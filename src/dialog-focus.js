const selector='button,input,select,textarea,a[href],summary,[tabindex]';
export function dialogFocusables(root){
 return [...(root?.querySelectorAll(selector)||[])].filter(element=>
  !element.matches(':disabled')&&element.tabIndex>=0&&
  !element.closest('[hidden],[inert],[aria-hidden="true"]')&&element.getClientRects().length>0);
}
export function focusDialog(root){
 const elements=dialogFocusables(root);
 const first=elements.find(element=>element.matches('input,select,textarea'))||elements[0]||root;
 first?.focus({preventScroll:true});
}
export function trapDialogTab(event,root){
 if(event.key!=='Tab'||!root||event.ctrlKey||event.metaKey||event.altKey)return false;
 const elements=dialogFocusables(root),first=elements[0],last=elements.at(-1),active=root.ownerDocument.activeElement;
 if(!first){event.preventDefault();root.focus();return true;}
 if(!root.contains(active)||active===root||event.shiftKey&&active===first||!event.shiftKey&&active===last){
  event.preventDefault();(event.shiftKey?last:first).focus();return true;
 }
 return false;
}
