import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,MessageSquare,Check,LoaderCircle,ShieldCheck} from 'lucide-react';
import {apiFetch,gameHome,documentLink} from './api.js';

export default function ContactScreen(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState('');
 async function submit(e){e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);setBusy(true);setError('');try{const r=await apiFetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.get('email'),topic:f.get('topic'),message:f.get('message'),website:f.get('website'),consent:f.get('consent')==='on'})});const d=await r.json();if(!r.ok)throw Error(d.error||'Prøv igen senere.');setReference(d.reference)}catch(e){setError(e.message||'Ingen forbindelse. Prøv igen.')}finally{setBusy(false)}}
 return <main className="legal-page contact-page">
  <a className="legal-back" href={gameHome}><ArrowLeft size={17}/>Tilbage til Touchline</a>
  <section className="legal-card panel contact-card">
   <header className="contact-intro"><span className="contact-icon"><MessageSquare size={23}/></span><span className="eyebrow">OPNEXT GAMES · KONTAKT</span><h1>Lad os høre fra dig.</h1><p>Spørgsmål, feedback eller hjælp til din konto? Skriv her.</p><div className="contact-security-note"><ShieldCheck size={17}/><span>Send aldrig adgangskoder eller engangskoder.</span></div></header>
   {reference?<div className="contact-received" role="status"><span className="contact-received-icon"><Check size={24}/></span><h2>Din besked er registreret.</h2><p>Henvendelser gennemgås manuelt. Vi kontakter dig på den svaradresse, du har angivet, når der er nyt. Der sendes ikke automatisk en mailkvittering.</p><div className="contact-reference"><span>Dit sagsnummer</span><strong>{reference}</strong></div></div>:<form onSubmit={submit} className="contact-form">
    <label htmlFor="contact-email">Din e-mail til svar<input id="contact-email" name="email" type="email" autoComplete="email" placeholder="din@email.dk" required maxLength={254} disabled={busy}/></label>
    <label htmlFor="contact-topic">Hvad drejer det sig om?<select id="contact-topic" name="topic" defaultValue={new URLSearchParams(typeof location==='undefined'?'':location.search).get('topic')==='deletion'?'deletion':'support'} disabled={busy}><option value="support">Hjælp til appen</option><option value="feedback">Idéer og feedback</option><option value="privacy">Mine oplysninger</option><option value="deletion">Anmodning om kontosletning</option></select></label>
    <label htmlFor="contact-message">Din besked<textarea id="contact-message" name="message" rows={5} minLength={15} maxLength={3000} required disabled={busy}/><span className="contact-field-hint">15–3.000 tegn</span></label>
    <label className="contact-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <label className="contact-consent"><input name="consent" type="checkbox" required disabled={busy}/><span>Jeg accepterer, at min svaradresse og besked bruges til at behandle henvendelsen og gemmes indtil næste oprydning efter 90 dage. <a href={documentLink('/privacy')}>Læs om privatliv</a>.</span></label>
    {error&&<p role="alert" className="auth-error">{error}</p>}
    <button className="primary" disabled={busy}>{busy?<><LoaderCircle size={17} className="spin"/>Sender…</>:<>Send besked<ArrowRight size={18}/></>}</button>
    <p className="legal-small">Ved kontosletning verificerer vi ejerskabet, før vi sletter data. Du kan også slette kontoen direkte i spillets klubindstillinger.</p>
   </form>}
  </section>
 </main>
}
