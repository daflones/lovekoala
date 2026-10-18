// Own the book gesture instead of letting PageFlip's global mouse/touch listeners
// compete with canvas, scrollable letters and buttons inside a page.
export const ALBUM_INTERACTIVE='button,a,input,select,textarea,canvas,[data-no-page-flip],.album-scratch-card,.album-scroll-copy,.album-contents,.coupon-list,.story-text';
export function bindAlbumGestures(root,book){
 let gesture=null;
 const point=e=>{const rect=book.getUI().getDistElement().getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
 const finish=e=>{if(!gesture||e.pointerId!==gesture.id)return;const current=gesture;gesture=null;if(current.started){if(e.cancelable)e.preventDefault();e.stopPropagation();book.userStop(point(e));}if(root.hasPointerCapture?.(e.pointerId))root.releasePointerCapture(e.pointerId);};
 const down=e=>{if(gesture||e.isPrimary===false||e.button!==0||e.target?.closest?.(ALBUM_INTERACTIVE)||book.getState()!=='read')return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,point:point(e),started:false};};
 const move=e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(!gesture.started){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return;gesture.started=true;book.startUserTouch(gesture.point);root.setPointerCapture?.(e.pointerId);}if(e.cancelable)e.preventDefault();e.stopPropagation();book.userMove(point(e),e.pointerType!=='mouse');};
 const listeners=[['pointerdown',down],['pointermove',move],['pointerup',finish],['pointercancel',finish],['lostpointercapture',finish]];
 for(const [event,listener] of listeners)root.addEventListener(event,listener,{passive:false});
 return()=>{for(const [event,listener] of listeners)root.removeEventListener(event,listener);if(gesture?.started)book.userStop(gesture.point);gesture=null;};
}
export function musicPageVisible(pages,page,orientation){if(!Number.isInteger(page)||page<0)return false;const visible=orientation==='landscape'&&page>0?[page,page+1]:[page];return visible.some(i=>pages[i]?.dataset.section==='music');}
export function bindAlbumMusic(book,pages,onEnter){let visible=false;const update=()=>{const next=musicPageVisible(pages,book.getCurrentPageIndex(),book.getOrientation());if(next&&!visible)onEnter();visible=next;};for(const event of ['flip','changeOrientation','init'])book.on(event,update);update();return()=>{for(const event of ['flip','changeOrientation','init'])book.off(event);};}
