// Physical z is the centre of a .22m-radius simulation ball; render radii can
// be smaller/larger for readability. One conversion is shared with the lens.
export function ballSurfacePose(point,radius=.19,out={}){
 const height=Math.max(0,point.z-.22);
 out.x=point.x;out.y=point.y;out.z=.03+radius+height;
 out.shadowScale=1+Math.min(8,height)*.22;
 out.shadowOpacity=Math.max(.07,.38/(1+height*.65));
 return out;
}

// A directional grounded shadow gives volume even on Auto without another
// shadow-map pass. Height softens/lifts it; no simulated trajectory is changed.
export function playerContactShadow(player,heading,out={}){
 const dive=player.dive>0;
 out.angle=heading-.28;
 out.width=dive?1.8:1.05;
 out.depth=dive?.65:.82;
 return out;
}
