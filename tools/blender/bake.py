# Bakes lighting into textures and exports a GLB.
# Run after build.py. Usage: bvenv/bin/python bake.py [samples_scale]
import bpy, math, sys, os, time
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = '/home/claude/scratch/blend'
SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
bpy.ops.wm.open_mainfile(filepath=f'{OUT}/scene3.blend')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.render.bake.margin = 16
scene.cycles.use_denoising = False

def is_dyn(o):
    n = o.name
    return (n.endswith('screen') or n.endswith('marquee') or 'coinslot' in n or n.startswith(('art', 'lamp', 'exit_sign', 'board_screen', 'neon_'))
            or (n.startswith('cart') and n.endswith('_label')))

def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# unparent everything, keep transforms
allobjs = [o for o in scene.objects if o.type in ('MESH', 'CURVE')]
select_only(allobjs); bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in [o for o in scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)

GROUPS = [
    ('hero', lambda o: o.name.startswith('hero_') and not is_dyn(o), 2048, 36, 1.4),
    ('row', lambda o: o.name.startswith('proj') and not is_dyn(o), 4096, 24, 1.6),
    ('floor', lambda o: o.name == 'floor', 2048, 26, 2.4),
    ('walls', lambda o: o.name.startswith('wall_'), 2048, 20, 2.2),
    ('props', lambda o: o.name.startswith(('gal_', 'shelf_', 'door_', 'board_frame', 'board_cork')) or (o.name.startswith('cart') and not is_dyn(o)), 2048, 26, 1.6),
]

def aces(x):
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)
def to_srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def grab(img, n):
    a = np.empty(n * n * 4, dtype=np.float32); img.pixels.foreach_get(a); return a.reshape(n, n, 4)

baked = []
for name, pred, size, samples, sigma in GROUPS:
    t0 = time.time()
    objs = [o for o in scene.objects if o.type in ('MESH', 'CURVE') and pred(o)]
    select_only(objs)
    bpy.ops.object.convert(target='MESH')
    objs = [o for o in bpy.context.selected_objects]
    select_only(objs)
    if len(objs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = f'{name}_baked'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    if name in ('hero', 'row', 'props', 'walls'):
        while len(me.uv_layers): me.uv_layers.remove(me.uv_layers[0])
        me.uv_layers.new(name='bake')
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.004 if size >= 4096 else 0.006, area_weight=0.0)
        bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{name}_img', size, size, float_buffer=True, alpha=True)
    img.generated_color = (0, 0, 0, 0)
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage'); node.name = 'BAKE'
        node.image = img; nt.nodes.active = node
    def bake(kind, filt, s):
        scene.cycles.samples = s
        img.pixels.foreach_set(np.zeros(size * size * 4, dtype=np.float32))
        if filt: bpy.ops.object.bake(type=kind, pass_filter=filt, margin=16)
        else: bpy.ops.object.bake(type=kind, margin=16)
        return grab(img, size)
    col = bake('DIFFUSE', {'COLOR'}, 1)
    emit = bake('EMIT', None, 1)
    light = bake('DIFFUSE', {'DIRECT', 'INDIRECT'}, max(4, int(samples * SCALE)))
    mask = (col[..., 3] > 0.5).astype(np.float32)
    # mask-normalized blur denoise of the lighting only
    lw = gaussian_filter(mask, sigma)
    lit = np.stack([gaussian_filter(light[..., c] * mask, sigma) / np.maximum(lw, 1e-4) for c in range(3)], -1)
    rgb = col[..., :3] * lit + emit[..., :3]
    rgb = to_srgb(aces(rgb * 1.15))
    out = (np.flipud(np.clip(rgb, 0, 1)) * 255 + 0.5).astype(np.uint8)
    path = f'{OUT}/{name}_baked.jpg'
    Image.fromarray(out).save(path, quality=88 if size >= 4096 else 90)
    # swap materials for a single baked material
    bm = bpy.data.materials.new(f'{name}_bakedmat')
    try: bm.use_nodes = True
    except Exception: pass
    tex = bm.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(path)
    pb = bm.node_tree.nodes.get('Principled BSDF')
    bm.node_tree.links.new(tex.outputs['Color'], pb.inputs['Base Color'])
    me.materials.clear(); me.materials.append(bm)
    baked.append(ob)
    print(f'BAKED {name} {size}px in {time.time() - t0:.0f}s', flush=True)

dyn = [o for o in scene.objects if is_dyn(o)]
select_only(baked + dyn)
bpy.ops.export_scene.gltf(filepath=f'{OUT}/arcade3.glb', export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=90,
                          export_cameras=False, export_lights=False)
print('EXPORTED', os.path.getsize(f'{OUT}/arcade3.glb') // 1024, 'KB', flush=True)
