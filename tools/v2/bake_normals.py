"""Model pipeline v2: bake a tangent-space normal map from the high-res scan onto a low-poly LOD.

Run headless (driven by tools/v2/build.mjs), never against a GUI instance:

    Blender -b --factory-startup -P tools/v2/bake_normals.py -- \
        <high.glb> <low.glb> <out.png> <size> <extrusion> <max_ray> [samples] [margin] [threads]

Inputs are written by build.mjs in the SAME normalised space (stands on y=0, height 1, front +Z):
  * high.glb -- full-res source mesh, NORMAL = crease-smoothed normals (tools/smooth-normals.mjs logic),
                so the baked map reproduces exactly the shading chosen for the high-poly (not the scan's
                flat per-face normals, which are what looked like crumpled paper).
  * low.glb  -- the LOD geometry that ships (dequantised positions), NORMAL = its own smooth normals,
                TEXCOORD_0 = the UVs shared with the base colour.

Bake: Cycles, type NORMAL, tangent space (MikkTSpace from the low-poly's imported custom normals + UVs,
OpenGL +Y -- the glTF convention), selected-to-active, cage = low-poly inflated by <extrusion> along its
normals, rays limited to <max_ray> (so thin carving is reached but rays don't jump to neighbouring
surfaces), margin dilation in pixels. Output: 8-bit RGB PNG, non-colour, no dither.
"""

import sys
import time

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) < 6:
        raise SystemExit(__doc__)
    return {
        "high": argv[0],
        "low": argv[1],
        "out": argv[2],
        "size": int(argv[3]),
        "extrusion": float(argv[4]),
        "max_ray": float(argv[5]),
        "samples": int(argv[6]) if len(argv) > 6 else 8,
        "margin": int(argv[7]) if len(argv) > 7 else 16,
        "threads": int(argv[8]) if len(argv) > 8 else 0,
    }


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(coll):
            coll.remove(block)


def import_one(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, import_shading="NORMALS", merge_vertices=False)
    objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if len(objs) != 1:
        raise SystemExit(f"[bake] expected exactly one mesh in {path}, got {len(objs)}")
    obj = objs[0]
    obj.name = name
    return obj


def main():
    a = parse_args()
    t0 = time.time()
    clear_scene()
    high = import_one(a["high"], "HIGH")
    low = import_one(a["low"], "LOW")
    print(f"[bake] high faces={len(high.data.polygons)} low faces={len(low.data.polygons)} uv={len(low.data.uv_layers)}")
    if not low.data.uv_layers:
        raise SystemExit("[bake] low-poly has no UVs")

    img = bpy.data.images.new("NRM", width=a["size"], height=a["size"], alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    img.generated_color = (0.5, 0.5, 1.0, 1.0)

    mat = bpy.data.materials.new("BAKE")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    nodes.active = tex
    low.data.materials.clear()
    low.data.materials.append(mat)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = a["samples"]
    scene.cycles.use_denoising = False
    scene.cycles.seed = 0
    scene.render.dither_intensity = 0.0
    if a["threads"] > 0:
        scene.render.threads_mode = "FIXED"
        scene.render.threads = a["threads"]

    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.use_cage = False
    bake.cage_extrusion = a["extrusion"]
    bake.max_ray_distance = a["max_ray"]
    bake.margin = a["margin"]
    bake.margin_type = "ADJACENT_FACES"
    bake.normal_space = "TANGENT"
    bake.normal_r = "POS_X"
    bake.normal_g = "POS_Y"
    bake.normal_b = "POS_Z"
    bake.target = "IMAGE_TEXTURES"
    bake.use_clear = True

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low

    t1 = time.time()
    bpy.ops.object.bake(type="NORMAL")
    t2 = time.time()

    img.filepath_raw = a["out"]
    img.file_format = "PNG"
    scene.render.image_settings.color_depth = "8"
    img.save()
    print(
        f"[bake] done size={a['size']} samples={a['samples']} extrusion={a['extrusion']} max_ray={a['max_ray']} "
        f"margin={a['margin']} import={t1 - t0:.1f}s bake={t2 - t1:.1f}s -> {a['out']}"
    )


if __name__ == "__main__":
    main()
