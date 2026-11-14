import React,{useState} from 'react';
import {Trash2,LoaderCircle,ArrowLeft,Mail} from 'lucide-react';
import {apiFetch} from './api.js';

export default function DeleteAccount({email,onDeleted,onCancel}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const response=await apiFetch('/api/auth/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,confirm})});const result=await response.json();if(!response.ok)throw Error(result.error||'Kontoen kunne ikke slettes.');setPassword('');onDeleted()}catch(e){setError(e.message||'Forbindelsen blev afbrudt. Prøv igen.')}finally{setBusy(false)}};
 return <div className="account-delete">
  <span className="delete-symbol"><Trash2 size={23}/></span><span className="eyebrow">FARVEL TIL KLUBBEN</span><h2 id="modal-title">Slet konto og klub?</h2>
  <p className="account-delete-warning">Din konto, e-mailadresse, klub og alle fremskridt slettes permanent. Handlingen kan ikke fortrydes.</p>
  <div className="account-details"><Mail size={16}/><span>{email}</span></div>
  <form onSubmit={submit}>
   <label htmlFor="delete-password">Bekræft din adgangskode</label><input autoFocus id="delete-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={128} required disabled={busy}/>
   <label htmlFor="delete-confirm">Skriv <b>SLET</b> for at bekræfte</label><input id="delete-confirm" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off" maxLength={4} required disabled={busy}/>
   {error&&<div className="auth-error" role="alert">{error}</div>}
   <button className="danger-button full" disabled={busy||confirm!=='SLET'||!password}>{busy?<LoaderCircle className="spin" size={17}/>:<Trash2 size={17}/>}Slet min konto permanent</button>
   <button type="button" className="auth-back" disabled={busy} onClick={onCancel}><ArrowLeft size={16}/>Behold min konto</button>
  </form>
 </div>
}
