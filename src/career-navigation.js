export function careerHeader(state,tab,clubBalance){
 const personal=tab==='player-career',career=state.playerCareer;
 return {
  personal,
  breadcrumb:personal?'Din spillerkarriere':'Dit klubhus',
  balance:personal?(career?.wallet||0):clubBalance,
  balanceLabel:personal?'Karrieresaldo – gå til næste spillerkamp':'Klubsaldo – gå til klubudvikling',
  balanceAction:personal?(career?'pc-match-title':null):'upgrades',
  seasonLabel:personal?(career?`Spillersæson ${career.season.number}`:'Opret din spiller'):`Sæson ${state.season}`,
  seasonAction:personal?(career?'pc-season-title':null):'league',
 };
}

export function focusCareerSection(id){
 const target=document.getElementById(id);if(!target)return;
 document.dispatchEvent(new CustomEvent('touchline:reveal-section',{detail:{id}}));
 const focus=()=>{target.scrollIntoView({block:'nearest'});target.tabIndex=-1;target.focus({preventScroll:true});};
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(focus);else focus();
}
