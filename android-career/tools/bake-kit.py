"""Regenerate the native sprite sheet with the project's licensed skinned footballers."""
import base64
import io
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright

project=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    bundle=Path(tmp)/'kit.js'
    subprocess.run([str(project/'node_modules/.bin/esbuild'),str(Path(__file__).with_suffix('.mjs')),
                    '--bundle','--outfile='+str(bundle)],check=True)
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=[
        '--no-sandbox','--single-process','--no-zygote','--disable-crashpad-for-testing',
        '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page()
    def serve(route):
        name=urlsplit(route.request.url).path[1:]
        if not name:route.fulfill(body='<script src="/kit.js"></script>',content_type='text/html')
        elif name=='kit.js':route.fulfill(body=bundle.read_bytes(),content_type='text/javascript')
        else:route.fulfill(body=(project/'public/match-assets55'/name).read_bytes(),content_type='model/gltf-binary')
    page.route('**/*',serve)
    page.goto('https://kit.test/')
    raw=base64.b64decode(page.evaluate('() => bake()'))
    image=Image.open(io.BytesIO(raw))
    assert image.getchannel('A').getbbox() and image.size==(640,1920)
    image.save(project/'android-career/assets/kits.webp',quality=91,method=6)
    browser.close()
