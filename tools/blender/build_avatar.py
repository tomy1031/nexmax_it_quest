"""
アバターの部品をブレンダーで作る（体のシルエット・服・髪型）。

使い方（画面なしで動かす）:
    blender -b --factory-startup -P tools/blender/build_avatar.py

できるもの:
    tools/blender/avatar.blend        … ブレンダーで開いて見るためのファイル（コミットしない。直すときはこのスクリプトを直す）
    public/models/avatar/avatar.glb   … アプリが読むファイル

決まり（アプリの src/three/avatar-parts.ts と合わせる）:
- 正面は -Y（glTF に書き出すと +Z）。上は +Z（glTF では +Y）。足の下が z=0。大きさは 168cm の人で 約1.15m。
- 部品の名前で、アプリが色を決める（top_ は上着の色・bottom_ はズボン／スカートの色・skin_ ははだ・hair_ は髪 など。
  一覧は ROLE にある）。部品は色ごとに分けて作る（1つの部品に1色）。
- 腕・足は、付け根（肩・股）が部品の原点。アプリはここを中心に回して歩かせる。
- 頭（顔の絵を貼る球）はアプリが作る。ここでは髪を合わせるための大きさ（HEAD）だけを使う。
- 参考にしたのは頭身とやわらかさだけ（大きな頭・短い手足・まるい形）。特定のゲームのキャラはまねない。
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_GLB = os.path.join(ROOT, "public", "models", "avatar", "avatar.glb")
OUT_BLEND = os.path.join(ROOT, "tools", "blender", "avatar.blend")

# 頭（アプリの球と同じ）。半径 R、横 1.08 倍・たて 0.95 倍。中心の高さ HEAD_Z
R = 0.29
HX, HY, HZ = R * 1.08, R * 1.0, R * 0.95
HEAD_Z = 0.86
SHOULDER = (0.155, 0.555)  # (x, z)
HIP = (0.062, 0.3)


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- 道具


def new_obj(name, bm, location=(0, 0, 0), subdiv=1):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = location
    bpy.context.scene.collection.objects.link(ob)
    if subdiv:
        m = ob.modifiers.new("subdiv", "SUBSURF")
        m.levels = subdiv
        m.render_levels = subdiv
    return ob


def lathe(name, profile, seg=28, sx=1.0, sy=1.0, origin=(0, 0, 0), offset=(0, 0), subdiv=1):
    """回転体。profile は下から上へ (半径, 高さ)。半径 0 の点は とがり（極）にする。
    sx, sy は横・奥行きの倍率。offset は回転の軸の位置 (x, y)。origin は部品の原点（世界の座標）。"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((offset[0] - origin[0], offset[1] - origin[1], z - origin[2]))])
            continue
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append(
                bm.verts.new(
                    (
                        offset[0] + r * math.cos(a) * sx - origin[0],
                        offset[1] + r * math.sin(a) * sy - origin[1],
                        z - origin[2],
                    )
                )
            )
        rings.append(ring)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(seg):
                bm.faces.new((a[0], b[(i + 1) % seg], b[i]))
        elif len(b) == 1:
            for i in range(seg):
                bm.faces.new((a[i], a[(i + 1) % seg], b[0]))
        else:
            for i in range(seg):
                j = (i + 1) % seg
                bm.faces.new((a[i], a[j], b[j], b[i]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, location=origin, subdiv=subdiv)


def ellipsoid(name, center, radii, seg=24, rings=16, origin=None, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    o = origin or center
    for v in bm.verts:
        v.co = Vector(
            (
                v.co.x * radii[0] + center[0] - o[0],
                v.co.y * radii[1] + center[1] - o[1],
                v.co.z * radii[2] + center[2] - o[2],
            )
        )
    return new_obj(name, bm, location=o, subdiv=subdiv)


def join(name, objs):
    """部品を1つにまとめる（同じ色の部品）。モディファイアは先に適用する。"""
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def empty(name, loc):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- 体


def build_body():
    hz = HIP[1]
    # 胴（上着）。どの服も この形の上に色をぬる。肩はなで肩・おなかは まるい
    torso = [
        (0.0, hz - 0.01),
        (0.118, hz),
        (0.128, hz + 0.06),
        (0.135, hz + 0.13),
        (0.138, hz + 0.19),
        (0.125, hz + 0.25),
        (0.085, hz + 0.29),
        (0.0, hz + 0.31),
    ]
    lathe("top_torso", torso, sy=0.82)
    # 女性の胴: 肩を少し せまく、こしを少し細く（むね・えりの所は男性と同じ太さにして、えり・ネクタイを合わせる）
    torso_f = [
        (0.0, hz - 0.01),
        (0.112, hz),
        (0.116, hz + 0.05),
        (0.126, hz + 0.12),
        (0.136, hz + 0.19),
        (0.12, hz + 0.25),
        (0.08, hz + 0.29),
        (0.0, hz + 0.31),
    ]
    lathe("top_torsoF", torso_f, sy=0.82)
    # スーツ: すそが少し ひろがる上着の下の部分
    lathe(
        "top_suitHem",
        [(0.13, hz - 0.03), (0.142, hz + 0.0), (0.14, hz + 0.06), (0.0001, hz + 0.06)],
        sy=0.84,
    )
    # シャツの V（スーツ）・ネクタイ・リボン・えり
    bm = bmesh.new()
    zf = -0.112
    pts = [(-0.05, hz + 0.27), (0.05, hz + 0.27), (0.0, hz + 0.15)]
    vs = [bm.verts.new((x, zf, z)) for x, z in pts]
    vs2 = [bm.verts.new((x, zf + 0.012, z)) for x, z in pts]
    bm.faces.new(vs)
    bm.faces.new(list(reversed(vs2)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs[i], vs2[i], vs2[j], vs[j]))
    new_obj("shirt_suitV", bm, subdiv=0)
    lathe("tie_suitTie", [(0.0, hz + 0.1), (0.02, hz + 0.12), (0.016, hz + 0.23), (0.012, hz + 0.26), (0.0, hz + 0.27)],
          seg=4, sx=1.0, sy=0.35, offset=(0, -0.118), subdiv=0)
    ribbon = [
        ellipsoid("tie_ribbonL", (-0.028, -0.124, hz + 0.255), (0.026, 0.012, 0.017), subdiv=0),
        ellipsoid("tie_ribbonR", (0.028, -0.124, hz + 0.255), (0.026, 0.012, 0.017), subdiv=0),
        ellipsoid("tie_ribbonK", (0.0, -0.128, hz + 0.255), (0.011, 0.012, 0.012), subdiv=0),
    ]
    join("tie_suitRibbon", ribbon)
    lapel = []
    for sx in (-1, 1):
        bm = bmesh.new()
        p = [(sx * 0.052, hz + 0.272), (sx * 0.018, hz + 0.19), (sx * 0.06, hz + 0.13)]
        vs = [bm.verts.new((x, -0.116, z)) for x, z in p]
        vs2 = [bm.verts.new((x, -0.122, z)) for x, z in p]
        bm.faces.new(vs)
        bm.faces.new(list(reversed(vs2)))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new((vs[i], vs2[i], vs2[j], vs[j]))
        lapel.append(new_obj("dark_lapel", bm, subdiv=0))
    join("dark_suitLapel", lapel)
    # パーカー: フード・ポケット・ひも
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=0.1, radius2=0.1, depth=0.01)
    bm.free()
    hood = ellipsoid("top_hoodieHood", (0.0, 0.06, hz + 0.285), (0.12, 0.08, 0.06))
    pocket = ellipsoid("dark_hoodiePocket", (0.0, -0.105, hz + 0.08), (0.075, 0.03, 0.04), subdiv=1)
    strings = [
        lathe("white_s1", [(0.0, hz + 0.18), (0.006, hz + 0.19), (0.006, hz + 0.26), (0.0, hz + 0.27)], seg=6,
              offset=(-0.03, -0.112), subdiv=0),
        lathe("white_s2", [(0.0, hz + 0.18), (0.006, hz + 0.19), (0.006, hz + 0.26), (0.0, hz + 0.27)], seg=6,
              offset=(0.03, -0.112), subdiv=0),
    ]
    join("white_hoodieStrings", strings)
    _ = (hood, pocket)
    # リュック
    pack = [
        ellipsoid("pack1", (0.0, 0.15, hz + 0.16), (0.12, 0.06, 0.13)),
        ellipsoid("pack2", (0.0, 0.2, hz + 0.1), (0.09, 0.03, 0.06)),
    ]
    for sx in (-1, 1):
        pack.append(
            lathe(
                "strap",
                [(0.0, hz + 0.08), (0.016, hz + 0.09), (0.016, hz + 0.27), (0.0, hz + 0.28)],
                seg=6,
                sx=1.0,
                sy=0.6,
                offset=(sx * 0.1, -0.095),
                subdiv=0,
            )
        )
    join("bag_backpack", pack)

    # 下: ズボンのこし・スカート
    lathe(
        "bottom_hips",
        [(0.0, hz - 0.06), (0.1, hz - 0.055), (0.12, hz - 0.01), (0.119, hz + 0.03), (0.0, hz + 0.035)],
        sy=0.82,
    )
    lathe(
        "bottom_skirt",
        [(0.0, hz + 0.05), (0.125, hz + 0.05), (0.15, hz - 0.03), (0.175, hz - 0.13), (0.178, hz - 0.145), (0.0, hz - 0.145)],
        sy=0.86,
    )

    # 足（股が原点）。ズボンの足・はだかストッキングの足は同じ形で、色だけ変える
    for side, sx in (("L", 1), ("R", -1)):
        origin = (sx * HIP[0], 0, HIP[1])
        lathe(
            f"leg_{side}",
            [(0.0, 0.035), (0.05, 0.04), (0.052, 0.14), (0.055, hz - 0.03), (0.0, hz - 0.01)],
            seg=20,
            offset=(sx * HIP[0], 0.0),
            origin=origin,
        )
        # くつ（前が まるく ながい）
        ellipsoid(f"shoe_{side}", (sx * HIP[0], -0.022, 0.035), (0.058, 0.085, 0.042), origin=origin)

    # 腕（肩が原点）。そで・手（ミトン）・カフス（スーツのシャツ）
    for side, sx in (("L", 1), ("R", -1)):
        origin = (sx * SHOULDER[0], 0, SHOULDER[1])
        x = sx * (SHOULDER[0] + 0.01)
        lathe(
            f"sleeve_{side}",
            [(0.0, SHOULDER[1] - 0.17), (0.04, SHOULDER[1] - 0.165), (0.044, SHOULDER[1] - 0.05),
             (0.046, SHOULDER[1]), (0.0, SHOULDER[1] + 0.03)],
            seg=18,
            offset=(x, 0.0),
            origin=origin,
        )
        lathe(
            f"cuff_{side}",
            [(0.0, SHOULDER[1] - 0.175), (0.041, SHOULDER[1] - 0.172), (0.041, SHOULDER[1] - 0.15), (0.0, SHOULDER[1] - 0.148)],
            seg=18,
            offset=(x, 0.0),
            origin=origin,
            subdiv=0,
        )
        ellipsoid(f"hand_{side}", (x, -0.005, SHOULDER[1] - 0.205), (0.045, 0.042, 0.05), origin=origin)

    # 耳
    for side, sx in (("L", 1), ("R", -1)):
        ellipsoid(f"ear_{side}", (sx * HX * 0.99, 0.01, HEAD_Z - 0.03), (0.024, 0.04, 0.045))

    # めがね
    gl = []
    for sx in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, segments=20, radius=0.046)
        bm.free()
        ring = bpy.data.objects.new("ring", bpy.data.meshes.new("ring"))
        bpy.context.scene.collection.objects.link(ring)
        bm = bmesh.new()
        mat = None
        _ = mat
        major, minor = 0.046, 0.006
        rings_ = []
        for i in range(20):
            a = 2 * math.pi * i / 20
            ringv = []
            for k in range(8):
                b = 2 * math.pi * k / 8
                rr = major + minor * math.cos(b)
                ringv.append(bm.verts.new((sx * 0.088 + rr * math.cos(a), -HY * 0.98 + minor * math.sin(b), HEAD_Z - 0.045 + rr * math.sin(a))))
            rings_.append(ringv)
        for i in range(20):
            for k in range(8):
                bm.faces.new((rings_[i][k], rings_[(i + 1) % 20][k], rings_[(i + 1) % 20][(k + 1) % 8], rings_[i][(k + 1) % 8]))
        bm.to_mesh(ring.data)
        bm.free()
        gl.append(ring)
    join("glasses_frame", gl)


# ---------------------------------------------------------------- 髪


def fringe_tips(phi, n, width, base, amp, sharp=1.5, shift=0.0):
    """前髪の毛先。phi=0 が正面。毛先の数 n が width ラジアンの はばに並ぶ。下へ amp だけ のびる。"""
    if abs(phi) > width:
        return base
    t = (phi + width + shift) / (2 * width) * n
    w = 0.5 - 0.5 * math.cos(2 * math.pi * t)  # 0..1（0 が毛先）
    return base - amp * (1 - w) ** sharp


def boundary(phi, front, side, back, a1=0.95, a2=1.55, a3=2.3):
    """髪の下のはし（単位球の z）。正面 front(phi)・横 side・後ろ back を なめらかに つなぐ。"""
    p = abs(phi)
    if p <= a1:
        return front(phi)
    if p <= a2:
        return lerp(front(math.copysign(a1, phi)), side, smoothstep(a1, a2, p))
    if p <= a3:
        return lerp(side, back, smoothstep(a2, a3, p))
    return back


def hair_shell(name, front, side, back, volume, res=(88, 60), edge=0.05):
    """頭をおおう髪のから。おおわない所（顔）は頭の中へ しまう。volume は ふくらみ（1 で頭の表面）。"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=res[0], v_segments=res[1], radius=1.0)
    for v in bm.verts:
        d = v.co.normalized()
        x, y, z = d.x, d.y, d.z
        phi = math.atan2(x, -y)
        b = boundary(phi, front, side, back)
        c = smoothstep(b - edge, b + edge * 0.4, z)
        k = lerp(0.9, volume(phi, z), c)
        v.co = Vector((x * HX * k, y * HY * k, z * HZ * k + HEAD_Z))
    # 顔の前の、頭の中に しまった所は消す（見えない三角を減らす）
    hidden = [f for f in bm.faces if all((vv.co - Vector((0, 0, HEAD_Z))).length < R * 0.93 for vv in f.verts)]
    bmesh.ops.delete(bm, geom=hidden, context="FACES")
    ob = new_obj(name, bm, location=(0, 0, 0), subdiv=1)
    return ob


def surf(theta, phi, k=1.0):
    """頭の表面の点。theta は真上から（ラジアン）、phi は正面から右まわり（+x の側が正）。"""
    return Vector(
        (
            HX * k * math.sin(theta) * math.sin(phi),
            -HY * k * math.sin(theta) * math.cos(phi),
            HEAD_Z + HZ * k * math.cos(theta),
        )
    )


def oriented(name, center, axes, radii, kind="ellipsoid", seg=16):
    """向きを決めた だ円体（kind="cone" なら とがった形）。axes は (横, 長さの向き, 外向き)。"""
    bm = bmesh.new()
    if kind == "cone":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=1.0, radius2=0.0, depth=1.0)
        for v in bm.verts:
            v.co.z += 0.5
    else:
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg * 2 // 3), radius=1.0)
    ax, ay, az = axes
    for v in bm.verts:
        p = v.co.copy()
        if kind == "cone":
            # 円すいは z が長さの向き
            w = ax * (p.x * radii[0]) + az * (p.y * radii[2]) + ay * (p.z * radii[1])
        else:
            w = ax * (p.x * radii[0]) + ay * (p.z * radii[1]) + az * (p.y * radii[2])
        v.co = w + center
    return new_obj(name, bm, subdiv=1 if kind != "cone" else 0)


def lock(theta, phi, length, width, thick=0.45, twist=0.0, out=0.0, kind="ellipsoid"):
    """頭の表面から垂れる毛束。twist は毛束を横へ かたむける角度、out は毛先を外へ はねる量。"""
    p0 = surf(theta, phi, 1.06)
    n = (surf(theta, phi) - Vector((0, 0, HEAD_Z))).normalized()
    down = (surf(theta + 0.05, phi) - surf(theta, phi)).normalized()
    side = down.cross(n).normalized()
    if twist:
        c, s_ = math.cos(twist), math.sin(twist)
        down, side = (down * c + side * s_).normalized(), (side * c - down * s_).normalized()
    if out:
        down = (down + n * out).normalized()
    center = p0 + down * length * 0.55
    return oriented("lock", center, (side, down, n), (width, length, width * thick), kind)


def finish_hair(name, parts, shine=True):
    """毛束を1つにまとめ、つやの帯（頭の上のまわりが明るい）を頂点の色で入れる。"""
    ob = join(name, parts) if len(parts) > 1 else parts[0]
    if len(parts) == 1:
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        ob.name = name
        ob.data.name = name
    me = ob.data
    attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    hc = Vector((0, 0, HEAD_Z))
    for i, v in enumerate(me.vertices):
        d = (Vector(v.co) + ob.location - hc).normalized()
        band = smoothstep(0.5, 0.62, d.z) * (1 - smoothstep(0.74, 0.86, d.z)) if shine else 0.0
        front = 0.6 + 0.4 * max(0.0, -d.y)
        val = 0.8 + 0.2 * band * front
        attr.data[i].color = (val, val, val, 1.0)
    me.color_attributes.active_color = attr
    return ob


def base_volume(top=0.14, side=0.05, base=1.16):
    def vol(phi, z):
        return base + top * max(0.0, z) ** 1.1 + side * (1 - abs(z))

    return vol


def fringe(theta=0.56, n=5, spread=0.95, length=0.13, width=0.075, out=0.0, kind="ellipsoid", twist=0.0):
    """前髪（毛束を左右に並べる）。"""
    res = []
    for i in range(n):
        t = (i / (n - 1)) * 2 - 1 if n > 1 else 0
        phi = t * spread
        res.append(lock(theta + 0.04 * abs(t), phi, length * (1 - 0.15 * abs(t)), width, twist=twist * (1 if t >= 0 else 1), out=out, kind=kind))
    return res


def hair_styles():
    hi = 0.55  # から（髪の土台）の前のはし。前髪の毛束の うしろに かくれる高さ
    # みじかい（耳を出す・まるい前髪）
    shell = hair_shell("hair_model", lambda p: hi, side=0.1, back=-0.5, volume=base_volume())
    finish_hair("hair_model", [shell] + fringe(0.62, 5, 1.0, 0.17, 0.105))
    # つんつん（上に はねる とがった毛・とがった前髪）
    shell = hair_shell("hair_spiky", lambda p: hi, 0.12, -0.45, base_volume(0.1))
    spikes = []
    for i in range(9):
        th = 0.12 + (i % 2) * 0.2
        ph = -2.4 + i * 0.6
        # 上へ はねる毛（頭の上の方だけ）
        spikes.append(lock(th, ph, 0.12, 0.06, thick=0.7, out=1.6, kind="cone"))
    finish_hair("hair_spiky", [shell] + spikes + fringe(0.62, 6, 1.0, 0.17, 0.07, out=0.1, kind="cone"))
    # よこわけ（右で分けて、左へ大きく流す）
    shell = hair_shell("hair_side", lambda p: hi, 0.1, -0.5, base_volume(0.14))
    sweep = [
        lock(0.45, 0.4, 0.24, 0.13, twist=0.9),
        lock(0.55, -0.1, 0.22, 0.12, twist=0.8),
        lock(0.66, -0.65, 0.18, 0.1, twist=0.5),
        lock(0.8, -1.1, 0.14, 0.08, twist=0.2),
        lock(0.74, 0.95, 0.12, 0.07),
    ]
    finish_hair("hair_side", [shell] + sweep)
    # ふわふわ（大きく ふくらんだ くせ毛。毛先が外へ はねる）
    shell = hair_shell("hair_wavy", lambda p: hi, 0.0, -0.55, base_volume(0.16, 0.07, 1.17))
    flips = [lock(1.3, ph, 0.1, 0.075, out=0.35) for ph in (-2.6, -2.0, 2.0, 2.6, 3.14)]
    finish_hair("hair_wavy", [shell] + flips + fringe(0.6, 5, 1.0, 0.17, 0.1, out=0.2, twist=0.3))
    # くるくる（まるい まき毛が たくさん）
    shell = hair_shell("hair_curly", lambda p: hi, 0.05, -0.45, base_volume(0.08, 0.04, 1.1))
    curls = []
    for ring, (th, n) in enumerate(((0.12, 5), (0.42, 10), (0.72, 13), (1.02, 12))):
        for i in range(n):
            ph = (i / n) * 2 * math.pi + ring * 0.3 - math.pi
            if th > 0.6 and abs(ph) < 0.75:
                continue
            c = surf(th, ph, 1.12)
            curls.append(ellipsoid("curl", (c.x, c.y, c.z), (0.068, 0.068, 0.068)))
    finish_hair("hair_curly", [shell] + curls + fringe(0.66, 5, 0.9, 0.11, 0.08))
    # ボブ（あごの横まで。下が内まき）
    def bob_vol(p, z):
        return base_volume(0.1, 0.02)(p, z) + 0.1 * smoothstep(0.3, -0.45, z) - 0.07 * smoothstep(-0.55, -0.72, z)

    shell = hair_shell("hair_bob", lambda p: hi, -0.62, -0.68, bob_vol)
    finish_hair("hair_bob", [shell] + fringe(0.62, 6, 1.05, 0.17, 0.09))
    # ながい（ボブ＋背中へ のびる髪）
    shell = hair_shell("hair_long", lambda p: hi, -0.7, -0.75, bob_vol)
    back = lathe(
        "longBack",
        [(0.0, HEAD_Z - 0.5), (0.17, HEAD_Z - 0.46), (0.22, HEAD_Z - 0.25), (0.26, HEAD_Z - 0.05), (0.0, HEAD_Z + 0.08)],
        sx=1.05,
        sy=0.5,
        offset=(0.0, 0.12),
    )
    finish_hair("hair_long", [shell, back] + fringe(0.62, 6, 1.05, 0.17, 0.09))
    # ポニーテール（後ろの上で むすぶ）
    shell = hair_shell("hair_ponytail", lambda p: hi, 0.0, -0.35, base_volume(0.08, 0.02))
    tail = lathe(
        "pt",
        [(0.0, HEAD_Z - 0.44), (0.045, HEAD_Z - 0.38), (0.08, HEAD_Z - 0.2), (0.075, HEAD_Z - 0.02), (0.05, HEAD_Z + 0.07), (0.0, HEAD_Z + 0.11)],
        sx=1.0,
        sy=0.85,
        offset=(0.0, HY * 1.18),
    )
    tie = ellipsoid("pt_tie", (0.0, HY * 1.05, HEAD_Z + 0.1), (0.045, 0.035, 0.032))
    tie.name = "acc_hairTie"
    finish_hair("hair_ponytail", [shell, tail] + fringe(0.62, 5, 1.0, 0.16, 0.1))
    # ツインテール
    shell = hair_shell("hair_twin", lambda p: hi, 0.0, -0.4, base_volume(0.08, 0.02))
    tails = [shell]
    for sx in (-1, 1):
        tails.append(
            lathe(
                "tt",
                [(0.0, HEAD_Z - 0.38), (0.045, HEAD_Z - 0.32), (0.075, HEAD_Z - 0.15), (0.065, HEAD_Z + 0.02), (0.0, HEAD_Z + 0.08)],
                offset=(sx * HX * 1.12, HY * 0.3),
            )
        )
    finish_hair("hair_twin", tails + fringe(0.62, 5, 1.0, 0.16, 0.1))
    # おだんご（頭の上に まるい だんご）
    shell = hair_shell("hair_bun", lambda p: hi, 0.02, -0.4, base_volume(0.08, 0.02))
    bun = ellipsoid("bun", (0.0, HY * 0.35, HEAD_Z + HZ * 1.08), (0.11, 0.105, 0.1))
    side_l = [lock(1.0, sx * 1.2, 0.13, 0.04) for sx in (-1, 1)]
    finish_hair("hair_bun", [shell, bun] + side_l + fringe(0.62, 5, 1.0, 0.16, 0.1))

    # 髪のかざり（花・リボン）。右の耳の上
    c = surf(0.85, 1.05, 1.17)
    n = (surf(0.85, 1.05) - Vector((0, 0, HEAD_Z))).normalized()
    up = (Vector((0, 0, 1)) - n * n.z).normalized()
    side = up.cross(n)
    petals = []
    for i in range(5):
        a = 2 * math.pi * i / 5
        pc = c + up * (math.cos(a) * 0.033) + side * (math.sin(a) * 0.033)
        petals.append(oriented("petal", pc, (side, up, n), (0.024, 0.03, 0.012)))
    join("acc_flowerPetals", petals)
    cc = c + n * 0.01
    ellipsoid("acc_flowerCenter", (cc.x, cc.y, cc.z), (0.016, 0.016, 0.016))
    c2 = surf(0.42, 0.7, 1.2)
    rib = [
        ellipsoid("r1", (c2.x - 0.04, c2.y, c2.z), (0.042, 0.022, 0.03)),
        ellipsoid("r2", (c2.x + 0.04, c2.y, c2.z), (0.042, 0.022, 0.03)),
        ellipsoid("r3", (c2.x, c2.y - 0.005, c2.z), (0.017, 0.02, 0.017)),
    ]
    join("acc_ribbon", rib)


def lighten():
    """三角の数を へらす（町の人が たくさん出るので、髪は 1つ 約9000、ほかは 約1500 まで）。"""
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        ev.to_mesh_clear()
        limit = 9000 if ob.name.startswith("hair_") else 1500
        if tris > limit:
            m = ob.modifiers.new("lighten", "DECIMATE")
            m.ratio = limit / tris


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_body()
    hair_styles()
    # 関節の位置（アプリが読む）
    empty("joint_head", (0, 0, HEAD_Z))
    for side, sx in (("L", 1), ("R", -1)):
        empty(f"joint_shoulder_{side}", (sx * SHOULDER[0], 0, SHOULDER[1]))
        empty(f"joint_hip_{side}", (sx * HIP[0], 0, HIP[1]))
    lighten()
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="NONE",
        export_normals=True,
        export_texcoords=False,
        export_vertex_color="ACTIVE",
    )
    names = sorted(o.name for o in bpy.data.objects)
    print("AVATAR_PARTS", len(names), " ".join(names))


if __name__ == "__main__":
    main()
    sys.exit(0)
