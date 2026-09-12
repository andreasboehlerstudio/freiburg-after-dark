// One deliberately placed vehicle per district. Rendering and combat use the
// same dimensions so a visible bumper is also where a strike makes contact.
export const CAR_WIDTHS = Object.freeze({ compact: 440, luxury: 560 });
export const CAR_DEPTH = 32;
export const STREET_CARS = Object.freeze({
 kajo: [{model:'compact',x:1560,y:498}],
 stuehlinger: [{model:'luxury',x:2730,y:604}],
 park: [{model:'compact',x:800,y:498}],
 // The riverside cycling path stays clear of parked motor vehicles.
 dreisam: [],
 haslach: [{model:'luxury',x:1700,y:610}],
 wiehre: [{model:'compact',x:2890,y:498}],
 bermuda: [{model:'luxury',x:3770,y:604}],
});
