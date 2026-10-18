import {useEffect,useRef} from 'react';
import {bindReaderDialog} from './reader-dialog.mjs';
// Keep the current close action without resetting focus on every parent render.
export function useReaderDialog(open:boolean,onClose:()=>void){const close=useRef(onClose);close.current=onClose;useEffect(()=>{if(open)return bindReaderDialog(()=>close.current());},[open]);}
