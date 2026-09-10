import { HEROES, LEVELS, ENEMY_TYPES, HEAVY_KICK_TIMING, BAT_TIMING, THROW_TIMING, JUMP_KICK_TIMING, ITEM_TYPES } from './data.js';
import { releasedPropPose, propHeightRange, batStrikeReach } from './prop-geometry.js';
import { CAR_WIDTHS as CAR_WIDTH, CAR_DEPTH, STREET_CARS } from './street-layout.js';
export { HEROES, LEVELS };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.8);
let serial=0;
const uid=()=>++serial;
const BOSS_PATTERNS={broker:['heavy','charge','heavy','slam'],enforcer:['heavy','slam','charge','charge'],baron:['slam','charge','slam','heavy'],bouncer:['heavy','heavy','charge','slam','heavy','slam']};
const SPAWN_LANES=[468,548,628],MAX_ACTIVE_ENEMIES=3,ENTRY_MARGIN=320;

export class Game {
 constructor({onEvent=()=>{},seed=0xf4e1}={}) { this.onEvent=onEvent; this.seed=seed>>>0;this.randomState=this.seed;this.mode='menu'; this.state={mode:'menu'}; this.time=0; this.enemies=[]; this.spawnQueue=[];this.spawnDelay=0;this.waveSpawned=null;this.effects=[]; this.pickups=[]; this.props=[];this.interactDown=false;this.camera=0; this.score=0; this.combo=0; this.stats={}; }
 random() { let n=this.randomState=(this.randomState+0x6d2b79f5)>>>0;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296; }
 setMode(mode) { this.mode=mode; this.state.mode=mode; }
 emit(type,data={}) { this.onEvent({type,...data}); }
 effect(kind,x,y,opts={}) { this.effects.push({kind,x,y,z:0,life:.45,maxLife:.45,color:'#fff',...opts}); }
 makeHero(id,x,y,isPartner=false) { const d=HEROES[id]; return { ...d,uid:uid(),type:'hero',heroId:id,isPartner,x,y,z:0,vz:0,vx:0,vy:0,facing:1,maxHp:d.hp,maxEnergy:100,energy:100,state:'idle',hp:d.hp,invuln:0,hitstun:0,cooldown:0,attackTime:0,attackDuration:0,attackKind:'',comboStep:0,comboWindow:0,dodgeCooldown:0,specialCooldown:0,downTimer:0,rescueProgress:0,heldItem:null,pendingInteract:null,batInputUntil:0,airAttackUsed:false,landingRecovery:0,aiThink:0 }; }
 start(heroId='nico',sidekickId='andreas',levelIndex=0) {
  if (!HEROES[heroId]||!HEROES[sidekickId]||heroId===sidekickId) throw new Error('Wähle zwei verschiedene Helden.');
  this.player=this.makeHero(heroId,230,555); this.partner=this.makeHero(sidekickId,145,610,true);
  this.randomState=this.seed;this.score=0;this.combo=0;this.comboTimer=0;this.time=0;this.interactDown=false;this.stats={kills:0,hits:0,playerHits:0,partnerHits:0,damageDealt:0,damageTaken:0,specials:0,revives:0,maxCombo:0,levelsCleared:0};
  this.setMode('playing');this.loadLevel(clamp(levelIndex|0,0,LEVELS.length-1));
 }
 loadLevel(index) {
  if(!Number.isInteger(index)||!LEVELS[index])throw new RangeError('Unbekanntes Level.');
  this.levelIndex=index;this.level=LEVELS[index];this.camera=0;this.enemies=[];this.effects=[];this.pickups=[];this.rescues=2;this.transition=0;this.defeatTimer=0;this.shake=0;
  this.obstacles=(STREET_CARS[this.level.id]||[]).map(car=>({...car,uid:uid(),kind:'car',hp:car.model==='compact'?125:180,maxHp:car.model==='compact'?125:180}));
  this.residents=[];
  for(let arena=0;arena<this.level.waves.length;arena++)for(let wave=1;wave<=this.level.waves[arena].length;wave++){
   for(const entry of this.waveEntries(arena,wave))if(ENEMY_TYPES[entry.type]?.passive||ENEMY_TYPES[entry.type]?.kind==='passive')this.spawnEnemy({...entry,resident:true,arenaIndex:arena,wave});
  }
  this.props=[.14,.43,.72].map((fraction,i)=>({uid:uid(),type:i===1?'bicycle':'bat',x:Math.round(this.level.width*fraction),y:555+i*23,z:0,rotation:0,state:'ground',durability:i===1?null:ITEM_TYPES.bat.durability}));
  this.player.x=230;this.player.y=555;this.partner.x=145;this.partner.y=610;
  for(const h of [this.player,this.partner]) {
   h.hp=Math.min(h.maxHp,h.hp+h.maxHp*.45);if(h.hp<=0)h.hp=h.maxHp*.6;
   h.state='idle';h.downTimer=0;h.rescueProgress=0;h.attackTime=0;h.attackDuration=0;h.attackContactTime=0;h.attackKind='';h.attackHits=new Set();h.didStrike=false;h.hitstun=0;h.z=0;h.vz=0;h.vx=0;h.vy=0;h.comboStep=0;h.comboWindow=0;h.cooldown=0;h.dodgeTime=0;h.dodgeCooldown=0;h.specialCooldown=0;h.walkDistance=0;h.walkSpeed=0;h.walking=false;
   h.invuln=2;h.energy=Math.min(100,h.energy+40);
   h.heldItem=null;h.pendingInteract=null;h.batInputUntil=0;h.airAttackUsed=false;h.landingRecovery=0;h.obstacleRoute=null;
  }
  this.enterArena(0);this.emit('level',{index,name:this.level.name});
 }
 enterArena(index) { const span=this.level.width/this.level.waves.length;this.arena={index,left:index*span,right:(index+1)*span,cleared:false};this.spawnQueue=[];this.spawnDelay=0;this.waveSpawned=null;this.wave=1;this.waveDelay=.9;this.waitingWave=true;this.announcement=index===0?this.level.subtitle:'ARENA '+(index+1);this.announcementTime=2.2; }
 waveEntries(arena,wave){
  const waves=this.level.waves[arena],bossWave=arena===this.level.waves.length-1&&wave===waves.length,types=this.level.enemyRoster||Object.keys(ENEMY_TYPES);
  return Array.from({length:waves[wave-1]},(_,order)=>({order,boss:bossWave&&order===0,type:bossWave&&order===0?this.level.bossType:types[(order+arena+wave+this.levelIndex)%types.length]}));
 }
 attackableEnemies(){return [...this.enemies,...(this.residents||[])];}
 spawnWave() {
  const waveKey=this.arena.index+':'+this.wave;if(this.waveSpawned===waveKey)return;
  const arenaWaves=this.level.waves[this.arena.index];const count=arenaWaves[this.wave-1];const bossWave=this.arena.index===this.level.waves.length-1&&this.wave===arenaWaves.length;
  this.spawnQueue=this.waveEntries(this.arena.index,this.wave);
  this.spawnDelay=0;this.waveSpawned=waveKey;
  this.waitingWave=false;this.emit('wave',{wave:this.wave,arena:this.arena.index,boss:bossWave});this.announcement=bossWave?this.level.boss:'WELLE '+this.wave+' / '+arenaWaves.length;this.announcementTime=1.5;
  this.updateSpawnQueue(0);
 }
 spawnEnemy({order,boss,type,resident=false,arenaIndex=this.arena?.index||0,wave=this.wave||1}) {
  const d=boss?{name:this.level.boss,hp:420+Math.min(this.levelIndex,2)*100,speed:130+Math.min(this.levelIndex,2)*8,power:21+Math.min(this.levelIndex,2)*2,color:this.level.accent,range:115,telegraph:.9,kind:'heavy',...this.level.bossStats}:ENEMY_TYPES[type];
  const hp=d.hp*(boss?1:this.level.enemyHealthScale??1+Math.min(this.levelIndex,2)*.12);
  const passive=d.passive||d.kind==='passive',side=(order+arenaIndex+wave+this.levelIndex)%2?1:-1;
  const seatKey=arenaIndex+':'+wave+':'+order;
  const existing=passive&&!resident&&(this.residents||[]).find(e=>e.seatKey===seatKey&&e.type===type);
  if(existing){
   this.residents.splice(this.residents.indexOf(existing),1);
   if(existing.hp>0||existing.deadTime>0)this.enemies.push(existing);
   this.emit('enemy-enter',{uid:existing.uid,enemyType:type,boss,side,x:existing.x,y:existing.y,preplaced:true});return;
  }
  let y=passive?628:SPAWN_LANES[(order*2+wave+arenaIndex)%SPAWN_LANES.length];
  // Entrants start beyond both the viewport and the arena. Only this brief
  // approach may use the outer corridor; normal combat keeps the arena bounds.
  const span=this.level.width/this.level.waves.length,left=arenaIndex*span,right=left+span;
  let x=side<0?Math.min(this.camera-ENTRY_MARGIN,left-ENTRY_MARGIN):Math.max(this.camera+1280+ENTRY_MARGIN,right+ENTRY_MARGIN);
  if(passive){
   // Seated figures are part of the street from the first frame, including
   // upcoming districts; activating their wave never creates a visible body.
   const compact=this.obstacles.find(car=>car.model==='compact'&&car.x>left&&car.x<right);
   const previous=(this.residents||[]).filter(e=>e.seatArena===arenaIndex).length;
   x=left+span*(previous?.78:.48);y=previous?628:548;
   if(compact){const gap=CAR_WIDTH.compact/2+85,candidates=[compact.x+gap,compact.x-gap].filter(position=>position>left+70&&position<right-70);x=candidates[previous%candidates.length]??left+80;y=compact.y;if(previous>=candidates.length)y=clamp(y+128,440,650);}
   x=clamp(x,left+70,right-70);
  }else{
   // A wider car can also occupy an offscreen entrance. Choose a free lane
   // before placing the actor, so collision never ejects a newly arrived body.
   y=[y,...SPAWN_LANES.filter(lane=>lane!==y)].find(lane=>!this.obstacles.some(car=>car.hp>0&&Math.abs(car.x-x)<CAR_WIDTH[car.model]/2+32&&Math.abs(car.y-lane)<CAR_DEPTH+24))??468;
  }
  const enemy={...d,uid:uid(),id:type,type,isBoss:boss,x,y,z:0,vx:0,vy:0,facing:passive?1:-side,hp,maxHp:hp,state:'idle',entering:!passive,entrySide:side,invuln:0,hitstun:0,cooldown:.6,attackTime:0,attackDuration:0,attackKind:'',attackCount:0,deadTime:0};
  if(resident){Object.assign(enemy,{seatKey,seatArena:arenaIndex});this.residents.push(enemy);return;}
  this.enemies.push(enemy);this.emit('enemy-enter',{uid:enemy.uid,enemyType:type,boss,side,x,y});
 }
 updateSpawnQueue(dt) {
  if(this.mode!=='playing'||this.player.hp<=0||!this.spawnQueue.length)return;
  if(this.enemies.filter(enemy=>enemy.hp>0).length>=MAX_ACTIVE_ENEMIES)return;
  this.spawnDelay=Math.max(0,this.spawnDelay-dt);if(this.spawnDelay>0)return;
  const next=this.spawnQueue.shift();this.spawnEnemy(next);
  // Two separated arrivals form a small group, followed by a longer breath.
  this.spawnDelay=next.boss?2.4:next.order%2===0?.55:1.55;
 }
 hurtCar(car,damage,source) {
  if(car.hp<=0)return false;
  car.hp=Math.max(0,car.hp-damage);
  this.effect('hit',car.x,car.y-60,{color:'#ffe3b8',life:.22,maxLife:.22});
  this.emit('car-hit',{targetUid:car.uid,model:car.model,x:car.x,y:car.y,damage,hero:source?.heroId});
  if(car.hp===0){this.emit('car-break',{targetUid:car.uid,model:car.model,x:car.x,y:car.y});this.shake=Math.max(this.shake,.13);}
  return true;
 }
 resolveObstacles(entity,fromX,fromY) {
  for(const car of this.obstacles||[]){
   if(car.hp<=0)continue;
   const half=CAR_WIDTH[car.model]/2+16,depth=CAR_DEPTH+12;
   const left=car.x-half,right=car.x+half,top=car.y-depth,bottom=car.y+depth;
   if(entity.x<=left||entity.x>=right||entity.y<=top||entity.y>=bottom)continue;
   if(fromX<=left)entity.x=left;else if(fromX>=right)entity.x=right;
   else if(fromY<=top)entity.y=top;else if(fromY>=bottom)entity.y=bottom;
   else{
    const edges=[{axis:'x',value:left,d:entity.x-left},{axis:'x',value:right,d:right-entity.x},{axis:'y',value:top,d:entity.y-top},{axis:'y',value:bottom,d:bottom-entity.y}];
    const edge=edges.sort((a,b)=>a.d-b.d)[0];entity[edge.axis]=edge.value;
   }
  }
 }
 obstacleInput(entity,target,input) {
  let route=entity.obstacleRoute;
  if(route){
   const car=(this.obstacles||[]).find(item=>item.uid===route.uid&&item.hp>0);
   if(!car||(entity.x-route.exitX)*route.direction>=0||(target.x-entity.x)*route.direction<-30){entity.obstacleRoute=null;route=null;}
  }
  if(!route&&input.x){
   for(const car of this.obstacles||[]){
    const half=CAR_WIDTH[car.model]/2+16,dx=car.x-entity.x,direction=Math.sign(input.x);
    if(car.hp<=0||dx*direction<0||Math.abs(dx)>half+85||Math.abs(entity.y-car.y)>CAR_DEPTH+16||(target.x-car.x)*direction<-half)continue;
    const options=[car.y-60,car.y+60].filter(y=>y>=440&&y<=650);
    const onClearEdge=Math.abs(dx)<half&&Math.abs(entity.y-car.y)>=CAR_DEPTH+12-.001;
    const y=onClearEdge?entity.y:options.sort((a,b)=>Math.abs(a-entity.y)-Math.abs(b-entity.y))[0];
    route=entity.obstacleRoute={uid:car.uid,y,direction,exitX:car.x+direction*(half+35)};break;
   }
  }
  if(!route)return input;
  return Math.abs(entity.y-route.y)>3?{...input,x:0,y:Math.sign(route.y-entity.y)}:{...input,x:route.direction,y:0};
 }
 pause(){if(this.mode==='playing'){this.shake=0;for(const h of [this.player,this.partner]){h.pendingInteract=null;h.batInputUntil=0;}this.setMode('paused');}} resume(){if(this.mode==='paused')this.setMode('playing');}
 continueLevel(){
  if(this.mode!=='level-clear')return false;
  if(this.levelIndex<LEVELS.length-1){this.setMode('playing');this.loadLevel(this.levelIndex+1);}
  else{this.setMode('victory');this.score+=5000;this.emit('victory',{score:this.score,stats:this.stats});}
  return true;
 }
 getNearbyProp(h=this.player) {
  if(!h||h.hp<=0||h.z>0||h.heldItem)return null;
  return this.props.filter(p=>p.state==='ground'&&Math.abs(p.x-h.x)<=90&&Math.abs(p.y-h.y)<=55).sort((a,b)=>distance(a,h)-distance(b,h))[0]||null;
 }
 interact(h) {
  if(this.mode!=='playing'||h.hp<=0||h.hitstun>0||h.attackTime>0||h.cooldown>0||h.state==='dodge'||h.z>0)return false;
  if(h.heldItem)return this.attack(h,'throw');
  const prop=this.getNearbyProp(h);if(!prop)return false;
  h.heldItem={uid:prop.uid,type:prop.type,durability:prop.durability};this.props.splice(this.props.indexOf(prop),1);
  this.emit('prop-pickup',{hero:h.heroId,propType:prop.type,uid:prop.uid,x:h.x,y:h.y});return true;
 }
 dropHeld(h) {
  if(!h.heldItem)return;
  const item=h.heldItem;h.heldItem=null;this.props.push({...item,x:h.x,y:h.y,z:0,rotation:0,state:'ground'});
  this.emit('prop-drop',{hero:h.heroId,propType:item.type,uid:item.uid,x:h.x,y:h.y});
 }
 releaseThrown(h) {
  const item=h.heldItem;if(!item)return;
  const def=ITEM_TYPES[item.type],pose=releasedPropPose(h);h.heldItem=null;
  this.props.push({...item,...pose,vx:h.attackFacing*def.throwSpeed,vz:def.throwLift,state:'thrown',life:1.2,age:0,ownerUid:h.uid,damage:def.throwDamage*h.power*(h.isPartner?.8:1),hitUids:new Set()});
  this.emit('prop-throw',{hero:h.heroId,propType:item.type,uid:item.uid,x:h.x,y:h.y,facing:h.attackFacing});
 }
 updateProps(dt) {
  for(const prop of this.props){
   if(prop.state!=='thrown')continue;
   const previousX=prop.x;prop.age+=dt;prop.life-=dt;prop.x=clamp(prop.x+prop.vx*dt,20,this.level.width-20);prop.vz-=650*dt;prop.z=Math.max(0,prop.z+prop.vz*dt);prop.rotation+=Math.sign(prop.vx)*dt*(prop.type==='bicycle'?7:12);
   const source=[this.player,this.partner].find(h=>h.uid===prop.ownerUid),radius=prop.type==='bicycle'?48:30;
   const height=propHeightRange(prop);
   if(source)for(const e of this.attackableEnemies()){
    if(e.hp<=0||prop.hitUids.has(e.uid)||height.top<8||height.bottom>(e.isBoss?268:211)||Math.abs(e.y-prop.y)>50||e.x<Math.min(previousX,prop.x)-radius||e.x>Math.max(previousX,prop.x)+radius)continue;
    if(this.hurt(e,prop.damage,source,prop.type==='bicycle'?320:230)){prop.hitUids.add(e.uid);this.emit('prop-hit',{hero:source.heroId,propType:prop.type,uid:prop.uid,targetUid:e.uid,x:e.x,y:e.y});}
   }
   if(source)for(const car of this.obstacles||[]){
    const half=CAR_WIDTH[car.model]/2;
    if(car.hp<=0||prop.hitUids.has(car.uid)||height.top<8||height.bottom>170||Math.abs(car.y-prop.y)>CAR_DEPTH+42||car.x+half<Math.min(previousX,prop.x)-radius||car.x-half>Math.max(previousX,prop.x)+radius)continue;
    if(this.hurtCar(car,prop.damage,source))prop.hitUids.add(car.uid);
   }
   if(prop.life<=0||prop.z===0||prop.x===20||prop.x===this.level.width-20){prop.state='ground';prop.z=0;prop.rotation=0;prop.vx=0;prop.vz=0;prop.life=0;prop.hitUids.clear();this.emit('prop-land',{propType:prop.type,uid:prop.uid,x:prop.x,y:prop.y});}
  }
 }
 attack(h,kind='light') {
  if(h.hp<=0||h.hitstun>0||h.state==='dodge'||h.cooldown>0||h.attackTime>0||h.landingRecovery>0)return false;
  if(kind==='special'&&(h.energy<45||h.specialCooldown>0))return false;
  const airborne=(h.z>0||h.vz>0)&&(kind==='light'||kind==='heavy');
  if(airborne&&h.airAttackUsed)return false;
  let action=airborne?'jump-kick':kind;
  if(!airborne&&kind==='light'&&h.heldItem)action=h.heldItem.type==='bat'?'bat':'throw';
  if(action==='throw'&&!h.heldItem)return false;
  h.state='attack';h.attackKind=action;h.attackHits=new Set();h.attackFacing=h.facing;if(action==='bat')h.batInputUntil=0;if(airborne)h.airAttackUsed=true;
  if(kind==='light'){h.comboStep=h.comboWindow>0?(h.comboStep%3)+1:1;h.comboWindow=.95;}
  const groundedKick=h.type==='hero'&&h.attackKind==='heavy'&&h.z===0&&h.vz<=0;
  const timing=action==='bat'?BAT_TIMING:action==='throw'?THROW_TIMING:action==='jump-kick'?JUMP_KICK_TIMING:groundedKick?HEAVY_KICK_TIMING:null;
  const durations={light:h.comboStep===3?.48:.32,heavy:.67,air:.42,special:.8};h.attackDuration=timing?timing.duration:durations[h.attackKind];h.attackTime=h.attackDuration;
  h.attackContactTime=timing?timing.contact:h.attackKind==='heavy'?.28:h.attackKind==='special'?.20:.09;
  h.cooldown=timing&&action!=='jump-kick'?h.attackDuration+timing.repeatDelay:.08;h.didStrike=false;
  if(kind==='special'){h.energy-=45;h.specialCooldown=1.8;h.invuln=.85;this.stats.specials++;this.emit('special',{hero:h.heroId,x:h.x,y:h.y});if(h.heroId==='andreas')for(const ally of [this.player,this.partner]){if(ally.hp>0){ally.hp=Math.min(ally.maxHp,ally.hp+25);this.effect('heal',ally.x,ally.y-75,{text:'+25',color:'#82ffe0',life:1,maxLife:1});}}}
  else this.emit('swing',{kind:h.attackKind,hero:h.heroId,uid:h.uid,x:h.x,y:h.y});return true;
 }
 strike(h) {
  const kind=h.attackKind;if(kind==='jump-kick'&&(h.z<=8||h.z>165))return;
  let range=kind==='bat'?batStrikeReach(h):kind==='jump-kick'?145:kind==='heavy'?120:kind==='air'?125:96;let depth=kind==='bat'?58:kind==='jump-kick'?68:kind==='heavy'?64:kind==='air'?66:49;let damage=(kind==='bat'?ITEM_TYPES.bat.damage:kind==='jump-kick'?28:kind==='heavy'?34:kind==='air'?24:h.comboStep===3?26:16)*h.power;let knock=kind==='bat'?210:kind==='jump-kick'?230:kind==='heavy'||h.comboStep===3?250:120;
  let omni=false;
  if(kind==='special'){ range={nico:235,stefan:190,torsten:280,andreas:190}[h.heroId];depth=h.heroId==='torsten'?160:115;damage={nico:56,stefan:48,torsten:58,andreas:34}[h.heroId]*h.power;knock=390;omni=h.heroId!=='nico';this.effect('special',h.x,h.y,{color:h.color,life:.65,maxLife:.65,radius:range,heroId:h.heroId}); }
  if(h.isPartner)damage*=.8;
  let hits=0;for(const e of this.attackableEnemies()){if(e.hp<=0||h.attackHits.has(e.uid)||Math.abs(e.y-h.y)>depth||Math.abs(e.x-h.x)>range||(!omni&&(e.x-h.x)*h.attackFacing < -26))continue;h.attackHits.add(e.uid);if(this.hurt(e,damage,h,knock))hits++;}
  for(const car of this.obstacles||[]){const half=CAR_WIDTH[car.model]/2;if(car.hp<=0||h.attackHits.has(car.uid)||Math.abs(car.y-h.y)>depth+CAR_DEPTH||Math.abs(car.x-h.x)>range+half||(!omni&&(car.x-h.x)*h.attackFacing < -half-26))continue;h.attackHits.add(car.uid);if(this.hurtCar(car,damage,h))hits++;}
  if(hits&&kind==='bat'&&h.heldItem?.type==='bat'){h.heldItem.durability--;this.emit('prop-bat-hit',{hero:h.heroId,propType:'bat',uid:h.heldItem.uid,hits,x:h.x,y:h.y});if(h.heldItem.durability<=0){this.emit('prop-break',{hero:h.heroId,propType:'bat',uid:h.heldItem.uid,x:h.x,y:h.y});h.heldItem=null;}}
  if(hits&&kind==='jump-kick')this.emit('jump-hit',{hero:h.heroId,hits,x:h.x,y:h.y});
 }
 hurt(target,damage,source,knock=120) {
  if(target.hp<=0||target.invuln>0||target.state==='dodge')return false;
  if(target.type==='hero'&&target.z>45&&source.attackKind!=='slam')return false;
  const armored=target.isBoss&&(target.state==='telegraph'||target.state==='attack');
  target.hp=Math.max(0,target.hp-damage);target.invuln=target.type==='hero'?.55:.13;target.hitstun=armored?0:target.isBoss?.16:.3;
  if(!armored||target.hp<=0){target.state=target.hp>0?'hurt':target.type==='hero'?'down':'dead';target.attackTime=0;}
  target.vx=armored?0:Math.sign(target.x-source.x||source.facing)*knock*(target.isBoss?.38:1);target.vy=(target.y-source.y)*.5;
  this.effect('hit',target.x,target.y-65,{color:source.color||'#ffdc8b',life:.24,maxLife:.24});this.effect('number',target.x,target.y-108,{text:String(Math.round(damage)),color:target.type==='hero'?'#ff8d90':'#fff3cc',life:.65,maxLife:.65});
  this.emit('hit',{x:target.x,y:target.y,damage,hero:target.type==='hero',heavy:knock>200,attackerHero:source.heroId||null,targetHero:target.heroId||null,attackerUid:source.uid,targetUid:target.uid});this.shake=Math.max(this.shake||0,knock>200?.2:.09);
  if(target.type==='hero'){target.pendingInteract=null;target.batInputUntil=0;this.stats.damageTaken+=damage;this.combo=0;this.comboTimer=0;}else{this.stats.damageDealt+=damage;this.stats.hits++;this.stats[source.isPartner?'partnerHits':'playerHits']++;this.combo++;this.comboTimer=2.5;this.stats.maxCombo=Math.max(this.stats.maxCombo,this.combo);this.score+=Math.round(damage*3);source.energy=Math.min(100,source.energy+5);}
  if(target.hp<=0){target.downTimer=0;if(target.type==='hero'){target.z=0;this.dropHeld(target);this.emit('down',{hero:target.heroId});}else{this.stats.kills++;this.score+=target.isBoss?1500:150;target.deadTime=.6;const food=target.isBoss||this.stats.kills%(this.level.foodEvery||8)===0;if(food||this.stats.kills%4===0)this.pickups.push({uid:uid(),kind:food?'food':'energy',x:target.x,y:target.y,life:35});}}
  return true;
 }
 heroUpdate(h,dt,inp) {
  h.dodgeCooldown=Math.max(0,h.dodgeCooldown-dt);h.specialCooldown=Math.max(0,h.specialCooldown-dt);h.comboWindow=Math.max(0,h.comboWindow-dt);h.landingRecovery=Math.max(0,h.landingRecovery-dt);h.energy=Math.min(100,h.energy+dt*2.8);
  if(h.pendingInteract?.until<this.time)h.pendingInteract=null;
  if(h.batInputUntil<this.time||h.heldItem?.type!=='bat')h.batInputUntil=0;
  if(h.hp<=0){h.downTimer+=dt;return;}
  const rescuing=inp.revive&&h===this.player&&this.partner.hp<=0&&distance(h,this.partner)<115;
  if(rescuing)h.pendingInteract=null;
  // A brief press near the end of recovery must survive that recovery. Bind E
  // to the current item and intent so picking up can never auto-turn into throwing.
  if(inp.interact&&!rescuing&&h.hitstun<=0&&h.z===0){const item=h.heldItem||this.getNearbyProp(h);if(item)h.pendingInteract={uid:item.uid,held:!!h.heldItem,until:this.time+.22};}
  if(inp.attack&&h.heldItem?.type==='bat'&&h.hitstun<=0&&h.z===0)h.batInputUntil=this.time+.18;
  if(h.z>0||h.vz>0){h.vz-=1250*dt;h.z=Math.max(0,h.z+h.vz*dt);if(h.z===0){h.vz=0;if(h.airAttackUsed){h.landingRecovery=JUMP_KICK_TIMING.landingRecovery;if(h.attackKind==='jump-kick')h.attackTime=Math.min(h.attackTime,h.landingRecovery);}this.emit('land',{hero:h.heroId,x:h.x,y:h.y});}}
  if(h.hitstun>0)return;
  if(h.state==='dodge'){h.dodgeTime-=dt;h.x+=h.dodgeX*570*dt;h.y+=h.dodgeY*250*dt;if(h.dodgeTime<=0)h.state='idle';return;}
  if(h.attackTime>0){const elapsed=h.attackDuration-h.attackTime;const trigger=h.attackContactTime>0?h.attackContactTime:h.attackKind==='heavy'?.28:h.attackKind==='special'?.20:.09;if(!h.didStrike&&elapsed>=trigger){h.didStrike=true;if(h.attackKind==='throw')this.releaseThrown(h);else this.strike(h);}if(h.attackKind==='special'&&h.heroId==='nico')h.x+=h.attackFacing*310*dt;if(h.attackKind==='light'&&elapsed<.13)h.x+=h.attackFacing*90*dt;if(h.attackKind==='jump-kick'&&h.z>0&&elapsed<.22)h.x+=h.attackFacing*165*dt;return;}
  if(h.heldItem&&inp.x)h.facing=Math.sign(inp.x);
  if(h.pendingInteract){const pending=h.pendingInteract,item=pending.held?h.heldItem:this.getNearbyProp(h);if(rescuing||item?.uid!==pending.uid)h.pendingInteract=null;else if(this.interact(h)){h.pendingInteract=null;return;}}
  if(inp.dodge&&h.dodgeCooldown<=0&&h.z===0){h.state='dodge';h.dodgeTime=.28;h.dodgeCooldown=.7;h.invuln=.35;h.dodgeX=inp.x||h.facing;h.dodgeY=inp.y||0;this.emit('dodge',{hero:h.heroId,uid:h.uid});return;}
  if(inp.jump&&h.z===0&&h.landingRecovery<=0){h.vz=560;h.z=1;h.airAttackUsed=false;this.emit('jump',{hero:h.heroId,uid:h.uid});}
  if(inp.special&&this.attack(h,'special'))return;if(inp.heavy&&this.attack(h,'heavy'))return;if((inp.attack||h.batInputUntil>this.time)&&this.attack(h,'light'))return;
  const x=inp.x||0,y=inp.y||0;const scale=x&&y?.707:1;h.x+=x*h.speed*dt*scale;h.y+=y*h.speed*.63*dt*scale;if(x)h.facing=Math.sign(x);h.state=x||y?'walk':'idle';
 }
 partnerInput(dt) {
  const h=this.partner,p=this.player;if(h.hp<=0)return{};
  if(p.hp<=0){const dx=p.x-h.x,dy=p.y-h.y;if(distance(p,h)>75)return this.obstacleInput(h,p,{x:Math.abs(dx)>35?Math.sign(dx):0,y:Math.abs(dy)>25?Math.sign(dy):0});return{attack:!!this.enemies.find(e=>e.hp>0&&distance(e,h)<105)};}
  let enemy=this.enemies.filter(e=>e.hp>0).sort((a,b)=>distance(a,h)-distance(b,h))[0];
  if(Math.abs(h.x-p.x)>670){h.x=p.x-90*p.facing;h.y=clamp(p.y+35,450,645);this.effect('heal',h.x,h.y,{color:h.color});}
  if(enemy&&distance(enemy,p)<950){let dx=enemy.x-h.x,dy=enemy.y-h.y;h.facing=Math.sign(dx)||h.facing;return this.obstacleInput(h,enemy,{x:Math.abs(dx)>74?Math.sign(dx):0,y:Math.abs(dy)>27?Math.sign(dy):0,attack:Math.abs(dx)<102&&Math.abs(dy)<47,heavy:enemy.isBoss&&Math.abs(dx)<110&&Math.abs(dy)<48,special:h.energy>=70&&Math.abs(dx)<150&&Math.abs(dy)<65,dodge:enemy.state==='telegraph'&&enemy.attackTime<.18&&distance(enemy,h)<130&&h.dodgeCooldown<=0});}
  const dx=p.x-p.facing*95-h.x,dy=p.y+36-h.y;return this.obstacleInput(h,p,{x:Math.abs(dx)>45?Math.sign(dx):0,y:Math.abs(dy)>25?Math.sign(dy):0});
 }
 enemyUpdate(e,dt) {
  if(e.hp<=0){e.deadTime-=dt;return;}if(e.hitstun>0)return;
  if(e.passive||e.kind==='passive'){e.state='idle';e.attackTime=0;return;}
  if(e.entering){
   const left=this.arena.left+45,right=this.arena.right-45;
   if(e.x>=left&&e.x<=right)e.entering=false;
   else{const target=e.x<left?left:right;e.facing=Math.sign(target-e.x);e.state='walk';const move=this.obstacleInput(e,{x:target,y:e.y},{x:e.facing,y:0});e.x+=move.x*Math.min(Math.abs(target-e.x),e.speed*dt);e.y+=move.y*e.speed*.54*dt;e.cooldown=Math.max(e.cooldown,.45);if(e.x>=left&&e.x<=right)e.entering=false;return;}
  }
  if(e.state==='telegraph'){
   if(e.attackTime<=0){e.state='attack';e.attackDuration=e.type==='bouncer'?(e.attackKind==='charge'?.64:e.attackKind==='slam'?.58:.5):e.attackKind==='charge'?.62:.38;e.attackTime=e.attackDuration;e.didStrike=false;e.attackHits=new Set();this.emit('enemy-swing',{boss:e.isBoss,kind:e.attackKind});}return;
  }
  if(e.state==='attack'){
   if(e.attackKind==='charge'){e.x+=e.facing*(e.type==='bouncer'?460:560)*dt;this.enemyStrike(e);}else if(!e.didStrike&&e.attackTime<e.attackDuration-(e.type==='bouncer'?.14:.08)){e.didStrike=true;this.enemyStrike(e);}
   if(e.attackTime<=0){e.state='idle';e.cooldown=e.type==='bouncer'?1.3:e.isBoss?1.05:1.25+this.random()*.6;}return;
  }
  const alive=[this.player,this.partner].filter(h=>h.hp>0);if(!alive.length)return;const target=alive.sort((a,b)=>distance(a,e)-(a.isPartner?0:20)-distance(b,e)+(b.isPartner?0:20))[0];
  const dx=target.x-e.x,dy=target.y-e.y;e.facing=Math.sign(dx)||e.facing;
  const active=this.enemies.filter(o=>o!==e&&(o.state==='telegraph'||o.state==='attack')).length;
  if(Math.abs(dx)<e.range&&Math.abs(dy)<45&&e.cooldown<=0&&active<2){
   const pattern=BOSS_PATTERNS[e.type]||BOSS_PATTERNS.enforcer;
   e.attackKind=e.isBoss?pattern[e.attackCount%pattern.length]:e.kind;e.attackCount++;
   e.enraged=e.isBoss&&e.hp<e.maxHp*.4;e.attackDuration=(e.telegraph+(e.attackKind==='slam'?.32:0))*(e.enraged?.8:1);e.attackTime=e.attackDuration;e.state='telegraph';e.attackTarget={x:target.x,y:target.y};this.emit('telegraph',{boss:e.isBoss,kind:e.attackKind,x:e.x,y:e.y});return;
  }
  const hold=active>=2&&Math.abs(dx)<160;const move=this.obstacleInput(e,target,{x:Math.abs(dx)>e.range*.78&&!hold?Math.sign(dx):0,y:Math.abs(dy)>22?Math.sign(dy):0});e.x+=move.x*e.speed*dt;e.y+=move.y*e.speed*.54*dt;e.state=move.x||move.y?'walk':'idle';
 }
 enemyStrike(e) {
  if(e.passive||e.kind==='passive')return;
  const slam=e.attackKind==='slam',charge=e.attackKind==='charge';
  if(slam)this.effect('shockwave',e.x,e.y,{radius:205,color:'#ff7b67',life:.5,maxLife:.5});
  for(const h of [this.player,this.partner]){if(e.attackHits.has(h.uid)||h.hp<=0)continue;const dx=h.x-e.x,dy=Math.abs(h.y-e.y);if(Math.abs(dx)<(slam?205:charge?100:e.range+20)&&dy<(slam?110:52)&&(slam||dx*e.facing>-28)){if(this.hurt(h,e.power*(slam?1.25:1),e,slam?300:180))e.attackHits.add(h.uid);}}
 }
 update(dt,input={}) {
  if(this.mode!=='playing')return;dt=clamp(dt,0,.04);this.time+=dt;this.comboTimer-=dt;if(this.comboTimer<=0)this.combo=0;this.shake=Math.max(0,(this.shake||0)-dt);this.announcementTime=Math.max(0,(this.announcementTime||0)-dt);
  const interactPressed=!!input.interact&&!this.interactDown;this.interactDown=!!input.interact;
  const all=[this.player,this.partner,...this.attackableEnemies()];
  for(const e of all){e.motionStartX=e.x;e.motionStartY=e.y;e.walking=false;e.walkSpeed=0;}
  for(const e of all){e.invuln=Math.max(0,e.invuln-dt);e.hitstun=Math.max(0,e.hitstun-dt);e.cooldown=Math.max(0,e.cooldown-dt);if(e.attackTime>0){e.attackTime=Math.max(0,e.attackTime-dt);if(e.type==='hero'&&e.attackTime===0&&e.hp>0)e.state='idle';}if(e.hitstun>0||e.state==='dead'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=Math.exp(-dt*7);} }
  this.heroUpdate(this.player,dt,{...input,interact:interactPressed});this.heroUpdate(this.partner,dt,this.partnerInput(dt));for(const e of this.attackableEnemies())this.enemyUpdate(e,dt);
  const right=this.arena.cleared?Math.min(this.level.width,this.arena.right+220):this.arena.right-25;
  for(const e of all){
   if(e.seatKey){const span=this.level.width/this.level.waves.length;e.x=clamp(e.x,e.seatArena*span+20,(e.seatArena+1)*span-25);}
   else if(!e.entering)e.x=clamp(e.x,this.arena.left+20,right);
   e.y=clamp(e.y,440,650);this.resolveObstacles(e,e.motionStartX,e.motionStartY);
   const travel=Math.hypot(e.x-e.motionStartX,e.y-e.motionStartY);
   // Only real grounded travel advances the gait: never hit knockback,
   // an arena clamp, a sidekick catch-up teleport, or holding against a wall.
   if(e.state==='walk'&&e.hp>0&&e.z===0&&travel>.0001&&travel<=e.speed*dt*1.5){
    e.walkDistance=(e.walkDistance||0)+travel;e.walkSpeed=travel/Math.max(dt,.0001);e.walking=true;
   }
  }
  this.updateProps(dt);this.enemies=this.enemies.filter(e=>e.hp>0||e.deadTime>0);
  for(const fx of this.effects)fx.life-=dt;this.effects=this.effects.filter(f=>f.life>0);
  for(const item of this.pickups){item.life-=dt;for(const h of [this.player,this.partner]){if(h.hp>0&&distance(h,item)<58){if(item.kind==='food')h.hp=Math.min(h.maxHp,h.hp+40);else h.energy=Math.min(100,h.energy+28);this.effect('heal',h.x,h.y-90,{text:item.kind==='food'?'+40 LP':'+28 EN',color:'#94ffcc',life:.9,maxLife:.9});item.life=0;this.emit('pickup',{kind:item.kind});break;}}}this.pickups=this.pickups.filter(p=>p.life>0);
  this.updateRescue(dt,input);
  if(this.mode!=='playing')return;
  if(this.waitingWave){if(this.player.hp>0)this.waveDelay-=dt;if(this.waveDelay<=0&&this.player.hp>0)this.spawnWave();}
  else this.updateSpawnQueue(dt);
  if(!this.waitingWave&&!this.spawnQueue.length&&!this.enemies.some(e=>e.hp>0)&&!this.arena.cleared){if(this.wave<this.level.waves[this.arena.index].length){this.wave++;this.waitingWave=true;this.waveDelay=1.4;}else{this.arena.cleared=true;this.announcement='WEITER →';this.announcementTime=3;this.score+=500;this.emit('arena-clear',{arena:this.arena.index});for(const h of [this.player,this.partner])if(h.hp>0)h.hp=Math.min(h.maxHp,h.hp+(this.level.arenaHeal||12));}}
  if(this.arena.cleared&&this.arena.index===this.level.waves.length-1&&!this.waitingWave&&!this.spawnQueue.length&&!this.enemies.some(enemy=>enemy.hp>0)&&(this.player.hp>0||this.partner.hp>0)){
   this.stats.levelsCleared++;this.shake=0;this.setMode('level-clear');this.emit('level-clear',{index:this.levelIndex,name:this.level.name,score:this.score,final:this.levelIndex===LEVELS.length-1});return;
  }
  if(this.arena.cleared&&this.player.hp>0&&this.player.x>this.arena.right-95&&this.arena.index<this.level.waves.length-1)this.enterArena(this.arena.index+1);
  const desired=clamp(this.player.x-470,this.arena.left,Math.max(this.arena.left,this.arena.right-1280));const unlocked=clamp(this.player.x-470,0,this.level.width-1280);this.camera+=( (this.arena.cleared?unlocked:clamp(desired,0,this.level.width-1280))-this.camera)*Math.min(1,dt*7);
 }
 updateRescue(dt,input){
  const p=this.player,h=this.partner;
  if(h.hp<=0&&p.hp>0){const nearby=distance(p,h)<115;h.rescueProgress=(h.rescueProgress||0)+dt*(nearby&&input.revive?5:1);if(h.rescueProgress>=12){h.hp=h.maxHp*.5;h.state='idle';h.invuln=3;h.rescueProgress=0;h.downTimer=0;this.stats.revives++;this.emit('revive',{hero:h.heroId});}}
  if(p.hp<=0){if(h.hp<=0||this.rescues<=0){this.defeatTimer=(this.defeatTimer||0)+dt;if(this.defeatTimer>1.5){this.setMode('defeat');this.emit('defeat');}}else{if(distance(p,h)<110)p.rescueProgress=(p.rescueProgress||0)+dt;if(p.downTimer>9){h.x=p.x+45;h.y=p.y+20;p.rescueProgress=(p.rescueProgress||0)+dt;}if(p.rescueProgress>=2.8){p.hp=p.maxHp*.55;p.state='idle';p.invuln=3.5;p.downTimer=0;p.rescueProgress=0;this.rescues--;this.stats.revives++;this.emit('revive',{hero:p.heroId});}}}else this.defeatTimer=0;
 }
}
