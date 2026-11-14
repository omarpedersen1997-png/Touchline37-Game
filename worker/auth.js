import {mailReady,sendMail} from './mail.js';
const encoder=new TextEncoder();
export const validOrigin=request=>{const origin=request.headers.get('Origin');return origin===new URL(request.url).origin||origin==='https://localhost'};
export const COOKIE='__Host-touchline';
const MONTH=30*24*60*60*1000;
const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>v.toString(16).padStart(2,'0')).join('');
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}
export const authJson=(body,status=200,cookie)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function config(env){if(!env.DB||!env.AUTH_PEPPER||env.AUTH_PEPPER.length<32)throw new AuthError('Login er midlertidigt utilgængeligt. Prøv igen om lidt.',503)}
export function normalizeEmail(email){if(typeof email!=='string')throw new AuthError('Skriv en gyldig e-mailadresse.');const value=email.trim().toLowerCase();if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||/[^\x21-\x7e]/.test(value))throw new AuthError('Skriv en gyldig e-mailadresse.');return value}
function validatePassword(password){if(typeof password!=='string'||password.length<8||password.length>128)throw new AuthError('Adgangskoden skal være mellem 8 og 128 tegn.')}
async function passwordHash(password,salt,pepper){
 const hmac=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const peppered=await crypto.subtle.sign('HMAC',hmac,encoder.encode(password));
 const key=await crypto.subtle.importKey('raw',peppered,'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const sessionCookie=token=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MONTH/1000}`;
function tokenFrom(request){const pairs=(request.headers.get('Cookie')||'').split(';').map(p=>p.trim());const token=pairs.find(p=>p.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null}
async function session(request,env){config(env);const token=tokenFrom(request);if(!token)return null;return env.DB.prepare('SELECT a.id, a.email, a.email_verified, s.token_hash FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ? AND s.credential_version = a.credential_version').bind(await digest(token),Date.now()).first()}
export async function authenticatedUser(request,env){const account=await session(request,env);return account?{id:account.id,email:account.email,emailVerified:!!account.email_verified}:null}
async function limit(request,env,label,email,max,window=900000){
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const bucket=await digest(env.AUTH_PEPPER+':'+label+':'+ip+':'+email);const now=Date.now();
 const row=await env.DB.prepare('INSERT INTO auth_attempts (bucket,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(bucket,now+window,now,now).first();
 if(!row||row.hits>max)throw new AuthError('For mange forsøg. Vent et kvarter, og prøv igen.',429);
}
async function newSession(account,env){await env.DB.prepare('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at <= ? LIMIT 100)').bind(Date.now()).run();await env.DB.prepare('DELETE FROM auth_attempts WHERE bucket IN (SELECT bucket FROM auth_attempts WHERE expires_at <= ? LIMIT 100)').bind(Date.now()).run();const token=randomHex(32),tokenHash=await digest(token);await env.DB.prepare('INSERT INTO sessions (token_hash,account_id,credential_version,expires_at) VALUES (?,?,?,?)').bind(tokenHash,account.id,account.credential_version,Date.now()+MONTH).run();return sessionCookie(token)}
async function input(request){if(Number(request.headers.get('Content-Length'))>4096)throw new AuthError('Forespørgslen er for stor.',413);const text=await request.text();if(text.length>4096)throw new AuthError('Forespørgslen er for stor.',413);try{const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data}catch{throw new AuthError('Forespørgslen kunne ikke læses.')}}
export async function authRoute(request,env){
 const path=new URL(request.url).pathname;
 try{
  config(env);
  if(path==='/api/auth/capabilities'&&request.method==='GET')return authJson({emailDelivery:mailReady(env)},200);
  if(path==='/api/auth/me'&&request.method==='GET'){const user=await authenticatedUser(request,env);return authJson({user},200)}
  if(request.method!=='POST')return authJson({error:'Metoden er ikke understøttet.'},405);
  if(!validOrigin(request))return authJson({error:'Ugyldig forespørgsel.'},403);
  if(path==='/api/auth/logout'){const token=tokenFrom(request);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();return authJson({ok:true},200,clearCookie())}
  if(path==='/api/auth/recover')return authJson({error:'Personlige gendannelseskoder bruges ikke længere. Nulstil adgangskoden via mail.'},410);
  if(['change-password','request-verification','change-email','verify-email','request-reset','reset-password'].some(p=>path==='/api/auth/'+p))return await accountSettings(request,env,path);
  if(path==='/api/auth/delete'){
   const user=await authenticatedUser(request,env);if(!user)throw new AuthError('Log ind for at slette din konto.',401);
   const data=await input(request);if(data.confirm!=='SLET')throw new AuthError('Skriv SLET for at bekræfte.');
   await limit(request,env,'delete',user.email,5);
   const account=await env.DB.prepare('SELECT id,email,password_hash,password_salt,recovery_hash,credential_version FROM accounts WHERE email = ?').bind(user.email).first();
   const candidate=typeof data.password==='string'&&data.password.length<=128?data.password:'';
   if(!account||!equal(await passwordHash(candidate,account.password_salt,env.AUTH_PEPPER),account.password_hash))throw new AuthError('Adgangskoden er forkert.',401);
   const result=await env.DB.batch([
    env.DB.prepare('DELETE FROM clubs WHERE user_id = ? AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND credential_version = ?)').bind(account.id,account.id,account.credential_version),
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND credential_version = ?)').bind(account.id,account.id,account.credential_version),
    env.DB.prepare('DELETE FROM accounts WHERE id = ? AND credential_version = ?').bind(account.id,account.credential_version)
   ]);
   if(result[2].meta.changes!==1)throw new AuthError('Kontoen blev ændret. Log ind igen, og prøv på ny.',409);
   return authJson({ok:true},200,clearCookie());
  }
  if(!['/api/auth/register','/api/auth/login'].includes(path))return authJson({error:'Ikke fundet.'},404);
  const data=await input(request);const email=normalizeEmail(data.email);
  await limit(request,env,'all','',80);
  await limit(request,env,path,email,path.endsWith('register')?5:10);
  if(path==='/api/auth/register'){
   validatePassword(data.password);
   const id='email_'+randomHex(16),salt=randomHex(32);
   const account={id,email,credential_version:1};
   const password=await passwordHash(data.password,salt,env.AUTH_PEPPER);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO accounts (id,email,password_hash,password_salt,recovery_hash,credential_version,created_at) VALUES (?,?,?,?,?,1,?)').bind(id,email,password,salt,'',Date.now()).run();
   if(result.meta.changes!==1)throw new AuthError('Kontoen kunne ikke oprettes. Prøv at logge ind, eller brug en anden e-mailadresse.',409);
   return authJson({user:{id,email,emailVerified:false}},201,await newSession(account,env));
  }
  const account=await env.DB.prepare('SELECT id,email,password_hash,password_salt,recovery_hash,credential_version FROM accounts WHERE email = ?').bind(email).first();
  if(path==='/api/auth/login'){
   const candidate=typeof data.password==='string'&&data.password.length<=128?data.password:'';
   const hash=await passwordHash(candidate,account?.password_salt||'0000000000000000000000000000000000000000000000000000000000000000',env.AUTH_PEPPER);
   if(!account||!equal(hash,account.password_hash))throw new AuthError('E-mail eller adgangskode er forkert.',401);
   return authJson({user:{id:account.id,email:account.email}},200,await newSession(account,env));
  }

 }catch(error){if(error instanceof AuthError)return authJson({error:error.message},error.status);return authJson({error:'Login kunne ikke gennemføres. Prøv igen.'},503)}
}

async function accountSettings(request,env,path){
 const data=await input(request),now=Date.now();
 const accountByEmail=email=>env.DB.prepare('SELECT * FROM accounts WHERE email = ?').bind(email).first();
 const issue=async(account,purpose,email)=>{
  if(!mailReady(env))throw new AuthError('Mailfunktionen er endnu ikke aktiveret. Prøv igen senere.',503);
  const recipientBucket=await digest(env.AUTH_PEPPER+':mail-recipient:'+email);
  const recipientLimit=await env.DB.prepare('INSERT INTO auth_attempts (bucket,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(recipientBucket,now+900000,now,now).first();
  if(recipientLimit.hits>5)throw new AuthError('For mange mailforsøg. Vent et kvarter.',429);
  const token=randomHex(24),hash=await digest(token);
  await env.DB.prepare('DELETE FROM account_challenges WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare('INSERT INTO account_challenges (token_hash,account_id,credential_version,purpose,email,expires_at) VALUES (?,?,?,?,?,?)').bind(hash,account.id,account.credential_version,purpose,email,now+1800000).run();
  try{await sendMail(env,{to:email,subject:purpose==='reset'?'Touchline — nulstil din adgangskode':'Touchline — bekræft din e-mail',text:`Din engangskode til Touchline er:\n\n${token}\n\nKoden udløber om 30 minutter. Indtast den i appen. Har du ikke bedt om koden, skal du ignorere beskeden. Del aldrig koden med andre.`,id:'account-'+hash})}catch{await env.DB.prepare('DELETE FROM account_challenges WHERE token_hash = ?').bind(hash).run();throw new AuthError('Mailen kunne ikke sendes. Prøv igen senere.',503)}
 };
 if(path==='/api/auth/request-reset'){
  const email=normalizeEmail(data.email);await limit(request,env,'mail-all','',20);await limit(request,env,'mail-reset',email,5);
  if(!mailReady(env))throw new AuthError('Mailgendannelse er endnu ikke aktiveret. Prøv igen senere.',503);
  const account=await accountByEmail(email);if(account)await issue(account,'reset',email);
  return authJson({ok:true,message:'Hvis adressen har en konto, sender vi en kode. Tjek også spam.'});
 }
 if(path==='/api/auth/reset-password'){
  const email=normalizeEmail(data.email);await limit(request,env,'mail-code',email,5);validatePassword(data.password);
  const hash=await digest(typeof data.code==='string'?data.code.trim().toLowerCase():''),account=await accountByEmail(email);
  const challenge=await env.DB.prepare("SELECT * FROM account_challenges WHERE token_hash = ? AND purpose = 'reset' AND email = ? AND expires_at > ?").bind(hash,email,now).first();
  if(!account||!challenge||challenge.account_id!==account.id||challenge.credential_version!==account.credential_version)throw new AuthError('Koden er forkert eller udløbet.',401);
  return changePassword(account,data.password,env,hash);
 }
 const user=await authenticatedUser(request,env);if(!user)throw new AuthError('Log ind for at ændre din konto.',401);
 const account=await accountByEmail(user.email);await limit(request,env,'settings',account.email,10);
 if(path==='/api/auth/verify-email'){
  const hash=await digest(typeof data.code==='string'?data.code.trim().toLowerCase():'');
  const challenge=await env.DB.prepare("SELECT * FROM account_challenges WHERE token_hash = ? AND account_id = ? AND purpose = 'verify' AND expires_at > ?").bind(hash,account.id,now).first();
  if(!challenge||challenge.credential_version!==account.credential_version)throw new AuthError('Koden er forkert eller udløbet.',401);
  const duplicate=await accountByEmail(challenge.email);if(duplicate&&duplicate.id!==account.id)throw new AuthError('Adressen kan ikke bruges.',409);
  const updated=await env.DB.prepare('UPDATE accounts SET email = ?, email_verified = 1, credential_version = credential_version + 1 WHERE id = ? AND credential_version = ? AND EXISTS (SELECT 1 FROM account_challenges WHERE token_hash = ? AND expires_at > ?)').bind(challenge.email,account.id,account.credential_version,hash,now).run();
  if(updated.meta.changes!==1)throw new AuthError('Kontoen blev ændret. Log ind igen.',409);
  await env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id).run();await env.DB.prepare('DELETE FROM account_challenges WHERE account_id = ?').bind(account.id).run();
  account.email=challenge.email;account.credential_version++;return authJson({user:{id:account.id,email:account.email,emailVerified:true}},200,await newSession(account,env));
 }
 const needsPassword=path==='/api/auth/change-password'||path==='/api/auth/change-email';
 if(needsPassword){const password=typeof data.password==='string'&&data.password.length<=128?data.password:'';if(!equal(await passwordHash(password,account.password_salt,env.AUTH_PEPPER),account.password_hash))throw new AuthError('Adgangskoden er forkert.',401)}
 if(path==='/api/auth/change-password'){validatePassword(data.newPassword);return changePassword(account,data.newPassword,env)}
 const email=path==='/api/auth/change-email'?normalizeEmail(data.email):account.email;
 if(email!==account.email&&await accountByEmail(email))throw new AuthError('Adressen kan ikke bruges.',409);
 await issue(account,'verify',email);return authJson({ok:true,message:'En engangskode er sendt. Din e-mail ændres først, når koden er bekræftet.'});
}
async function changePassword(account,password,env,challengeHash=null){
 const salt=randomHex(32),hash=await passwordHash(password,salt,env.AUTH_PEPPER);
 const sql='UPDATE accounts SET password_hash = ?, password_salt = ?, recovery_hash = ?, credential_version = credential_version + 1 WHERE id = ? AND credential_version = ?'+(challengeHash?' AND EXISTS (SELECT 1 FROM account_challenges WHERE token_hash = ? AND expires_at > ?)':'');
 const args=[hash,salt,'',account.id,account.credential_version,...(challengeHash?[challengeHash,Date.now()]:[])];
 const changed=await env.DB.prepare(sql).bind(...args).run();if(changed.meta.changes!==1)throw new AuthError('Kontoen blev ændret. Prøv at logge ind igen.',409);
 await env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id).run();await env.DB.prepare('DELETE FROM account_challenges WHERE account_id = ?').bind(account.id).run();account.credential_version++;
 return authJson({user:{id:account.id,email:account.email,emailVerified:!!account.email_verified}},200,await newSession(account,env));
}
