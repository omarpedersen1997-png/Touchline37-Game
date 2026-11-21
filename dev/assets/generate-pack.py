"""Rebuild original TEST55 textures and derived, animated MakeHuman GLBs.

Requires Python, Pillow, numpy, scipy. No network or signing material involved.
The existing football assets and engine files are read-only inputs.
"""
from pathlib import Path
import json, struct, copy, hashlib, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial.transform import Rotation

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/match-assets55'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(55037)

def image(name, pixels):
    Image.fromarray(np.uint8(np.clip(pixels,0,255))).save(OUT/name,compress_level=6)

# Seamless turf: explicitly authored fibre/noise detail, not a photograph.
n=2048
y,x=np.mgrid[:n,:n]
noise=rng.normal(0,1,(n,n))
fibres=np.sin(x*2.7+y*.27)*.3+np.sin(x*.15-y*.8)*.2
height=noise*.3+fibres
base=np.stack([48+height*13,100+height*22,30+height*10],axis=-1)
image('grass-color-2048.png',base)
dy,dx=np.gradient(height)
normal=np.stack([-dx*.34,-dy*.34,np.ones_like(dx)],axis=-1)
normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
image('grass-normal-2048.png',(normal*.5+.5)*255)
image('grass-roughness-2048.png',np.clip(220+noise*8,170,250))
for kind in ['color','normal','roughness']:
    with Image.open(OUT/f'grass-{kind}-2048.png') as im:
        im.resize((1024,1024),Image.Resampling.LANCZOS).save(OUT/f'grass-{kind}-1024.png')
n=1024;y,x=np.mgrid[:n,:n]
weave=(np.sin(x*np.pi/2)*np.sin(y*np.pi/2))*6+rng.normal(0,1,(n,n))*2
pattern=(np.sin((x+y*.4)/62)>0)*9
image('kit-fabric-1024.png',np.stack([225+weave-pattern]*3,axis=-1))
image('kit-roughness-1024.png',np.clip(195+weave*2,130,235))
image('kit-normal-1024.png',np.stack([128+np.cos(x*np.pi/2)*5,128+np.sin(y*np.pi/2)*5,np.full((n,n),254)],axis=-1))
image('boot-leather-1024.png',np.stack([48+weave,53+weave,58+weave],axis=-1))
grip=(np.sin(x*.2)*np.sin(y*.2)>0)*26
image('glove-grip-1024.png',np.stack([200+weave+grip,203+weave+grip,189+weave+grip],axis=-1))
image('stadium-concrete-1024.png',np.stack([126+weave*2,137+weave*2,145+weave*2],axis=-1))
font=ImageFont.truetype(str(ROOT/'assets/fonts/Barlow-Condensed.ttf'),130)
im=Image.new('RGB',(2048,512),'#0b253a');d=ImageDraw.Draw(im)
d.rectangle((0,468,2048,512),fill='#c1f66b')
d.text((1024,220),'TOUCHLINE  /  FOOTBALL',fill='#edf5ec',font=font,anchor='mm')
im.save(OUT/'stadium-board-2048.png')
im=Image.new('RGBA',(1024,1024),(0,0,0,0));d=ImageDraw.Draw(im)
d.regular_polygon((512,440,410),5,rotation=180,fill='#183e35',outline='#c1f66b',width=18)
d.text((512,390),'TL',font=ImageFont.truetype(str(ROOT/'assets/fonts/Barlow-Condensed.ttf'),300),fill='#c1f66b',anchor='mm')
d.text((512,650),'37',font=font,fill='#eef6eb',anchor='mm');im.save(OUT/'club-emblem-1024.png')
for size in [1024,2048]:
    im=Image.new('RGBA',(size,size),(0,0,0,0));d=ImageDraw.Draw(im);cell=size//4
    number_font=ImageFont.truetype(str(ROOT/'assets/fonts/Barlow-Condensed.ttf'),round(cell*.76))
    for number in range(1,17):
        col=(number-1)%4;row=(number-1)//4
        d.text((cell*(col+.5),cell*(row+.52)),str(number),font=number_font,fill='#f4f7ec',stroke_width=max(2,size//256),stroke_fill='#122632',anchor='mm')
    im.save(OUT/f'jersey-numbers-{size}.png')


class GLB:
    def __init__(self,path):
        b=path.read_bytes();size=struct.unpack_from('<I',b,12)[0]
        self.j=json.loads(b[20:20+size]);self.bin=bytearray(b[28+size:])
    def view(self,b):
        self.bin.extend(b'\0'*((-len(self.bin))%4));offset=len(self.bin);self.bin.extend(b)
        self.j.setdefault('bufferViews',[]).append({'buffer':0,'byteOffset':offset,'byteLength':len(b)})
        return len(self.j['bufferViews'])-1
    def accessor(self,data,kind,component=5126):
        a=np.asarray(data,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component]);size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[kind]
        count=a.size//size;a=a.reshape(count,size)
        self.j['accessors'].append({'bufferView':self.view(a.tobytes()),'componentType':component,'count':count,'type':kind,'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()})
        return len(self.j['accessors'])-1
    def texture(self,name):
        self.j.setdefault('images',[]).append({'bufferView':self.view((OUT/name).read_bytes()),'mimeType':'image/png','name':name})
        self.j.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497})
        self.j.setdefault('textures',[]).append({'source':len(self.j['images'])-1,'sampler':len(self.j['samplers'])-1})
        return len(self.j['textures'])-1
    def save(self,path):
        self.j['buffers'][0]['byteLength']=len(self.bin);self.bin.extend(b'\0'*((-len(self.bin))%4))
        s=json.dumps(self.j,separators=(',',':')).encode();s+=b' '*((-len(s))%4)
        path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(s)+len(self.bin))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(self.bin),0x004e4942)+self.bin)

motion=json.loads((ROOT/'assets/game/football-motion.json').read_text())
clips=copy.deepcopy(motion['clips'])
clips['sprint']=copy.deepcopy(clips['run']);clips['sprint']['duration']*=.82
# Original football actions layered in bone-local space over the captured pose.
for name,duration in [('turn',.42),('pass',.55),('shoot',.7),('tackle',.8),('dive',.85)]:
    frames=[]
    for i in range(25):
        f=copy.deepcopy(clips['idle']['frames'][0]);t=i/24;wave=math.sin(math.pi*t)
        changes={'turn':{'Spine2':(0,.32,0),'LeftUpLeg':(.16,0,0),'RightUpLeg':(-.16,0,0)},
                 'pass':{'RightUpLeg':(-.75,0,0),'RightLeg':(.45,0,0),'LeftArm':(-.2,0,.22)},
                 'shoot':{'RightUpLeg':(-1.15,0,0),'RightLeg':(.65,0,0),'Spine2':(.15,-.25,0),'LeftArm':(-.4,0,.45)},
                 'tackle':{'RightUpLeg':(-1.2,0,0),'RightLeg':(.15,0,0),'LeftUpLeg':(.7,0,0),'LeftArm':(-.4,0,.4)},
                 'dive':{'LeftArm':(-.7,0,1.3),'RightArm':(-.7,0,-1.3),'LeftUpLeg':(.3,0,.15),'RightUpLeg':(-.3,0,-.15)}}[name]
        for bone,angles in changes.items():
            k=motion['bones'].index(bone);r=Rotation.from_quat(f['rot'][k])*Rotation.from_euler('xyz',np.array(angles)*wave);f['rot'][k]=r.as_quat().tolist()
        frames.append(f)
    clips[name]={'duration':duration,'frames':frames}

def animate(g):
    nodes={n.get('name'):i for i,n in enumerate(g.j['nodes'])};g.j['animations']=[]
    for name,clip in clips.items():
        times=g.accessor(np.linspace(0,clip['duration'],len(clip['frames'])),'SCALAR');channels=[];samplers=[]
        for i,bone in enumerate(motion['bones']):
            if bone not in nodes:continue
            values=g.accessor([f['rot'][i] for f in clip['frames']],'VEC4');samplers.append({'input':times,'output':values,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':nodes[bone],'path':'rotation'}})
        values=g.accessor([f['root'] for f in clip['frames']],'VEC3');samplers.append({'input':times,'output':values,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':nodes['Hips'],'path':'translation'}})
        g.j['animations'].append({'name':name,'channels':channels,'samplers':samplers})
    g.j.setdefault('extras',{})['touchlineAssetPack']='TEST55'

def gloves(g):
    # Skinned glove shells follow the existing hand inverse bind matrices.
    skin=g.j['skins'][0];acc=g.j['accessors'][skin['inverseBindMatrices']];v=g.j['bufferViews'][acc['bufferView']]
    start=v.get('byteOffset',0)+acc.get('byteOffset',0)
    inverses=np.frombuffer(g.bin,dtype='<f4',count=16*len(skin['joints']),offset=start).reshape(-1,4,4).transpose(0,2,1).copy()
    tex=g.texture('glove-grip-1024.png');g.j['materials'].append({'name':'Keeper glove','pbrMetallicRoughness':{'baseColorTexture':{'index':tex},'roughnessFactor':.88}});mat=len(g.j['materials'])-1
    for side in ['LeftHand','RightHand']:
        node=next(i for i,n in enumerate(g.j['nodes']) if n.get('name')==side);joint=skin['joints'].index(node);matrix=np.linalg.inv(inverses[joint]);points=[];normals=[];uv=[];indices=[]
        for row in range(13):
            lat=math.pi*row/12
            for col in range(17):
                lon=2*math.pi*col/16;n=np.array([math.sin(lat)*math.cos(lon),math.cos(lat),math.sin(lat)*math.sin(lon)])
                p=n*np.array([.055,.105,.027])+[0,.065,0];points.append((matrix@np.r_[p,1])[:3]);normal=matrix[:3,:3]@n;normals.append(normal/np.linalg.norm(normal));uv.append([col/16,row/12])
        for row in range(12):
            for col in range(16):
                a=row*17+col;b=a+17;indices.extend([a,b,a+1,a+1,b,b+1])
        attrs={'POSITION':g.accessor(points,'VEC3'),'NORMAL':g.accessor(normals,'VEC3'),'TEXCOORD_0':g.accessor(uv,'VEC2'),'JOINTS_0':g.accessor([[joint,0,0,0]]*len(points),'VEC4',5123),'WEIGHTS_0':g.accessor([[1,0,0,0]]*len(points),'VEC4')}
        g.j['meshes'].append({'name':side+' glove','primitives':[{'attributes':attrs,'indices':g.accessor(indices,'SCALAR',5123),'material':mat}]})
        g.j['nodes'].append({'name':side+' glove','mesh':len(g.j['meshes'])-1,'skin':0});g.j['nodes'][g.j['scenes'][0]['nodes'][0]].setdefault('children',[]).append(len(g.j['nodes'])-1)

for lod,original in [('auto','football-auto.glb'),('detail','football-pro.glb')]:
    for role in ['player','keeper']:
        g=GLB(ROOT/'assets/game'/original);animate(g)
        # Shirt colour remains runtime-tinted; actual UV fabric maps live in GLB.
        fabric=g.texture('kit-fabric-1024.png');normal=g.texture('kit-normal-1024.png')
        for m in g.j['materials']:
            if 'Football Shirt' in m['name'] or 'Football Shorts' in m['name']:
                m['pbrMetallicRoughness']['baseColorTexture']={'index':fabric};m['normalTexture']={'index':normal,'scale':.2}
        if role=='keeper':gloves(g)
        g.save(OUT/f'{role}-{lod}.glb')
print('Textures and four skinned, animated GLBs generated',sum(p.stat().st_size for p in OUT.iterdir() if p.is_file()))
