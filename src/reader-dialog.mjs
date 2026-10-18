// One keyboard/focus owner per document, including nested readers.
const sessions=new WeakMap();
const selectable='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
const available=element=>!!element?.isConnected&&!element.closest('[inert],[hidden],[aria-hidden="true"]');
const controls=dialog=>Array.from(dialog?.querySelectorAll(selectable)||[]).filter(element=>available(element)&&!element.matches('[disabled],input[type="hidden"],[tabindex="-1"]'));
export function bindReaderDialog(onClose,{doc=document,dialog}={}){
 dialog ||= Array.from(doc.querySelectorAll('[data-reader-dialog]')).filter(available).at(-1);
 if(!dialog)return ()=>{};
 let state=sessions.get(doc);
 if(!state){
  state={entries:[],overflow:doc.body.style.overflow};
  state.focus=entry=>{const first=controls(entry.dialog)[0];if(first)first.focus();else{if(!entry.dialog.hasAttribute('tabindex'))entry.dialog.setAttribute('tabindex','-1');entry.dialog.focus();}};
  state.key=event=>{
   const entry=state.entries.at(-1);if(!entry)return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();entry.onClose();return;}
   if(event.key!=='Tab')return;
   const items=controls(entry.dialog),first=items[0],last=items.at(-1),active=doc.activeElement;
   if(!first){event.preventDefault();state.focus(entry);return;}
   if(!entry.dialog.contains(active)||!items.includes(active)||event.shiftKey&&active===first||!event.shiftKey&&active===last){event.preventDefault();(event.shiftKey?last:first).focus();}
  };
  state.focusIn=event=>{const entry=state.entries.at(-1);if(entry&&available(entry.dialog)&&!entry.dialog.contains(event.target))state.focus(entry);};
  sessions.set(doc,state);doc.body.style.overflow='hidden';doc.addEventListener('keydown',state.key,true);doc.addEventListener('focusin',state.focusIn,true);
 }
 const entry={dialog,onClose,previous:doc.activeElement};state.entries.push(entry);state.focus(entry);let closed=false;
 return ()=>{
  if(closed)return;closed=true;
  const top=state.entries.at(-1)===entry;state.entries=state.entries.filter(item=>item!==entry);
  if(!state.entries.length){doc.removeEventListener('keydown',state.key,true);doc.removeEventListener('focusin',state.focusIn,true);doc.body.style.overflow=state.overflow;sessions.delete(doc);}
  if(!top)return;
  const parent=state.entries.at(-1);
  if(available(entry.previous)&&(!parent||parent.dialog.contains(entry.previous)))entry.previous.focus();else if(parent)state.focus(parent);
 };
}
