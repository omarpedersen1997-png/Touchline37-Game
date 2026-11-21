"""Original Touchline stadium kit, authored as reusable UV/PBR GLB modules.
Run: blender -b -t 2 --python dev/assets/generate-stadium.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/match-assets55'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.7,texture=None,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if texture:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(OUT/texture));m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color'])
    if emit:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit
    return m
steel=material('Brushed steel',(.28,.34,.4),.65,.38)
white=material('Goal powder coat',(.92,.95,.94),.3,.45)
navy=material('Stadium navy',(.035,.09,.14))
lime=material('Touchline lime',(.58,.9,.16))
concrete=material('Concrete aggregate',(.44,.48,.5),texture='stadium-concrete-1024.png')
lamp=material('Floodlight lens',(.83,.91,1),.2,.28,emit=.8)
skin=material('Audience skin',(.58,.34,.23));rope=material('Woven goal net',(.63,.7,.67),0,1)
leather=material('Ball white leather',(.94,.96,.92),0,.65);black=material('Ball dark panels',(.035,.05,.065),0,.7)
def finish(o,m):o.data.materials.append(m);return o
def box(loc,size,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Rounded profile','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,m)
def sphere(loc,size,m,seg=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc);o=bpy.context.object;o.scale=size
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,m)
def rod(a,b,r,m,segments=8):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y')
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,m)
roots=[]
def component(name,fn):
    before=set(bpy.context.scene.objects);fn();parts=[o for o in bpy.context.scene.objects if o not in before]
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # UV-map assembled architecture for authored concrete and future atlases.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
    roots.append(o)
def bench():
    for x in [-4.3,4.3]:
        rod((x,0,0),(x,0,2.2),.045,steel)
        for i in range(9):
            a=math.pi/2*i/8;b=math.pi/2*(i+1)/8
            rod((x,math.sin(a)*1.4,1.1+math.cos(a)*1.1),(x,math.sin(b)*1.4,1.1+math.cos(b)*1.1),.04,steel)
    # Curved closed canopy, not a translucent box.
    for i in range(8):
        a=math.pi/2*(i+.5)/8;o=box((0,math.sin(a)*1.4,1.1+math.cos(a)*1.1),(8.9,.3,.035),navy);o.rotation_euler.x=a
    for x in [-3.6,-2.4,-1.2,0,1.2,2.4,3.6]:
        box((x,.6,.5),(.83,.73,.16),navy,.07);box((x,1.0,.94),(.83,.16,.8),navy,.07)
        rod((x,.6,.1),(x,.6,.45),.06,steel)
def stand():
    for row in range(6):
        y=row*.85;h=.35+row*.48;box((0,y,h/2),(12,.9,h),concrete)
        for col in range(15):
            x=-5.55+col*.79
            if col==7:continue
            box((x,y,h+.18),(.53,.5,.12),navy,.035);box((x,y+.2,h+.45),(.53,.1,.52),navy,.035)
    for x in [-6,0,6]:
        rod((x,5.4,0),(x,5.4,6.3),.08,steel);rod((x,-.5,5.8),(x,6,6.3),.07,steel)
    box((0,2.7,6.15),(12.5,7,.15),navy,.035)
    for x in [-6,6]:rod((x,-.5,1),(x,5.5,3.8),.025,steel)
def light():
    for x,y in [(-.35,-.35),(-.35,.35),(.35,-.35),(.35,.35)]:rod((x,y,0),(x*.6,y*.6,22),.065,steel)
    for z in range(0,22,2):
        for side in [-1,1]:
            rod((-.35,side*.35,z),(.35,side*.35,z+2),.025,steel);rod((side*.35,-.35,z),(side*.35,.35,z+2),.025,steel)
    box((0,0,22.3),(4,.4,2.3),navy,.08)
    for x in [-1.5,-.5,.5,1.5]:
        for z in [21.65,22.3,22.95]:box((x,-.24,z),(.75,.1,.45),lamp,.025)
def flag():
    rod((0,0,0),(0,0,1.65),.025,white)
    verts=[];faces=[]
    for row in range(5):
        for col in range(9):
            t=col/8;verts.append((t*.48,math.sin(t*8+row*.4)*.055*t,1.62-row*.07))
    for row in range(4):
        for col in range(8):a=row*9+col;faces.append((a,a+1,a+10,a+9))
    me=bpy.data.meshes.new('Waving fabric');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Flag cloth',me);bpy.context.collection.objects.link(o);finish(o,lime)
def goal():
    for x in [-3.66,3.66]:
        rod((x,0,0),(x,0,2.44),.06,white,16);rod((x,0,2.44),(x,1.8,2.44),.035,steel);rod((x,1.8,2.44),(x,1.8,0),.035,steel);rod((x,0,.04),(x,1.8,.04),.035,steel)
    rod((-3.66,0,2.44),(3.66,0,2.44),.06,white,20)
    # Net is a separate root so the runtime can animate only the impacted net.
def net():
    for i in range(42):
        x=-3.66+i*7.32/41;rod((x,1.8,.03),(x,1.8,2.44),.009,rope,4);rod((x,0,2.44),(x,1.8,2.44),.009,rope,4)
    for i in range(15):
        z=.03+i*2.41/14;rod((-3.66,1.8,z),(3.66,1.8,z),.009,rope,4)
        for x in [-3.66,3.66]:rod((x,0,z),(x,1.8,z),.009,rope,4)
    for i in range(11):
        y=i*.18;rod((-3.66,y,2.44),(3.66,y,2.44),.009,rope,4)
        for x in [-3.66,3.66]:rod((x,y,.03),(x,y,2.44),.009,rope,4)
def spectator():
    sphere((0,0,1.48),(.115,.1,.14),skin);sphere((0,0,1.13),(.2,.12,.27),navy)
    for s in [-1,1]:
        rod((s*.16,0,1.3),(s*.27,-.12,1.04),.055,navy);rod((s*.27,-.12,1.04),(s*.16,-.28,1.05),.04,skin)
        rod((s*.09,0,.9),(s*.1,-.24,.65),.065,navy);rod((s*.1,-.24,.65),(s*.1,-.21,.3),.045,navy)
        box((s*.1,-.26,.28),(.11,.22,.08),steel,.02)
def ball():
    o=sphere((0,0,0),(.19,.19,.19),leather,48,24);o.data.materials.append(black)
    for poly in o.data.polygons:
        c=poly.center;poly.material_index=1 if (int((math.atan2(c.y,c.x)+math.pi)/math.pi*5)+int(c.z*30))%4==0 else 0
for name,fn in [('bench',bench),('stand',stand),('floodlight',light),('flag',flag),('goal',goal),('net',net),('spectator',spectator),('ball',ball)]:component(name,fn)
# Authored high detail stays available; distant Auto crowds use real mesh LODs.
for name,ratio in [('spectator',.18),('stand',.38)]:
    source=next(o for o in roots if o.name==name);low=source.copy();low.data=source.data.copy();bpy.context.collection.objects.link(low);low.name=name+'-low'
    bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low
    mod=low.modifiers.new('Distant mesh LOD','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name);roots.append(low)
bpy.ops.object.select_all(action='DESELECT')
for o in roots:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'stadium-kit.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='EXPORT',export_extras=True)
print('TEST55 original stadium kit:',(OUT/'stadium-kit.glb').stat().st_size)
