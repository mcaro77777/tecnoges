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
syncMotion();

// Anchor the pen to the actual final letter, including font and viewport changes.
const writerRobot=document.querySelector('.robot-writer');
const writerLetter=document.querySelector('.final-e');
function positionWriter(){
  if(!writerRobot||!writerLetter||!writerRobot.offsetWidth)return;
  const letter=writerLetter.getBoundingClientRect();
  const surface=writerRobot.offsetParent.getBoundingClientRect();
  writerRobot.style.left=`${letter.left+letter.width*.85-surface.left-writerRobot.offsetWidth*.208}px`;
  writerRobot.style.top=`${letter.top+letter.height*.6-surface.top-writerRobot.offsetHeight*.215}px`;
  writerRobot.classList.add('is-positioned');
}
window.addEventListener('resize',positionWriter);
if('ResizeObserver' in window){
  const writerResize=new ResizeObserver(positionWriter);
  writerResize.observe(document.querySelector('.hero h1'));
  writerResize.observe(writerRobot);
}
document.fonts?.ready.then(positionWriter);
positionWriter();
