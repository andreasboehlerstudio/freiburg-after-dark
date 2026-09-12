const ACTIONS=['attack','heavy','jump','special','dodge','interact'];
export const touchMode=value=>['auto','on','off'].includes(value)?value:'auto';
export function touchAvailable(navigator,query){return Number(navigator.maxTouchPoints)>0&&query.matches;}
export function mergeTouch(command,touch){
 const result={...command};
 for(const action of [...ACTIONS,'revive'])result[action]=!!(command[action]||touch[action]);
 result.x=touch.x||command.x||0;result.y=touch.y||command.y||0;
 return result;
}

/** Independent pointers allow movement, jumping and striking at the same time. */
export class TouchState {
 constructor(now=()=>performance.now()){this.now=now;this.held=new Map();this.pending=new Map();this.x=0;this.y=0;}
 press(id,action){if(!ACTIONS.includes(action))return;this.held.set(id,action);this.pending.set(action,this.now()+100);}
 release(id){this.held.delete(id);}
 move(x,y){const length=Math.hypot(x,y);if(length<.18){this.x=0;this.y=0;return;}const scale=Math.min(1,(length-.18)/.82)/length;this.x=x*scale;this.y=y*scale;}
 clear(){this.held.clear();this.pending.clear();this.x=0;this.y=0;}
 command(){const result={x:this.x,y:this.y},held=new Set(this.held.values());for(const action of ACTIONS)result[action]=held.has(action)||this.now()<(this.pending.get(action)||0);result.revive=result.interact;return result;}
}

export class TouchControls {
 constructor({document,host,mode='auto'}){
  this.document=document;this.host=host;this.mode=touchMode(mode);this.state=new TouchState();this.screen='loading';
  this.query=host.matchMedia('(pointer: coarse)');this.usedTouch=false;
  this.root=document.createElement('div');this.root.id='touch-controls';this.root.hidden=true;
  this.root.innerHTML=`<div class="touch-orientation" role="note">AM BESTEN IM QUERFORMAT SPIELEN</div><div class="touch-gamepad"><div class="touch-stick" role="group" aria-label="Bewegungsstick: ziehen zum Laufen"><span class="touch-stick-cross" aria-hidden="true">＋</span><span class="touch-stick-knob" aria-hidden="true"></span><span class="touch-stick-label">BEWEGEN</span></div><div class="touch-actions" aria-label="Aktionen für Spieler 1">${[['special','SPEZIAL'],['dodge','AUSWEICHEN'],['interact','GREIFEN'],['jump','SPRUNG'],['heavy','TRITT'],['attack','SCHLAG']].map(([action,label])=>`<button type="button" data-touch-action="${action}" aria-label="${action==='interact'?'Aufheben, Werfen oder zum Aufhelfen halten':label}" aria-pressed="false">${label}</button>`).join('')}</div></div>`;
  document.body.appendChild(this.root);this.stick=this.root.querySelector('.touch-stick');this.knob=this.root.querySelector('.touch-stick-knob');
  this.buttons=[...this.root.querySelectorAll('[data-touch-action]')];
  const stop=event=>{event.preventDefault();};
  this.root.addEventListener('contextmenu',stop);
  for(const button of this.buttons){
   button.addEventListener('pointerdown',event=>{if(!this.active||event.button>0)return;event.preventDefault();button.setPointerCapture(event.pointerId);this.state.press(event.pointerId,button.dataset.touchAction);this.paintButtons();});
   button.addEventListener('pointerup',event=>{event.preventDefault();this.state.release(event.pointerId);this.paintButtons();});
   const cancel=event=>{this.state.release(event.pointerId);this.state.pending.delete(button.dataset.touchAction);this.paintButtons();};
   button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',event=>{if(this.state.held.has(event.pointerId))cancel(event);});
  }
  this.stick.addEventListener('pointerdown',event=>{if(!this.active||this.stickPointer!=null||event.button>0)return;event.preventDefault();this.stickPointer=event.pointerId;this.stick.setPointerCapture(event.pointerId);this.move(event);});
  this.stick.addEventListener('pointermove',event=>{if(this.stickPointer===event.pointerId){event.preventDefault();this.move(event);}});
  const release=event=>{if(this.stickPointer!==event.pointerId)return;this.stickPointer=null;this.state.move(0,0);this.paintStick();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])this.stick.addEventListener(event,release);
  host.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!this.usedTouch){this.usedTouch=true;this.refresh();}},{capture:true});
  host.addEventListener('blur',()=>this.clear());
  host.addEventListener('resize',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  this.query.addEventListener?.('change',()=>this.refresh());this.refresh();
 }
 get enabled(){return this.mode==='on'||this.mode==='auto'&&(this.usedTouch||touchAvailable(this.host.navigator,this.query));}
 setMode(mode){this.mode=touchMode(mode);this.clear();this.refresh();}
 setScreen(screen){this.screen=screen;this.clear();this.refresh();}
 refresh(){const active=this.enabled&&this.screen==='playing';if(this.active!==active)this.clear();this.active=active;this.root.hidden=!this.enabled;this.root.dataset.playing=String(active);this.document.documentElement.dataset.touch=String(this.enabled);}
 clear(){this.state.clear();this.stickPointer=null;this.paintStick();this.paintButtons();}
 paintButtons(){for(const button of this.buttons||[]){const held=[...this.state.held.values()].includes(button.dataset.touchAction);button.setAttribute('aria-pressed',String(held));}}
 paintStick(){if(this.knob)this.knob.style.transform=`translate(${this.state.x*32}%,${this.state.y*32}%)`;}
 move(event){const rect=this.stick.getBoundingClientRect(),radius=rect.width*.38;this.state.move((event.clientX-rect.left-rect.width/2)/radius,(event.clientY-rect.top-rect.height/2)/radius);this.paintStick();}
 command(){return this.active?this.state.command():{};}
}
