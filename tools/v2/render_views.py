"""Render a model (GLB/glTF/OBJ) from several azimuths, textured, orthographic, for side-by-side identification.

    Blender -b --factory-startup -P tools/v2/render_views.py -- <model> <out_prefix> [az,az,...] [WxH] [up_axis] [ux,uy,uz]

[ux,uy,uz] (optional): the scan's real "up" in the FILE's own coordinates (e.g. from a ground-plane fit of a raw,
tilted photogrammetry OBJ); the model is rotated so that this vector points up before framing.

Normalises nothing in the file; the camera frames the world bounding box (Blender Z-up after import). Azimuth 0 looks
from +Y_blender... i.e. from glTF +Z (the v2 "front"); positive azimuth rotates the camera towards +X. Workbench,
studio light, texture colour -> fast and faithful to the albedo. Output: <out_prefix>_az<deg>.png
"""

import math
import sys

import bpy
import mathutils


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    model, prefix = argv[0], argv[1]
    azs = [float(a) for a in (argv[2] if len(argv) > 2 else "0,90,180,270").split(",")]
    w, h = (int(x) for x in (argv[3] if len(argv) > 3 else "360x480").split("x"))
    up = argv[4] if len(argv) > 4 else "Y"
    file_up = [float(x) for x in argv[5].split(",")] if len(argv) > 5 and argv[5] else None
    frame_turtle = len(argv) > 6 and argv[6] == "turtle"  # khung chỉ phần rùa (dưới) — so hình rùa giữa các bản

    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    if model.lower().endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=model, up_axis=up, forward_axis="NEGATIVE_Z" if up == "Y" else "Y")
    else:
        bpy.ops.import_scene.gltf(filepath=model)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if file_up:
        # file Y-up (x, y, z) -> Blender (x, -z, y)
        u = mathutils.Vector((file_up[0], -file_up[2], file_up[1])).normalized()
        rot = u.rotation_difference(mathutils.Vector((0, 0, 1))).to_matrix().to_4x4()
        for o in meshes:
            o.matrix_world = rot @ o.matrix_world
        bpy.context.view_layer.update()
    lo = mathutils.Vector((1e30, 1e30, 1e30))
    hi = mathutils.Vector((-1e30, -1e30, -1e30))
    for o in meshes:
        for c in o.bound_box:
            p = o.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector(map(min, lo, p))
            hi = mathutils.Vector(map(max, hi, p))
    center = (lo + hi) / 2
    size = hi - lo
    print(f"[views] {model}: meshes={len(meshes)} faces={sum(len(o.data.polygons) for o in meshes)} size={tuple(round(s, 4) for s in size)}")

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_cavity = False
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.film_transparent = True
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    horiz = max(size.x, size.y)
    cam_data.ortho_scale = 1.08 * max(size.z * w / h, horiz)
    if frame_turtle:
        cam_data.ortho_scale = 1.08 * horiz
        center = mathutils.Vector((center.x, center.y, lo.z + 0.3 * horiz * h / w))
    dist = 4 * max(size)
    cam_data.clip_start = dist * 0.01
    cam_data.clip_end = dist * 3
    for az in azs:
        a = math.radians(az)
        # glTF +Z (front) == Blender -Y after import; camera on that side looking back at the centre
        d = mathutils.Vector((math.sin(a), -math.cos(a), 0.0))
        cam.location = center + d * dist
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = f"{prefix}_az{int(az)}.png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
