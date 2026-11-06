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

main_root, main_objs = cabinet('cab_')
bgL, bgL_objs = cabinet('bgL_', 2.55, 1.75, math.radians(-34), 'sideB', True)
bgR, bgR_objs = cabinet('bgR_', 1.4, 1.15, math.radians(-24), 'sideC', True)

# room
bpy.ops.mesh.primitive_plane_add(size=1); floor = bpy.context.object; floor.name = 'floor'; floor.scale = (9, 9, 1); floor.data.materials.append(M['floor'])
bpy.ops.mesh.primitive_plane_add(size=1); wall = bpy.context.object; wall.name = 'wall'; wall.scale = (9, 4, 1)
wall.rotation_euler = (math.pi / 2, 0, 0); wall.location = (0, 2.1, 2); wall.data.materials.append(M['wall'])

# lights
def area(name, loc, target, size, energy, color):
    ld = bpy.data.lights.new(name, 'AREA'); ld.size = size; ld.energy = energy; ld.color = hexc(color)[:3]
    o = link(bpy.data.objects.new(name, ld)); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o
area('key', (-1.4, -2.2, 2.4), (0, 0, 0.9), 1.6, 260, '#ffe2c4')
area('rimR', (1.5, 1.0, 2.1), (0, 0, 1.0), 1.0, 220, '#ff4fa3')
area('rimL', (-1.6, 0.8, 1.7), (0, 0, 1.0), 1.0, 140, '#2dd4bf')
sd = bpy.data.lights.new('top', 'SPOT'); sd.energy = 260; sd.spot_size = math.radians(55); sd.spot_blend = 0.6; sd.color = hexc('#ffd8a8')[:3]; sd.shadow_soft_size = 0.4
top = link(bpy.data.objects.new('top', sd)); top.location = (0, -0.7, 3.4); top.rotation_euler = (math.radians(12), 0, 0)
world = bpy.data.worlds.new('w'); scene.world = world
try: world.use_nodes = True
except Exception: pass
world.node_tree.nodes['Background'].inputs['Color'].default_value = hexc('#0b0708')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'

if MODE == 'preview':
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 45
    cam = link(bpy.data.objects.new('cam', cam_d)); cam.location = (-1.25, -2.9, 1.2)
    cam.rotation_euler = (Vector((0, 0, 1.0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 960, 600
    scene.cycles.samples = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    scene.cycles.use_denoising = True
    scene.render.filepath = f'{OUT}/preview.png'
    bpy.ops.render.render(write_still=True)
    print('PREVIEW DONE')

bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/scene.blend')
