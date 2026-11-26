export const FORMATIONS = {
  '4-3-3': [[.06,0],[.26,-.76],[.22,-.26],[.22,.26],[.26,.76],[.46,-.48],[.40,0],[.46,.48],[.70,-.78],[.80,0],[.70,.78]],
  '4-2-3-1': [[.06,0],[.24,-.76],[.21,-.25],[.21,.25],[.24,.76],[.38,-.27],[.38,.27],[.62,-.68],[.65,0],[.79,0],[.62,.68]],
  '3-5-2': [[.06,0],[.22,-.58],[.18,0],[.22,.58],[.43,-.84],[.38,-.38],[.47,0],[.38,.38],[.71,-.26],[.71,.26],[.43,.84]],
};
export const TACTICS = {
  balanced: {label:'Balanceret', push:0, width:1, risk:.45},
  attack: {label:'Offensiv', push:9, width:1.12, risk:.64},
  defend: {label:'Defensiv', push:-9, width:.88, risk:.23},
};
export const PRESS = {low:'Lavt', medium:'Mellem', high:'Højt'};
export const HOME = {name:'Prøvelund BK',code:'PBK',color:'#d7ff78',formation:'4-3-3', rating:67};
export const LEAGUE = [
  {name:'Havneby IF',code:'HIF',color:'#8fb4ff',formation:'4-2-3-1',rating:65},
  {name:'Skovlund GF',code:'SGF',color:'#81c7ff',formation:'3-5-2',rating:69},
  {name:'Vesterbro 1910',code:'V10',color:'#bba3ff',formation:'4-3-3',rating:72},
];
const names = ['Emil Bæk','Kasper Hald','Adam Kjær','Victor Berg','Noah Lange','Mads Storm','Elias Birk','Tobias Lund','Lucas Friis','Anton Holm','Oscar Dahl','Felix Sø','Liam Ravn','Malthe Due','Karl Møller','Alfred Boye'];
const opponents = ['Nikolaj Krog','Jonas Skov','Lasse Juul','Oliver Beck','Mikkel Høgh','Simon Buhl','Mathias Gram','Aksel Fog','August Viig','Magnus Bro','William Falk','Theo Tran','Silas Lind','Isak Hede','Sofus Dal','Asger Bank'];
const positions = ['MÅL','HB','CB','CB','VB','CM','DM','CM','HK','ANG','VK','CM','ANG','CB','HK','MÅL'];
export function makeSquad(team, side) {
  return (side ? opponents : names).map((name, i) => ({
    id: team.code+'-'+(i+1), name, number:i+1, role:positions[i],
    skill:team.rating + (i*7%13)-6, energy:100, form: 5+i*3%4,
  }));
}
export function fieldRole(formation, index) {
  if (!index) return 'Målmand';
  const depth = FORMATIONS[formation][index][0];
  return depth < .3 ? 'Forsvar' : depth < .6 ? 'Midtbane' : 'Angreb';
}
