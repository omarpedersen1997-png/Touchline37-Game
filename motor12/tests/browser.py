"""Browser smoke test for an already built Motor 12 static directory."""
from pathlib import Path
import mimetypes
import sys
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve()
origin = 'https://motor12.touchline.test'
errors = []
missing = []

def serve(route):
    url = urlsplit(route.request.url)
    if url.hostname != 'motor12.touchline.test':
        route.abort()
        missing.append(url.geturl())
        return
    file = root / (url.path.lstrip('/') or 'index.html')
    if not file.is_file():
        missing.append(url.path)
        route.fulfill(status=404)
        return
    kind = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
    route.fulfill(body=file.read_bytes(), content_type=kind)

def wait(page, text):
    page.get_by_text(text, exact=True).first.wait_for()

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.url

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=[
        '--no-sandbox', '--single-process', '--no-zygote', '--disable-crashpad-for-testing'])
    page = browser.new_page(viewport={'width': 1280, 'height': 850}, reduced_motion='reduce')
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', serve)
    page.goto(origin+'/index.html')
    assert page.locator('h1').inner_text().split() == ['SIDELINJEN', 'ER', 'DIN.']
    page.wait_for_function('document.querySelector(".hero-cover img").naturalWidth > 0')
    assert page.locator('body').evaluate('el=>getComputedStyle(el).backgroundColor') == 'rgb(245, 239, 227)'
    for width in [320, 384, 1280]:
        page.set_viewport_size({'width': width, 'height': 850})
        no_overflow(page)
        if width == 384 and len(sys.argv) > 2:
            page.screenshot(path=sys.argv[2]+'/motor12-forside-mobil.png')
    if len(sys.argv) > 2:
        page.screenshot(path=sys.argv[2]+'/motor12-forside.png', full_page=True)
    assert page.locator('.countdown b').count() == 4
    page.get_by_role('link', name='Support').click()
    assert page.get_by_role('link', name='Åbn kontaktformularen').get_attribute('href') == 'https://playtouchline.dk/contact'
    page.get_by_role('link', name='Læs om kontosletning').click()
    assert page.get_by_role('link', name='Anmod om kontosletning').get_attribute('href').endswith('topic=deletion')
    page.get_by_role('link', name='Privatliv').click()
    wait(page, 'Motor 12-udgaven')
    page.goto(origin+'/index.html')
    page.get_by_role('link', name='Start prøvekamp').click()
    page.get_by_role('button', name='Kick Off').wait_for()
    assert page.locator('.scoreboard strong').first.inner_text() == 'Prøvelund BK'
    assert page.locator('.match-sheet canvas:visible').count() == 1
    page.clock.install()
    page.clock.run_for(600)
    assert page.locator('#clock').inner_text() == '00:00'
    for width,height in [(320,800),(390,830),(844,390),(1280,850)]:
        page.set_viewport_size({'width':width,'height':height})
        no_overflow(page)
        if width == 390 and len(sys.argv) > 2:
            page.screenshot(path=sys.argv[2]+'/motor12-kamp-mobil.png')
    if len(sys.argv) > 2:
        page.screenshot(path=sys.argv[2]+'/motor12-kamp.png')
    page.get_by_role('button', name='4×').click()
    page.get_by_role('button', name='Kick Off').click()
    page.clock.run_for(220)
    score_clock = page.locator('#clock')
    assert score_clock.inner_text() != '00:00'
    page.get_by_role('button',name='Pause', exact=True).click()
    paused = score_clock.inner_text()
    page.clock.run_for(500)
    assert score_clock.inner_text() == paused
    page.get_by_role('button',name='Taktik',exact=True).click()
    page.get_by_label('Formation').select_option('3-5-2')
    page.get_by_label('Mentalitet').select_option('attack')
    page.get_by_label('Preshøjde').select_option('high')
    page.get_by_role('button',name='Tilbage til kampen').click()
    assert page.get_by_role('button',name='Genoptag').is_visible()
    assert '3-5-2' in page.locator('#events').inner_text()
    page.goto(origin+'/play/index.html')
    page.set_viewport_size({'width':390,'height':820})
    assert page.locator('.app-nav').evaluate('el=>getComputedStyle(el).position') == 'fixed'
    no_overflow(page)
    if len(sys.argv) > 2:
        page.screenshot(path=sys.argv[2]+'/motor12-klub-mobil.png')
    page.get_by_role('link', name='Trup').click()
    page.get_by_label('Spiller ud').select_option('4')
    page.get_by_role('button', name='Bekræft skift').click()
    wait(page, 'Skiftet er gennemført.')
    page.get_by_role('link', name='Kamp', exact=True).click()
    assert page.get_by_role('button', name='Kick Off').is_visible()
    page.reload()
    assert page.get_by_role('button', name='Kick Off').is_visible()
    assert page.locator('#clock').inner_text() == '00:00'
    page.goto(origin+'/play/index.html?demo=1')
    page.get_by_role('button', name='4×').click()
    stopped = []
    for _ in range(5):
        page.get_by_role('button', name='Kick Off').click()
        page.clock.run_for(25500)
        phase = page.locator('#phase').inner_text()
        if phase == 'Slutfløjt':
            break
        assert 'afspark' in phase or 'halvleg' in phase, phase
        clock_before = page.locator('#clock').inner_text()
        page.clock.run_for(300)
        assert page.locator('#clock').inner_text() == clock_before
        stopped.append(phase)
    assert any('Mål' in phase for phase in stopped), stopped
    assert any('Halvleg' in phase for phase in stopped), stopped
    assert page.locator('#clock').inner_text() == '90:00'
    wait(page, 'SLUTFLØJT · KAMPRAPPORT')
    assert not errors, errors
    assert not missing, missing
    browser.close()

print('BESTÅET: 5 sider, links, 320/384 px, liggende mobil, kickoff, pause, taktik, trup, genindlæsning, mål, halvleg og slutrapport.')
