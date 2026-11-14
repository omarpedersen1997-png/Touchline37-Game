"""Capture actual current APK web UI in Chromium at native 4K (no resize).

The runtime serves the byte-identical HTML extracted from the signed APK and
the application's real API using isolated SQLite storage. These are web-view
captures, not photographs of an Android device or an assertion of phone FPS.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import zipfile
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
digest=lambda data:hashlib.sha256(data).hexdigest()

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--port',type=int,default=4321)
 parser.add_argument('--auth-only',action='store_true')
 parser.add_argument('--diagnose-layout',action='store_true')
 parser.add_argument('--match-only',action='store_true')
 args=parser.parse_args()
 release=json.loads((ROOT/'release/downloads/current.json').read_text())
 apk=ROOT/'release/downloads'/release['apk'];apk_bytes=apk.read_bytes();apk_hash=digest(apk_bytes)
 assert apk_hash==release['sha256'],'APK checksum does not match release metadata.'
 with zipfile.ZipFile(io.BytesIO(apk_bytes))as archive:html=archive.read('assets/public/index.html')
 page_hash=digest(html)
 assert html==(ROOT/'native-web/index.html').read_bytes(),'Build/sync the exact current APK before capturing.'
 capture_dir=ROOT/'assets/site/captures';capture_dir.mkdir(parents=True,exist_ok=True)
 manifest_path=ROOT/'release/site-captures.json'
 manifest={'schemaVersion':1,'required':True,'versionCode':release['versionCode'],'apkSha256':apk_hash,'screenshots':[]}
 if args.match_only and manifest_path.exists():
  existing=json.loads(manifest_path.read_text())
  if existing.get('apkSha256')==apk_hash and existing.get('versionCode')==release['versionCode']:manifest=existing
 def capture(page,identifier,title,description,alt):
  if args.diagnose_layout or (args.match_only and identifier!='match'):return
  if identifier=='match':
   # Pause the genuine frame so software GL finishes readback without another render.
   # The canvas already contains native 4K pixels; CDP captures the viewport at
   # its configured 4x device scale, with no image resizing afterward.
   cdp=page.context.new_cdp_session(page)
   cdp.send('Debugger.enable');cdp.send('Debugger.pause')
   try:pixels=base64.b64decode(cdp.send('Page.captureScreenshot',{'format':'jpeg','quality':98,'fromSurface':True,'captureBeyondViewport':True,'clip':{'x':0,'y':0,'width':960,'height':540,'scale':4}})['data'])
   finally:
    cdp.send('Debugger.resume');cdp.detach()
  else:pixels=page.screenshot(type='jpeg',quality=98,full_page=False,animations='disabled',scale='device',timeout=90000)
  with Image.open(io.BytesIO(pixels))as image:
   assert image.size==(3840,2160),image.size
   image.verify()
  filename=f'{identifier}-{release["versionCode"]}-{apk_hash[:12]}.jpg'
  (capture_dir/filename).write_bytes(pixels)
  entry={'id':identifier,'src':'/assets/captures/'+filename,'title':title,'description':description,'alt':alt,'width':3840,'height':2160,'sha256':digest(pixels),'capturedAt':datetime.now(timezone.utc).isoformat(),'provenance':{'method':'Chromium screenshot of exact signed APK web UI','renderedApkSha256':apk_hash,'nativePageSha256':page_hash,'pixelProcessing':'none (direct browser JPEG capture)','format':'image/jpeg','quality':98,'runtime':'isolated real Worker API and SQLite','viewport':{'width':960,'height':540,'deviceScaleFactor':4}}}
  entry['provenance']['renderProfile']='Chromium web UI (not an installed Android device screenshot)'
  if identifier=='match':entry['provenance']['frameCapture']='Paused genuine rendered frame, direct CDP viewport capture at configured 4x device scale; native canvas 3840x2160'
  manifest['screenshots']=[item for item in manifest['screenshots']if item['id']!=identifier]+[entry]
  temp_manifest=manifest_path.with_suffix('.json.tmp')
  temp_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');temp_manifest.replace(manifest_path)
  print(json.dumps({'capture':entry['src'],'bytes':len(pixels),'width':3840,'height':2160}),flush=True)
 with tempfile.TemporaryDirectory(prefix='touchline-web-capture-')as folder:
  temp=Path(folder);(temp/'index.html').write_bytes(html)
  subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-keyout',str(temp/'key.pem'),'-out',str(temp/'cert.pem'),'-days','1','-nodes','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  log=(ROOT/'outputs/app-web-capture-server.log').open('w')
  server=subprocess.Popen(['node','scripts/app-capture-server.mjs','--html',str(temp/'index.html'),'--key',str(temp/'key.pem'),'--cert',str(temp/'cert.pem'),'--port',str(args.port)],cwd=ROOT,stdout=log,stderr=log)
  try:
   from urllib.request import urlopen
   import ssl
   origin=f'https://127.0.0.1:{args.port}'
   for _ in range(100):
    if server.poll()is not None:raise RuntimeError('Capture server failed; inspect outputs/app-web-capture-server.log')
    try:
     with urlopen(origin+'/',context=ssl._create_unverified_context(),timeout=1)as response:assert response.status==200
     break
    except OSError:time.sleep(.1)
   with sync_playwright()as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':960,'height':540},device_scale_factor=4,is_mobile=False,has_touch=True,ignore_https_errors=True,color_scheme='dark')
    context.route('**/*',lambda route:route.continue_()if route.request.url.startswith((origin,'data:','blob:'))else route.abort())
    page=context.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(origin+'/',wait_until='networkidle');page.get_by_role('heading',name='Velkommen tilbage.').wait_for()
    page.evaluate('document.fonts.ready');page.wait_for_timeout(400)
    assert not errors,errors
    if args.auth_only:capture(page,'login','Dit næste kapitel.','Appens login i bredformat, optaget direkte fra den aktuelle webvisning.','Touchlines aktuelle login i bredformat med det nye logo, optaget i 4K fra webvisningen.')
    if not args.auth_only:
     page.get_by_role('button',name='Opret konto',exact=True).click()
     page.get_by_label('E-mailadresse',exact=True).fill('capture-'+secrets.token_hex(5)+'@example.test')
     page.get_by_role('button',name='Fortsæt',exact=True).click()
     password=secrets.token_urlsafe(24)
     page.locator('#auth-password').fill(password);page.locator('#auth-confirm').fill(password)
     page.get_by_role('button',name='Opret min klub',exact=True).click()
     try:page.locator('.app-shell[data-page=club]').wait_for(timeout=20000)
     except Exception:
      page.screenshot(path=str(ROOT/'outputs/app-capture-debug.png'),full_page=False)
      print('CAPTURE_DEBUG '+page.locator('body').inner_text()[:5000],flush=True)
      print('PAGE_ERRORS '+json.dumps(errors),flush=True)
      raise
     page.locator('.welcome-strip').click()
     page.get_by_label('Klubnavn',exact=True).fill('Nordhavn FC')
     page.get_by_role('button',name='Gem klubnavn',exact=True).click()
     page.locator('.welcome-strip').wait_for(state='hidden')
     if page.get_by_role('button',name='Luk besked',exact=True).is_visible():page.get_by_role('button',name='Luk besked',exact=True).click()
     page.wait_for_timeout(300)
     print('LAYOUT '+json.dumps(page.evaluate('''()=>[".game-hub",".game-career-feature",".game-feature-copy",".game-feature-player",".game-feature-actions",".game-destinations",".game-world-grid",".game-cup-tile",".game-club-strip",".welcome-strip",".app-bottom-nav"].map(selector=>{const e=document.querySelector(selector);if(!e)return{selector,missing:true};const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{selector,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,display:s.display,gridColumn:s.gridColumn,gridRow:s.gridRow,alignItems:s.alignItems,alignSelf:s.alignSelf,minHeight:s.minHeight,maxHeight:s.maxHeight,position:s.position,objectPosition:s.objectPosition}})''')),flush=True)
     if args.diagnose_layout:return
     page.evaluate('window.scrollTo(0,0)')
     action_box=page.get_by_role('button',name='Spil selv i 3D',exact=False).first.bounding_box()
     nav_box=page.locator('.app-bottom-nav').bounding_box()
     assert action_box and nav_box and action_box['y']+action_box['height']<=nav_box['y']+1,{'manualAction':action_box,'navigation':nav_box}
     print('LANDSCAPE_CTA '+json.dumps({'manualAction':action_box,'navigation':nav_box}),flush=True)
     capture(page,'clubhouse','Dit klubhus.','Klubbens næste kamp og overblik i den aktuelle webvisning.','Touchlines klubhus i bredformat, optaget direkte i 4K fra den aktuelle webvisning.')
     page.get_by_role('button',name='Mit hold',exact=True).click()
     page.get_by_role('heading',name='Hold & taktik.').wait_for();page.wait_for_timeout(400)
     page.locator('.game-squad-pitch').evaluate('(e)=>window.scrollTo(0,window.scrollY+e.getBoundingClientRect().top-70)')
     page.wait_for_timeout(200)
     capture(page,'team','Dit hold. Din plan.','Startopstilling, formation og taktik i appens webvisning.','Touchlines holdvisning i bredformat, optaget direkte i 4K fra den aktuelle webvisning.')
     page.get_by_role('button',name='Klubcenter',exact=True).click()
     page.get_by_role('heading',name='Klubcenter.').wait_for();page.wait_for_timeout(400)
     page.locator('.exp-section-intro').first.evaluate('(e)=>window.scrollTo(0,window.scrollY+e.getBoundingClientRect().top-70)')
     page.wait_for_timeout(200)
     capture(page,'center','Klubbens retning.','Klubbens udvikling og DNA i den aktuelle webvisning.','Touchlines klubcenter i bredformat, optaget direkte i 4K fra den aktuelle webvisning.')
     page.get_by_role('button',name='Kluboverblik',exact=True).click()
     page.locator('.app-shell[data-page=club]').wait_for()
     page.get_by_role('button',name='Spil selv i 3D',exact=False).first.click()
     page.get_by_role('dialog',name='Kampdag').wait_for(timeout=30000)
     page.get_by_text('Banen gøres klar…',exact=True).wait_for(state='hidden',timeout=60000)
     page.wait_for_timeout(1000)
     state=page.request.get(origin+'/api/game').json()['state'];active=state['active']
     assert active['manual']['version']==10 and active['ends']-active['started']==250000,active['manual']
     dims=page.locator('.manual-field canvas').evaluate('(c)=>({width:c.width,height:c.height})')
     if max(dims.values())<3840:
      page.get_by_role('button',name='Kampindstillinger',exact=True).click()
      page.get_by_label('Grafikkvalitet',exact=True).select_option('4k')
      page.get_by_role('button',name='Tilbage på banen',exact=True).first.click()
      page.get_by_text('Banen gøres klar…',exact=True).wait_for(state='hidden',timeout=60000)
      page.wait_for_timeout(800)
      dims=page.locator('.manual-field canvas').evaluate('(c)=>({width:c.width,height:c.height})')
     assert max(dims.values())>=3840,dims
     capture(page,'match','Træd ind på banen.','En aktuel 11 mod 11-kamp i 4K fra appens fælles webvisning.','Touchlines aktuelle 3D-kamp med spillerne, banen, resultattavlen og berøringsstyring, optaget direkte i 4K fra webvisningen.')
     assert not errors,errors
     print(json.dumps({'gameCanvas':dims,'pageErrors':errors}),flush=True)
     order={'match':0,'clubhouse':1,'team':2,'center':3}
     manifest['screenshots']=sorted((item for item in manifest['screenshots']if item['id']in order),key=lambda item:order[item['id']])
     temp_manifest=manifest_path.with_suffix('.json.tmp')
     temp_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');temp_manifest.replace(manifest_path)
    context.close()
    portrait=browser.new_context(viewport={'width':540,'height':960},screen={'width':540,'height':960},device_scale_factor=1,is_mobile=True,has_touch=True,ignore_https_errors=True,color_scheme='dark')
    portrait.route('**/*',lambda route:route.continue_()if route.request.url.startswith((origin,'data:','blob:'))else route.abort())
    portrait_page=portrait.new_page();portrait_errors=[]
    portrait_page.on('pageerror',lambda error:portrait_errors.append(str(error)))
    portrait_page.goto(origin+'/',wait_until='networkidle')
    portrait_page.get_by_role('heading',name='Vend skærmen på langs.',exact=True).wait_for()
    assert not portrait_page.locator('#auth-email').is_visible()
    assert portrait_page.locator('.app-orientation-content').get_attribute('hidden') is not None
    assert portrait_page.locator('.app-orientation-content').get_attribute('inert') is not None
    assert not portrait_errors,portrait_errors
    print('PORTRAIT_GATE '+json.dumps({'blocked':True,'loginHidden':True,'childrenMounted':portrait_page.locator('#auth-email').count()==1,'consoleErrors':portrait_errors}),flush=True)
    portrait.close();browser.close()
  finally:
   server.terminate()
   try:server.wait(timeout=5)
   except subprocess.TimeoutExpired:server.kill();server.wait()
   log.close()

if __name__=='__main__':main()
