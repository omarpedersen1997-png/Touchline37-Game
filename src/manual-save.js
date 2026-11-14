export const isManualCompletion=action=>['manual-match-finish','player-career-manual-finish'].includes(action?.type);

export function manualSaveError(message,status=0){
 const error=new Error(message||'Kampen kunne ikke gemmes. Prøv igen.');error.status=status;
 error.retryable=!status||[408,409,425,429].includes(status)||status>=500||status===400&&message==='Kampen er ikke færdigspillet endnu.';
 return error;
}

// A 200 response alone is not an acknowledgement of this particular recording.
export function manualSaveAcknowledgement(data,matchId,personal=false){
 const state=data?.state,active=personal?state?.playerCareer?.active:state?.active;
 const history=personal?state?.playerCareer?.history:state?.history;
 const record=personal?history?.find(m=>m.id===matchId&&m.manual):data?.result?.id===matchId&&data.result.manual?data.result:history?.find(m=>m.id===matchId&&m.manual);
 if(!state||active?.id===matchId||!record||!Number.isFinite(record.home)||!Number.isFinite(record.away))throw manualSaveError('Serveren har endnu ikke bekræftet dette kampresultat. Optagelsen beholdes på enheden.');
 return record;
}

export function manualRetryDelay(attempt){return[1000,2000,4000,8000,15000,30000][Math.max(0,Math.min(5,attempt-1))];}

export async function saveManualRecording({session,finish,matchId,personal=false}){
 if(!session?.complete)throw manualSaveError('Kampen er ikke færdigspillet endnu.',400);
 session.save();const packet=session.packet();
 if(!packet)throw manualSaveError('Kampoptagelsen kunne ikke læses. Genåbn kampen på samme enhed.',400);
 const data=await finish(packet),result=manualSaveAcknowledgement(data,matchId,personal);
 session.clear();return result;
}
