import { HEROES, LEVELS } from './data.js';

export const STORY_IMAGES = ['01-kneipe','02-nachricht','03-spur','04-dreisam','05-rettung','06-bermuda'].map(name=>`assets/story/${name}.webp`);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scene=(image,title,body,lines,place)=>({image:STORY_IMAGES[image-1],title,body,lines,place});
const names=ids=>(ids?.length?ids:['nico','stefan']).map(id=>HEROES[id]?.name?.split(' ')[0]||'Team');

/** Short chapter beats; art depicts the founding trio, dialogue follows the selected team. */
export function storyForLevel(index,ids){
 const [first,second='Team']=names(ids),level=LEVELS[index];
 if(!level)return [];
 const place=`LEVEL ${index+1} / ${LEVELS.length} · ${level.name}`;
 switch(level.id){
 case 'kajo':return [
  scene(1,'Die letzte Runde','Eigentlich wollten Nico, Stefan und Torsten nur ein Feierabendbier. Doch der Treffpunkt ist verwüstet. Ihr Freund fehlt. Jetzt übernimmt euer Team die Suche.',[[first,'Ein Bier. Mehr hatten wir nicht vor.'],[second,'Dann wird das wohl ein längerer Abend.']], 'FREIBURG · KURZ VOR MITTERNACHT'),
  scene(2,'Eine letzte Nachricht','Auf dem Tresen liegt sein Handy: „Kommt ins Bermuda. Und bringt bloß nicht Stefan mit.“ Ein Kurier wurde zuletzt auf der KaJo gesehen.',[[ids?.includes('stefan')?'Stefan':first,ids?.includes('stefan')?'Jetzt erst recht.':'Dann gehen wir ihn suchen.']],place)
 ];
 case 'stuehlinger':return [scene(3,'Die falsche Tasche','Dr. Rendites Spur führt in den Stühlinger. Ein Kurier trägt dieselbe schwarze Tasche wie euer Freund. Als ihr ihn ansprecht, rennt er los.',[[first,'Wir wollen nur kurz was fragen!'],[second,'Das sagen wir offenbar zu bedrohlich.']],place)];
 case 'park':return [scene(3,'Alle haben etwas gesehen','Der Kurier verschwindet am Kirchplatz. Ein Veranstalter, ein eifriger Fotograf und ein betrunkener Stammgast liefern drei Versionen derselben Nacht. Ein Name fällt immer: der Nachtbürgermeister.',[[first,'Ist der gewählt?'],[second,'Von seinen eigenen Türstehern.']],place)];
 case 'dreisam':return [scene(4,'Ein ruhiger Treffpunkt','Die Spur führt unter eine Brücke. Dort sollte die Tasche übergeben werden. Darin steckt die Abrechnung eines Clubbesitzers, der das ganze Nachtleben kontrollieren will. Der Nachtbürgermeister hat bereits Leute geschickt.',[[first,'Hier sollte doch niemand sein.'],[second,'Das war wohl die Beschreibung für nachher.']],place)];
 case 'haslach':return [scene(4,'Hinter der nächsten Tür','Nach dem Hinterhalt steht fest: Euer Freund hat die Taschen verwechselt. Der Pförtner hält ihn in einem Hinterhof in Haslach–Weingarten fest. Holt ihn dort heraus.',[[first,'Und das alles wegen einer Sporttasche.'],[second,'Hoffentlich ist wenigstens unser Bier drin.']],place)];
 case 'wiehre':return [scene(5,'Gerettet. Fast.','Euer Freund ist frei und hat seine eigene Tasche wieder. Aber sein Fahrrad und die brisante Abrechnung sind noch im Bermuda. Der Nachtkassierer am Alten Wiehrebahnhof kennt den Weg zur letzten Tür.',[['Euer Freund','Ohne mein Fahrrad gehe ich nicht.'],[first,'Wir haben gerade einen halben Stadtteil nach dir abgesucht.']],place)];
 case 'bermuda':return [scene(6,'Die letzte Tür','Der Nachtkassierer hat geredet. Hinter der Mähne feiert der Nachtbürgermeister bereits seine „saubere, exklusive Innenstadt“. Ihr wollt das Fahrrad, die Abrechnung und Freiburgs Nacht zurück.',[['Die Mähne','Heute nur mit Gästeliste.'],[first,'Dann schreib uns drauf.']],place)];
 default:return [];
 }
}

export function storyEnding(ids){
 const [first,second='Team']=names(ids);
 return [scene(2,'Drei warme Bier','Die Mähne ist besiegt. Die Abrechnung geht an die Öffentlichkeit, und dem selbst ernannten Nachtbürgermeister laufen die Partner davon. Euer Freund öffnet endlich seine eigene Tasche: drei warme Bier. Ein Fahrradschloss.',[['Euer Freund','Hab doch gesagt: Ich habe alles dabei.'],[first,'Können wir jetzt endlich einen trinken?'],[second,'Die machen gerade zu.']], 'ENDE · FREIBURG GEHÖRT WIEDER DER NACHT')];
}

export function storyHTML(scenes,index=0){
 const s=scenes[index];if(!s)throw new RangeError('Unknown story scene');
 return `<section class="story-screen" aria-labelledby="story-title"><img class="story-image" src="./${esc(s.image)}" alt="${esc(s.title)} – gezeichnete Szene aus der Freiburger Nacht" decoding="async"><div class="story-shade"></div><header class="story-header"><span>FREIBURG AFTER DARK · DIE LETZTE RUNDE</span><button data-action="story-skip">Überspringen <small>ESC</small></button></header><div class="story-copy"><p class="story-place">${esc(s.place)}</p><h1 id="story-title">${esc(s.title)}</h1><p class="story-body">${esc(s.body)}</p><div class="story-dialogue">${s.lines.map(([who,line])=>`<p><strong>${esc(who)}</strong><span>„${esc(line)}“</span></p>`).join('')}</div><footer><span class="story-count">${String(index+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}</span><button data-action="story-next">${index+1<scenes.length?'Weiter':s.place.startsWith('ENDE')?'Zur Auswertung':'Zur Levelroute'} <small>ENTER / A</small></button></footer></div></section>`;
}
