// Presentation only. Spread the formation lines and preserve player/role order.
export function squadDisplayCoordinates(coordinates) {
 const rows=[...new Set(coordinates.map(([,y])=>y))].sort((a,b)=>a-b);
 return coordinates.map(([x,y])=>{
  const line=coordinates.filter(([,lineY])=>lineY===y).map(([lineX])=>lineX).sort((a,b)=>a-b),index=line.indexOf(x),edge=line.length===2?28:line.length===3?15:8;
  return[line.length===1?50:edge+(100-2*edge)*index/(line.length-1),rows.length===1?50:8+84*rows.indexOf(y)/(rows.length-1)];
 });
}
