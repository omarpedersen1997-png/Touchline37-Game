const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

// Strike quality depends on support, approach and body orientation. Apply it
// after aiming, so the pass planner still works in the same pitch coordinates.
export function applyStrikeMechanics(ball,player,skill,opponentDistance) {
  const speed=Math.hypot(ball.vx,ball.vy);
  if(speed<.01)return;
  const x=ball.vx/speed,y=ball.vy/speed;
  const side=player.facingX*y-player.facingY*x;
  const alignment=clamp(player.facingX*x+player.facingY*y,-1,1);
  const sidestep=Math.abs(player.vx*y-player.vy*x);
  const pressure=clamp((3-opponentDistance)/3,0,1);
  const instability=(1-alignment)*.33+clamp(sidestep/10,0,1)*.36+pressure*.23;
  const loft=ball.flightKind==='loft',shot=ball.flightKind==='shot';
  const loss=instability*(1-skill*.006)*(shot?.31:loft?.16:.095);
  const angle=side*instability*(1-skill*.006)*(shot?.14:loft?.1:.035);
  const cos=Math.cos(angle),sin=Math.sin(angle);
  ball.vx=(x*cos-y*sin)*speed*(1-loss);
  ball.vy=(x*sin+y*cos)*speed*(1-loss);
  if(loft||shot){
    ball.curl=clamp(ball.curl+side*(loft?3.1:2.5)*(.38+skill*.006),-5.5,5.5);
    ball.vz*=1+(loft?.14:.22)*instability;
  }
}

// A post is cylindrical and a crossbar is horizontal. Deflect the incoming
// velocity about a surface normal facing the field, and dissipate impact energy.
export function reboundFromWoodwork(ball,crossing,post,bar) {
  const inside=crossing.y<0?1:-1;
  const lateral=post?clamp((crossing.x-Math.sign(crossing.x)*4)*4.2,-.52,.52):0;
  const vertical=bar?clamp((crossing.z-2.4)*5,-.58,.38):0;
  const inward=inside*Math.sqrt(Math.max(.2,1-lateral*lateral-vertical*vertical));
  const normalSpeed=ball.vx*lateral+ball.vy*inward+ball.vz*vertical;
  const impulse=Math.min(0,normalSpeed)*1.64;
  ball.vx=(ball.vx-impulse*lateral)*.81;
  ball.vy=inside*Math.max(.9,(ball.vy-impulse*inward)*inside*.81);
  ball.vz=(ball.vz-impulse*vertical)*.77;
  ball.curl*=.57;
}
