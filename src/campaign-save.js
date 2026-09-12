const LEGACY_LEVEL_IDS=['kajo','stuehlinger','park','haslach','wiehre','bermuda'];
export const CAMPAIGN_SAVE_VERSION=2;

/** Keep the furthest unlocked district stable when a new district is inserted. */
export function migrateCampaignSave(stored,levels){
 const save=stored&&typeof stored==='object'&&!Array.isArray(stored)?{...stored}:{};
 const numeric=Number(save.level),oldIndex=Number.isFinite(numeric)?Math.max(0,Math.floor(numeric)):0;
 let level=oldIndex;
 const explicit=typeof save.levelId==='string'?levels.findIndex(entry=>entry.id===save.levelId):-1;
 if(explicit>=0)level=explicit;
 else if((save.campaignVersion===undefined||save.campaignVersion===1)&&oldIndex<LEGACY_LEVEL_IDS.length){
  const migrated=levels.findIndex(entry=>entry.id===LEGACY_LEVEL_IDS[oldIndex]);if(migrated>=0)level=migrated;
 }
 level=Math.max(0,Math.min(levels.length-1,level));
 return{...save,level,levelId:levels[level].id,campaignVersion:CAMPAIGN_SAVE_VERSION};
}
