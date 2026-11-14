/** Coordinate account-scoped game requests without letting old responses unlock a new account's work. */
export function createGameRequests(){
 let generation=0,reading=null,writing=null;
 function run(kind,operation){
  if(kind==='read'&&reading)return reading.promise;
  if(writing)return Promise.resolve(null);
  // A write supersedes a pending refresh, including its later error/401 path.
  if(kind==='write'&&reading){reading.valid=false;reading=null;}
  const token={generation,valid:true,promise:null};
  const isCurrent=()=>token.valid&&generation===token.generation;
  token.promise=Promise.resolve().then(()=>isCurrent()?operation(isCurrent):null).finally(()=>{
   if(kind==='read'&&reading===token)reading=null;
   if(kind==='write'&&writing===token)writing=null;
  });
  if(kind==='read')reading=token;else writing=token;
  return token.promise;
 }
 return{
  runRead:operation=>run('read',operation),
  runWrite(operation,{wait=false}={}){
   if(!wait)return run('write',operation);
   const queuedGeneration=generation;
   return(async()=>{
    while(writing){try{await writing.promise;}catch{}if(generation!==queuedGeneration)return null;}
    if(generation!==queuedGeneration)return null;
    return run('write',operation);
   })();
  },
  reset(){generation++;reading=null;writing=null;},
  get reading(){return!!reading;},
  get writing(){return!!writing;}
 };
}

/** One foreground scheduler replaces overlapping idle, club and career poll intervals. */
export function gamePollDelay({hidden=false,clubMatch=null,careerTask=null}={}){
 if(hidden)return null;
 return clubMatch&&!clubMatch.manual||careerTask?.kind==='match'&&!careerTask.manual?2000:10000;
}

export function handleGameActionFailure(error,{current,critical=false,notify}){
 if(!current)return;
 if(critical)throw error;
 notify(error?.message||'Handlingen kunne ikke gemmes. Prøv igen.',true);
}
