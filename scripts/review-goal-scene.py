"""Repeatable visual QA for a real engine10 goal and the production 3D renderer.

The deterministic shot is a test fixture, not a recorded user match. All images
stay in ignored outputs/ and must never be used as website screenshots.
Uses the preinstalled Chromium and Python Playwright; installs nothing.
"""
import argparse
from functools import partial
import http.server
import json
from pathlib import Path
import subprocess
import tempfile
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

HARNESS = r"""
import {createArcade,stepArcade,STEP_MS} from './shared/football-goals.js';
import {prepareMatchSceneAssets,createMatchScene} from './src/manual-scene.js';
import {matchCamera} from './src/match-camera.js';
import {goalCameraPlan} from './src/goal-presentation.js';
import * as THREE from 'three';
const clone=value=>structuredClone(value),states=[];
const state=createArcade('goal-visual-review',{homeRating:65,awayRating:50,matchVersion:10});
state.tick=1000;
Object.assign(state.home[10],{x:1.1,y:-40,vx:0,vy:-2,facingX:0,facingY:-1});
Object.assign(state.home[8],{x:-6,y:-38,vx:0,vy:-1});
Object.assign(state.home[9],{x:7,y:-37,vx:0,vy:-1});
Object.assign(state.away[0],{x:-3.4,y:-45.2,vx:0,vy:0});
Object.assign(state.ball,{owner:null,x:1.1,y:-44,z:.55,vx:.25,vy:-20,vz:1,
 shot:true,lastShooter:{team:'home',index:10},lastTouch:{team:'home',index:10},
 lastTeam:'home',protected:0});
state.stats.homeShots=1;
states.push(clone(state));
for(let i=0;i<130;i++){stepArcade(state,0);states.push(clone(state));}
const crossing=states.findIndex(s=>s.goalSequence?.elapsedTicks===0);
if(crossing<1||state.homeScore!==1||state.awayScore!==0)throw Error('Shot fixture did not produce exactly one real goal.');
const net=states.findIndex(s=>s.goalSequence?.impact&&s.goalSequence.elapsedTicks>=6&&s.goalSequence.stage==='net');
const celebration=states.findIndex(s=>s.goalSequence?.stage==='celebration'&&s.goalSequence.stageTicks>=35);
const kickoff=states.findIndex(s=>s.goalSequence?.stage==='kickoff');
const openplay=states.findIndex((s,i)=>i>kickoff&&!s.goalSequence);
if([net,celebration,kickoff,openplay].some(i=>i<0))throw Error('A goal phase was not reached.');
window.reviewStages={before:0,crossing,net,celebration,kickoff,openplay:openplay+8};
let scene,index=0,resolution;
const host=document.getElementById('field');
await prepareMatchSceneAssets({version:10,quality:'sharp'});
scene=createMatchScene(host,{version:10,quality:'sharp',initialState:states[0],
 field:states[0].field,players:11,color:'#c1f66b',stage:3,onResolution:value=>resolution=value});
if(scene.mode!=='3d')throw Error('Actual production 3D renderer failed; simple fallback is not a visual QA pass.');
const check=s=>{
 const players=[...s.home,...s.away];
 if(!players.every(p=>['x','y','vx','vy'].every(k=>Number.isFinite(p[k])))||!['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(s.ball[k])))throw Error('Non-finite authoritative position.');
 const plan=goalCameraPlan(matchCamera(s,'pro',host.clientWidth/host.clientHeight),s);
 if(![...plan.eye,...plan.target,plan.fov||48].every(Number.isFinite))throw Error('Non-finite camera.');
 const camera=new THREE.PerspectiveCamera(plan.fov||48,host.clientWidth/host.clientHeight,.5,800);
 camera.position.set(...plan.eye);camera.lookAt(new THREE.Vector3(...plan.target));camera.updateMatrixWorld();
 const ball=new THREE.Vector3(s.ball.x,s.ball.z,s.ball.y).project(camera);
 if(Math.abs(ball.x)>1||Math.abs(ball.y)>1||Math.abs(ball.z)>1)throw Error('Ball outside camera frame.');
 return{tick:s.tick,stage:s.goalSequence?.stage||'play',score:[s.homeScore,s.awayScore],
  ball:clone(s.ball),scorer:s.goalSequence?.scorer??null,impact:clone(s.goalSequence?.impact||null),
  camera:plan,projectedBall:ball.toArray(),resolution,renderMode:scene.mode};
};
window.reviewDraw=async name=>{
 const target=window.reviewStages[name];
 if(!Number.isInteger(target)||target<index)throw Error('Stages must be rendered in chronological order.');
 for(;index<target;index++){
  scene.render(states[index],'pro');
  await new Promise(resolve=>setTimeout(resolve,16));
  scene.render(states[index],'pro');
  await new Promise(resolve=>setTimeout(resolve,16));
 }
 for(let i=0;i<12;i++){scene.render(states[target],'pro');await new Promise(resolve=>setTimeout(resolve,16));}
 return check(states[target]);
};
window.reviewReady=true;
"""

BUILDER = r"""
import {build} from 'esbuild';
const [source,outfile]=process.argv.slice(1);
await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'goal-review.js'},
 bundle:true,format:'esm',platform:'browser',outfile,
 define:{__PRO_PLAYER_URL__:JSON.stringify('/assets/game/football-pro.glb'),
 __PRO_PLAYER_AUTO_URL__:JSON.stringify('/assets/game/football-auto.glb')}});
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4323)
    parser.add_argument('--width', type=int, default=960)
    parser.add_argument('--height', type=int, default=540)
    args = parser.parse_args()
    output = ROOT / 'outputs/goal-scene-review'
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='touchline-goal-review-') as folder:
        temp = Path(folder)
        (temp / 'assets').symlink_to(ROOT / 'assets', target_is_directory=True)
        (temp / 'index.html').write_text('<!doctype html><html><head><meta charset="utf-8"><title>Goal sequence QA fixture</title><style>html,body,#field{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head><body><div id="field"></div><script type="module" src="/harness.js"></script></body></html>')
        subprocess.run(['node', '--input-type=module', '-e', BUILDER, HARNESS,
                        str(temp / 'harness.js')], cwd=ROOT, check=True)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), partial(QuietHandler, directory=str(temp)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        errors, requests, results = [], [], {}
        origin = f'http://127.0.0.1:{args.port}'
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                    args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
                context = browser.new_context(viewport={'width':args.width, 'height':args.height}, device_scale_factor=2)
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith((origin, 'data:', 'blob:')) else route.abort())
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('requestfailed', lambda request: requests.append({'url':request.url, 'error':request.failure}))
                page.goto(origin, wait_until='networkidle')
                page.wait_for_function('window.reviewReady===true', timeout=90000)
                for name in ['before', 'crossing', 'net', 'celebration', 'kickoff', 'openplay']:
                    results[name] = page.evaluate('(name)=>window.reviewDraw(name)', name)
                    path = output / f'{name}.png'
                    page.screenshot(path=str(path), animations='disabled', timeout=60000)
                    with Image.open(path) as image:
                        assert image.size == (args.width*2,args.height*2), image.size
                        pixels = list(image.convert('RGB').resize((96,54)).getdata())
                        green = sum(g>r*1.16 and g>b*1.1 and g>45 for r,g,b in pixels)/len(pixels)
                        assert green>.2, (name,green,'Field must remain visible.')
                        results[name]['greenPixelRatio'] = round(green,4)
                    results[name]['screenshot'] = str(path.relative_to(ROOT))
                assert not errors, errors
                assert not requests, requests
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
        report = {'fixtureOnly':True,'engine':10,'actualProductionRenderer':True,
            'phonePerformanceVerified':False,'errors':errors,'failedRequests':requests,'stages':results}
        (output / 'report.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'passed':True,'report':str(output/'report.json'),'screenshots':len(results)}))


if __name__ == '__main__':
    main()
