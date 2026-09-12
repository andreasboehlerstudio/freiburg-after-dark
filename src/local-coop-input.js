/** Browser gamepad indices are stable assignments, never positions in a filtered list. */
export function connectedPads(gamepads=[]){
 return Array.from(gamepads||[]).flatMap((pad,arrayIndex)=>pad&&pad.connected!==false?[{pad,index:Number.isInteger(pad.index)?pad.index:arrayIndex}]:[]);
}

export class CoopLobby{
 constructor(heroIds){this.heroIds=[...heroIds];this.slots=[];}
 reset(){this.slots=[];}
 get keyboard(){return this.slots[0]?.kind==='keyboard';}
 get canStart(){return this.slots.length>=2&&this.slots.length<=4;}
 freeHero(){return this.heroIds.find(id=>!this.slots.some(slot=>slot.heroId===id));}
 setKeyboard(enabled){
  if(enabled===this.keyboard)return false;
  if(enabled){
   if(this.slots.length)this.slots[0]={kind:'keyboard',heroId:this.slots[0].heroId};
   else this.slots.push({kind:'keyboard',heroId:this.freeHero()});
  }else this.slots.shift();
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
  const heroes=new Set(),pads=new Set();
  for(const [index,slot] of bindings.entries()){
   if(!this.heroIds.includes(slot.heroId)||heroes.has(slot.heroId))throw new Error('Duplicate or invalid fighter');heroes.add(slot.heroId);
   if(slot.kind==='keyboard'){if(index!==0)throw new Error('Only player one can use the keyboard');}
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
