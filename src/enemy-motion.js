import { localEnemyMotion, isLocalEnemy } from './local-enemy-motion.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ENEMY_GAIT_DISTANCE = 88;
export const ENEMY_MOTION_GROUPS = Object.freeze(['night-a','night-b','original','bosses']);
export const ENEMY_MOTION_ASSETS = Object.freeze(ENEMY_MOTION_GROUPS.flatMap(group => ['motion-'+group,'steps-'+group]));
export const ENEMY_COUNTER_ASSETS = Object.freeze(['hooligan','suit','runner','extremist','enforcer','broker','mafia','baron','tattoo','clubfighter','civic','blackbomber','nightowl','scrapper','skinny','eco'].map(key=>'counter-'+key));
const groups = Object.freeze({ enemies:'original',bosses:'bosses','enemies-night-a':'night-a','enemies-night-b':'night-b' });

/** Select authored drawings, never a deformed or cross-faded body. */
export function enemyMotion(entity, sheet, key) {
  if(isLocalEnemy(entity))return localEnemyMotion(entity);
  if(entity.passive || entity.kind==='passive' || entity.type==='protester')return null;
  const group=groups[sheet];if(!group)return null;
  if(entity.state==='walk' && entity.walking && entity.walkSpeed>.01){
    const phase=((entity.walkDistance||0)/ENEMY_GAIT_DISTANCE)%1;
    const index=Math.floor(phase*4);
    // Each contact has a genuine narrow passing pose between it and the next
    // contact, registered at the pelvis and the supporting foot respectively.
    if(index===0)return {action:'walk',phase:index,legacy:true,index:1};
    if(index===3)return {action:'walk',phase:index,sheet:'steps-'+group,index:0};
    return {action:'walk',phase:index,sheet:'counter-'+key,index:index===1?1:0};
  }
  if(entity.attackKind==='kick' && entity.state==='telegraph' && entity.attackTime<=.16){
    return {action:'kick',phase:'lift',sheet:'motion-'+group,index:4,extension:0};
  }
  if(entity.state!=='attack' || entity.attackKind!=='kick')return null;
  const duration=entity.attackDuration||.38,elapsed=clamp(duration-(entity.attackTime??duration),0,duration),contact=entity.attackContactTime||.08;
  const struck=entity.didStrike===true || entity.didStrike!==false && elapsed>=contact;
  let index,phase;
  if(!struck){index=elapsed<contact*.34?4:5;phase=index===4?'lift':'chamber';}
  else if(elapsed<contact+.06){index=6;phase='contact';}
  else if(elapsed<duration*.69){index=7;phase='retract';}
  else if(elapsed<duration*.87){index=4;phase='lower';}
  else return {action:'kick',phase:'guard',guard:true,extension:0,elapsed};
  return {action:'kick',phase,sheet:'motion-'+group,index,extension:index===6?1:0,elapsed};
}

/** Alternate sheets keep a fixed reference height; never scale each pose to its own bounds. */
export function authoredEnemyPose(renderer,entity,legacy,sheet,key){
  const motion=enemyMotion(entity,sheet,key);
  if(!motion)return {...legacy,motion:null};
  if(motion.guard)return {...legacy,motion};
  if(motion.legacy){
    const anchor=renderer.enemyMetadata['motion-'+groups[sheet]]?.characters?.[key]?.baseWalkAnchor;
    return anchor?{...legacy,dx:(legacy.source.x-anchor.x)*legacy.scale,dy:(legacy.source.y-anchor.y)*legacy.scale,motion}:{...legacy,motion};
  }
  const image=renderer.assets[motion.sheet],character=renderer.enemyMetadata[motion.sheet]?.characters?.[key],frame=character?.frames?.[motion.index];
  if(!image||!frame?.source||!frame.sourceAnchor||!character.referenceHeight)return {...legacy,motion:null};
  const source=frame.source,scale=legacy.height/character.referenceHeight;
  if(![source.x,source.y,source.w,source.h,frame.sourceAnchor.x,frame.sourceAnchor.y,scale].every(Number.isFinite)||source.w<=0||source.h<=0||source.x<0||source.y<0||source.x+source.w>image.width||source.y+source.h>image.height)return {...legacy,motion:null};
  return {...legacy,image,source,frame,index:motion.index,row:character.row,scale,
    dx:(source.x-frame.sourceAnchor.x)*scale,dy:(source.y-frame.sourceAnchor.y)*scale,dw:source.w*scale,dh:source.h*scale,motion};
}
