"""
着がえの「髪型」のボタンに出す絵（髪型ごとに1枚）をブレンダーで作る。

使い方（先に build_avatar.py を動かして tools/blender/avatar.blend を作っておく）:
    blender -b --factory-startup -P tools/blender/render_hair_icons.py

できるもの: public/img/hair/<髪型>.png（192x192・背景は透明）
顔は描かない（形だけを見せる）。色は こげ茶 に そろえる。
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLEND = os.path.join(ROOT, "tools", "blender", "avatar.blend")
OUT = os.path.join(ROOT, "public", "img", "hair")

# build_avatar.py と同じ頭の大きさ
R = 0.29
HX, HY, HZ = R * 1.08, R * 1.0, R * 0.95
HEAD_Z = 0.86
STYLES = ["model", "spiky", "side", "wavy", "curly", "bob", "long", "ponytail", "twin", "bun"]


def material(name, rgb, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    return m


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 32
    sc.render.film_transparent = True
    sc.render.resolution_x = 192
    sc.render.resolution_y = 192
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"

    hair_m = material("hair", (0.13, 0.06, 0.032), 0.5)
    skin_m = material("skin", (0.42, 0.24, 0.14), 0.7)
    body_m = material("body", (0.22, 0.25, 0.3), 0.8)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=1.0, location=(0, 0, HEAD_Z))
    head = bpy.context.object
    head.scale = (HX, HY, HZ)
    bpy.ops.object.shade_smooth()
    head.data.materials.append(skin_m)

    hairs = {}
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob is head:
            continue
        if ob.name.startswith("ear_"):
            ob.data.materials.clear()
            ob.data.materials.append(skin_m)
            continue
        if ob.name == "top_torso":
            # 肩まで見せる（長い髪の内がわが見えないように）
            ob.data.materials.clear()
            ob.data.materials.append(body_m)
            continue
        if ob.name.startswith("hair_") or ob.name == "acc_hairTie":
            ob.data.materials.clear()
            ob.data.materials.append(hair_m)
            hairs[ob.name] = ob
        ob.hide_render = True

    # カメラ（正面から少し右・少し上。どの髪型も同じ わくに入れる）
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 0.98
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    yaw, pitch, dist = 0.3, 0.12, 4.0
    target = Vector((0, 0, HEAD_Z - 0.07))
    cam.location = target + Vector(
        (math.sin(yaw) * math.cos(pitch) * dist, -math.cos(yaw) * math.cos(pitch) * dist, math.sin(pitch) * dist)
    )
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

    # あかり（前の上から やわらかく・まわりは明るめ）
    for name, loc, energy, size in (("key", (0.8, -2.2, 2.4), 110, 2.5), ("fill", (-1.6, -1.4, 1.0), 35, 3.0),
                                     ("rim", (0.0, 2.0, 2.0), 60, 2.0)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, HEAD_Z)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.55, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    sc.world = world

    os.makedirs(OUT, exist_ok=True)
    for st in STYLES:
        for name, ob in hairs.items():
            ob.hide_render = not (name == f"hair_{st}" or (st == "ponytail" and name == "acc_hairTie"))
        sc.render.filepath = os.path.join(OUT, f"{st}.png")
        bpy.ops.render.render(write_still=True)
        print("HAIR_ICON", st)


if __name__ == "__main__":
    main()
    sys.exit(0)
