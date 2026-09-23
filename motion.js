// One timeline drives the joints, carried module, and application assembly.
// All content and navigation remain available without animation or JavaScript.
(() => {
  'use strict';
  const stage = document.querySelector('.assembly-stage');
  const robot = document.querySelector('.assembly-robot');
  const control = document.querySelector('.motion-control');
  if (!stage || !robot || !control) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const joints = ['shoulder', 'elbow', 'wrist'].map(name => robot.querySelector('.robot-' + name));
  const modules = [...document.querySelectorAll('[data-module]')];
  const steps = [...document.querySelectorAll('[data-step]')];
  const chip = document.querySelector('.assembly-chip');
  const application = document.querySelector('.assembly-app');
  const source = document.querySelector('.assembly-source');
  const spark = robot.querySelector('.writer-spark');
  let paused = preference.matches;
  let visible = true;
  let frame = 0;
  let previous = null;
  let elapsed = 0;
  let geometry = null;
  const stepTime = 3200;
  const cycleTime = 13200;
  const degrees = value => value * 180 / Math.PI;
  const ease = value => value * value * (3 - 2 * value);
  const mix = (a, b, t) => a + (b - a) * t;
  const arc = (a, b, t, lift) => ({ x: mix(a.x, b.x, ease(t)), y: mix(a.y, b.y, ease(t)) - Math.sin(Math.PI * t) * lift });

  function measure() {
    const width = robot.offsetWidth, height = robot.offsetHeight;
    if (!width || !height || !stage.offsetWidth) { geometry = null; sync(); return; }
    const shoulder = { x: width * .91, y: height * .66 };
    const elbow = { x: width * .82, y: height * .29 };
    const wrist = { x: width * .45, y: height * .09 };
    const tip = { x: width * .208, y: height * .215 };
    const stageRect = stage.getBoundingClientRect();
    const localPoint = (element, fraction = .5) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - stageRect.left + rect.width / 2, y: rect.top - stageRect.top + rect.height * fraction };
    };
    geometry = {
      shoulder, left: robot.offsetLeft, top: robot.offsetTop,
      upper: Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y),
      lower: Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y),
      tool: Math.hypot(tip.x - wrist.x, tip.y - wrist.y),
      upperAngle: Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x),
      lowerAngle: Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x),
      toolAngle: Math.atan2(tip.y - wrist.y, tip.x - wrist.x),
      source: localPoint(source, .2), targets: modules.map(element => localPoint(element, .22)),
      lift: stage.offsetWidth * .045
    };
    robot.classList.add('is-positioned');
    render(); sync();
  }

  function pointArm(target) {
    const g = geometry;
    const toolAngle = 155 * Math.PI / 180;
    const dx = target.x - g.left - g.tool * Math.cos(toolAngle) - g.shoulder.x;
    const dy = target.y - g.top - g.tool * Math.sin(toolAngle) - g.shoulder.y;
    const cosine = (dx * dx + dy * dy - g.upper * g.upper - g.lower * g.lower) / (2 * g.upper * g.lower);
    const bend = -Math.acos(Math.max(-1, Math.min(1, cosine)));
    const upper = Math.atan2(dy, dx) - Math.atan2(g.lower * Math.sin(bend), g.upper + g.lower * Math.cos(bend));
    const rotations = [upper - g.upperAngle, bend - (g.lowerAngle - g.upperAngle), toolAngle - upper - bend - (g.toolAngle - g.lowerAngle)];
    joints.forEach((joint, index) => { joint.style.transform = `rotate(${degrees(rotations[index])}deg)`; });
  }

  function render() {
    if (!geometry) return;
    const phase = elapsed % cycleTime;
    const index = Math.min(2, Math.floor(phase / stepTime));
    const t = (phase - index * stepTime) / stepTime;
    const complete = phase >= stepTime * 3;
    const g = geometry;
    const target = g.targets[index];
    const previousTarget = index ? g.targets[index - 1] : g.source;
    let point;
    let carrying = false;
    let depositing = false;
    if (complete) {
      // Return once, then stay at rest while the completed app remains visible.
      point = arc(g.targets[2], g.source, Math.min((phase - stepTime * 3) / 1800, 1), g.lift);
    } else if (t < .28) {
      point = arc(previousTarget, g.source, t / .28, g.lift);
    } else if (t < .42) {
      point = g.source; carrying = true;
    } else if (t < .82) {
      point = arc(g.source, target, (t - .42) / .4, g.lift); carrying = true;
    } else {
      point = target; depositing = t < .95;
    }
    pointArm(point);
    chip.style.transform = `translate(${point.x}px, ${point.y}px)`;
    chip.classList.toggle('carrying', carrying);
    spark.style.opacity = carrying || depositing ? '1' : '.22';
    application.classList.toggle('complete', complete);
    source.classList.toggle('picking', !complete && t >= .28 && t < .42);
    modules.forEach((element, moduleIndex) => {
      const installed = complete || moduleIndex < index || (moduleIndex === index && t >= .82);
      element.classList.toggle('installed', installed);
      element.classList.toggle('connecting', !complete && moduleIndex === index && depositing);
    });
    steps.forEach((element, stepIndex) => {
      element.classList.toggle('active', !complete && stepIndex === index);
      element.classList.toggle('done', complete || stepIndex < index);
    });
  }

  function tick(time) {
    frame = 0;
    if (previous !== null) elapsed += Math.min(time - previous, 64);
    previous = time;
    render();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    const active = !paused && !document.hidden && visible && Boolean(geometry);
    document.documentElement.dataset.motion = paused ? 'paused' : 'running';
    document.documentElement.dataset.motionActive = String(active);
    control.setAttribute('aria-pressed', String(paused));
    control.textContent = paused ? 'Activar animación' : 'Pausar animación';
    if (active && !frame) { previous = null; frame = requestAnimationFrame(tick); }
    if (!active) { cancelAnimationFrame(frame); frame = 0; previous = null; }
  }
  control.addEventListener('click', () => { paused = !paused; sync(); });
  preference.addEventListener('change', event => { paused = event.matches; if (paused) { elapsed = 12000; render(); } sync(); });
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0 });
    observer.observe(stage);
  }
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);
  else window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
  if (paused) elapsed = 12000;
  measure();
})();
