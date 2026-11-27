"""Motor 12's 3D view, assets, camera and return to 2D on a real WebGL context."""
from pathlib import Path
import mimetypes
import sys
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root=Path(sys.argv[1]).resolve()
origin='https://motor12-arena.touchline.test'
seen=set()
issues=[]
def route(request):
    target=urlsplit(request.request.url)
    assert target.hostname=='motor12-arena.touchline.test', target.geturl()
    file=root/(target.path.lstrip('/') or 'index.html')
    if not file.is_file():
        issues.append('missing '+target.path)
        request.fulfill(status=404)
        return
    seen.add(target.path)
    request.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=[
        '--no-sandbox','--disable-crashpad-for-testing','--single-process','--no-zygote',
        '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1080,'height':510})
    page.set_default_timeout(18000)
    page.route('**/*',route)
    page.on('pageerror',lambda e:issues.append(str(e)))
    page.on('console',lambda e:issues.append(e.text[:250]) if e.type=='error' else None)
    page.goto(origin+'/play/index.html?demo=1')
    page.get_by_role('button',name='Arena 3D').click()
    canvas=page.locator('#pitch3d')
    canvas.wait_for(state='visible')
    assert canvas.evaluate('c => !!c.getContext("webgl2") && c.width > 100 && c.height > 100')
    assert page.locator('#clock').inner_text()=='00:00'
    assert {'/assets/arena/player-auto.glb','/assets/arena/keeper-auto.glb'}<=seen
    page.get_by_role('button',name='Udvid').click()
    assert page.locator('.match-expanded').is_visible()
    if len(sys.argv)>2: page.screenshot(path=sys.argv[2]+'/motor12-arena.png',timeout=18000)
    page.get_by_role('button',name='Kick Off').click()
    page.wait_for_function('document.querySelector("#clock").textContent!=="00:00"')
    page.get_by_role('button',name='Kampmenu').click()
    page.get_by_role('button',name='Nærkamera').click()
    assert page.get_by_role('button',name='Nærkamera').get_attribute('aria-pressed')=='true'
    page.get_by_role('button',name='Kampmenu').click()
    page.get_by_role('button',name='Pause',exact=True).click()
    if len(sys.argv)>2: page.screenshot(path=sys.argv[2]+'/motor12-naer.png',timeout=18000)
    paused=page.locator('#clock').inner_text()
    page.get_by_role('button',name='Kampmenu').click()
    page.get_by_role('button',name='Taktisk',exact=True).click()
    assert page.locator('#pitch').is_visible()
    assert not canvas.is_visible()
    assert paused==page.locator('#clock').inner_text()
    page.keyboard.press('Escape')
    assert page.locator('.match-expanded').count()==0
    page.set_viewport_size({'width':390,'height':840})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width':844,'height':390})
    page.goto(origin+'/index.html')
    page.evaluate("""async()=>{
      const {newClub,nextMatch,saveClub}=await import('/src/club.js');
      const {kickOff,PHASE}=await import('/src/engine.js');
      const club=newClub(),m=nextMatch(club);kickOff(m);m.tick=730;
      Object.assign(m.ball,{x:31,y:2,z:.11,vx:0,vy:0,vz:0,owner:-1,lastTeam:-1,target:-1});
      Object.assign(m.teams[0].players[7],{x:30.3,y:2,vx:0,vy:0});
      m.phase=PHASE.DEAD_BALL;m.restart={kind:'free-kick',side:0,slot:7,end:758};
      saveClub(club,localStorage);
    }""")
    page.goto(origin+'/play/index.html#overview')
    page.get_by_role('button',name='Spil selv').click()
    page.locator('#pitch3d').wait_for(state='visible')
    page.get_by_role('button',name='Genoptag').click()
    page.wait_for_function("document.querySelector('#active-player').textContent==='Dit frispark'")
    page.wait_for_function('JSON.parse(localStorage.getItem("touchline:motor12:local:v1")).active.restart.ready === true')
    if len(sys.argv)>2: page.screenshot(path=sys.argv[2]+'/motor12-frispark.png')
    page.get_by_role('button',name='Skyd',exact=True).click()
    page.wait_for_function("document.querySelector('#events').textContent.includes('Afslutning')")
    assert not issues,issues
    browser.close()
print('BESTÅET: 3D-modeller, WebGL, manuelt afspark, udvidet bane, nærkamera, pause og skift til 2D.')
