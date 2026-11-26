export const FIELD = {length:105, width:68, goal:7.32, bar:2.44, circle:9.15};
export const STEP = 1/30;
export const clamp = (n, min, max) => Math.max(min, Math.min(max,n));
export const distanceSquared = (a,b) => (a.x-b.x)**2 + (a.y-b.y)**2;

export function kickBall(ball, x,y, speed, loft=0, spin=0) {
  const dx=x-ball.x,dy=y-ball.y, length=Math.hypot(dx,dy)||1;
  ball.vx=dx/length*speed;
  ball.vy=dy/length*speed;
  ball.vz=loft;
  ball.spin=spin;
  ball.z=Math.max(.11,ball.z);
}
export function integrateBall(ball, dt) {
  const air=ball.z>.12||ball.vz>.2;
  const drag=Math.exp(-(air?.28:1.17)*dt);
  const curve=(air?.97:.21)*ball.spin*dt;
  const vx=ball.vx,vy=ball.vy;
  ball.vx=(vx-vy*curve)*drag;
  ball.vy=(vy+vx*curve)*drag;
  ball.spin*=Math.exp(-1.35*dt);
  ball.x+=ball.vx*dt;
  ball.y+=ball.vy*dt;
  if (air) {
    ball.vz-=9.81*dt;
    ball.z+=ball.vz*dt;
    if (ball.z<.11) {ball.z=.11;ball.vz=ball.vz<-1.25?-ball.vz*.44:0;}
  }
}
export function movePlayer(p,x,y, speed,dt) {
  const dx=x-p.x,dy=y-p.y,range=Math.hypot(dx,dy);
  const desired=Math.min(speed, range*3.3);
  const factor=range>1e-5?desired/range:0;
  const tx=dx*factor-p.vx,ty=dy*factor-p.vy;
  const cap=Math.min(1,(range<1.6?13:10)*dt/(Math.hypot(tx,ty)||1));
  p.vx+=tx*cap;
  p.vy+=ty*cap;
  p.x=clamp(p.x+p.vx*dt,-FIELD.length/2+.25,FIELD.length/2-.25);
  p.y=clamp(p.y+p.vy*dt,-FIELD.width/2+.25,FIELD.width/2-.25);
  const motion=Math.hypot(p.vx,p.vy);
  if (motion>.12) {p.fx=p.vx/motion;p.fy=p.vy/motion;}
  p.energy=clamp(p.energy-(motion>4.15?.126:motion>2?.039:-.034)*dt,18,100);
}
