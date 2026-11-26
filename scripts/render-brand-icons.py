"""Rasterize the original shared vector for each native icon density.

The source is shared/brand-mark.js, never a smaller input image. Supersampling
only antialiases each vector render; it does not enlarge an existing bitmap.
"""
import json
from pathlib import Path
import re
import subprocess
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def load_brand_mark():
    return json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import{BRAND_MARK}from'./shared/brand-mark.js';process.stdout.write(JSON.stringify(BRAND_MARK));"
    ], cwd=ROOT, text=True))


def path_points(path):
    """Read the logo's absolute M/L/H/V/Z path data without an SVG dependency."""
    tokens = re.findall(r'[MLHVZ]|-?\d+(?:\.\d+)?', path)
    points, x, y, index, command = [], 0.0, 0.0, 0, None
    while index < len(tokens):
        if tokens[index] in 'MLHVZ':
            command = tokens[index]
            index += 1
            if command == 'Z':
                break
        if command in ('M', 'L'):
            x, y = float(tokens[index]), float(tokens[index+1])
            index += 2
        elif command == 'H':
            x = float(tokens[index])
            index += 1
        elif command == 'V':
            y = float(tokens[index])
            index += 1
        else:
            raise ValueError('Unsupported brand path command')
        points.append((x, y))
    return points


def draw_brand_mark(draw, box, brand=None, tile=True, round_icon=False):
    """Draw the exact shared monogram in a square box on an existing canvas."""
    brand = brand or load_brand_mark()
    left, top, right, bottom = box
    sx, sy = (right-left)/64, (bottom-top)/64
    point = lambda p: (left+p[0]*sx, top+p[1]*sy)
    bounds = (*point((0, 0)), *point((64, 64)))
    if tile:
        if round_icon:
            draw.ellipse(bounds, fill=brand['background'])
        else:
            draw.rounded_rectangle(bounds, radius=13*sx, fill=brand['background'])
    # Centre circle, its clearance around the halfway line, then the T on top.
    ring = brand['ring']
    cx, cy, r, w = ring['cx'], ring['cy'], ring['r'], ring['width']
    draw.ellipse((*point((cx-r-w/2, cy-r-w/2)), *point((cx+r+w/2, cy+r+w/2))), fill=brand['accent'])
    draw.ellipse((*point((cx-r+w/2, cy-r+w/2)), *point((cx+r-w/2, cy+r-w/2))), fill=brand['background'])
    draw.polygon([point(p) for p in path_points(brand['gap'])], fill=brand['background'])
    draw.polygon([point(p) for p in path_points(brand['t'])], fill=brand['accent'])


def render_icon(size, brand, round_icon=False, opaque=False):
    aa = 4
    image = Image.new('RGBA', (size*aa, size*aa), brand['background'] if opaque else (0, 0, 0, 0))
    draw_brand_mark(ImageDraw.Draw(image), (0, 0, size*aa, size*aa), brand, round_icon=round_icon)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    return image.convert('RGB') if opaque else image


def adaptive_foreground(brand):
    ring = brand['ring']
    cx, cy, r = ring['cx'], ring['cy'], ring['r']
    ring_path = f'M{cx-r} {cy}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0Z'
    return ('<vector xmlns:android="http://schemas.android.com/apk/res/android" '
            'android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">'
            # Keep the full monogram inside Android's central 66dp safe circle.
            '<group android:translateX="18.8" android:translateY="18.8" android:scaleX="1.1" android:scaleY="1.1">'
            f'<path android:fillColor="#00000000" android:strokeColor="{brand["accent"]}" '
            f'android:strokeWidth="{ring["width"]}" android:pathData="{ring_path}"/>'
            f'<path android:fillColor="{brand["background"]}" android:pathData="{brand["gap"]}"/>'
            f'<path android:fillColor="{brand["accent"]}" android:pathData="{brand["t"]}"/>'
            '</group></vector>\n')


def main():
    brand = load_brand_mark()
    resources = ROOT/'android/app/src/main/res'
    for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
        folder = resources/f'mipmap-{density}'
        folder.mkdir(parents=True, exist_ok=True)
        render_icon(size, brand).save(folder/'ic_launcher.png', optimize=True)
        render_icon(size, brand, round_icon=True).save(folder/'ic_launcher_round.png', optimize=True)
    render_icon(512, brand, opaque=True).save(ROOT/'release/store-assets/icon-512.png', optimize=True)
    foreground = adaptive_foreground(brand)
    for folder in ['drawable', 'drawable-v24']:
        (resources/folder/'ic_launcher_foreground.xml').write_text(foreground)
    (resources/'drawable/ic_launcher_background.xml').write_text(
        '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">'
        f'<solid android:color="{brand["background"]}"/></shape>\n')
    (resources/'values/ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>'
        f'<color name="ic_launcher_background">{brand["background"]}</color></resources>\n')
    print('Rendered original Touchline vector into five Android icon densities and the 512px store icon.')


if __name__ == '__main__':
    main()
