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
  andreas: { id:'andreas', name:'Andreas Böhler', color:'#7296bf', hp:145, speed:252, power:1.04, specialName:'Zweiter Wind', description:'Teamspieler. Sein Energieschub trifft Gegner und heilt das Team.', stats:{Kraft:3,Tempo:4,Ausdauer:4} },
};
export const LEVELS = [
 { id:'kajo', worldKey:'martinstor', name:'Kaiser-Joseph-Straße', subtitle:'01 · Nachtschicht am Martinstor', landmark:'Martinstor', width:4600, ground:'#494958', sky:'#22253e', accent:'#ffa764', boss:'Dr. Rendite', bossType:'broker', enemyRoster:['skinny','scrapper','clubfighter','civic','hooligan','protester','frust','selfie','finance','hustle','queue','business'], waves:[[3,4],[4,4],[4,5],[4,1]], atmosphere:'Warme Schaufenster, Straßenbahnschienen, Bächle und das Martinstor.', bossLine:'Die Stadt gehört allen. Seine Rechnung geht heute nicht auf.' },
 { id:'stuehlinger', worldKey:'stuehlinger', name:'Stühlinger', subtitle:'02 · Hinter den Gleisen', landmark:'Radstation', width:4600, ground:'#444f58', sky:'#132c3b', accent:'#63d8dc', boss:'Der Pate vom Hinterhof', bossType:'enforcer', enemyRoster:['scrapper','hooligan','skinny','tattoo','clubfighter','blackbomber','tunnel','puffer','ultra','queue','student'], waves:[[4,4],[4,5],[5,5],[4,1]], atmosphere:'Altbaufassaden, Werkstätten, Fahrräder und die runde Radstation.', bossLine:'Schutzgeld? Heute übernimmt die Straße den Kundendienst.' },
 { id:'park', worldKey:'park', name:'Stühlinger Park', subtitle:'03 · Unter den Türmen', landmark:'Herz-Jesu-Kirche', width:4600, ground:'#34483f', sky:'#152c39', accent:'#afe084', boss:'Beton-Baron', bossType:'baron', enemyRoster:['eco','runner','skinny','scrapper','protester','blackbomber','eco_guard','grill','festival','student'], waves:[[4,5],[5,5],[5,6],[5,1]], atmosphere:'Baumreihen, Parkbänke und die türkisen Türme der Herz-Jesu-Kirche.', bossLine:'Auch ein Immobilienkönig muss irgendwann zu Fuß nach Hause.' },
 { id:'dreisam', worldKey:'dreisam', name:'Dreisam bei Nacht', subtitle:'04 · Gegen die Strömung', landmark:'Dreisamufer / Kronenbrücke', width:4600, ground:'#34424b', sky:'#101f30', accent:'#73b8d2', boss:'Der Brückenwächter', bossType:'enforcer', bossStats:{hp:640,speed:140,power:24,telegraph:.95}, enemyHealthScale:1.26, enemyRoster:['runner','scrapper','clubfighter','skinny','blackbomber','tattoo','helmet','tunnel','festival','student','complaint'], foodEvery:6, arenaHeal:14, waves:[[4,5],[5,5],[5,6],[5,1]], atmosphere:'Die Dreisam glitzert zwischen Ufermauern und Brücken. Ein langer Radweg führt durch die Nacht.', bossLine:'Unter der Brücke macht er die Regeln. Ihr macht den Weg frei.' },
 { id:'haslach', worldKey:'haslach', name:'Haslach / Weingarten', subtitle:'05 · Kein Durchgang', landmark:'Haslach / Weingarten', width:4600, ground:'#39424d', sky:'#172731', accent:'#ed9164', boss:'Der Pförtner', bossType:'enforcer', bossStats:{hp:660,speed:144,power:25}, enemyHealthScale:1.28, enemyRoster:['tattoo','clubfighter','enforcer','scrapper','skinny','blackbomber','concrete','shift','parking','grill','complaint'], foodEvery:6, arenaHeal:14, waves:[[4,5],[5,5],[5,6],[5,1]], atmosphere:'Tramtrassen, Wohnblöcke und Hinterhöfe zwischen Haslach und Weingarten.', bossLine:'Seine Wachtruppe sperrt die Straße. Ihr macht sie wieder frei.' },
 { id:'wiehre', worldKey:'wiehre', name:'Wiehre / Alter Wiehrebahnhof', subtitle:'06 · Die letzte Verbindung', landmark:'Alter Wiehrebahnhof', width:4600, ground:'#42474b', sky:'#1c2833', accent:'#e8bb79', boss:'Der Nachtkassierer', bossType:'broker', bossStats:{hp:720,speed:150,power:27}, enemyHealthScale:1.34, enemyRoster:['civic','eco','suit','runner','protester','tattoo','frust','eco_guard','finance','parking','business','luxury'], foodEvery:6, arenaHeal:14, waves:[[5,5],[5,6],[5,6],[5,1]], atmosphere:'Der alte Bahnhof, ruhige Seitenstraßen und warme Fenster im nächtlichen Regen.', bossLine:'Seine Handlanger kassieren an jeder Ecke. Ihr beendet die Schicht.' },
 { id:'bermuda', worldKey:'bermuda', name:'Bermuda-Dreieck / Martinstor', subtitle:'07 · Die letzte Tür', landmark:'Martinstor / Bermuda-Dreieck', width:4600, ground:'#3f3947', sky:'#191e32', accent:'#f04a53', boss:'Die Mähne', bossType:'bouncer', bossStats:{hp:820,speed:138,power:29,range:125,telegraph:1.0}, enemyHealthScale:1.4, enemyRoster:['nightowl','clubfighter','blackbomber','tattoo','suit','enforcer','puffer','afterhour','selfie','hustle','ultra','luxury'], foodEvery:6, arenaHeal:16, waves:[[5,5],[6,5],[6,6],[5,1]], atmosphere:'Enge Altstadtgassen, rote Clublichter und das Martinstor über dem Bermuda-Dreieck.', bossLine:'Eine letzte Clubtür. Ein riesiger Türsteher mit wilder Mähne. Eure Stadt wartet.' },
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
 // Local silhouettes are assigned to selected districts, never a universal wave.
 frust:{name:'Spätbier-Pöbler',description:'Fiktiver angetrunkener Straßenpöbler: laut, aufgebracht und mit weit ausholenden, gut lesbaren Fäusten.',hp:57,speed:158,power:11,range:90,telegraph:.88,kind:'punch',color:'#ac8173',spriteHeight:213},
 helmet:{name:'Helm-Hektiker',description:'Hat Vorfahrt, selbst wenn er zu Fuß pöbelt. Seine Warnweste leuchtet heller als seine Einsicht.',hp:42,speed:213,power:10,range:95,telegraph:.67,kind:'kick',color:'#c6cf76',spriteHeight:215},
 concrete:{name:'Beton-Boxer',description:'Hält jedes Gespräch für eine Wand, die man mit genügend Kraft durchbrechen kann.',hp:96,speed:103,power:18,range:96,telegraph:1.1,kind:'heavy',color:'#a98979',spriteHeight:242},
 tunnel:{name:'Tunnel-Treter',description:'Sein Horizont endet an der nächsten Unterführung; seine Schuhe sind schon weiter.',hp:48,speed:192,power:11,range:98,telegraph:.72,kind:'kick',color:'#8c9fb7',spriteHeight:219},
 shift:{name:'Feierabend-Bomber',description:'Die Schicht ist vorbei, die schlechte Laune macht Überstunden.',hp:61,speed:141,power:12,range:82,telegraph:.76,kind:'punch',color:'#b48c6d',spriteHeight:215},
 eco_guard:{name:'Öko-Rechthaber',description:'Recycelt dieselbe Belehrung an jeder Ecke und erklärt seinen Ellenbogen zur moralischen Instanz.',hp:39,speed:165,power:8,range:77,telegraph:.8,kind:'punch',color:'#8caa78',spriteHeight:206},
 puffer:{name:'Türsteher-Azubi',description:'Übt den harten Blick schon vor der geschlossenen Bäckerei. Die Gästeliste kennt ihn nicht.',hp:86,speed:113,power:16,range:90,telegraph:1,kind:'heavy',color:'#827985',spriteHeight:235},
 afterhour:{name:'Afterhour-Zappel',description:'Fiktiver betrunkener Nachtschwärmer: laut und schwankend, flink in kurzen Anläufen, aber schnell erschöpft.',hp:29,speed:227,power:7,range:87,telegraph:.64,kind:'kick',color:'#d0b5ba',spriteHeight:198},
 selfie:{name:'Selfie-Star',description:'Für ihn ist jeder Streit nur Content. Rücksicht gibt es erst ab zehntausend Likes.',hp:33,speed:194,power:7,range:72,telegraph:.7,kind:'punch',color:'#b3a1cc',spriteHeight:205},
 finance:{name:'Rendite-Rambo',description:'Nennt jeden Rempler eine Wachstumschance und die Straße sein persönliches Portfolio.',hp:44,speed:167,power:10,range:84,telegraph:.76,kind:'punch',color:'#879bb3',spriteHeight:214},
 parking:{name:'Parkplatz-Pascha',description:'Reserviert mit einem genervten Blick gleich die ganze Straße. Alle anderen stehen grundsätzlich falsch.',hp:69,speed:123,power:13,range:82,telegraph:.9,kind:'punch',color:'#a28c73',spriteHeight:218},
 hustle:{name:'Coaching-König',description:'Verkauft Durchsetzungskraft im Dreierpaket. Seine letzte Erfolgsgeschichte war eine selbst geschriebene Bewertung.',hp:50,speed:180,power:11,range:88,telegraph:.77,kind:'punch',color:'#819aba',spriteHeight:215},
 ultra:{name:'Auswärts-Aufschneider',description:'Sein Verein spielt heute gar nicht, aber irgendjemand muss trotzdem schuld sein.',hp:59,speed:184,power:12,range:93,telegraph:.76,kind:'kick',color:'#b87176',spriteHeight:217},
 queue:{name:'Vordrängler',description:'Hat es immer eiliger als alle anderen und verwechselt Rücksicht mit einer freien Lücke.',hp:26,speed:235,power:6,range:68,telegraph:.64,kind:'punch',color:'#c77c78',spriteHeight:199},
 business:{name:'Akten-Aggressor',description:'Jede Begegnung ist ein Eskalationstermin. Zuständig für Einsicht ist leider eine andere Abteilung.',hp:56,speed:157,power:11,range:88,telegraph:.81,kind:'punch',color:'#a7a7ac',spriteHeight:228},
 grill:{name:'Grillplatz-General',description:'Hat die Zange und daher das Kommando. Am Rost herrscht seine Ein-Mann-Verfassung.',hp:103,speed:98,power:19,range:96,telegraph:1.12,kind:'heavy',color:'#a78472',spriteHeight:239},
 festival:{name:'Festival-Flüchtling',description:'Das letzte Set ist vorbei, das Bändchen bleibt. Hält jeden Gehweg noch für einen Moshpit.',hp:36,speed:206,power:8,range:86,telegraph:.71,kind:'kick',color:'#aa8ac5',spriteHeight:207},
 luxury:{name:'VIP-Versager',description:'Die Goldkette glänzt, die Kreditkarte schweigt. Wartet auf den großen Auftritt vor der falschen Tür.',hp:88,speed:116,power:16,range:93,telegraph:1,kind:'heavy',color:'#d4c2a4',spriteHeight:232},
 student:{name:'Dauer-Debattierer',description:'Fordert erst eine Begriffsdefinition und dann die gesamte Gehwegbreite für seine Gegenposition.',hp:38,speed:180,power:8,range:91,telegraph:.78,kind:'kick',color:'#ba9e6a',spriteHeight:209},
 complaint:{name:'Beschwerde-Baron',description:'Hat vorsorglich schon eine Beschwerde über deine nächste Antwort formuliert.',hp:64,speed:130,power:12,range:81,telegraph:.88,kind:'punch',color:'#b3a18a',spriteHeight:220},
 protester:{name:'Protest-Sitzer',hp:26,speed:0,power:0,range:0,telegraph:1,kind:'passive',passive:true,color:'#e69c41',spriteHeight:120},
};
