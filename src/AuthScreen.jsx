import StadiumIllustration from './StadiumIllustration.jsx';
import {useFormRequest} from './use-form-request.js';
import RecoveryAccess from './RecoveryAccess.jsx';
import{TouchlineMark}from'./TouchlineBrand.jsx';
import {publisher} from './publisher.js';
import {apiFetch,gameHome,documentLink} from './api.js';
import MailRecovery from './MailRecovery.jsx';
import {initialAccountAccess,mergeAccountAccess} from './account-access.js';
import React,{useState,useEffect} from 'react';
import {ArrowLeft,ArrowRight,Mail,LockKeyhole,Eye,EyeOff,LoaderCircle,ShieldCheck,Users,TrendingUp,Trophy,RefreshCw,Check} from 'lucide-react';

export default function AuthScreen({onAuthenticated,checking=false,connectionError,onRetry,notice,initialCapabilities,onPractice}){const formRequest=useFormRequest();
 const [step,setStep]=useState('email'),[mailStatus,setMailStatus]=useState('loading');
 const [access,setAccess]=useState(()=>initialAccountAccess(initialCapabilities));
 const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(access.testEnvironment){setMailStatus('off');return}let alive=true;apiFetch('/api/auth/capabilities').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(alive){setAccess(current=>mergeAccountAccess(current,d));setMailStatus(d.emailDelivery===true?'ready':'off')}}).catch(()=>{if(alive){setAccess(current=>mergeAccountAccess(current,null));setMailStatus('error')}});return()=>{alive=false}},[]);
 useEffect(()=>{if(checking||connectionError||mode==='mail')return;const frame=requestAnimationFrame(()=>document.getElementById(step==='email'?'auth-email':'auth-password')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)},[step,mode,checking,connectionError]);
 const choose=next=>{if(access.testEnvironment&&next!=='login')return;setStep('email');setMode(next);setPassword('');setConfirm('');setError('');setVisible(false)};
 useEffect(()=>{if(access.testEnvironment&&mode!=='login'){setMode('login');setStep('email');setPassword('');setConfirm('');setError('');setVisible(false)}},[access.testEnvironment,mode]);
 const editEmail=()=>{setStep('email');setPassword('');setConfirm('');setError('')};
 useEffect(()=>{const back=e=>{if(formRequest.pending){e.preventDefault();return;}if(step==='password'){e.preventDefault();editEmail()}else if(mode!=='login'){e.preventDefault();choose('login')}};window.addEventListener('touchline:back',back);return()=>window.removeEventListener('touchline:back',back)},[mode,step]);
 async function submit(e){e.preventDefault();if(busy||formRequest.pending||access.testEnvironment&&mode!=='login')return;if(step==='email'){setEmail(email.trim());setError('');setStep('password');return}if(mode==='signup'&&password!==confirm){setError('De to adgangskoder skal være ens.');return}setBusy(true);setError('');try{const reply=await formRequest.request('/api/auth/'+(mode==='signup'?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!reply)return;const{response:r,data:d}=reply;if(!r.ok)throw Error(d.error||'Kunne ikke logge ind.');setPassword('');setConfirm('');onAuthenticated(d.user)}catch(e){setError(e.message||'Ingen forbindelse. Prøv igen.')}finally{setBusy(false)}}
 return <div className={'auth-page stadium-auth'+(mode==='mail'?' auth-recovery':'')}>
  <header className="auth-top">
   <a className="brand" href={gameHome} aria-label="Touchline forside"><TouchlineMark size={44}/><div>touchline<span>FOOTBALL IDLE</span></div></a>
   {onPractice&&<button type="button" className="r4-practice-launch" onClick={onPractice}>Spil lokal testkamp · R5</button>}
   {!access.testEnvironment&&<a className="auth-support-link" href={documentLink(publisher.contactPath)}>Hjælp & support<ArrowRight size={15}/></a>}
  </header>
  {mode==='mail'?<div className="auth-recovery-content"><MailRecovery onBack={()=>choose('login')} onRecovered={data=>onAuthenticated(data.user)}/></div>:<main className="auth-layout">
   <section className="auth-story" aria-labelledby="auth-story-title">
    <span className="eyebrow"><span className="tiny-line"/>Fra lokal til legende.</span>
    <h1 id="auth-story-title">Din klub.<br/>{' '}Dit næste <em>kapitel.</em></h1>
    <p>Et lille stadion. Et hold med store drømme.<br/>Resten af historien er din.</p>
    <div className="auth-stadium" aria-hidden="true"><StadiumIllustration/></div>
    <div className="auth-features"><span><Users size={17}/>Byg dit hold</span><span><TrendingUp size={17}/>Udvikl din klub</span><span><Trophy size={17}/>Spil dig til toppen</span></div>
   </section>
   <section className="auth-card panel" aria-labelledby="auth-title">
    {checking?<div className="auth-checking" role="status"><LoaderCircle className="spin" size={25}/><h2 id="auth-title">Åbner klubhuset…</h2></div>:connectionError?<div className="auth-checking"><ShieldCheck size={30}/><h2 id="auth-title">Vi kan ikke åbne klubhuset.</h2><p>{connectionError}</p><button className="primary full" onClick={onRetry}><RefreshCw size={17}/>Prøv igen</button></div>:<>
     <div className="auth-tabs" aria-label="Vælg kontoadgang" style={access.testEnvironment?{gridTemplateColumns:'1fr'}:undefined}><button className={mode==='login'?'active':''} aria-pressed={mode==='login'} onClick={()=>choose('login')} disabled={busy}>Log ind</button>{access.registration&&<button className={mode==='signup'?'active':''} aria-pressed={mode==='signup'} onClick={()=>choose('signup')} disabled={busy}>Opret konto</button>}</div>
     {access.testEnvironment&&<p className="auth-notice" role="status">Testudgave: Brug den udleverede testkonto. Oprettelse, mail og kontoændringer er slået fra her.</p>}
     <div className="auth-form-heading"><span className="auth-heading-icon" aria-hidden="true">{step==='email'?<Mail size={21}/>:<LockKeyhole size={21}/>}</span><div><h2 id="auth-title">{mode==='signup'?'Bliv klubbens nye manager.':'Velkommen tilbage.'}</h2><p className="auth-description">{step==='email'?(mode==='signup'?'Start med din e-mailadresse.':'Log ind, og fortsæt din vej mod toppen.'):(mode==='signup'?'Vælg en adgangskode til din konto.':'Indtast adgangskoden til din klub.')}</p></div></div>
     {notice&&<p className="auth-notice" role="status">{notice}</p>}
     <ol className="auth-steps" aria-label="Logintrin"><li className={step==='password'?'complete':''} aria-current={step==='email'?'step':undefined}><b>{step==='password'?<Check size={13}/>:1}</b><span>E-mail</span></li><li aria-current={step==='password'?'step':undefined}><b>2</b><span>Adgangskode</span></li></ol>
     <form aria-busy={busy} onSubmit={submit}>
      {step==='email'?<><label htmlFor="auth-email">E-mailadresse</label><div className="auth-input"><Mail size={18}/><input id="auth-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" autoFocus required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="din@email.dk" disabled={busy}/></div></>:<>
       <div className="auth-email-summary"><Mail size={17}/><span>{email}</span><button type="button" disabled={busy} onClick={editEmail} aria-label="Ret e-mailadresse"><ArrowLeft size={15}/>Ret</button></div>
       <input type="email" name="username" autoComplete="username" value={email} readOnly hidden/>
       <label htmlFor="auth-password">Adgangskode{mode==='signup'&&<span className="auth-field-hint">Mindst 8 tegn</span>}</label>
       <div className="auth-input"><LockKeyhole size={18}/><input id="auth-password" autoFocus name="password" type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'Din adgangskode':'Mindst 8 tegn'} disabled={busy}/><button type="button" disabled={busy} onClick={()=>setVisible(!visible)} aria-pressed={visible} aria-label={visible?'Skjul adgangskode':'Vis adgangskode'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
       {mode==='signup'&&<><label htmlFor="auth-confirm">Gentag adgangskoden</label><div className="auth-input"><LockKeyhole size={18}/><input id="auth-confirm" type={visible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Samme adgangskode igen" disabled={busy}/></div>{mailStatus==='off'&&<p className="recovery-status">Nulstilling via mail er endnu ikke aktiveret. Gem din adgangskode sikkert.</p>}<p className="auth-privacy-note">Når du opretter kontoen, bruges dine oplysninger til at gemme din klub. <a href={documentLink('/privacy')}>Læs om privatliv</a>.</p></>}
       {mode==='login'&&!access.testEnvironment&&<RecoveryAccess status={mailStatus} onOpen={()=>choose('mail')}/>}
      </>}
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <button className="primary full auth-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={18}/>Et øjeblik…</>:<>{step==='email'?'Fortsæt':mode==='signup'?'Opret min klub':'Log ind på min klub'}<ArrowRight size={18}/></>}</button>
     </form>
     <div className="auth-assurance"><ShieldCheck size={17}/><span>Fremskridt gemmes på tværs af enheder.</span></div>
    </>}
   </section>
  </main>}
  <footer className="auth-footer"><span>Et spil fra {publisher.name}<small className="auth-version">Version {publisher.version} ({publisher.build})</small></span><div className="auth-legal-links">{!access.testEnvironment&&<a href={documentLink(publisher.contactPath)}>Support</a>}<a href={documentLink('/privacy')}>Privatliv</a>{access.accountChanges&&<a href={documentLink('/delete-account')}>Slet konto</a>}</div></footer>
 </div>
}
