import {mailReady,sendMail} from './mail.js';
import {validOrigin} from './auth.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function contactRoute(request,env){
 if(request.method!=='POST')return json({error:'Metoden er ikke understøttet.'},405);
 if(!validOrigin(request))return json({error:'Ugyldig forespørgsel.'},403);
 if(!env.DB||!env.AUTH_PEPPER)return json({error:'Support er midlertidigt utilgængelig.'},503);
 try{
  const text=await request.text();if(text.length>7000)return json({error:'Beskeden er for lang.'},413);
  let d;try{d=JSON.parse(text)}catch{return json({error:'Ugyldig besked.'},400)}
  if(!d||typeof d!=='object'||Array.isArray(d))return json({error:'Ugyldig besked.'},400);
  if(d.website)return json({error:'Beskeden kunne ikke sendes.'},400);
  const email=typeof d.email==='string'?d.email.trim().toLowerCase():'';
  const message=typeof d.message==='string'?d.message.trim():'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<15||message.length>3000||!['support','feedback','privacy','deletion'].includes(d.topic)||d.consent!==true)return json({error:'Udfyld en gyldig svaradresse, emne og besked på 15–3000 tegn, og godkend behandlingen.'},400);
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.AUTH_PEPPER+'contact:'+ip));
  const bucket='contact:'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  const counter=await env.DB.prepare('INSERT INTO auth_attempts (bucket,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(bucket,now+900000,now,now).first();
  if(counter.hits>5)return json({error:'Du har sendt flere beskeder. Prøv igen om 15 minutter.'},429);
  await env.DB.prepare('DELETE FROM support_messages WHERE created_at < ?').bind(now-90*86400000).run();
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO support_messages (id,email,topic,message,created_at) VALUES (?,?,?,?,?)').bind(id,email,d.topic,message,now).run();
  if(mailReady(env)&&env.SUPPORT_TO){try{await sendMail(env,{to:env.SUPPORT_TO,subject:'Touchline support · '+d.topic+' · '+id,text:'Sag: '+id+'\nSvaradresse: '+email+'\nEmne: '+d.topic+'\n\n'+message,id:'support-'+id});await env.DB.prepare("UPDATE support_messages SET delivery_status = 'delivered' WHERE id = ?").bind(id).run()}catch{await env.DB.prepare("UPDATE support_messages SET delivery_status = 'failed' WHERE id = ?").bind(id).run()}}
  return json({ok:true,reference:id},201);
 }catch{return json({error:'Beskeden blev ikke registreret. Prøv igen senere.'},503)}
}
