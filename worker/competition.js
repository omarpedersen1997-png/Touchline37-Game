// Competition rules are snapshotted per season. Existing seasons finish with
// their original rules; facility upgrades can satisfy a licence during a season.
export const oppositionBases=[43,48,54,60,66,72,78,84,88];
export const promotionTargets=[18,18,19,19,20,20,21,22,22];
export const licenceLevels=[
 [1,1,0],[2,2,0],[4,3,0],[6,5,1],
 [8,7,2],[11,9,3],[14,12,4],[18,15,5]
];
const tierFor=s=>Math.max(0,Math.min(8,s.tier||0));
const makeRules=(s,version)=>{
 const tier=tierFor(s);
 return{version,season:s.season,tier,targetPoints:version===1?18:promotionTargets[tier],
  oppositionBase:version===1?43+tier*5:oppositionBases[tier],
  oppositionGrowth:version===1||tier<2?.65:.45,
  licence:version===2&&tier<8?[...licenceLevels[tier]]:[0,0,0]};
};
export function ensureCompetition(s){
 const current=s.competitionRules;
 if(!current||current.season!==s.season||current.tier!==tierFor(s)){
  const legacy=!current&&((s.played||0)>0||!!s.active);
  s.competitionRules=makeRules(s,legacy?1:2);
 }
 s.seasonArchive||=[];
 return s;
}
export function licenceFor(s){
 const tuple=s.competitionRules.licence;
 const entries=[['stadium','Stadion',s.levels.stadium],['training','Træningsanlæg',s.levels.training],['academy','Ungdomsakademi',s.academyFacility?.level||1]];
 const requirements=entries.map(([key,name,current],i)=>({key,name,current,required:tuple[i],ready:current>=tuple[i]})).filter(r=>r.required>0);
 return{required:requirements.length>0,ready:requirements.every(r=>r.ready),requirements};
}
export const trainingLicenceUpgrade=s=>s.competitionRules.version===2&&tierFor(s)<8&&s.levels.training<s.competitionRules.licence[1];
export function oppositionFor(s,{cup=false,round=s.played}={}){
 const rules=s.competitionRules;
 // A legacy cup keeps its original round difficulty for the entire old season.
 return Math.min(rules.version===1?95:99,rules.oppositionBase+(cup?round*4+3:round*rules.oppositionGrowth));
}
export function competitionView(s,rank){
 const rules=s.competitionRules,topFlight=tierFor(s)===8,championshipAvailable=topFlight&&rules.version===2;
 return{targetPoints:rules.targetPoints,topFlight,legacy:rules.version===1,points:s.points,rank,matchesRemaining:Math.max(0,10-s.played),matchCount:10,
  promotionPossible:!topFlight,championshipAvailable,trainingLicenseUpgrade:trainingLicenceUpgrade(s),objective:topFlight?(championshipAvailable?'championship':'season'):'promotion',
  license:licenceFor(s),history:s.seasonArchive,oppositionBase:rules.oppositionBase,oppositionGrowth:rules.oppositionGrowth};
}
