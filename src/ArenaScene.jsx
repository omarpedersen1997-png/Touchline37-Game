import{CLUB_COLORS}from'./ClubStudio.jsx';
import React,{memo,useId,useState}from'react';
import{RotateCcw,RotateCw,Layers}from'lucide-react';
import{stadiumLayout,stadiumProjection,boxCorners}from'./stadium-layout.js';
function ArenaScene({stage=1,live=false,compact=false,fit=false,name='Touchline Arena',clubColor='lime'}){
 const accent=CLUB_COLORS[clubColor]||CLUB_COLORS.lime;
 const[angle,setAngle]=useState(1.16),[view,setView]=useState('overview'),id=useId().replaceAll(':','');
 const layout=stadiumLayout(stage),bounds=layout.boxes.flatMap(boxCorners);
 layout.poles.forEach(p=>bounds.push([p.x,p.height,p.z]));
 const{project,depth}=stadiumProjection(bounds,angle,view),points=ps=>ps.map(p=>project(p).map(n=>n.toFixed(2)).join(',')).join(' ');
 let layer=3;const items=[],polygon=(ps,fill)=>items.push({ps,layer,draw:key=><polygon key={key} points={points(ps)} fill={fill} stroke={fill} strokeWidth=".35"/>});
 const line=(ps,color='#e2f1d9',width=.85,opacity=.8)=>items.push({ps,layer,draw:key=><polyline key={key} points={points(ps)} fill="none" stroke={color} strokeWidth={width} opacity={opacity}/>});
 const palette={base:['#355744','#192f26','#274435'],walkway:['#516753','#354e3e','#405b47'],seating:['#82a37b','#42614a','#527453'],roof:['#89a79a','#48645a','#5f7f70'],post:['#a4b9a8','#647d6e','#7a9683']};
 for(const b of layout.boxes){layer=['base','walkway'].includes(b.kind)?0:3;const{x,y,z,w,h,d,kind}=b,[top,front,side]=palette[kind],a=x-w/2,c=x+w/2,n=z-d/2,f=z+d/2,low=y-h/2,high=y+h/2;
  polygon([[a,high,n],[c,high,n],[c,high,f],[a,high,f]],top);
  polygon([[a,low,n],[c,low,n],[c,high,n],[a,high,n]],front);
  polygon([[a,low,f],[c,low,f],[c,high,f],[a,high,f]],front);
  polygon([[a,low,n],[a,low,f],[a,high,f],[a,high,n]],side);
  polygon([[c,low,n],[c,low,f],[c,high,f],[c,high,n]],side);
  if(kind==='seating'){
   if(d>w){for(let z=n+1;z<f-1;z+=2.2)polygon([[a+.15,high+.03,z],[c-.15,high+.03,z],[c-.15,high+.03,z+.7],[a+.15,high+.03,z+.7]],Math.floor(z/2)%4===0?accent:'#9db98b');}
   else{for(let x=a+1;x<c-1;x+=2.2)polygon([[x,high+.03,n+.15],[x+.7,high+.03,n+.15],[x+.7,high+.03,f-.15],[x,high+.03,f-.15]],Math.floor(x/2)%4===0?accent:'#9db98b');}
  }
 }
 layer=1;const w=34,l=52.5,y=.06;
 for(let i=0;i<10;i++){const z=-l+i*10.5;polygon([[-w,y,z],[w,y,z],[w,y,z+10.5],[-w,y,z+10.5]],i%2?'#328355':'#2c764c');}
 layer=2;line([[-w,.09,-l],[w,.09,-l],[w,.09,l],[-w,.09,l],[-w,.09,-l]]);line([[-w,.09,0],[w,.09,0]]);
 line(Array.from({length:65},(_,i)=>[Math.cos(i/64*Math.PI*2)*9.15,.09,Math.sin(i/64*Math.PI*2)*9.15]));
 for(const sign of[-1,1]){
  for(const[wide,deep]of[[20.16,16.5],[9.16,5.5]])line([[-wide,.09,sign*l],[-wide,.09,sign*(l-deep)],[wide,.09,sign*(l-deep)],[wide,.09,sign*l]]);
  line([[-3.66,.1,sign*l],[-3.66,2.44,sign*l],[3.66,2.44,sign*l],[3.66,.1,sign*l]],'#f0f4e5',1.5,1);
  for(let x=-3.66;x<=3.67;x+=.61)line([[x,2.44,sign*l],[x,2.44,sign*(l+2)],[x,.1,sign*(l+2)]],'#d1ddd0',.5,.55);
  for(let h=.1;h<=2.44;h+=.39)line([[-3.66,h,sign*l],[-3.66,h,sign*(l+2)],[3.66,h,sign*(l+2)],[3.66,h,sign*l]],'#d1ddd0',.5,.55);
 }
 if(live)for(const sign of[-1,1])[[0,47],[-25,30],[-8,32],[8,32],[25,30],[-19,10],[0,16],[19,10],[-23,-5],[0,2],[23,-5]].forEach(([x,z],i)=>{
  const ps=[[x*sign,.1,z*sign]],color=sign===1?accent:'#eaa276';items.push({ps,layer:3,draw:key=>{const[cx,cy]=project(ps[0]);return<g key={key} className="arena-player live" style={{animationDelay:`${i*.13}s`}}><ellipse cx={cx+1.5} cy={cy+1} rx="3.5" ry="1.6" fill="#173b25"/><path d={`M${cx-1.5} ${cy}v-4h3v4`} stroke={color} strokeWidth="2.5"/><circle cx={cx} cy={cy-7} r="1.8" fill="#e6c3a0"/></g>}});
 });
 layer=3;for(const p of layout.poles){line([[p.x,0,p.z],[p.x,p.height,p.z]],'#7e9a87',2);const ps=[[p.x,p.height,p.z]];items.push({ps,layer:3,draw:key=>{const[x,y]=project(ps[0]);return<g key={key}><circle cx={x} cy={y} r="18" fill={`url(#${id}glow)`}/><rect x={x-7} y={y-2} width="14" height="5" rx="1" fill="#e4f5bc"/></g>}});}
 return <div className={`arena-model ${compact?'compact':''}`}><svg viewBox="0 0 800 440" style={fit?{position:'absolute',inset:0,width:'100%',height:'100%',margin:0}:undefined} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${name}, stadion i 3D-perspektiv${live?', illustreret kamp i gang':''}`}><defs><radialGradient id={id+'sky'}><stop stopColor="#294151"/><stop offset="1" stopColor="#11222d"/></radialGradient><radialGradient id={id+'glow'}><stop stopColor="#eaffc6" stopOpacity=".6"/><stop offset="1" stopColor="#eaffc6" stopOpacity="0"/></radialGradient></defs><rect width="800" height="440" fill={`url(#${id}sky)`}/><ellipse cx="400" cy="335" rx="310" ry="50" fill="#07141f" opacity=".4"/>{items.sort((a,b)=>a.layer-b.layer||depth(a.ps)-depth(b.ps)).map((item,i)=>item.draw(i))}</svg><div className="arena-caption"><span><i className="live-dot"/>{live?'KAMPDAG':'DIT STADION'}</span><small>{live?'Illustreret kampvisning':'Byg klubben. Udvid din hjemmebane.'}</small></div><button className="arena-view-toggle" onClick={()=>setView(v=>v==='overview'?'tribune':'overview')} aria-pressed={view==='tribune'} aria-label="Skift mellem overblik og tribuneperspektiv"><Layers size={15}/>{view==='overview'?'Overblik':'Tribune'}</button><div className="arena-camera" role="group" aria-label="Stadionkamera"><button aria-label="Drej stadion mod venstre" onClick={()=>setAngle(a=>Math.max(-.5,a-.2))} disabled={angle<=-.5}><RotateCcw size={17}/></button><button onClick={()=>setAngle(1.16)} aria-label="Nulstil stadionkamera">3D</button><button aria-label="Drej stadion mod højre" onClick={()=>setAngle(a=>Math.min(1.5,a+.2))} disabled={angle>=1.5}><RotateCw size={17}/></button></div></div>;
}
export default memo(ArenaScene);
