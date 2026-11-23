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
FABRIC_TILE = 0.25  # 布の模様の UV の 1 = 0.25m


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
    # 布の模様を貼る位置（UV）。まわりの長さと高さを メートルで測り、FABRIC_TILE で わる（アプリで くり返しの細かさを決める）
    uv = bm.loops.layers.uv.new("UVMap")
    rmax = max(r for r, _ in profile) * (sx + sy) / 2
    circ = 2 * math.pi * rmax / FABRIC_TILE
    ax, ay = offset[0] - origin[0], offset[1] - origin[1]
    for f in bm.faces:
        us = []
        for lp in f.loops:
            co = lp.vert.co
            a = math.atan2((co.y - ay) / sy, (co.x - ax) / sx) % (2 * math.pi)
            us.append(a / (2 * math.pi) * circ)
        # 一周の つなぎ目を またぐ面は、小さい方を 一周ぶん ずらす
        if max(us) - min(us) > circ / 2:
            us = [u + circ if u < circ / 2 else u for u in us]
        for lp, u in zip(f.loops, us):
            lp[uv].uv = (u, (lp.vert.co.z + origin[2]) / FABRIC_TILE)
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


# ---------------------------------------------------------------- 髪
# 髪は「頭にかぶる、厚みのある1つのかたまり」で作る（細い毛束を並べない。2026-11-23 tomy さんの髪型のイメージ）。
# 下のはし（切りそろえた線）を cut(phi) で、外がわの ふくらみを vol(phi, th) で決める。
# はしは厚く まるくし、前髪は 大きな まるい毛先か、まっすぐな切りそろえにする。


def Z(z):
    """頭の球の高さ z（-1..1）→ cut の値（真上からの角度）。"""
    return math.acos(max(-1.0, min(1.0, z)))


def D(m):
    """横から まっすぐ たれる長さ（メートル）→ cut の値（π/2 より大きい）。"""
    return math.pi / 2 + m / HZ


def keys(points, sym=True):
    """(phi, 値) の点を なめらかに つなぐ。sym なら左右おなじ（|phi| で見る）。"""
    pts = sorted(points)

    def f(phi):
        p = abs(phi) if sym else phi
        if p <= pts[0][0]:
            return pts[0][1]
        for (a, va), (b, vb) in zip(pts, pts[1:]):
            if p <= b:
                return lerp(va, vb, smoothstep(a, b, p))
        return pts[-1][1]

    return f


def tips(n, width, base, amp, sharp=1.6, shift=0.0):
    """前髪の毛先（大きな まるい先が n こ）。z（頭の球の高さ）を返す。"""

    def f(phi):
        if abs(phi) > width:
            return base
        t = (phi + width) / (2 * width) * n + shift
        w = 0.5 + 0.5 * math.cos(2 * math.pi * t)  # 1 が すきま、0 が毛先
        return base - amp * (1 - w) ** sharp

    return f


def hairline(bang, side, a=0.72, b=1.0):
    """前髪（z の関数）と、横・後ろ（cut の値の関数）を つなぐ。"""

    def f(phi):
        return lerp(Z(bang(phi)), side(phi), smoothstep(a, b, abs(phi)))

    return f


def udir(th, phi):
    return Vector((math.sin(th) * math.sin(phi), -math.sin(th) * math.cos(phi), math.cos(th)))


def puff(base=1.13, top=0.06, back=0.05):
    """ふくらみ（1 で頭の表面）。上と後ろを少し大きく。"""

    def v(phi, th):
        z = math.cos(th)
        backness = 0.5 - 0.5 * math.cos(phi)  # 0 が正面、1 が後ろ
        return base + top * max(0.0, z) ** 1.5 + back * backness * math.sin(th)

    return v


def with_bumps(v, bumps, dome=False):
    """ふくらみに こぶを足す。bumps は [(th, phi, 高さ, はば, とがり)]。dome なら まるい こぶ（くせ毛）。"""
    dirs = [(udir(t, p), h, w, sh) for t, p, h, w, sh in bumps]

    def f(phi, th):
        u = udir(th, phi)
        add = 0.0
        for d, h, w, sh in dirs:
            a = math.acos(max(-1.0, min(1.0, u.dot(d))))
            if a < w:
                x = a / w
                add = max(add, h * math.sqrt(1 - x * x)) if dome else add + h * (1 - x) ** sh
        return v(phi, th) + add

    return f


def with_part(v, phi0, depth=0.025):
    """分け目（頭の上に うすい みぞ）。"""

    def f(phi, th):
        d = (phi - phi0 + math.pi) % (2 * math.pi) - math.pi
        return v(phi, th) - depth * math.exp(-((d / 0.07) ** 2)) * smoothstep(0.12, 0.35, th) * smoothstep(1.25, 0.8, th)

    return f


def cap(name, cut, vol, taper=None, cols=88, rows=30, thick=0.05):
    """頭にかぶる髪のかたまり。外がわ・内がわ・下のはし（まるい ふち）で、とじた形にする。
    cut(phi): 下のはし。π/2 までは頭の球の角度、それより大きいと 横から まっすぐ たれる（D で長さを書く）。
    taper(phi, f): たれた所の はば（f は 0 が上・1 が毛先。内まきは 1 より小さく、外はねは大きく）。"""
    hd = lambda phi: Vector((math.sin(phi), -math.cos(phi), 0.0))
    center = Vector((0, 0, HEAD_Z))

    def outer(phi, s):
        if s <= math.pi / 2:
            k = vol(phi, s)
            return center + Vector(
                (HX * k * math.sin(s) * math.sin(phi), -HY * k * math.sin(s) * math.cos(phi), HZ * k * math.cos(s))
            )
        k = vol(phi, math.pi / 2)
        d = (s - math.pi / 2) * HZ
        length = max(1e-4, (cut(phi) - math.pi / 2) * HZ)
        w = taper(phi, min(1.2, d / length)) if taper else 1.0
        return Vector((HX * k * w * math.sin(phi), -HY * k * w * math.cos(phi), HEAD_Z - d))

    def inner(phi, s):
        p = outer(phi, s)
        if s <= math.pi / 2:
            k = vol(phi, s)
            return center + (p - center) * (max(0.94, k - thick / R) / k)
        return p - hd(phi) * thick

    bm = bmesh.new()
    top_o = bm.verts.new(outer(0.0, 0.0))
    top_i = bm.verts.new(inner(0.0, 0.0))
    O, I, M = [], [], []
    for j in range(cols):
        phi = -math.pi + 2 * math.pi * j / cols
        sc = cut(phi)
        O.append([bm.verts.new(outer(phi, sc * i / rows)) for i in range(1, rows + 1)])
        I.append([bm.verts.new(inner(phi, sc * i / rows)) for i in range(1, rows + 1)])
        po, pi_ = outer(phi, sc), inner(phi, sc)
        down = outer(phi, sc + 0.03) - po
        down = down.normalized() if down.length > 1e-6 else Vector((0, 0, -1))
        M.append([bm.verts.new(po.lerp(pi_, a) + down * thick * 0.6 * math.sin(math.pi * a))
                  for a in (0.1, 0.25, 0.5, 0.75, 0.9)])
    for j in range(cols):
        k = (j + 1) % cols
        bm.faces.new((top_o, O[j][0], O[k][0]))
        bm.faces.new((top_i, I[k][0], I[j][0]))
        for i in range(rows - 1):
            bm.faces.new((O[j][i], O[j][i + 1], O[k][i + 1], O[k][i]))
            bm.faces.new((I[j][i], I[k][i], I[k][i + 1], I[j][i + 1]))
        rj = [O[j][-1]] + M[j] + [I[j][-1]]
        rk = [O[k][-1]] + M[k] + [I[k][-1]]
        for i in range(len(rj) - 1):
            bm.faces.new((rj[i], rj[i + 1], rk[i + 1], rk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # 細かい目で作り、なめらかに見せる（あとで三角を へらすと、はしが がたがたになるので へらさない）
    return new_obj(name, bm, subdiv=0)


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


def hair_styles():
    # 耳を出す みじかい髪の、横と後ろ（もみあげ → 耳の上 → えりあし）
    short_side = keys(
        [(0.95, Z(0.05)), (1.15, D(0.05)), (1.3, D(0.04)), (1.45, Z(0.16)), (1.78, Z(0.16)), (2.0, D(0.12)),
         (2.4, D(0.2)), (math.pi, D(0.22))]
    )

    def follow(side):
        """たれた所を、頭の丸みに そって 内へ入れる（長いほど 内へ）。"""
        return lambda p, f: 1 - 0.95 * f * (side(p) - math.pi / 2) * HZ
    tied_side = keys(
        [(0.95, Z(0.08)), (1.2, D(0.03)), (1.45, Z(0.2)), (1.78, Z(0.2)), (2.0, D(0.1)), (2.4, D(0.17)), (math.pi, D(0.19))]
    )

    # みじかい（大きな毛先が2つ。少し右へ流す）
    cap("hair_model", hairline(tips(2, 0.8, 0.47, 0.12, 1.6, shift=0.22), short_side),
        with_part(puff(1.12, 0.07, 0.05), 0.55), taper=follow(short_side))
    finish_hair("hair_model", [bpy.data.objects["hair_model"]])

    # つんつん（上と後ろに、太くて先の まるい とがり）
    spikes = [(0.22, 0.25, 0.36, 0.34, 2.0), (0.45, 1.25, 0.3, 0.34, 2.0), (0.45, -1.0, 0.3, 0.34, 2.0),
              (0.62, 2.25, 0.28, 0.36, 2.0), (0.62, -2.15, 0.28, 0.36, 2.0), (0.55, math.pi, 0.3, 0.36, 2.0),
              (0.7, 0.6, 0.16, 0.28, 2.0), (0.68, -0.45, 0.18, 0.28, 2.0)]
    cap("hair_spiky", hairline(tips(3, 0.8, 0.45, 0.17, 2.4), short_side), with_bumps(puff(1.1, 0.04, 0.04), spikes),
        taper=follow(short_side))
    finish_hair("hair_spiky", [bpy.data.objects["hair_spiky"]])

    # よこわけ（右で分けて、左へ大きく流す前髪）
    def side_bang(phi):
        return lerp(0.62, 0.2, smoothstep(0.75, -0.7, phi)) - 0.05 * math.exp(-(((phi + 0.4) / 0.2) ** 2))

    cut = lambda phi: lerp(Z(side_bang(phi)), short_side(phi), smoothstep(0.72, 1.0, abs(phi)))
    cap("hair_side", cut, with_part(puff(1.12, 0.07, 0.05), 0.75, 0.03), taper=follow(short_side))
    finish_hair("hair_side", [bpy.data.objects["hair_side"]])

    # ふわふわ（あごまで。まん中で分けた前髪・毛先が外へ はねる）
    wavy_side = lambda phi: D(0.15 + 0.03 * smoothstep(0.95, math.pi, abs(phi)) + 0.015 * math.cos(7 * phi))
    cap("hair_wavy", hairline(lambda p: 0.22 + 0.3 * math.exp(-((p / 0.24) ** 2)), wavy_side),
        puff(1.15, 0.06, 0.06),
        taper=lambda p, f: 1 - 0.7 * f * (wavy_side(p) - math.pi / 2) * HZ + 0.25 * f ** 3 * (0.1 + 0.9 * abs(math.sin(p))))
    finish_hair("hair_wavy", [bpy.data.objects["hair_wavy"]])

    # くるくる（まるい こぶが たくさん。毛先も まるい）
    domes = []
    for th, n, off in ((0.0, 1, 0.0), (0.42, 6, 0.0), (0.82, 10, 0.3), (1.2, 12, 0.0), (1.55, 12, 0.25)):
        for i in range(n):
            domes.append((th, -math.pi + 2 * math.pi * (i + off) / n, 0.17, 0.36, 0))
    curly_side = keys([(0.95, Z(0.0)), (1.3, D(0.04)), (1.9, D(0.08)), (2.4, D(0.18)), (math.pi, D(0.2))])
    cap("hair_curly", hairline(tips(4, 0.8, 0.42, 0.08, 1.0), curly_side),
        with_bumps(puff(1.08, 0.04, 0.03), domes, dome=True), taper=follow(curly_side))
    finish_hair("hair_curly", [bpy.data.objects["hair_curly"]])

    # ボブ（まっすぐ切りそろえた前髪・あごの横まで・毛先が内まき）
    bob_side = keys([(0.95, D(0.19)), (1.6, D(0.21)), (math.pi, D(0.2))])
    cap("hair_bob", hairline(lambda p: 0.3 + 0.06 * (p / 0.8) ** 2, bob_side, 0.72, 0.92),
        puff(1.14, 0.05, 0.05), taper=lambda p, f: 1 - 0.12 * smoothstep(0.5, 1.0, f))
    finish_hair("hair_bob", [bpy.data.objects["hair_bob"]])

    # ながい（せなかまで。下へ いくほど体に そう）
    long_side = keys([(0.95, D(0.3)), (1.5, D(0.38)), (2.4, D(0.46)), (math.pi, D(0.48))])
    cap("hair_long", hairline(tips(2, 0.8, 0.36, 0.06, 1.2), long_side, 0.72, 0.95), puff(1.14, 0.05, 0.05),
        taper=lambda p, f: 1 - 0.3 * smoothstep(0.1, 1.0, f))
    finish_hair("hair_long", [bpy.data.objects["hair_long"]])

    # ポニーテール（後ろの上で むすぶ。たばは ふっくら）
    shell = cap("hair_ponytail", hairline(tips(2, 0.8, 0.5, 0.11, 1.6, shift=0.2), tied_side), puff(1.08, 0.05, 0.03),
                taper=follow(tied_side))
    tail = lathe(
        "pt",
        [(0.0, HEAD_Z - 0.4), (0.05, HEAD_Z - 0.35), (0.095, HEAD_Z - 0.2), (0.09, HEAD_Z - 0.04),
         (0.06, HEAD_Z + 0.07), (0.0, HEAD_Z + 0.11)],
        sx=1.0,
        sy=0.85,
        offset=(0.0, HY * 1.2),
    )
    tie = ellipsoid("pt_tie", (0.0, HY * 1.05, HEAD_Z + 0.1), (0.05, 0.035, 0.035))
    tie.name = "acc_tie_ponytail"
    finish_hair("hair_ponytail", [shell, tail])

    # ツインテール（まっすぐ切りそろえた、少し短い前髪）
    shell = cap("hair_twin", hairline(lambda p: 0.36 + 0.07 * (p / 0.8) ** 2, tied_side), puff(1.09, 0.05, 0.03),
                taper=follow(tied_side))
    tails = [shell]
    for sx in (-1, 1):
        tails.append(
            lathe(
                "tt",
                [(0.0, HEAD_Z - 0.36), (0.05, HEAD_Z - 0.3), (0.085, HEAD_Z - 0.15), (0.075, HEAD_Z + 0.02),
                 (0.0, HEAD_Z + 0.09)],
                offset=(sx * HX * 1.14, HY * 0.3),
            )
        )
    finish_hair("hair_twin", tails)

    # おだんご（まん中で分けた前髪・頭の上に まるい だんご）
    shell = cap("hair_bun", hairline(lambda p: 0.3 + 0.28 * math.exp(-((p / 0.2) ** 2)), tied_side),
                puff(1.08, 0.05, 0.03), taper=follow(tied_side))
    bun = ellipsoid("bun", (0.0, HY * 0.35, HEAD_Z + HZ * 1.1), (0.115, 0.11, 0.105))
    finish_hair("hair_bun", [shell, bun])

    # ベリーショート（とても みじかい。おでこを出す）
    buzz_side = keys(
        [(0.95, Z(0.3)), (1.25, Z(0.12)), (1.45, Z(0.22)), (1.78, Z(0.22)), (2.05, D(0.05)), (2.5, D(0.13)),
         (math.pi, D(0.15))]
    )
    cap("hair_buzz", hairline(lambda p: 0.62 - 0.05 * (p / 0.8) ** 2, buzz_side), puff(1.045, 0.03, 0.03),
        taper=follow(buzz_side), thick=0.03)
    finish_hair("hair_buzz", [bpy.data.objects["hair_buzz"]])

    # センターわけ（まん中で分けて、前髪が左右へ流れる）
    cap("hair_center", hairline(lambda p: 0.24 + 0.36 * math.exp(-((p / 0.17) ** 2)), short_side),
        with_part(puff(1.12, 0.07, 0.05), 0.0, 0.035), taper=follow(short_side))
    finish_hair("hair_center", [bpy.data.objects["hair_center"]])

    # ハーフアップ（せなかまでの髪。上の半分を後ろで小さく むすぶ）
    half_side = keys([(0.95, D(0.28)), (1.5, D(0.34)), (2.4, D(0.4)), (math.pi, D(0.42))])
    shell = cap("hair_halfup", hairline(tips(2, 0.8, 0.45, 0.1, 1.6, shift=0.3), half_side, 0.72, 0.95),
                puff(1.12, 0.05, 0.05), taper=lambda p, f: 1 - 0.3 * smoothstep(0.1, 1.0, f))
    knot = ellipsoid("knot", (0.0, HY * 1.2, HEAD_Z + 0.07), (0.075, 0.055, 0.06))
    tie = ellipsoid("ht_tie", (0.0, HY * 1.12, HEAD_Z + 0.02), (0.045, 0.03, 0.03))
    tie.name = "acc_tie_halfup"
    finish_hair("hair_halfup", [shell, knot])

    # みつあみ（右の肩の前へ、1本の みつあみ）
    shell = cap("hair_braid", hairline(tips(3, 0.8, 0.42, 0.08, 1.2), tied_side), puff(1.09, 0.05, 0.03),
                taper=follow(tied_side))
    p0 = Vector((-0.27, 0.06, HEAD_Z - 0.08))
    p1 = Vector((-0.2, -0.1, HEAD_Z - 0.44))
    seg = []
    n = 6
    for i in range(n):
        t0 = (i + 0.5) / n
        c = p0.lerp(p1, t0)
        along = (p1 - p0).normalized()
        side = along.cross(Vector((0, 1, 0))).normalized()
        out = side.cross(along).normalized()
        c = c + side * (0.012 if i % 2 else -0.012)
        r = 0.062 - 0.016 * t0
        seg.append(oriented("braid", c, (side, along, out), (r, (p1 - p0).length / n * 0.75, r * 0.85)))
    tip = p1 + (p1 - p0).normalized() * 0.04
    seg.append(oriented("btip", tip, (Vector((1, 0, 0)), (p1 - p0).normalized(), Vector((0, -1, 0))),
                        (0.038, 0.05, 0.03)))
    bt = p1 + (p1 - p0).normalized() * 0.005
    tie = ellipsoid("bt_tie", (bt.x, bt.y, bt.z), (0.03, 0.03, 0.022))
    tie.name = "acc_tie_braid"
    finish_hair("hair_braid", [shell] + seg)

    # おだんご2つ（頭の上の左右に まるい だんご・まっすぐな前髪）
    shell = cap("hair_twinbun", hairline(lambda p: 0.34 + 0.06 * (p / 0.8) ** 2, tied_side), puff(1.09, 0.05, 0.03),
                taper=follow(tied_side))
    buns = [shell]
    for sx in (-1, 1):
        c = surf(0.5, sx * 1.05, 1.17)
        buns.append(ellipsoid("tb", (c.x, c.y, c.z), (0.1, 0.095, 0.095)))
    finish_hair("hair_twinbun", buns)

    # 髪のかざり（花・リボン）。右の耳の上
    c = surf(0.85, 1.05, 1.18)
    # 花は 外と前の あいだを向ける（横から見て うすい線に見えないように）。花びらは少し厚く
    n = ((surf(0.85, 1.05) - Vector((0, 0, HEAD_Z))).normalized() + Vector((0, -0.8, 0))).normalized()
    up = (Vector((0, 0, 1)) - n * n.z).normalized()
    side = up.cross(n)
    petals = []
    for i in range(5):
        a = 2 * math.pi * i / 5
        pc = c + up * (math.cos(a) * 0.033) + side * (math.sin(a) * 0.033)
        petals.append(oriented("petal", pc, (side, up, n), (0.026, 0.032, 0.02)))
    join("acc_flowerPetals", petals)
    cc = c + n * 0.01
    ellipsoid("acc_flowerCenter", (cc.x, cc.y, cc.z), (0.016, 0.016, 0.016))
    c2 = surf(0.42, 0.7, 1.27)
    rib = [
        ellipsoid("r1", (c2.x - 0.04, c2.y, c2.z), (0.042, 0.022, 0.03)),
        ellipsoid("r2", (c2.x + 0.04, c2.y, c2.z), (0.042, 0.022, 0.03)),
        ellipsoid("r3", (c2.x, c2.y - 0.005, c2.z), (0.017, 0.02, 0.017)),
    ]
    join("acc_ribbon", rib)


def lighten():
    """三角の数を へらす（町の人が たくさん出るので、ほかの部品は 約1500 まで。髪は はしが がたがたにならないよう、細かいまま）。"""
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        ev.to_mesh_clear()
        # 髪とかざり（小さな部品の集まり）は へらすと形が くずれるので、へらさない
        limit = 24000 if ob.name.startswith(("hair_", "acc_")) else 1500
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
        export_texcoords=True,
        export_vertex_color="ACTIVE",
    )
    names = sorted(o.name for o in bpy.data.objects)
    print("AVATAR_PARTS", len(names), " ".join(names))


if __name__ == "__main__":
    main()
    sys.exit(0)
