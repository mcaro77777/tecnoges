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
