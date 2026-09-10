// Shared by the simulation and sprite timing. Repeat delay follows the pose
// recovery, so a held button still produces one deliberate kick per cycle.
export const HEAVY_KICK_TIMING = Object.freeze({ contact: .17, duration: .45, repeatDelay: .06 });
export const BAT_TIMING = Object.freeze({ contact:.12, duration:.4, repeatDelay:.07 });
export const THROW_TIMING = Object.freeze({ contact:.12, duration:.34, repeatDelay:.06 });
export const JUMP_KICK_TIMING = Object.freeze({ contact:.13, duration:.5, landingRecovery:.08 });
export const ITEM_TYPES = Object.freeze({
 bat:{name:'Baseballschläger',damage:28,throwDamage:24,durability:6,throwSpeed:820,throwLift:120},
 bicycle:{name:'Fahrrad',throwDamage:48,throwSpeed:640,throwLift:150},
});

export const HEROES = {
  nico: { id:'nico', name:'Nico Horny', color:'#e77663', hp:140, speed:260, power:1.12, specialName:'Hornstoß', description:'Druckvoller Allrounder. Ein Vorstoß räumt die Straße frei.', stats:{Kraft:4,Tempo:4,Ausdauer:4} },
  stefan: { id:'stefan', name:'Stefan Seesemann', color:'#e9a044', hp:125, speed:290, power:.96, specialName:'Wirbelwind', description:'Schnelle Combos. Ein Rundumschlag trifft Gegner auf beiden Seiten.', stats:{Kraft:3,Tempo:5,Ausdauer:3} },
  torsten: { id:'torsten', name:'Torsten van der Linde', color:'#a5c89c', hp:185, speed:218, power:1.28, specialName:'Bodenwelle', description:'Viel Ausdauer und schwere Fäuste. Erschüttert eine große Fläche.', stats:{Kraft:5,Tempo:2,Ausdauer:5} },
  andreas: { id:'andreas', name:'Andreas Böhler', color:'#7296bf', hp:145, speed:252, power:1.04, specialName:'Zweiter Wind', description:'Teamspieler. Sein Energieschub trifft Gegner und heilt beide Helden.', stats:{Kraft:3,Tempo:4,Ausdauer:4} },
};
export const LEVELS = [
 { id:'kajo', worldKey:'martinstor', name:'Kaiser-Joseph-Straße', subtitle:'01 · Nachtschicht am Martinstor', landmark:'Martinstor', width:4600, ground:'#494958', sky:'#22253e', accent:'#ffa764', boss:'Dr. Rendite', bossType:'broker', enemyRoster:['skinny','scrapper','clubfighter','civic','hooligan','protester'], waves:[[3,4],[4,4],[4,5],[4,1]], atmosphere:'Warme Schaufenster, Straßenbahnschienen, Bächle und das Martinstor.', bossLine:'Die Stadt gehört allen. Seine Rechnung geht heute nicht auf.' },
 { id:'stuehlinger', worldKey:'stuehlinger', name:'Stühlinger', subtitle:'02 · Hinter den Gleisen', landmark:'Radstation', width:4600, ground:'#444f58', sky:'#132c3b', accent:'#63d8dc', boss:'Der Pate vom Hinterhof', bossType:'enforcer', enemyRoster:['scrapper','hooligan','skinny','tattoo','clubfighter','blackbomber'], waves:[[4,4],[4,5],[5,5],[4,1]], atmosphere:'Altbaufassaden, Werkstätten, Fahrräder und die runde Radstation.', bossLine:'Schutzgeld? Heute übernimmt die Straße den Kundendienst.' },
 { id:'park', worldKey:'park', name:'Stühlinger Park', subtitle:'03 · Unter den Türmen', landmark:'Herz-Jesu-Kirche', width:4600, ground:'#34483f', sky:'#152c39', accent:'#afe084', boss:'Beton-Baron', bossType:'baron', enemyRoster:['eco','runner','skinny','scrapper','protester','blackbomber'], waves:[[4,5],[5,5],[5,6],[5,1]], atmosphere:'Baumreihen, Parkbänke und die türkisen Türme der Herz-Jesu-Kirche.', bossLine:'Auch ein Immobilienkönig muss irgendwann zu Fuß nach Hause.' },
 { id:'haslach', worldKey:'haslach', name:'Haslach / Weingarten', subtitle:'04 · Kein Durchgang', landmark:'Haslach / Weingarten', width:4600, ground:'#39424d', sky:'#172731', accent:'#ed9164', boss:'Der Pförtner', bossType:'enforcer', bossStats:{hp:660,speed:144,power:25}, enemyHealthScale:1.28, enemyRoster:['tattoo','clubfighter','enforcer','scrapper','skinny','blackbomber'], foodEvery:6, arenaHeal:14, waves:[[4,5],[5,5],[5,6],[5,1]], atmosphere:'Tramtrassen, Wohnblöcke und Hinterhöfe zwischen Haslach und Weingarten.', bossLine:'Seine Wachtruppe sperrt die Straße. Ihr macht sie wieder frei.' },
 { id:'wiehre', worldKey:'wiehre', name:'Wiehre / Alter Wiehrebahnhof', subtitle:'05 · Die letzte Verbindung', landmark:'Alter Wiehrebahnhof', width:4600, ground:'#42474b', sky:'#1c2833', accent:'#e8bb79', boss:'Der Nachtkassierer', bossType:'broker', bossStats:{hp:720,speed:150,power:27}, enemyHealthScale:1.34, enemyRoster:['civic','eco','suit','runner','protester','tattoo'], foodEvery:6, arenaHeal:14, waves:[[5,5],[5,6],[5,6],[5,1]], atmosphere:'Der alte Bahnhof, ruhige Seitenstraßen und warme Fenster im nächtlichen Regen.', bossLine:'Seine Handlanger kassieren an jeder Ecke. Ihr beendet die Schicht.' },
 { id:'bermuda', worldKey:'bermuda', name:'Bermuda-Dreieck / Martinstor', subtitle:'06 · Die letzte Tür', landmark:'Martinstor / Bermuda-Dreieck', width:4600, ground:'#3f3947', sky:'#191e32', accent:'#f04a53', boss:'Die Mähne', bossType:'bouncer', bossStats:{hp:820,speed:138,power:29,range:125,telegraph:1.0}, enemyHealthScale:1.4, enemyRoster:['nightowl','clubfighter','blackbomber','tattoo','suit','enforcer'], foodEvery:6, arenaHeal:16, waves:[[5,5],[6,5],[6,6],[5,1]], atmosphere:'Enge Altstadtgassen, rote Clublichter und das Martinstor über dem Bermuda-Dreieck.', bossLine:'Eine letzte Clubtür. Ein riesiger Türsteher mit wilder Mähne. Eure Stadt wartet.' },
];
export const ENEMY_TYPES = {
 hooligan:{ name:'Kurven-Krawallo',hp:54,speed:152,power:11,color:'#de7760',range:76,telegraph:.55,kind:'punch' },
 suit:{ name:'Bonus-Bully',hp:46,speed:180,power:10,color:'#c5b099',range:100,telegraph:.65,kind:'kick' },
 enforcer:{ name:'Schutzgeld-Schorsch',hp:82,speed:120,power:16,color:'#9d83bf',range:88,telegraph:.8,kind:'heavy' },
 // Keep the legacy sprite key; the character is a fictional club guard.
 extremist:{ name:'Club-Krawallo',role:'clubguard',hp:63,speed:140,power:13,color:'#a4936e',range:85,telegraph:.68,kind:'punch' },
 runner:{ name:'Ecken-Eddie',hp:41,speed:216,power:9,color:'#6eaeb6',range:83,telegraph:.5,kind:'kick' },
 // Fictional roles use different silhouettes and combat styles; ancestry is not a class.
 tattoo:{name:'Tattoo-Titan',hp:116,speed:99,power:21,range:101,telegraph:1.05,kind:'heavy',color:'#b67a65',spriteHeight:245},
 clubfighter:{name:'Club-Boxer',hp:56,speed:190,power:12,range:82,telegraph:.57,kind:'punch',color:'#9b6e66',spriteHeight:211},
 civic:{name:'Rathaus-Rambo',hp:52,speed:161,power:11,range:94,telegraph:.72,kind:'kick',color:'#7a96b4',spriteHeight:211},
 blackbomber:{name:'Block-Krawallo',hp:86,speed:124,power:17,range:88,telegraph:.86,kind:'heavy',color:'#55434a',spriteHeight:222},
 nightowl:{name:'Nachtfalter',hp:33,speed:235,power:8,range:79,telegraph:.52,kind:'punch',color:'#d4c3b4',spriteHeight:205},
 scrapper:{name:'Gassen-Raufbold',hp:58,speed:145,power:12,range:79,telegraph:.66,kind:'punch',color:'#7c827f',spriteHeight:216},
 skinny:{name:'Hemdchen',hp:24,speed:168,power:5,range:69,telegraph:.85,kind:'punch',color:'#9b9a95',spriteHeight:190},
 eco:{name:'Öko-Eiferer',hp:44,speed:172,power:9,range:89,telegraph:.69,kind:'kick',color:'#b39b5d',spriteHeight:207},
 protester:{name:'Protest-Sitzer',hp:26,speed:0,power:0,range:0,telegraph:1,kind:'passive',passive:true,color:'#e69c41',spriteHeight:120},
};
