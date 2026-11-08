# Blender (bpy) script: builds the stylized arcade cabinet scene.
# Run: bvenv/bin/python build.py [preview|bake]
import bpy, bmesh, math, sys, os
from mathutils import Vector

MODE = sys.argv[1] if len(sys.argv) > 1 else 'preview'
OUT = '/home/claude/scratch/blend'
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers
def hexc(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)

def mat(name, color, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0
    if emit:
        b.inputs['Emission Color'].default_value = hexc(emit)
        b.inputs['Emission Strength'].default_value = strength
    return m

def link(obj):
    bpy.context.collection.objects.link(obj)
    return obj

def mesh_obj(name, verts, faces, material=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    if material: o.data.materials.append(material)
    return o

def bevel(o, w=0.006, seg=2, angle=40):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = w; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m

def prism(name, prof, x0, x1, material):
    """Extrude a 2D profile (f=forward, z=up) between x0..x1. Forward = Blender -Y."""
    n = len(prof)
    verts = [(x0, -f, z) for f, z in prof] + [(x1, -f, z) for f, z in prof]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    o = mesh_obj(name, verts, faces, material)
    # fix normals
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    return o

def offset_poly(pts, d):
    """Offset a simple polygon by d (positive = outward)."""
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2
    s = 1 if area > 0 else -1  # ccw -> outward normal is (dy, -dx)
    lines = []
    for i in range(len(pts)):
        a, b = Vector(pts[i]), Vector(pts[(i + 1) % len(pts)])
        dvec = (b - a).normalized()
        nrm = Vector((dvec.y, -dvec.x)) * s
        lines.append((a + nrm * d, dvec))
    out = []
    for i in range(len(lines)):
        p1, d1 = lines[i - 1]; p2, d2 = lines[i]
        den = d1.x * d2.y - d1.y * d2.x
        if abs(den) < 1e-6: out.append(tuple(p2)); continue
        t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
        out.append(tuple(p1 + d1 * t))
    return out

def place_on_face(o, a, b, along, out=0.0):
    """Place object on the slanted face from profile point a->b (f,z). along: 0..1 position. Object's local +Z becomes face normal."""
    A, B = Vector(a), Vector(b)
    P = A + (B - A) * along
    d = (B - A).normalized()
    nrm = Vector((d.y, -d.x))  # outward (forward-ish) for our winding
    if nrm.x < 0: nrm = -nrm
    ang = math.atan2(nrm.y, nrm.x)  # angle of normal from +f toward +z
    o.location = (o.location.x, -(P.x + nrm.x * out), P.y + nrm.y * out)
    o.rotation_euler = (math.pi / 2 - ang, 0, 0)  # local +Z -> normal in (-y,z) plane
    return o

# ---------------------------------------------------------------- materials
M = {
    'body': mat('body', '#17110f', 0.55),
    'side': None,
    'panel': mat('panel', '#1f1716', 0.45),
    'bezel': mat('bezel', '#0c0a0a', 0.35),
    'tmold': mat('tmold', '#c8780c', 0.3),
    'metal': mat('metal', '#2e2c33', 0.4),
    'kick': mat('kick', '#2c2a2e', 0.35),
    'black': mat('black', '#0a0909', 0.4),
    'ball': mat('ball', '#e5322d', 0.25),
    'shaft': mat('shaft', '#8a8a90', 0.3),
    'floor': mat('floor', '#2a1f1b', 0.75),
    'wall': mat('wall', '#1c1513', 0.9),
    'screen': mat('screen', '#000000', 0.2, '#9cc9ff', 1.6),
    'marquee': mat('marquee', '#000000', 0.3, '#ffd59a', 5.0),
    'coin': mat('coin', '#000000', 0.3, '#ff3b30', 6.0),
    'screen_dim': mat('screen_dim', '#000000', 0.2, '#56657a', 0.35),
    'marquee_dim': mat('marquee_dim', '#000000', 0.3, '#9a5428', 0.6),
    'coin_dim': mat('coin_dim', '#000000', 0.3, '#ff3b30', 2.0),
}
btn_cols = ['#ef4444', '#f59e0b', '#2dd4bf', '#ef4444', '#f59e0b', '#2dd4bf']
for i, c in enumerate(btn_cols): M[f'btn{i}'] = mat(f'btn{i}', c, 0.3)
M['start'] = mat('start', '#f3eee6', 0.3)

# side art: diagonal racing stripes driven by object coords
def side_mat(name, cols):
  side = bpy.data.materials.new(name)
  try: side.use_nodes = True
  except Exception: pass
  nt = side.node_tree; N = nt.nodes; L = nt.links
  bsdf = N.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value = 0.4
  tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ')
  mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY_ADD'; mul.inputs[1].default_value = -0.85  # z + (-y)*-0.85 => z + f*0.85
  ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
  el = ramp.color_ramp.elements
  el[0].position = 0.0; el[0].color = hexc('#1d1412')
  stops = [(0.555, cols[0]), (0.60, '#1d1412'), (0.625, cols[1]), (0.665, '#1d1412'), (0.69, cols[2]), (0.73, '#1d1412')]
  for p, c in stops:
      e = el.new(p); e.color = hexc(c)
  el[-1].position = 1.0 if el[-1].position < 1.0 else el[-1].position
  L.new(tc.outputs['Object'], sep.inputs[0])
  L.new(sep.outputs['Y'], mul.inputs[0]); L.new(sep.outputs['Z'], mul.inputs[2])
  mapr = N.new('ShaderNodeMapRange'); mapr.inputs['From Min'].default_value = 0; mapr.inputs['From Max'].default_value = 2.2
  L.new(mul.outputs[0], mapr.inputs['Value']); L.new(mapr.outputs['Result'], ramp.inputs['Fac'])
  L.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
  return side
M['side'] = side_mat('side', ['#f59e0b', '#f97316', '#ef4444'])
M['sideB'] = side_mat('sideB', ['#2dd4bf', '#38bdf8', '#a855f7'])
M['sideC'] = side_mat('sideC', ['#ff4fa3', '#a855f7', '#f59e0b'])

# ---------------------------------------------------------------- cabinet
PROF = [(-0.40, 0.00), (0.28, 0.00), (0.28, 0.80), (0.46, 0.90), (0.47, 0.97), (0.22, 1.05),
        (0.20, 1.07), (0.06, 1.50), (0.17, 1.55), (0.19, 1.80), (-0.40, 1.84)]
W = 0.64      # inner body width
T = 0.022     # side panel thickness
parts = []

def cabinet(prefix, ox=0.0, oy=0.0, rotz=0.0, sidem='side', dim=False):
    sfx = '_dim' if dim else ''
    objs = []
    body_prof = offset_poly(PROF, -0.018)
    body = prism(f'{prefix}body', body_prof, -W / 2, W / 2, M['body']); bevel(body, 0.008, 2); objs.append(body)
    for sgn in (-1, 1):
        x0, x1 = (W / 2, W / 2 + T) if sgn > 0 else (-W / 2 - T, -W / 2)
        sp = prism(f'{prefix}side{sgn}', PROF, x0, x1, M[sidem]); bevel(sp, 0.005, 2); objs.append(sp)
        # T-molding around the side panel edge
        cu = bpy.data.curves.new(f'{prefix}tm{sgn}', 'CURVE'); cu.dimensions = '3D'
        sp_ = cu.splines.new('POLY'); sp_.points.add(len(PROF) - 1)
        for k, (f, z) in enumerate(PROF): sp_.points[k].co = (sgn * (W / 2 + T / 2), -f, z, 1)
        sp_.use_cyclic_u = True
        cu.bevel_depth = T / 2 + 0.003; cu.bevel_resolution = 3
        tm = link(bpy.data.objects.new(f'{prefix}tmold{sgn}', cu)); tm.data.materials.append(M['tmold']); objs.append(tm)
    # screen bezel frame (raised) + screen
    a, b = PROF[6], PROF[7]
    sw, sh = 0.50, 0.375
    fr = bpy.data.meshes.new('fr'); bm = bmesh.new()
    ow, oh, th = W * 0.5 - 0.005, 0.215, 0.012
    outer = [(-ow, -oh), (ow, -oh), (ow, oh), (-ow, oh)]; inner = [(-sw / 2, -sh / 2), (sw / 2, -sh / 2), (sw / 2, sh / 2), (-sw / 2, sh / 2)]
    vs = []
    for z in (0, th):
        vs.append([bm.verts.new((x, y, z)) for x, y in outer]); vs.append([bm.verts.new((x, y, z)) for x, y in inner])
    o0, i0, o1, i1 = vs
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new([o1[k], o1[j], i1[j], i1[k]])
        bm.faces.new([o0[k], o0[j], o1[j], o1[k]][::-1])
        bm.faces.new([i0[k], i1[k], i1[j], i0[j]][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(fr); bm.free()
    frame = link(bpy.data.objects.new(f'{prefix}bezel', fr)); frame.data.materials.append(M['bezel'])
    place_on_face(frame, a, b, 0.5, out=-0.018 + 0.001); bevel(frame, 0.003, 2); objs.append(frame)
    # curved screen glass (slight CRT bulge)
    sc = bpy.data.meshes.new('sc'); bm = bmesh.new()
    nx, ny = 16, 12
    grid = [[bm.verts.new((-sw / 2 + sw * i / nx, -sh / 2 + sh * j / ny,
                            0.006 * (1 - ((2 * i / nx - 1) ** 2)) * (1 - ((2 * j / ny - 1) ** 2)))) for j in range(ny + 1)] for i in range(nx + 1)]
    uv_list = []
    for i in range(nx):
        for j in range(ny):
            f = bm.faces.new([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uvl].uv = ((lp.vert.co.x + sw / 2) / sw, (lp.vert.co.y + sh / 2) / sh)
    bm.to_mesh(sc); bm.free()
    screen = link(bpy.data.objects.new(f'{prefix}screen', sc)); screen.data.materials.append(M['screen' + sfx])
    place_on_face(screen, a, b, 0.5, out=-0.018 + 0.004); objs.append(screen)
    # marquee light box face
    ma, mb = PROF[8], PROF[9]
    mq = bpy.data.meshes.new('mq'); mq.from_pydata([(-0.29, -0.105, 0), (0.29, -0.105, 0), (0.29, 0.105, 0), (-0.29, 0.105, 0)], [], [(0, 1, 2, 3)])
    uvl = mq.uv_layers.new(name='UVMap')
    for k, uv in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uvl.data[k].uv = uv
    marq = link(bpy.data.objects.new(f'{prefix}marquee', mq)); marq.data.materials.append(M['marquee' + sfx])
    place_on_face(marq, ma, mb, 0.5, out=-0.018 + 0.004); objs.append(marq)
    # marquee trim bars
    for zz in (0.115, -0.115):
        bar = prism(f'{prefix}mbar{zz}', [(-0.02, -0.012), (0.02, -0.012), (0.02, 0.012), (-0.02, 0.012)], -W / 2, W / 2, M['black'])
        place_on_face(bar, ma, mb, 0.5, out=-0.018); bar.rotation_euler = (0, 0, 0)
        P = Vector(ma) + (Vector(mb) - Vector(ma)) * 0.5
        bar.location = (0, -(P.x - 0.0), P.y + zz); objs.append(bar)
    # control panel: slanted top surface details
    ca, cb = PROF[4], PROF[5]
    cp = bpy.data.meshes.new('cp'); cp.from_pydata([(-W / 2, -0.12, 0), (W / 2, -0.12, 0), (W / 2, 0.12, 0), (-W / 2, 0.12, 0)], [], [(0, 1, 2, 3)])
    cpo = link(bpy.data.objects.new(f'{prefix}cpanel', cp)); cpo.data.materials.append(M['panel'])
    place_on_face(cpo, cb, ca, 0.5, out=-0.018 + 0.002)
    sol = cpo.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.006; objs.append(cpo)

    def on_panel(o, u, v, h=0.0):
        """u across (x), v along panel from back(0) to front(1)."""
        A, B = Vector(cb), Vector(ca)
        P = A + (B - A) * v
        d = (B - A).normalized(); nrm = Vector((d.y, -d.x))
        if nrm.y < 0: nrm = -nrm
        o.location = (u, -(P.x + nrm.x * (h - 0.018 + 0.008)), P.y + nrm.y * (h - 0.018 + 0.008))
        o.rotation_euler = (math.atan2(nrm.x, nrm.y) * -1, 0, 0)
        return o
    # joystick
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.032, depth=0.01); jb = bpy.context.object; jb.name = f'{prefix}jbase'; jb.data.materials.append(M['black']); on_panel(jb, -0.17, 0.55); objs.append(jb)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.007, depth=0.09); js = bpy.context.object; js.name = f'{prefix}jshaft'; js.data.materials.append(M['shaft']); on_panel(js, -0.17, 0.55, 0.045); objs.append(js)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.026); jbl = bpy.context.object; jbl.name = f'{prefix}jball'; jbl.data.materials.append(M['ball']); on_panel(jbl, -0.17, 0.55, 0.095); objs.append(jbl)
    # buttons 2x3 + start buttons
    for r in range(2):
        for cidx in range(3):
            bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.019, depth=0.014)
            bt = bpy.context.object; bt.name = f'{prefix}btn{r}{cidx}'; bt.data.materials.append(M[f'btn{r * 3 + cidx}'])
            on_panel(bt, 0.0 + cidx * 0.058 + r * 0.02, 0.38 + r * 0.30, 0.006); bevel(bt, 0.004, 2, 60); objs.append(bt)
            bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.024, depth=0.004)
            ring = bpy.context.object; ring.name = f'{prefix}bring{r}{cidx}'; ring.data.materials.append(M['black'])
            on_panel(ring, 0.0 + cidx * 0.058 + r * 0.02, 0.38 + r * 0.30, 0.0); objs.append(ring)
    for k in range(2):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.011, depth=0.01)
        st = bpy.context.object; st.name = f'{prefix}start{k}'; st.data.materials.append(M['start'])
        on_panel(st, -0.04 + k * 0.05, 0.12, 0.004); objs.append(st)
    # coin door
    bpy.ops.mesh.primitive_cube_add(size=1); cd = bpy.context.object; cd.name = f'{prefix}coindoor'
    cd.scale = (0.22, 0.012, 0.26); cd.location = (0, -(0.28 - 0.018 + 0.006), 0.46); cd.data.materials.append(M['metal']); bevel(cd, 0.006, 2); objs.append(cd)
    for k in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1); cs = bpy.context.object; cs.name = f'{prefix}coinslot{k}'
        cs.scale = (0.03, 0.006, 0.05); cs.location = (k * 0.05, -(0.28 - 0.018 + 0.014), 0.52); cs.data.materials.append(M['coin' + sfx]); objs.append(cs)
        bpy.ops.mesh.primitive_cube_add(size=1); cr = bpy.context.object; cr.name = f'{prefix}coinret{k}'
        cr.scale = (0.035, 0.008, 0.03); cr.location = (k * 0.05, -(0.28 - 0.018 + 0.014), 0.41); cr.data.materials.append(M['black']); objs.append(cr)
    # kick plate
    bpy.ops.mesh.primitive_cube_add(size=1); kp = bpy.context.object; kp.name = f'{prefix}kick'
    kp.scale = (W - 0.01, 0.01, 0.1); kp.location = (0, -(0.28 - 0.018 + 0.004), 0.06); kp.data.materials.append(M['kick']); bevel(kp, 0.003); objs.append(kp)
    # speaker grille strip under marquee
    for k in range(9):
        bpy.ops.mesh.primitive_cube_add(size=1); g = bpy.context.object; g.name = f'{prefix}grille{k}'
        g.scale = (0.006, 0.006, 0.03)
        P = Vector(PROF[7]) + (Vector(PROF[8]) - Vector(PROF[7])) * 0.5
        g.location = (-0.12 + k * 0.03, -(P.x - 0.018 + 0.006), P.y); g.data.materials.append(M['black']); objs.append(g)

    root = bpy.data.objects.new(f'{prefix}root', None); link(root)
    for o in objs: o.parent = root
    root.location = (ox, oy, 0); root.rotation_euler = (0, 0, rotz)
    return root, objs

# ================================================================ v3: the whole arcade
# Coordinates: Blender X = three.js X, Blender -Y = three.js +Z (forward), Blender Z = up.
# Cabinets face Blender -Y. Camera lives at negative Y (positive three.js Z) in front of them.
ROOM_X, ROOM_Y_BACK, ROOM_Y_FRONT, ROOM_H = 9.0, 6.2, -8.6, 5.0   # walls at x=±9, back wall y=+6.2, front wall y=-8.6

M['screen_row'] = mat('screen_row', '#000000', 0.2, '#6f8aa6', 0.9)
M['marquee_row'] = mat('marquee_row', '#000000', 0.3, '#ffcf8a', 3.2)
M['frame'] = mat('frame', '#3a2216', 0.5)
M['lamp'] = mat('lamp', '#000000', 0.3, '#ffe2a8', 2.5)
M['wood'] = mat('wood', '#5a3418', 0.75)
M['cart'] = mat('cart', '#2b2622', 0.5)
M['cork'] = mat('cork', '#8a5a32', 1.0)
M['exit'] = mat('exit', '#000000', 0.3, '#ff3b30', 7.0)
M['ceil'] = mat('ceil', '#120b08', 1.0)
M['ledteal'] = mat('ledteal', '#000000', 0.3, '#2dd4bf', 2.5)
M['stripe'] = mat('stripe', '#000000', 0.3, '#f59e0b', 1.6)

# hero cabinet (About) in the middle of the room
hero_root, _ = cabinet('hero_', 0.0, 0.2, 0.0, 'side')

# project row along the back wall: 7 cabinets, distinct side art
row_pal = [['#ef4444', '#f97316', '#fbbf24'], ['#fbbf24', '#f59e0b', '#ffffff'], ['#2dd4bf', '#38bdf8', '#a855f7'],
           ['#84cc16', '#22c55e', '#fbbf24'], ['#a855f7', '#ff4fa3', '#38bdf8'], ['#22c55e', '#2dd4bf', '#ffffff'], ['#8b7355', '#6b5a45', '#f59e0b']]
for i, cols in enumerate(row_pal):
    M[f'sideP{i}'] = side_mat(f'sideP{i}', cols)
ROW_Y = 5.75
ROW_X = [-4.5, -3.0, -1.5, 0.0, 1.5, 3.0, 4.5]
for i, x in enumerate(ROW_X):
    cabinet(f'proj{i}_', x, ROW_Y, 0.0, f'sideP{i}')
# swap row screens/marquees to the row materials (dimmer, neutral)
for o in scene.objects:
    if o.name.startswith('proj') and o.name.endswith('screen'): o.data.materials[0] = M['screen_row']
    if o.name.startswith('proj') and o.name.endswith('marquee'): o.data.materials[0] = M['marquee_row']
# hazard tape on the last one
for r in (0.5, -0.5):
    bpy.ops.mesh.primitive_cube_add(size=1); t = bpy.context.object; t.name = f'proj6_tape{r}'
    t.scale = (0.75, 0.005, 0.045); t.location = (ROW_X[6], ROW_Y - 0.44, 1.62); t.rotation_euler = (0, r, 0); t.data.materials.append(M['stripe'])

# room shell
def box(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.name = name
    o.location = loc; o.scale = scale; o.data.materials.append(material); return o
bpy.ops.mesh.primitive_plane_add(size=1); floor = bpy.context.object; floor.name = 'floor'
floor.scale = (ROOM_X * 2, ROOM_Y_BACK - ROOM_Y_FRONT, 1); floor.location = (0, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, 0); floor.data.materials.append(M['floor'])
depth = ROOM_Y_BACK - ROOM_Y_FRONT
box('wall_back', (0, ROOM_Y_BACK + 0.05, ROOM_H / 2), (ROOM_X * 2 + 0.2, 0.1, ROOM_H), M['wall'])
box('wall_front', (0, ROOM_Y_FRONT - 0.05, ROOM_H / 2), (ROOM_X * 2 + 0.2, 0.1, ROOM_H), M['wall'])
box('wall_left', (-ROOM_X - 0.05, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, ROOM_H / 2), (0.1, depth, ROOM_H), M['wall'])
box('wall_right', (ROOM_X + 0.05, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, ROOM_H / 2), (0.1, depth, ROOM_H), M['wall'])
box('wall_ceil', (0, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, ROOM_H + 0.05), (ROOM_X * 2, depth, 0.1), M['ceil'])
# wainscot rail + baseboard on all walls
for nm, loc, sc in [('back', (0, ROOM_Y_BACK - 0.03, 1.2), (ROOM_X * 2, 0.06, 0.08)), ('front', (0, ROOM_Y_FRONT + 0.03, 1.2), (ROOM_X * 2, 0.06, 0.08)),
                    ('left', (-ROOM_X + 0.03, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, 1.2), (0.06, depth, 0.08)), ('right', (ROOM_X - 0.03, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, 1.2), (0.06, depth, 0.08))]:
    box(f'wall_rail_{nm}', loc, sc, M['kick']); l2 = list(loc); l2[2] = 0.12; s2 = list(sc); s2[2] = 0.24; box(f'wall_base_{nm}', tuple(l2), tuple(s2), M['kick'])
# amber neon strip along the ceiling edge (baked as emissive)
for nm, loc, sc in [('back', (0, ROOM_Y_BACK - 0.06, ROOM_H - 0.25), (ROOM_X * 2, 0.04, 0.04)), ('front', (0, ROOM_Y_FRONT + 0.06, ROOM_H - 0.25), (ROOM_X * 2, 0.04, 0.04)),
                    ('left', (-ROOM_X + 0.06, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, ROOM_H - 0.25), (0.04, depth, 0.04)), ('right', (ROOM_X - 0.06, (ROOM_Y_BACK + ROOM_Y_FRONT) / 2, ROOM_H - 0.25), (0.04, depth, 0.04))]:
    box(f'wall_neon_{nm}', loc, sc, M['stripe'])

# gallery on the right wall: 12 frames, 2 rows x 6, art planes dynamic
ART_Z = [(-4.5 + 1.5 * c) for c in range(6)]   # along Blender Y
ART_ROWS = [2.25, 1.05]
for i in range(12):
    r, c = divmod(i, 6)
    y = ART_Z[c]; z = ART_ROWS[r]
    box(f'gal_frame{i}', (ROOM_X - 0.045, y, z), (0.07, 1.14, 1.04), M['frame'])
    bpy.ops.mesh.primitive_plane_add(size=1); a = bpy.context.object; a.name = f'art{i}'
    a.scale = (1.0, 0.9, 1); a.rotation_euler = (math.pi / 2, 0, -math.pi / 2); a.location = (ROOM_X - 0.085, y, z)
    a.data.materials.append(mat(f'artm{i}', '#222222', 0.6))
    if r == 0:
        box(f'gal_lamparm{i}', (ROOM_X - 0.15, y, z + 0.72), (0.3, 0.05, 0.03), M['metal'])
        box(f'lamp{i}', (ROOM_X - 0.26, y, z + 0.70), (0.08, 0.5, 0.03), M['lamp'])
    else:
        box(f'lamp{i}', (ROOM_X - 0.1, y, z - 0.62), (0.03, 0.9, 0.025), M['lamp'])

# skills shelf on the front wall (faces +Y toward the room)
SH_X, SH_Y = 4.4, ROOM_Y_FRONT + 0.4
SW_, SH_, SD_ = 3.6, 3.3, 0.5
box('shelf_side_l', (SH_X - SW_ / 2, SH_Y, SH_ / 2), (0.1, SD_, SH_), M['wood'])
box('shelf_side_r', (SH_X + SW_ / 2, SH_Y, SH_ / 2), (0.1, SD_, SH_), M['wood'])
box('shelf_back', (SH_X, SH_Y - SD_ / 2 + 0.02, SH_ / 2), (SW_, 0.04, SH_), M['panel'])
rows_y = [0.25, 1.0, 1.75, 2.5, 3.25]
for k, zz in enumerate(rows_y):
    box(f'shelf_board{k}', (SH_X, SH_Y, zz), (SW_, SD_, 0.07), M['wood'])
    if k > 0: box(f'shelf_led{k}', (SH_X, SH_Y + SD_ / 2 - 0.04, zz - 0.05), (SW_ - 0.2, 0.02, 0.02), M['ledteal'])
for i in range(16):
    r, c = divmod(i, 4)
    cx = SH_X - 1.2 + c * 0.8; cz = rows_y[3 - r] + 0.07 + 0.31
    box(f'cart{i}', (cx, SH_Y + 0.02, cz), (0.56, 0.12, 0.62), M['cart'])
    bpy.ops.mesh.primitive_plane_add(size=1); lb = bpy.context.object; lb.name = f'cart{i}_label'
    lb.scale = (0.46, 0.54, 1); lb.rotation_euler = (math.pi / 2, 0, 0); lb.location = (cx, SH_Y + 0.02 - 0.062, cz)
    lb.data.materials.append(mat(f'cartlm{i}', '#333333', 0.5))

# exit door + high-score board on the front wall
DX = -3.2
box('door_hole', (DX, ROOM_Y_FRONT + 0.03, 1.55), (1.9, 0.02, 3.1), M['black'])
box('door_frame_l', (DX - 1.02, ROOM_Y_FRONT + 0.08, 1.6), (0.16, 0.16, 3.2), M['kick'])
box('door_frame_r', (DX + 1.02, ROOM_Y_FRONT + 0.08, 1.6), (0.16, 0.16, 3.2), M['kick'])
box('door_frame_t', (DX, ROOM_Y_FRONT + 0.08, 3.22), (2.2, 0.16, 0.16), M['kick'])
bpy.ops.mesh.primitive_plane_add(size=1); ex = bpy.context.object; ex.name = 'exit_sign'
ex.scale = (1.1, 0.34, 1); ex.rotation_euler = (math.pi / 2, 0, 0); ex.location = (DX, ROOM_Y_FRONT + 0.2, 3.6); ex.data.materials.append(M['exit'])
BX = -0.4
box('board_frame', (BX, ROOM_Y_FRONT + 0.05, 2.0), (2.4, 0.08, 1.8), M['wood'])
box('board_cork', (BX, ROOM_Y_FRONT + 0.1, 2.0), (2.2, 0.02, 1.6), M['cork'])
bpy.ops.mesh.primitive_plane_add(size=1); bs = bpy.context.object; bs.name = 'board_screen'
bs.scale = (2.0, 1.4, 1); bs.rotation_euler = (math.pi / 2, 0, 0); bs.location = (BX, ROOM_Y_FRONT + 0.12, 2.0); bs.data.materials.append(mat('boardm', '#111111', 0.5, '#404040', 0.4))

# big neon over the row (dynamic text planes at runtime; emissive bars baked for glow)
bpy.ops.mesh.primitive_plane_add(size=1); ne = bpy.context.object; ne.name = 'neon_title'
ne.scale = (8.0, 1.25, 1); ne.rotation_euler = (math.pi / 2, 0, math.pi); ne.location = (0, ROOM_Y_BACK - 0.08, 3.95); ne.data.materials.append(mat('neonm', '#000000', 0.5, '#f59e0b', 3.0))
bpy.ops.mesh.primitive_plane_add(size=1); ns = bpy.context.object; ns.name = 'neon_sub'
ns.scale = (3.2, 0.5, 1); ns.rotation_euler = (math.pi / 2, 0, math.pi); ns.location = (0, ROOM_Y_BACK - 0.08, 3.05); ns.data.materials.append(mat('neonsm', '#000000', 0.5, '#ff4fa3', 2.2))

# ---- lights
def area(name, loc, target, size, energy, color):
    ld = bpy.data.lights.new(name, 'AREA'); ld.size = size; ld.energy = energy; ld.color = hexc(color)[:3]
    o = link(bpy.data.objects.new(name, ld)); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return o
def spot(name, loc, target, energy, color, size_deg=50, blend=0.6, soft=0.35):
    sd = bpy.data.lights.new(name, 'SPOT'); sd.energy = energy; sd.spot_size = math.radians(size_deg); sd.spot_blend = blend; sd.color = hexc(color)[:3]; sd.shadow_soft_size = soft
    o = link(bpy.data.objects.new(name, sd)); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return o
area('key_hero', (-1.4, -2.2, 3.2), (0, 0.2, 0.9), 1.6, 320, '#ffe2c4')
spot('top_hero', (0.2, -0.5, ROOM_H - 0.1), (0, 0.2, 0.5), 260, '#ffd8a8', 55)
area('rim_hero', (2.2, 1.6, 2.2), (0, 0.2, 1.0), 1.0, 160, '#ff4fa3')
for i, x in enumerate(ROW_X):
    spot(f'row_spot{i}', (x, ROW_Y - 1.4, ROOM_H - 0.1), (x, ROW_Y, 0.6), 170, '#ffd2a0' if i % 2 == 0 else '#ffe6c8', 48, 0.5)
area('row_fill', (0, 1.5, 3.0), (0, ROW_Y, 1.0), 6.0, 90, '#f2c9a0')
for yy in (-3.75, -0.75, 2.25):
    area(f'gal_light{yy}', (ROOM_X - 1.6, yy, 3.9), (ROOM_X, yy, 1.6), 1.8, 150, '#ffe0b0')
spot('shelf_spot', (SH_X, SH_Y + 2.3, ROOM_H - 0.1), (SH_X, SH_Y, 1.5), 220, '#ffe6c8', 50, 0.5)
area('door_red', (DX, ROOM_Y_FRONT + 1.0, 3.3), (DX, ROOM_Y_FRONT, 1.5), 1.6, 90, '#ff5a4a')
area('board_light', (BX, ROOM_Y_FRONT + 1.6, 3.6), (BX, ROOM_Y_FRONT, 2.0), 1.2, 110, '#ffe0b0')
area('wash_magenta', (-ROOM_X + 0.5, -1.0, 2.6), (-2, -1.0, 1.0), 2.5, 120, '#ff4fa3')
area('wash_teal', (ROOM_X - 0.5, -5.5, 2.6), (3, -5.0, 1.0), 2.0, 90, '#2dd4bf')
world = bpy.data.worlds.new('w'); scene.world = world
try: world.use_nodes = True
except Exception: pass
world.node_tree.nodes['Background'].inputs['Color'].default_value = hexc('#0a0607')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'

if MODE == 'preview':
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 35
    cam = link(bpy.data.objects.new('cam', cam_d))
    views = {'hero': ((-1.5, -3.6, 1.3), (0, 0.2, 1.0)), 'row': ((-1.5, 2.4, 1.3), (-0.6, ROW_Y, 1.1)), 'gal': ((5.0, -0.8, 1.5), (ROOM_X, -0.8, 1.6)), 'front': ((0.5, -3.5, 1.5), (0.5, ROOM_Y_FRONT, 1.8))}
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 800, 500
    scene.cycles.samples = int(sys.argv[2]) if len(sys.argv) > 2 else 16
    scene.cycles.use_denoising = True
    for k, (loc, tgt) in views.items():
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}/prev_{k}.png'; bpy.ops.render.render(write_still=True)
    print('PREVIEW DONE')
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/scene3.blend')
