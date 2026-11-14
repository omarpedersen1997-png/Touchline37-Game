import React,{useEffect,useState} from 'react';
import {LockKeyhole,Mail,ShieldCheck,KeyRound,ArrowLeft,ArrowRight,LoaderCircle} from 'lucide-react';
import {apiFetch} from './api.js';

export default function AccountSettings({user,onUpdated,onBack}){
 const [mode,setMode]=useState('password'),[password,setPassword]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[email,setEmail]=useState(''),[code,setCode]=useState(''),[mail,setMail]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{apiFetch('/api/auth/capabilities').then(r=>r.json()).then(d=>setMail(d.emailDelivery===true)).catch(()=>{})},[]);
 async function submit(e){e.preventDefault();if(busy)return;if(mode==='password'&&next!==confirm){setError('De to nye adgangskoder skal være ens.');return}setBusy(true);setError('');setNotice('');try{const path=mode==='password'?'change-password':mode==='code'?'verify-email':mode==='verify'?'request-verification':'change-email';const r=await apiFetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,newPassword:next,email,code})});const d=await r.json();if(!r.ok)throw Error(d.error||'Ændringen kunne ikke gemmes.');setPassword('');setNext('');setConfirm('');setCode('');if(d.user){onUpdated(d.user);return}setMode('code');setNotice(d.message)}catch(e){setError(e.message||'Ingen forbindelse. Prøv igen.')}finally{setBusy(false)}}
 return <div className="account-security">
  <span className="eyebrow">DIN KONTO</span><h2 id="modal-title">Login & sikkerhed</h2>
  <div className="account-identity"><span className="account-identity-icon"><Mail size={19}/></span><div><b>{user.email}</b><span className={user.emailVerified?'verified':''}>{user.emailVerified?<><ShieldCheck size={13}/>Mailadressen er bekræftet.</>:'Mailadressen er ikke bekræftet.'}</span></div></div>
  <div className="account-options" aria-label="Kontoindstillinger">{[['password','Adgangskode',LockKeyhole],['email','Skift mail',Mail],['verify','Bekræft mail',ShieldCheck],['code','Indtast mailkode',KeyRound]].map(([key,label,Icon])=><button type="button" className={mode===key?'selected':''} aria-pressed={mode===key} key={key} disabled={busy} onClick={()=>{setMode(key);setError('');setNotice('');setPassword('');setNext('');setConfirm('');setCode('')}}><Icon size={16}/>{label}</button>)}</div>
  {!mail&&<p className="account-mail-note">Mailbekræftelse og skift af mail er endnu ikke aktiveret. Du kan stadig ændre adgangskoden.</p>}
  <form onSubmit={submit}>
   {['password','email'].includes(mode)&&<><label htmlFor="current-password">Nuværende adgangskode</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></>}
   {mode==='password'&&<><label htmlFor="new-password">Ny adgangskode <span>Mindst 8 tegn</span></label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={e=>setNext(e.target.value)} disabled={busy}/><label htmlFor="confirm-password">Gentag ny adgangskode</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy}/></>}
   {mode==='email'&&<><label htmlFor="next-email">Ny e-mailadresse</label><input id="next-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/><p className="account-form-note">Den nuværende adresse bruges, indtil den nye er bekræftet.</p></>}
   {mode==='verify'&&<p className="account-form-note">Vi sender en engangskode til din kontos mailadresse. Indtast koden her for at bekræfte adressen.</p>}
   {mode==='code'&&<><label htmlFor="mail-code">Engangskode fra mailen</label><input id="mail-code" autoComplete="one-time-code" required maxLength={48} value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/></>}
   {notice&&<p className="account-notice" role="status">{notice}</p>}{error&&<p role="alert" className="auth-error">{error}</p>}
   <button className="primary full" disabled={busy||(mode!=='password'&&!mail)}>{busy?<><LoaderCircle className="spin" size={17}/>Gemmer…</>:<>{mode==='password'?'Skift adgangskode':mode==='code'?'Bekræft koden':'Send bekræftelseskode'}<ArrowRight size={17}/></>}</button>
   <button type="button" className="auth-back" onClick={onBack} disabled={busy}><ArrowLeft size={16}/>Tilbage til indstillinger</button>
  </form>
 </div>
}
