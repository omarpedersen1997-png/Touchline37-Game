"""Render the original Touchline sharing card; no gameplay screenshot is implied."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import runpy

root = Path(__file__).resolve().parents[1]
RED, INK, PAPER, GREEN = '#cb2620', '#15191c', '#fffdf8', '#1f7a4d'
image = Image.new('RGB', (3840, 2160), RED)
raw = ImageDraw.Draw(image)
# Render the original vector layout and fonts directly at 4K, never resize a
# screenshot or a smaller sharing-card bitmap.
scale = 3.2
def coords(values):
    return tuple(round(v*scale) for v in values)
class VectorDraw:
    def __getattr__(self, name):
        def paint(points, *args, **kwargs):
            if 'width' in kwargs: kwargs['width'] = max(1, round(kwargs['width']*scale))
            return getattr(raw, name)(coords(points), *args, **kwargs)
        return paint
draw = VectorDraw()
def font(size, display=False, weight=600, width=None):
    face = ImageFont.truetype(str(root/'assets/fonts'/('Bricolage-Grotesque.ttf' if display else 'Instrument-Sans.ttf')), round(size*scale))
    axes = []
    for axis in face.get_variation_axes():
        name = axis['name'].decode() if isinstance(axis['name'], bytes) else axis['name']
        value = axis['default']
        if 'eight' in name: value = weight
        if 'idth' in name and width is not None: value = width
        axes.append(max(axis['minimum'], min(axis['maximum'], value)))
    face.set_variation_by_axes(axes)
    return face
# Original vector pitch artwork, deliberately separate from the actual app gallery.
draw.rectangle((800, 0, 1200, 675), fill='#1b2024')
draw.rectangle((840, 44, 1160, 631), fill=GREEN)
for y in range(44, 631, 98): draw.rectangle((840, y, 1160, min(631, y+49)), fill='#24825a')
line = dict(outline=PAPER, width=2)
draw.rectangle((860, 64, 1140, 611), **line)
draw.line((860, 337, 1140, 337), fill=PAPER, width=2)
draw.ellipse((945, 282, 1055, 392), **line)
draw.rectangle((920, 64, 1080, 140), **line)
draw.rectangle((920, 535, 1080, 611), **line)
draw.rectangle((965, 64, 1035, 92), **line)
draw.rectangle((965, 583, 1035, 611), **line)
for x, y in [(1000, 575), (910, 500), (970, 512), (1030, 512), (1090, 500), (940, 425), (1000, 440), (1060, 425), (925, 360), (1000, 372), (1075, 360)]:
    draw.ellipse((x-9, y-9, x+9, y+9), fill=PAPER, outline=INK, width=2)
brand = runpy.run_path(str(root/'scripts/render-brand-icons.py'))
brand['draw_brand_mark'](raw, coords((64, 56, 128, 120)), brand['load_brand_mark']())
draw.text((146, 60), 'Touchline', font=font(40, True, 700, 84), fill='#ffffff')
draw.text((148, 106), 'Fra OPNext Games', font=font(15, weight=500), fill='#ffffff')
draw.line((64, 216, 104, 216), fill='#ffffff', width=3)
draw.text((120, 205), 'FODBOLD · STRATEGI · IDLE TYCOON', font=font(17), fill='#ffffff')
draw.text((58, 246), 'Små begyndelser.', font=font(98, True, 800, 78), fill='#ffffff')
draw.text((58, 348), 'Store spiloplevelser.', font=font(98, True, 800, 78), fill=INK)
draw.text((64, 500), 'Led klubben  ·  Skab spilleren  ·  Spil kampen', font=font(22), fill='#ffffff')
draw.rectangle((64, 572, 736, 574), fill='#ffffff')
draw.text((64, 590), 'playtouchline.dk', font=font(22, weight=700), fill='#ffffff')
image.save(root/'assets/site/touchline-share.png', optimize=True)
