export function waterGarden(page){
 if(!page)return 0;const step=Math.min(3,Number(page.dataset.gardenStep||0)+1);page.dataset.gardenStep=String(step);
 const message=page.querySelector('[data-garden-message]'),count=page.querySelector('[data-garden-count]'),button=page.querySelector('[data-garden-water]');
 if(message)message.textContent=['','Um carinho vira raiz.','Outro cuidado. Um novo começo.','Olha só o que a gente cultivou.'][step];
 if(count)count.textContent=step+' / 3';
 if(button&&step===3){button.disabled=true;const label=button.querySelector('span');if(label)label.textContent='Floresceu com a gente';}
 return step;
}
export function bindAlbumScenes(book,pages){
 const update=()=>{const index=book.getCurrentPageIndex(),spread=book.getOrientation()==='landscape'&&index>0?[index,index+1]:[index];pages.forEach((page,i)=>{const visible=spread.includes(i);page.classList.toggle('is-scene-visible',visible);page.inert=!visible;page.setAttribute?.('aria-hidden',visible?'false':'true');});};
 for(const name of ['flip','changeOrientation','init'])book.on(name,update);update();
 return()=>{for(const name of ['flip','changeOrientation','init'])book.off(name);};
}
