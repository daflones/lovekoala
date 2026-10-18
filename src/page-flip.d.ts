declare module 'page-flip' {
 export class PageFlip {
  constructor(element:HTMLElement,settings:Record<string,unknown>);
  loadFromHTML(items:NodeListOf<Element>):void;
  on(event:string,callback:(event:any)=>void):void;
  flipPrev():void;
  flipNext():void;
  flip(page:number,corner?:string):void;
  destroy():void;
  getSettings():{useMouseEvents:boolean};
  getState():string;
  getCurrentPageIndex():number;
  getOrientation():'portrait'|'landscape';
  getUI():{getDistElement():HTMLElement};
  startUserTouch(point:{x:number;y:number}):void;
  userMove(point:{x:number;y:number},isTouch:boolean):void;
  userStop(point:{x:number;y:number},isSwipe?:boolean):void;
  off(event:string):void;
 }
}
