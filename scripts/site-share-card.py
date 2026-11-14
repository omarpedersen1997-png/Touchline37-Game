"""Render the original Touchline sharing card; no gameplay screenshot is implied."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import runpy

root = Path(__file__).resolve().parents[1]
image = Image.new('RGB', (3840, 2160))
raw = ImageDraw.Draw(image)
for y in range(2160):
    t = y / 2159
    raw.line((0,y,3840,y), fill=tuple(round(a+(b-a)*t) for a,b in zip((11,20,29),(22,45,52))))
# Render the original vector layout and fonts directly at 4K, never resize a
# screenshot or a smaller sharing-card bitmap.
scale=3.2
def coords(values):
    return tuple(round(v*scale+(72 if i%2 else 0)) for i,v in enumerate(values))
class VectorDraw:
    def __getattr__(self,name):
        def paint(points,*args,**kwargs):
            if 'width' in kwargs:kwargs['width']=max(1,round(kwargs['width']*scale))
            if 'radius' in kwargs:kwargs['radius']=round(kwargs['radius']*scale)
            return getattr(raw,name)(coords(points),*args,**kwargs)
        return paint
draw=VectorDraw()
lime = '#c3f85c'
font = lambda size, condensed=False: ImageFont.truetype(str(root/'assets/fonts'/('Barlow-Condensed.ttf' if condensed else 'DM-Sans.ttf')), round(size*scale))
# Original vector pitch artwork, deliberately separate from the actual app gallery.
draw.rounded_rectangle((820, 60, 1280, 570), radius=40, fill='#193c39', outline='#34574d', width=2)
for x in range(840,1280,52): draw.rectangle((x,80,x+26,550),fill='#1e433a')
draw.rectangle((850,95,1250,535), outline='#638868', width=3)
draw.line((850,315,1250,315), fill='#638868', width=3)
draw.ellipse((981,247,1119,383), outline='#638868', width=3)
draw.rectangle((950,95,1150,170), outline='#638868', width=3)
draw.rectangle((950,460,1150,535), outline='#638868', width=3)
for x,y in [(920,415),(1000,395),(1110,420),(1045,315),(1150,260),(930,220)]:
    draw.ellipse((x-8,y-8,x+8,y+8),fill=lime)
brand=runpy.run_path(str(root/'scripts/render-brand-icons.py'))
brand['draw_brand_mark'](raw,coords((64,60,128,124)),brand['load_brand_mark']())
draw.text((148,66),'touchline',font=font(37),fill='#f2f7ec')
draw.text((150,110),'FRA OPNEXT GAMES',font=font(13),fill='#b8c8ce')
draw.line((64,202,100,202), fill=lime, width=3)
draw.text((117,190),'DIN KLUB. DIN FODBOLDHISTORIE.',font=font(16),fill='#bfd4ca')
draw.text((60,242),'Små begyndelser.',font=font(83,True),fill='#f2f7ec')
draw.text((60,335),'Store spiloplevelser.',font=font(83,True),fill=lime)
draw.text((66,490),'LED KLUBBEN  ·  SKAB SPILLEREN  ·  SPIL KAMPEN',font=font(16),fill='#c7d5d9')
draw.line((64,550,748,550),fill='#38514f',width=1)
draw.text((65,575),'ANDROID + WEB',font=font(17),fill='#f2f7ec')
draw.text((490,575),'playtouchline.dk',font=font(17),fill='#c3f85c')
image.save(root/'assets/site/touchline-share.png', optimize=True)
