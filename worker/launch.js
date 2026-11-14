import schedule from'../release/launch.json' with{type:'json'};
import download from'../release/downloads/current.json' with{type:'json'};

// The production server clock is authoritative. Neither URL parameters nor
// browser time can opt into an unreleased build.
export function validLaunch(settings=schedule){
 if(!settings||typeof settings.opensAt!=='string'||!/^\d+\.\d+\.\d+$/.test(settings.apkVersion||''))return false;
 const opens=Date.parse(settings.opensAt);
 return Number.isFinite(opens)&&new Date(opens).toISOString()===settings.opensAt&&settings.timeZone==='Europe/Copenhagen'&&settings.apkVersion===download.version;
}
export function launchInfo(now=Date.now(),settings=schedule){
 const valid=validLaunch(settings),version=valid?settings.apkVersion:null;
 return{open:valid&&Number.isFinite(now)&&now>=Date.parse(settings.opensAt),opensAt:valid?settings.opensAt:null,timeZone:valid?settings.timeZone:null,apkVersion:version,playUrl:'/play',apkUrl:version?`/downloads/Touchline-${version}.apk`:null,serverTime:Number.isFinite(now)?now:null};
}
