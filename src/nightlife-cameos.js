const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.8);

// Friendly fictional game appearances. These captions are interface copy,
// not quotations, endorsements or claims about the real people's behaviour.
export const NIGHTLIFE_CAMEOS=Object.freeze(Object.fromEntries([
 {id:'pischko',name:'Pischko',role:'BEKANNTE GESICHTER DER NACHT',actionLabel:'KURZE PAUSE',caption:'PAUSE AM KIOSK',color:'#ecc390',bonus:{stat:'hp',amount:25,label:'+25 LP'}},
 {id:'betty',name:'Betty BBQ',role:'GASTGEBERIN DER NACHT',actionLabel:'RÜCKENWIND HOLEN',caption:'RÜCKENWIND FÜR DIE NACHT',color:'#f08eaf',bonus:{stat:'energy',amount:35,label:'+35 EN'}},
 {id:'trueby',name:'Rainer Trüby',role:'DJ',actionLabel:'DEN BEAT MITNEHMEN',caption:'DER NÄCHSTE BEAT',color:'#9fcddb',bonus:{stat:'energy',amount:25,label:'+25 EN'}},
 {id:'ticket',name:'Anzeigenhauptmeister',role:'SATIRISCHER GAST',actionLabel:'DIENSTWEG KLÄREN',caption:'DIENSTWEG FREI',color:'#c3d486',bonus:{stat:'energy',amount:15,label:'+15 EN'}},
].map(record=>[record.id,Object.freeze({...record,bonus:Object.freeze(record.bonus)})])));

export const NIGHTLIFE_CAMEO_PLACEMENTS=Object.freeze({
 kajo:Object.freeze([Object.freeze({id:'pischko',arenaIndex:0})]),
 stuehlinger:Object.freeze([Object.freeze({id:'ticket',arenaIndex:0})]),
 haslach:Object.freeze([Object.freeze({id:'ticket',arenaIndex:1})]),
 wiehre:Object.freeze([Object.freeze({id:'trueby',arenaIndex:1})]),
 bermuda:Object.freeze([Object.freeze({id:'pischko',arenaIndex:0}),Object.freeze({id:'betty',arenaIndex:1}),Object.freeze({id:'trueby',arenaIndex:2})]),
});

export function createNightlifeCameos(level){
 const placements=NIGHTLIFE_CAMEO_PLACEMENTS[level?.id]||[];
 const span=level?.width/level?.waves?.length;
 return placements.map(({id,arenaIndex})=>({...NIGHTLIFE_CAMEOS[id],uid:`cameo:${level.id}:${id}`,type:'cameo',x:(arenaIndex+1)*span-100,y:420,z:0,arenaIndex,used:false,feedbackTime:0,animationTime:0}));
}

export function updateNightlifeCameos(game,dt){
 if(game.mode!=='playing')return;
 const step=Number.isFinite(dt)?Math.max(0,Math.min(.04,dt)):0;
 for(const cameo of game.cameos||[]){cameo.feedbackTime=Math.max(0,cameo.feedbackTime-step);cameo.animationTime+=step;}
}

export function getNearbyCameo(game,hero){
 if(game.mode!=='playing'||!game.arena?.cleared||game.waitingWave||game.spawnQueue?.length||game.enemies?.some(enemy=>enemy.hp>0))return null;
 if(!hero||!game.heroes?.includes(hero)||hero.hp<=0||hero.isHuman===false||hero.z>0||hero.vz>0||hero.hitstun>0||hero.attackTime>0||hero.cooldown>0||hero.state==='dodge'||hero.heldItem)return null;
 // A rescue or reachable object keeps priority even when the same LB/E press
 // could also acknowledge the person at the edge of the street.
 if(game.heroes?.some(ally=>ally!==hero&&ally.hp<=0&&distance(hero,ally)<115)||game.getNearbyProp?.(hero))return null;
 let closest=null,nearest=110;
 for(const cameo of game.cameos||[]){
  if(cameo.used||cameo.arenaIndex!==game.arena.index)continue;
  const gap=distance(hero,cameo);if(gap<=nearest){closest=cameo;nearest=gap;}
 }
 return closest;
}

export function interactNightlifeCameo(game,hero){
 const cameo=getNearbyCameo(game,hero);if(!cameo)return false;
 // Claim before applying effects/events: two people pressing together may
 // grant this team's bonus only once, including re-entrant event listeners.
 cameo.used=true;cameo.feedbackTime=3.2;
 const {stat,amount,label}=cameo.bonus;let applied=0;
 for(const ally of game.heroes||[]){
  if(ally.hp<=0)continue;
  const limit=stat==='hp'?ally.maxHp:ally.maxEnergy??100;
  const previous=ally[stat];ally[stat]=Math.min(limit,previous+amount);
  const gained=ally[stat]-previous;applied+=gained;
  if(gained>0)game.effect('heal',ally.x,ally.y-90,{text:`+${Math.round(gained)} ${stat==='hp'?'LP':'EN'}`,color:cameo.color,life:1,maxLife:1});
 }
 game.emit('cameo',{id:cameo.id,name:cameo.name,hero:hero.heroId,heroUid:hero.uid,x:cameo.x,y:cameo.y,caption:cameo.caption,bonus:{stat,amount,label},applied});
 return true;
}
