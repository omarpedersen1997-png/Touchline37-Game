// One active form request. Invalidated work cannot update a closed/replaced form.
export function createRequestTask(){
 let active=null;
 return{
  get pending(){return active!==null;},
  async run(operation){
   if(active)return null;
   const controller=new AbortController();active=controller;
   try{
    const result=await operation(controller.signal);
    return active===controller&&!controller.signal.aborted?result:null;
   }catch(error){if(active!==controller||controller.signal.aborted)return null;throw error;}
   finally{if(active===controller)active=null;}
  },
  cancel(){const previous=active;active=null;previous?.abort();}
 };
}
