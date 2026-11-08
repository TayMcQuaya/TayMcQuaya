# Cabinet scene (Blender)

`build.py` models the arcade cabinets and room. `bake.py` bakes lighting into textures and exports `assets/arcade.glb`.

```
pip install bpy==5.2.3 pillow scipy   # Python 3.13
python build.py build      # or: python build.py preview 32  (test render)
python bake.py 1.0         # ~13 min on 2 CPU cores (5 bake groups)
cp <out>/arcade3.glb ../../assets/arcade3.glb
```
Output folder is set by `OUT` at the top of each script.
