// One calculation for UI explanations and server strength. These are the
// existing rules: position penalty 6, training +2/level, potential and 99 caps.
export const effectivePlayerRating=(player,level)=>Math.min(99,player.potential??99,player.rating+(level-1)*2+(player.development||0));
export function teamStrengthDetails({players,roles,trainingLevel,coach=0,clubBonus=0}){
 const lineup=players.map((player,index)=>{
  const rating=effectivePlayerRating(player,trainingLevel),penalty=player.position===roles[index]?0:6;
  return{id:player.id,name:player.name,position:player.position,role:roles[index],rating,penalty,contribution:Math.max(1,rating-penalty)};
 });
 const average=lineup.reduce((sum,player)=>sum+player.contribution,0)/11;
 return{lineup,average,coach,clubBonus,total:Math.min(99,Math.round(average+coach+clubBonus)),outOfPosition:lineup.filter(player=>player.penalty>0).length};
}
