export const mailReady=env=>typeof env.MAIL_API_KEY==='string'&&env.MAIL_API_KEY.length>10&&typeof env.MAIL_FROM==='string'&&env.MAIL_FROM.includes('@');
export async function sendMail(env,{to,subject,text,id}){
 if(!mailReady(env))throw Error('Mail delivery not configured');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.MAIL_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Mail delivery unavailable');
}
