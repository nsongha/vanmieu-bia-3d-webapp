"""Pre-decimate a high-poly source GLB with Blender's Decimate modifier.

meshoptimizer's simplify() operates on the exact glTF vertex topology, where
every UV/normal seam is a split vertex -- on a mesh split almost everywhere
(e.g. bia-1463: 2.1M welded vertices for 1.08M triangles) it can barely find
a valid interior edge to collapse, regardless of the error budget given (see
prepare-models.mjs's SIMPLIFY_OVERRIDES comment: even error=0.4 changed
nothing). Blender's Decimate modifier (type COLLAPSE) instead operates on the
underlying mesh topology in edit-mesh terms, so those seams don't block it.

Run inside Blender's background mode, driven by tools/prepare-models.mjs
(PRE_DECIMATE map):

    Blender --background --python predecimate.py -- <in.glb> <out.glb> <ratio>

- Imports the source GLB.
- Merges near-coincident vertices by position (bmesh remove_doubles) on every
  mesh object first. These scans are exported with almost every vertex split
  (e.g. bia-1463: 2.1M vertices for 1.08M triangles -- UV/normal seams
  everywhere), and feeding that straight into Decimate produced a mesh full of
  z-fighting-like speckle/holes once rendered (confirmed by testing: skipping
  this step is what caused it; merging first fixes it completely).
- Adds a Decimate (COLLAPSE) modifier to every mesh object, at `ratio`, with
  use_collapse_triangulate=True, and bakes it into the mesh data (via the
  evaluated depsgraph mesh, which is robust in background mode -- the
  modifier_apply operator needs an active object in Object mode and a bit of
  context poking that's fragile headless).
- Exports a GLB to <out.glb>: no Draco, no animations/cameras/lights, textures
  kept as-is (export_image_format='AUTO'), transforms baked (export_apply=True).

The output is an intermediate for the normal prepare-models.mjs pipeline to
read next (dedup -> prune -> weld -> simplify -> bake -> compress), not a
final asset itself.
"""

import sys

import bmesh
import bpy

MERGE_DISTANCE_FACTOR = 1e-5  # merge-by-distance threshold, relative to each object's bbox diagonal


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    if len(argv) < 3:
        raise SystemExit("usage: Blender --background --python predecimate.py -- <in.glb> <out.glb> <ratio>")
    in_glb = argv[0]
    out_glb = argv[1]
    ratio = float(argv[2])
    return in_glb, out_glb, ratio


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block_coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.materials, bpy.data.images, bpy.data.worlds):
        for block in list(block_coll):
            if block.users == 0:
                block_coll.remove(block)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.selected_objects if o.type == "MESH"]


def face_count(objects):
    return sum(len(o.data.polygons) for o in objects)


def merge_by_distance(obj):
    """Merge vertices that are coincident (or near enough) in position only,
    ignoring UV/normal splits, so Decimate has real interior edges to collapse.
    Distance is relative to the object's own bbox diagonal so this scales
    sanely across models authored at very different raw sizes.
    """
    diag = obj.dimensions.length or 1.0
    dist = diag * MERGE_DISTANCE_FACTOR

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    after = len(bm.verts)
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    return before, after, dist


def decimate_and_apply(objects, ratio):
    for obj in objects:
        before_v, after_v, dist = merge_by_distance(obj)
        print(f"[predecimate]   {obj.name}: merge-by-distance (d={dist:.6g}) verts {before_v} -> {after_v}")

        mod = obj.modifiers.new(name="PreDecimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True

        # Bake the modifier into the mesh data via the evaluated (post-modifier)
        # mesh, rather than the modifier_apply operator: the operator needs the
        # object active, in Object mode, with a real context, which is fragile
        # in --background mode. Reading the evaluated depsgraph mesh sidesteps
        # all of that and is exactly what "apply" means here.
        #
        # The depsgraph handle MUST be (re-)fetched after the modifier is added
        # (and per object): a handle obtained earlier does not automatically see
        # later scene edits without an explicit update, so reusing one grabbed
        # before the modifier existed silently evaluates the pre-modifier mesh
        # (this bit us once already -- first attempt reported "faces X -> X").
        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = obj.evaluated_get(depsgraph)
        new_mesh = bpy.data.meshes.new_from_object(eval_obj)
        old_mesh = obj.data
        obj.modifiers.clear()
        obj.data = new_mesh
        if old_mesh.users == 0:
            bpy.data.meshes.remove(old_mesh)


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_image_format="AUTO",  # keep textures as-is
        export_apply=True,  # bake remaining object transforms
        use_selection=False,
        export_draco_mesh_compression_enable=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_skins=False,
        export_morph=False,
    )


def main():
    in_glb, out_glb, ratio = parse_args()

    clear_scene()
    objects = import_glb(in_glb)
    if not objects:
        raise SystemExit(f"no mesh objects imported from {in_glb}")

    before = face_count(objects)
    decimate_and_apply(objects, ratio)
    after = face_count(objects)

    export_glb(out_glb)
    print(f"[predecimate] {in_glb} -> {out_glb} ratio={ratio} faces {before} -> {after}")


if __name__ == "__main__":
    main()
