/** Browser gamepad indices are stable assignments, never positions in a filtered list. */
export function connectedPads(gamepads=[]){
 return Array.from(gamepads||[]).flatMap((pad,arrayIndex)=>pad&&pad.connected!==false?[{pad,index:Number.isInteger(pad.index)?pad.index:arrayIndex}]:[]);
}

export class CoopLobby{
 constructor(heroIds){this.heroIds=[...heroIds];this.slots=[];}
 reset(){this.slots=[];}
 get keyboard(){return this.hasKeyboard(0);}
 hasKeyboard(index){return this.slots.some(slot=>slot.kind==='keyboard'&&(slot.keyboardIndex??0)===index);}
 get canStart(){return this.slots.length>=2&&this.slots.length<=4;}
 freeHero(){return this.heroIds.find(id=>!this.slots.some(slot=>slot.heroId===id));}
 setKeyboard(enabled,keyboardIndex=0){
  if(![0,1].includes(keyboardIndex))return false;
  const existing=this.slots.findIndex(slot=>slot.kind==='keyboard'&&(slot.keyboardIndex??0)===keyboardIndex);
  if(enabled===(existing>=0))return false;
  if(enabled){
   if(this.slots.length<4)this.slots.push({kind:'keyboard',keyboardIndex,heroId:this.freeHero()});
   else return false;
  }else this.slots.splice(existing,1);
  return true;
 }
 join(index,gamepads){
  if(!Number.isInteger(index)||!connectedPads(gamepads).some(entry=>entry.index===index))return -1;
  const existing=this.slots.findIndex(slot=>slot.kind==='gamepad'&&slot.padIndex===index);
  if(existing!==-1)return existing;
  if(this.slots.length>=4)return -1;
  this.slots.push({kind:'gamepad',padIndex:index,heroId:this.freeHero()});return this.slots.length-1;
 }
 remove(index){if(Number.isInteger(index)&&index>=0&&index<this.slots.length)this.slots.splice(index,1);}
 cycleHero(index,direction){
  const slot=this.slots[index];if(!slot)return false;
  const next=this.heroIds[(this.heroIds.indexOf(slot.heroId)+(direction<0?-1:1)+this.heroIds.length)%this.heroIds.length];
  const other=this.slots.find(entry=>entry!==slot&&entry.heroId===next);
  if(other)other.heroId=slot.heroId;
  slot.heroId=next;return true;
 }
 restore(bindings){
  if(!Array.isArray(bindings)||bindings.length>4)throw new Error('Invalid controller assignments');
  const heroes=new Set(),pads=new Set(),keyboards=new Set();
  for(const [index,slot] of bindings.entries()){
   if(!this.heroIds.includes(slot.heroId)||heroes.has(slot.heroId))throw new Error('Duplicate or invalid fighter');heroes.add(slot.heroId);
   if(slot.kind==='keyboard'){const key=slot.keyboardIndex??0;if(![0,1].includes(key)||keyboards.has(key))throw new Error('Duplicate or invalid keyboard');keyboards.add(key);}
   else if(slot.kind==='gamepad'&&Number.isInteger(slot.padIndex)&&slot.padIndex>=0&&!pads.has(slot.padIndex))pads.add(slot.padIndex);
   else throw new Error('Duplicate or invalid controller');
  }
  this.slots=bindings.map(slot=>({...slot}));
 }
 missing(gamepads,bindings=this.slots){
  const connected=new Set(connectedPads(gamepads).map(entry=>entry.index));
  return bindings.flatMap((slot,index)=>slot.kind==='gamepad'&&!connected.has(slot.padIndex)?[{...slot,playerIndex:index}]:[]);
 }
 snapshot(gamepads){
  if(!this.canStart||this.missing(gamepads).length)throw new Error('Connect two to four players first');
  return Object.freeze(this.slots.map(slot=>Object.freeze({...slot})));
 }
}

export const COOP_KEYBOARD_CODES=['KeyC','KeyV','KeyX','KeyO','Enter'];
export const COOP_KEYBOARD_HINTS=[
 'WASD · C Schlag · V Tritt · X Spezial · Leertaste Sprung · E Aufheben / Helfen · linke Shift Ausweichen',
 'Pfeile · J Schlag · K Tritt · L Spezial · Enter Sprung · O Aufheben / Helfen · rechte Shift Ausweichen',
];

/** Assignments survive slot removal and hero swaps; no key belongs to both sides. */
export function coopKeyboardCommand(has,index=0,{shared=false}={}){
 if(index===1)return{x:Number(has('ArrowRight'))-Number(has('ArrowLeft')),y:Number(has('ArrowDown'))-Number(has('ArrowUp')),attack:has('KeyJ'),heavy:has('KeyK'),special:has('KeyL'),jump:has('Enter'),dodge:has('ShiftRight'),interact:has('KeyO'),revive:has('KeyO')};
 if(index!==0)return{};
 return{x:Number(has('KeyD')||(!shared&&has('ArrowRight')))-Number(has('KeyA')||(!shared&&has('ArrowLeft'))),y:Number(has('KeyS')||(!shared&&has('ArrowDown')))-Number(has('KeyW')||(!shared&&has('ArrowUp'))),attack:has('KeyC')||(!shared&&has('KeyJ')),heavy:has('KeyV')||(!shared&&has('KeyK')),special:has('KeyX')||(!shared&&has('KeyL')),jump:has('Space'),dodge:has('ShiftLeft')||(!shared&&has('ShiftRight')),interact:has('KeyE'),revive:has('KeyE')};
}

export function coopKeyboardHelp(bindings=[]){
 const keyboards=bindings.flatMap((slot,index)=>slot.kind==='keyboard'?[{player:index+1,key:slot.keyboardIndex??0}]:[]);
 return keyboards.length?`<div class="coop-key-guide" aria-label="Tastaturbelegung">${keyboards.map(({player,key})=>`<p><strong>SPIELER ${player} · TASTATUR ${key===0?'LINKS':'RECHTS'}</strong><span>${COOP_KEYBOARD_HINTS[key]}</span></p>`).join('')}</div>`:'';
}

/** One edge history and held-action lock per physical controller. */
export class GamepadInput{
 constructor(){this.previous=new Map();this.blocked=new Map();this.current=[];}
 blockHeld(gamepads){
  this.blocked.clear();
  for(const {pad,index} of connectedPads(gamepads))this.blocked.set(index,new Set(Array.from(pad.buttons||[]).flatMap((button,i)=>button.pressed?[i]:[])));
 }
 poll(gamepads){
  const current=[];
  for(const {pad,index} of connectedPads(gamepads)){
   const buttons=Array.from(pad.buttons||[],button=>!!button.pressed),x=Number(pad.axes?.[0])||0,y=Number(pad.axes?.[1])||0;
   const direction={left:!!buttons[14]||x<-.55,right:!!buttons[15]||x>.55,up:!!buttons[12]||y<-.55,down:!!buttons[13]||y>.55};
   const before=this.previous.get(index)||{buttons:[],direction:{}},blocked=this.blocked.get(index)||new Set();
   for(const button of blocked)if(!buttons[button])blocked.delete(button);
   const frame={index,pad,buttons,x,y,direction,pressed:button=>!!buttons[button],edge:button=>!!buttons[button]&&!before.buttons[button],moved:key=>!!direction[key]&&!before.direction[key],action:button=>!!buttons[button]&&!blocked.has(button)};
   current.push(frame);this.previous.set(index,{buttons,direction});
  }
  const connected=new Set(current.map(frame=>frame.index));
  for(const index of this.previous.keys())if(!connected.has(index))this.previous.delete(index);
  for(const index of this.blocked.keys())if(!connected.has(index))this.blocked.delete(index);
  this.current=current;return current;
 }
 command(index){
  const frame=this.current.find(entry=>entry.index===index);if(!frame)return{};
  return{x:Math.abs(frame.x)>.2?frame.x:frame.pressed(15)?1:frame.pressed(14)?-1:0,y:Math.abs(frame.y)>.2?frame.y:frame.pressed(13)?1:frame.pressed(12)?-1:0,attack:frame.action(2),heavy:frame.action(3),jump:frame.action(0),dodge:frame.action(1),special:frame.action(5),interact:frame.action(4),revive:frame.action(4)};
 }
}
