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
// Distances are metres. On grass the ball loses speed to rolling resistance
// and drag. Inverting the same law gives a pass its intended receiving pace.
const ROLL = 2.2, TURF_DRAG = .007, RADIUS = .11;
export function passSpeed(distance, through=false) {
  const arrival = clamp(4.3 + distance * .105, 4.3, 8.5) + (through ? 1.8 : 0);
  const gain = Math.expm1(2 * TURF_DRAG * Math.min(distance, 80));
  return Math.min(29, Math.sqrt(arrival * arrival * (1 + gain) + ROLL / TURF_DRAG * gain));
}

export function integratePlayBall(b, dt) {
  const airborne = b.z > RADIUS + 1e-6 || b.vz > 0;
  const vx = b.vx, vy = b.vy, speed = Math.hypot(vx, vy);
  if (airborne) {
    const drag = 1 / (1 + .009 * Math.hypot(speed, b.vz) * dt);
    const turn = b.spin * .74 * dt;
    b.vx = (vx - vy * turn) * drag;
    b.vy = (vy + vx * turn) * drag;
    const vz = b.vz;
    b.vz = vz * drag - 9.81 * dt;
    b.z += (vz + b.vz) * .5 * dt;
    if (b.z <= RADIUS) {
      b.z = RADIUS;
      b.vz = b.vz < -1.05 ? -b.vz * .43 : 0;
      b.vx *= .91;
      b.vy *= .91;
    }
  } else {
    const next = Math.max(0, speed - (ROLL + TURF_DRAG * speed * speed) * dt);
    const scale = speed ? next / speed : 0;
    b.vx = vx * scale;
    b.vy = vy * scale;
    b.vz = 0;
    b.z = RADIUS;
  }
  b.x += (vx + b.vx) * .5 * dt;
  b.y += (vy + b.vy) * .5 * dt;
  b.spin *= Math.exp(-(airborne ? .65 : 2.8) * dt);
}

export function cushionTouch(b, p) {
  // Retain some incoming momentum relative to the receiving foot.
  const retain = p.slot === 0 ? .07 : clamp(.41 - p.skill * .0028, .13, .29);
  b.vx = p.vx + (b.vx - p.vx) * retain;
  b.vy = p.vy + (b.vy - p.vy) * retain;
  b.vz = -Math.abs(b.vz) * .24;
  b.spin *= retain;
  b.nextTouch = .10;
}

export function carryBall(b, p, dt) {
  const speed = Math.hypot(p.vx, p.vy);
  b.nextTouch = (b.nextTouch || 0) - dt;
  if (b.nextTouch <= 0 && b.z < .65) {
    const interval = clamp(.36 - speed * .012, .23, .36);
    const lead = .46 + Math.min(speed, 9) * .085;
    // Aim the next tap ahead of the moving foot. Between taps the ball
    // travels under the same grass resistance as a loose pass.
    const tx = p.vx + (p.x + p.fx * lead - b.x) / interval;
    const ty = p.vy + (p.y + p.fy * lead - b.y) / interval;
    const dx = tx - b.vx, dy = ty - b.vy;
    const grip = Math.min(1, (2.6 + p.skill * .034) / (Math.hypot(dx, dy) || 1));
    b.vx += dx * grip;
    b.vy += dy * grip;
    b.nextTouch = interval;
  }
  integratePlayBall(b, dt);
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
