// Canvas interaction is independent of the book's page gesture.
export function bindScratchCard(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return()=>{};
 const width=480,height=260;canvas.width=width;canvas.height=height;
 const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,'#d9bbe9');gradient.addColorStop(.5,'#b388c6');gradient.addColorStop(1,'#e6c7d8');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.fillStyle='#fff6ff';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('♡',240,104);ctx.font='18px sans-serif';ctx.fillText('Raspe para descobrir',240,152);
 const card=canvas.closest('.album-scratch-card'),button=card?.querySelector('button');let pointer=null,last=null,revealed=false;
 const reveal=()=>{revealed=true;pointer=null;last=null;card?.classList.add('scratch-revealed');};
 const at=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*width,y:(e.clientY-r.top)/r.height*height};};
 const erase=e=>{if(pointer!==e.pointerId||revealed)return;if(e.cancelable)e.preventDefault();e.stopPropagation();const p=at(e);ctx.globalCompositeOperation='destination-out';ctx.lineWidth=58;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last?.x??p.x,last?.y??p.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,29,0,Math.PI*2);ctx.fill();last=p;};
 const start=e=>{if(revealed||pointer!==null||e.isPrimary===false||e.button!==0)return;if(e.cancelable)e.preventDefault();e.stopPropagation();pointer=e.pointerId;last=null;canvas.setPointerCapture?.(pointer);erase(e);};
 const end=e=>{if(pointer!==e.pointerId)return;if(e.cancelable)e.preventDefault();e.stopPropagation();pointer=null;last=null;if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);const pixels=ctx.getImageData(0,0,width,height).data;let clear=0,total=0;for(let i=3;i<pixels.length;i+=64){total++;if(pixels[i]<40)clear++;}if(clear/total>.38)reveal();};
 const listeners=[['pointerdown',start],['pointermove',erase],['pointerup',end],['pointercancel',end],['lostpointercapture',end]];
 for(const [event,listener] of listeners)canvas.addEventListener(event,listener,{passive:false});button?.addEventListener('click',reveal);
 return()=>{for(const [event,listener] of listeners)canvas.removeEventListener(event,listener);button?.removeEventListener('click',reveal);if(pointer!==null&&canvas.hasPointerCapture?.(pointer))canvas.releasePointerCapture(pointer);};
}
