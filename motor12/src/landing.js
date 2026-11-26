const kickoff=Date.parse('2027-01-01T09:00:00Z');
const values=[...document.querySelectorAll('#countdown b')];
function update(){
  let seconds=Math.max(0,Math.floor((kickoff-Date.now())/1000));
  const durations=[86400,3600,60,1];
  for(let i=0;i<4;i++){
    const time=Math.floor(seconds/durations[i]);
    const value=String(time).padStart(2,'0');
    if(values[i].textContent!==value)values[i].textContent=value;
    seconds%=durations[i];
  }
}
let interval;
function schedule(){
  clearInterval(interval);
  update();
  if(!document.hidden&&Date.now()<kickoff)interval=setInterval(update,1000);
}
document.addEventListener('visibilitychange',schedule);
schedule();
