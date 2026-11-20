import React,{useEffect,useRef,useState}from'react';

export function workspaceKeyIndex(event,index,count){
 if(!count||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return null;
 if(event.key==='Home')return 0;if(event.key==='End')return count-1;
 if(event.key==='ArrowRight')return(index+1)%count;
 if(event.key==='ArrowLeft')return(index+count-1)%count;
 return null;
}
// Keep every panel mounted: tab changes must not discard form edits, filters or
// recordings. Only the selected panel participates in layout and keyboard focus.
export default function WorkspaceDeck({id,label,items,selected,onChange,initial,className=''}){
 const[local,setLocal]=useState(initial||items[0]?.id),[visited,setVisited]=useState([]),root=useRef(null),buttons=useRef([]);
 const current=items.some(item=>item.id===(selected??local))?(selected??local):items[0]?.id;
 const select=value=>{setLocal(value);setVisited(prior=>prior.includes(value)?prior:[...prior,value]);onChange?.(value);};
 useEffect(()=>{
  const reveal=event=>{const target=document.getElementById(event.detail?.id);if(!target||!root.current?.contains(target))return;let node=target;while(node&&node!==root.current){if(node.dataset?.deck===id){select(node.dataset.deckPanel);break;}node=node.parentElement;}};
  document.addEventListener('touchline:reveal-section',reveal);return()=>document.removeEventListener('touchline:reveal-section',reveal);
 },[id,onChange]);
 const key=(event,index)=>{const next=workspaceKeyIndex(event,index,items.length);if(next===null)return;event.preventDefault();event.stopPropagation();select(items[next].id);buttons.current[next]?.focus({preventScroll:true});};
 return <section className={'workspace-deck '+className} aria-label={label} ref={root} data-selected={current}>
  <div className="workspace-deck-tabs" role="tablist" aria-label={label}>{items.map((item,index)=><button key={item.id} type="button" role="tab" id={`${id}-${item.id}-tab`} aria-controls={`${id}-${item.id}-panel`} aria-selected={current===item.id} tabIndex={current===item.id?0:-1} ref={node=>buttons.current[index]=node} onClick={()=>select(item.id)} onKeyDown={event=>key(event,index)}>{item.label}</button>)}</div>
  <div className="workspace-deck-pages">{items.map(item=><div key={item.id} className="workspace-deck-panel" role="tabpanel" data-deck={id} data-deck-panel={item.id} id={`${id}-${item.id}-panel`} aria-labelledby={`${id}-${item.id}-tab`} hidden={current!==item.id} tabIndex={0}>{!item.defer||current===item.id||visited.includes(item.id)?item.content:null}</div>)}</div>
 </section>;
}
