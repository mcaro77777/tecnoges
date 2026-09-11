// Decorative movement never blocks content, input, or product navigation.
const video=document.querySelector('.hero-backdrop video');
const motionControl=document.querySelector('.motion-control');
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused=motionPreference.matches;
let heroVisible=true;
function syncMotion(){
  document.documentElement.dataset.motion=motionPaused?'paused':'running';
  motionControl.setAttribute('aria-pressed',String(motionPaused));
  motionControl.textContent=motionPaused?'Activar animación':'Pausar animación';
  if(motionPaused||document.hidden||!heroVisible){video.pause();return;}
  const playback=video.play();
  if(playback)playback.catch(error=>{if(error.name==='AbortError'||motionPaused||document.hidden||!heroVisible)return;motionPaused=true;document.documentElement.dataset.motion='paused';motionControl.setAttribute('aria-pressed','true');motionControl.textContent='Activar animación';});
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
