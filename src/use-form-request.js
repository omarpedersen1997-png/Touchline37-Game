import {useEffect,useRef} from 'react';
import {apiFetch} from './api.js';
import {createRequestTask} from './request-task.js';
export function useFormRequest(){
 const ref=useRef(null);
 if(!ref.current){
  const task=createRequestTask();
  ref.current={get pending(){return task.pending;},request:(path,options)=>task.run(async signal=>{
   const response=await apiFetch(path,{...options,signal});
   const data=await response.json();return{response,data};
  }),cancel:()=>task.cancel()};
 }
 useEffect(()=>()=>ref.current.cancel(),[]);
 return ref.current;
}
