// React 19 can put image preload links before the actual page element.
// Select the page by its contract, never by firstElementChild.
export function createAlbumPage(markup,index,doc=document){
 const fragment=doc.createElement('div');fragment.innerHTML=markup;
 const page=fragment.querySelector('.album-page');
 if(!page)throw Error('Não foi possível preparar uma das páginas do álbum.');
 page.dataset.page=String(index);return page;
}
