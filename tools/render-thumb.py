"""Render a portrait studio thumbnail of a stele (turtle + bia) GLB using Blender.

Run inside Blender's background mode, driven by tools/render-thumbs.mjs:

    Blender --background --python render-thumb.py -- <in.glb> <out.png> [azimuth_deg] [elevation_deg]

- Clears the default startup scene.
- Imports the GLB (glTF is Y-up; Blender's importer converts to Blender's Z-up).
- Frames a camera in a 3/4 front view (azimuth, default 30 deg -- 0 means the
  camera sits on +Z looking at -Z, straight at the front face; positive azimuth
  moves the camera toward +X) looking slightly down (elevation, default 15 deg),
  fit so the object's projected bounds fill ~88% of the frame height (or width,
  whichever is the binding constraint), at 800x1000 (portrait) resolution.
  Fitting projects the 8 bbox corners through the camera and iterates the
  distance -- a bounding-sphere estimate hugely overframes an asymmetric
  turtle+stele silhouette (the sphere that encloses the whole diagonal is much
  bigger than what's actually visible from any one angle).
- Lights with a warm key + soft fill + cool rim, grey ~0.3 world, transparent film.
- Renders a PNG (RGBA, transparent background) to <out.png>.

One fixed azimuth/elevation now works for every model: prepare-models.mjs's bake
step rotates each model's geometry itself (slab thin-axis -> Z, inscribed front
-> +Z), so "front" always lands at the same world azimuth. (Earlier versions of
this pipeline used a per-model AZIMUTH_OVERRIDES map in render-thumbs.mjs to
compensate for inconsistent source orientations -- no longer needed.)
"""

import math
import sys

import bpy
import mathutils

RESOLUTION_X = 800
RESOLUTION_Y = 1000
TARGET_FILL = 0.88  # fraction of frame height (or width) the object's bounds should fill
FIT_ITERATIONS = 10
LENS_MM = 50.0
SENSOR_WIDTH_MM = 36.0
DEFAULT_AZIMUTH_DEG = 30.0
DEFAULT_ELEVATION_DEG = 15.0


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    if len(argv) < 2:
        raise SystemExit(
            "usage: Blender --background --python render-thumb.py -- <in.glb> <out.png> [azimuth_deg] [elevation_deg]"
        )
    in_glb = argv[0]
    out_png = argv[1]
    azimuth_deg = float(argv[2]) if len(argv) > 2 else DEFAULT_AZIMUTH_DEG
    elevation_deg = float(argv[3]) if len(argv) > 3 else DEFAULT_ELEVATION_DEG
    return in_glb, out_png, azimuth_deg, elevation_deg


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


def world_bounds(objects):
    minv = mathutils.Vector((math.inf, math.inf, math.inf))
    maxv = mathutils.Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        mat = obj.matrix_world
        for corner in obj.bound_box:
            world_co = mat @ mathutils.Vector(corner)
            minv.x = min(minv.x, world_co.x)
            minv.y = min(minv.y, world_co.y)
            minv.z = min(minv.z, world_co.z)
            maxv.x = max(maxv.x, world_co.x)
            maxv.y = max(maxv.y, world_co.y)
            maxv.z = max(maxv.z, world_co.z)
    return minv, maxv


def bbox_corners(minv, maxv):
    return [
        mathutils.Vector((x, y, z))
        for x in (minv.x, maxv.x)
        for y in (minv.y, maxv.y)
        for z in (minv.z, maxv.z)
    ]


def camera_pose(center, distance, azimuth_deg, elevation_deg):
    """Location + rotation (euler) + world matrix for a camera at `distance` from
    `center`, at the given azimuth/elevation, looking at `center`.

    Computed directly with mathutils rather than via a live bpy Object: setting
    obj.location/obj.rotation_euler does NOT synchronously update obj.matrix_world
    (that only happens on the next dependency-graph evaluation, e.g. before a
    render), so reading matrix_world back immediately during an iterative fit
    loop would return a stale value -- this sidesteps that entirely.
    """
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    offset = mathutils.Vector(
        (
            distance * math.cos(el) * math.sin(az),
            -distance * math.cos(el) * math.cos(az),
            distance * math.sin(el),
        )
    )
    loc = center + offset
    direction = center - loc
    rot_quat = direction.to_track_quat("-Z", "Y")
    matrix = rot_quat.to_matrix().to_4x4()
    matrix.translation = loc
    return loc, rot_quat.to_euler(), matrix


def projected_fill(cam_matrix, corners, tan_h, tan_v):
    """Fraction of the frame width/height the projected bbox corners span.

    Projects each corner into the camera's local space (camera looks down -Z,
    +Y up) and normalizes by the half-FOV tangent, so a value of 1.0 exactly
    reaches the frame edge. Returns (fill_x, fill_y) as fractions of the full
    frame width/height.
    """
    inv = cam_matrix.inverted()
    xs = []
    ys = []
    for corner in corners:
        p = inv @ corner
        depth = -p.z
        if depth <= 1e-6:
            depth = 1e-6  # corner behind/at the camera during an early iteration
        xs.append((p.x / depth) / tan_h)
        ys.append((p.y / depth) / tan_v)
    fill_x = (max(xs) - min(xs)) / 2.0
    fill_y = (max(ys) - min(ys)) / 2.0
    return fill_x, fill_y


def setup_camera(center, corners, azimuth_deg, elevation_deg, target_fill=TARGET_FILL):
    cam_data = bpy.data.cameras.new("ThumbCam")
    cam_data.lens = LENS_MM
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = SENSOR_WIDTH_MM
    cam_obj = bpy.data.objects.new("ThumbCam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    aspect = RESOLUTION_X / RESOLUTION_Y
    hfov = 2.0 * math.atan((SENSOR_WIDTH_MM / 2.0) / LENS_MM)
    vfov = 2.0 * math.atan(math.tan(hfov / 2.0) / aspect)
    tan_h = math.tan(hfov / 2.0)
    tan_v = math.tan(vfov / 2.0)

    radius = max((c - center).length for c in corners) or 1.0
    distance = radius * 4.0  # generous seed: keeps every corner in front of the camera

    fill = None
    loc = rot_euler = None
    for _ in range(FIT_ITERATIONS):
        loc, rot_euler, matrix = camera_pose(center, distance, azimuth_deg, elevation_deg)
        fill_x, fill_y = projected_fill(matrix, corners, tan_h, tan_v)
        fill = max(fill_x, fill_y)
        if fill <= 1e-6:
            break
        scale = fill / target_fill
        scale = max(0.3, min(scale, 3.0))  # damp step size for stable convergence
        distance = max(distance * scale, radius * 0.05)

    cam_obj.location = loc
    cam_obj.rotation_euler = rot_euler
    bpy.context.scene.camera = cam_obj
    return cam_obj, distance, fill


def add_light(name, kind, energy, color, azimuth_deg, elevation_deg, distance, center, size=None):
    light_data = bpy.data.lights.new(name, type=kind)
    light_data.energy = energy
    light_data.color = color
    if size is not None and hasattr(light_data, "size"):
        light_data.size = size
    light_obj = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light_obj)

    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    offset = mathutils.Vector(
        (
            distance * math.cos(el) * math.sin(az),
            -distance * math.cos(el) * math.cos(az),
            distance * math.sin(el),
        )
    )
    light_obj.location = center + offset
    direction = center - light_obj.location
    light_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return light_obj


def setup_lighting(center, radius, camera_azimuth_deg):
    light_distance = radius * 4.0
    # Warm key light, ~30 deg off camera azimuth, fairly high.
    add_light(
        "Key",
        "AREA",
        energy=max(300.0, radius * 400.0),
        color=(1.0, 0.90, 0.78),
        azimuth_deg=camera_azimuth_deg - 35.0,
        elevation_deg=45.0,
        distance=light_distance,
        center=center,
        size=radius * 2.0,
    )
    # Soft, cooler fill from the opposite side, low intensity.
    add_light(
        "Fill",
        "AREA",
        energy=max(80.0, radius * 100.0),
        color=(0.85, 0.90, 1.0),
        azimuth_deg=camera_azimuth_deg + 110.0,
        elevation_deg=25.0,
        distance=light_distance,
        center=center,
        size=radius * 3.0,
    )
    # Rim / back light for separation from the background.
    add_light(
        "Rim",
        "AREA",
        energy=max(150.0, radius * 200.0),
        color=(0.95, 0.97, 1.0),
        azimuth_deg=camera_azimuth_deg + 180.0,
        elevation_deg=55.0,
        distance=light_distance,
        center=center,
        size=radius * 1.5,
    )

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg is not None:
        bg.inputs[0].default_value = (0.3, 0.3, 0.3, 1.0)
        bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = world


def setup_render(out_png):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION_X
    scene.render.resolution_y = RESOLUTION_Y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = out_png
    try:
        scene.eevee.taa_render_samples = 64
    except AttributeError:
        pass


def main():
    in_glb, out_png, azimuth_deg, elevation_deg = parse_args()

    clear_scene()
    objects = import_glb(in_glb)
    if not objects:
        raise SystemExit(f"no mesh objects imported from {in_glb}")

    minv, maxv = world_bounds(objects)
    center = (minv + maxv) / 2.0
    half_size = (maxv - minv) / 2.0
    radius = half_size.length
    corners = bbox_corners(minv, maxv)

    _cam_obj, distance, fill = setup_camera(center, corners, azimuth_deg, elevation_deg)
    setup_lighting(center, radius, azimuth_deg)
    setup_render(out_png)

    bpy.ops.render.render(write_still=True)
    print(
        f"[render-thumb] wrote {out_png} (azimuth={azimuth_deg}, elevation={elevation_deg}, "
        f"distance={distance:.3f}, fill={fill:.3f}, target={TARGET_FILL})"
    )


if __name__ == "__main__":
    main()
