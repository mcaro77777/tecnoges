// Decorative movement never blocks content, input, or product navigation.
const motionControl=document.querySelector('.motion-control');
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused=motionPreference.matches;
let heroVisible=true;
function syncMotion(){
  document.documentElement.dataset.motion=motionPaused?'paused':'running';
  motionControl.setAttribute('aria-pressed',String(motionPaused));
  motionControl.textContent=motionPaused?'Activar animación':'Pausar animación';
  document.documentElement.dataset.motionActive=(!motionPaused&&!document.hidden&&heroVisible)?'true':'false';
  updateWriterPlayback();
}
motionControl.addEventListener('click',()=>{motionPaused=!motionPaused;syncMotion();});
motionPreference.addEventListener('change',event=>{motionPaused=event.matches;syncMotion();});
document.addEventListener('visibilitychange',syncMotion);
if('IntersectionObserver' in window){
  const heroObserver=new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncMotion();},{threshold:0});
  heroObserver.observe(document.querySelector('.hero'));
  const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){if(!motionPaused)entry.target.classList.add('motion-enter');revealObserver.unobserve(entry.target);}});},{threshold:.12});
  document.querySelectorAll('.section-head,.solution,.principle,.process article,.price-box').forEach(element=>revealObserver.observe(element));
}
// The SVG path is the single source for the visible stroke and the pen position.
const writerRobot=document.querySelector('.robot-writer');
const writerLetter=document.querySelector('.final-e');
const writerStroke=document.querySelector('.writer-letter-stroke');
const writerSpark=document.querySelector('.writer-spark');
const writerJoints=['shoulder','elbow','wrist'].map(name=>document.querySelector(`.robot-${name}`));
const writerLength=writerStroke.getTotalLength();
let writerGeometry=null;
let writerFrame=0;
let writerPreviousTime=null;
let writerElapsed=0;
const writerCycle=5600;
const writerDrawTime=4200;
const degrees=radians=>radians*180/Math.PI;

function positionWriter(){
  if(!writerRobot.offsetWidth){writerGeometry=null;updateWriterPlayback();return;}
  const letter=writerLetter.getBoundingClientRect();
  const surface=writerRobot.offsetParent.getBoundingClientRect();
  const w=writerRobot.offsetWidth,h=writerRobot.offsetHeight;
  // The pedestal remains upright. Its top joint stays fixed beside the letter.
  const shoulder={x:w*.91,y:h*.66};
  const elbow={x:w*.82,y:h*.29};
  const wrist={x:w*.45,y:h*.09};
  const tip={x:w*.208,y:h*.215};
  const left=letter.right-surface.left+w*.5-shoulder.x;
  const top=letter.bottom-surface.top-h*.32-shoulder.y;
  writerRobot.style.left=`${left}px`;
  writerRobot.style.top=`${top}px`;
  writerGeometry={
    shoulder, letterX:letter.left-surface.left-left,letterY:letter.top-surface.top-top,
    letterWidth:letter.width,letterHeight:letter.height,
    upper:Math.hypot(elbow.x-shoulder.x,elbow.y-shoulder.y),
    lower:Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y),
    tool:Math.hypot(tip.x-wrist.x,tip.y-wrist.y),
    upperAngle:Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x),
    lowerAngle:Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x),
    toolAngle:Math.atan2(tip.y-wrist.y,tip.x-wrist.x)
  };
  writerLetter.querySelectorAll('path').forEach(path=>path.style.strokeWidth=`${parseFloat(getComputedStyle(writerLetter).fontSize)*.085}px`);
  writerStroke.style.strokeDasharray=String(writerLength);
  writerLetter.classList.add('writer-ready');
  renderWriter();
  writerRobot.classList.add('is-positioned');
  updateWriterPlayback();
}

function renderWriter(){
  if(!writerGeometry)return;
  const phase=writerElapsed%writerCycle;
  const drawing=phase<writerDrawTime;
  const progress=Math.min(phase/writerDrawTime,1);
  let point=writerStroke.getPointAtLength(writerLength*progress);
  if(!drawing){
    // Lift and return in a smooth arc, with no new ink during the return.
    const t=(phase-writerDrawTime)/(writerCycle-writerDrawTime),u=1-t;
    const end=writerStroke.getPointAtLength(writerLength),start=writerStroke.getPointAtLength(0);
    point={x:u*u*u*end.x+3*u*u*t*115+3*u*t*t*5+t*t*t*start.x,
      y:u*u*u*end.y+3*u*u*t*105+3*u*t*t*100+t*t*t*start.y};
  }
  const g=writerGeometry;
  const target={x:g.letterX+point.x*g.letterWidth/100,y:g.letterY+point.y*g.letterHeight/100};
  const toolAngle=155*Math.PI/180;
  const dx=target.x-g.tool*Math.cos(toolAngle)-g.shoulder.x;
  const dy=target.y-g.tool*Math.sin(toolAngle)-g.shoulder.y;
  const cosine=(dx*dx+dy*dy-g.upper*g.upper-g.lower*g.lower)/(2*g.upper*g.lower);
  const bend=-Math.acos(Math.max(-1,Math.min(1,cosine)));
  const upper=Math.atan2(dy,dx)-Math.atan2(g.lower*Math.sin(bend),g.upper+g.lower*Math.cos(bend));
  const rotations=[upper-g.upperAngle,bend-(g.lowerAngle-g.upperAngle),toolAngle-upper-bend-(g.toolAngle-g.lowerAngle)];
  writerJoints.forEach((joint,index)=>joint.style.transform=`rotate(${degrees(rotations[index])}deg)`);
  writerStroke.style.strokeDashoffset=String(motionPaused?0:writerLength*(1-progress));
  writerSpark.style.opacity=drawing?'1':'.15';
}

function animateWriter(time){
  writerFrame=0;
  if(writerPreviousTime!==null)writerElapsed+=Math.min(time-writerPreviousTime,64);
  writerPreviousTime=time;
  renderWriter();
  writerFrame=requestAnimationFrame(animateWriter);
}
function updateWriterPlayback(){
  const active=!motionPaused&&!document.hidden&&heroVisible&&writerGeometry;
  if(active&&!writerFrame){writerPreviousTime=null;writerFrame=requestAnimationFrame(animateWriter);}
  if(!active){cancelAnimationFrame(writerFrame);writerFrame=0;writerPreviousTime=null;renderWriter();}
}
window.addEventListener('resize',positionWriter);
if('ResizeObserver' in window){
  const writerResize=new ResizeObserver(positionWriter);
  writerResize.observe(document.querySelector('.hero h1'));
  writerResize.observe(writerRobot);
}
document.fonts?.ready.then(positionWriter);
positionWriter();
syncMotion();
