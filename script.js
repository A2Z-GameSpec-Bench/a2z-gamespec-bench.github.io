'use strict';
(async function initializeSite() {
await window.A2ZStylesReady;
// Keep the mobile navigation dismissible without changing the header's height.
document.querySelectorAll('.mast-menu').forEach(menu => {
  const summary = menu.querySelector('summary');
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a[href]')) menu.open = false;
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      summary.focus();
      event.preventDefault();
    }
  });
  window.matchMedia('(max-width:760px)').addEventListener('change', () => {
    menu.open = false;
  });
});
const benchmarkResults = [
  {name:'Claude-Fable-5.1',provider:'claude',all:77.0,small:82.8,big:71.1,vs:98.7,vb:98.7,source:{small:89.7,big:83.5},replay:{small:73.5,big:55.1},playtest:{small:85.2,big:74.7}},
  {name:'Claude-Opus-5',provider:'claude',all:73.9,small:80.9,big:66.8,vs:100.0,vb:99.3,source:{small:87.9,big:78.4},replay:{small:71.2,big:54.4},playtest:{small:83.6,big:67.7}},
  {name:'Claude-Opus-4.8',provider:'claude',all:56.8,small:67.9,big:45.6,vs:99.3,vb:100.0,source:{small:72.5,big:49.6},replay:{small:62.5,big:41.4},playtest:{small:68.7,big:46.0}},
  {name:'GPT-6-Astra',provider:'openai',all:71.6,small:78.5,big:64.6,vs:99.3,vb:97.3,source:{small:84.2,big:74.4},replay:{small:69.9,big:52.1},playtest:{small:81.6,big:67.4}},
  {name:'GPT-5.6-Sol',provider:'openai',all:61.8,small:72.8,big:50.8,vs:98.7,vb:98.0,source:{small:78.5,big:46.3},replay:{small:63.8,big:48.3},playtest:{small:76.0,big:57.9}},
  {name:'GPT-5.5',provider:'openai',all:63.2,small:73.1,big:53.4,vs:97.3,vb:98.7,source:{small:81.0,big:55.9},replay:{small:60.8,big:42.5},playtest:{small:77.5,big:61.7}},
  {name:'GLM-5.3',provider:'glm',all:55.6,small:66.9,big:44.3,vs:88.7,vb:87.3,source:{small:78.6,big:58.1},replay:{small:57.3,big:34.5},playtest:{small:64.9,big:40.4}},
  {name:'DeepSeek-V4-Pro',provider:'deepseek',all:50.4,small:65.3,big:35.6,vs:88.0,vb:82.7,source:{small:75.7,big:53.8},replay:{small:52.2,big:25.9},playtest:{small:68.0,big:27.0}},
  {name:'Kimi-K2.7',provider:'kimi',all:39.5,small:51.4,big:27.5,vs:75.3,vb:86.0,source:{small:60.8,big:37.3},replay:{small:47.7,big:19.0},playtest:{small:45.7,big:26.2}}
];
const benchmarkAxes = {
  overall: {label:'GDD Fidelity',short:'Overall'},
  source: {label:'Source code',short:'Source code'},
  replay: {label:'Scenario-based replay',short:'Scenario-based replay'},
  playtest: {label:'Adaptive playtest',short:'Adaptive playtest'}
};
// Table 2 reports per-axis Small/Big results. The equal-sized splits
// permit an approximate All mean, explicitly identified in the interface.
function benchmarkScore(row, split, axis) {
  if (axis === 'overall') return row[split];
  return split === 'all' ? (row[axis].small + row[axis].big) / 2 : row[axis][split];
}
function displayedBenchmarkScore(value) {
  return (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1);
}
const providerMarks = {
  claude: {src:'assets/icons/claude.svg', mono:false},
  openai: {src:'assets/icons/openai.svg', mono:true},
  glm: {src:'assets/icons/glm.svg', mono:false},
  deepseek: {src:'assets/icons/deepseek.svg', mono:false},
  kimi: {src:'assets/icons/kimi.svg', mono:false}
};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
/* Editorial metric engine. */
// Only explicitly selected research statistics use this engine. Rule IDs,
// screenshot values, carousel indexes, and model names remain unchanged.
const metricCounters = new WeakMap();
const activeMetricCounters = new Set();
const registeredMetricCounters = new Set();
const stableMetricCounters = new Set();
let metricFrame = 0;
let metricLayoutFrame = 0;
function reserveMetricSlot(state) {
  const {element,slot,finalText}=state;
  // Measure complete candidate strings in the actual font, including its
  // proportional digits, punctuation, kerning, and inherited numeric features.
  const probe=document.createElement('span');probe.className='metric-reserve-probe';
  probe.setAttribute('aria-hidden','true');element.append(probe);
  let widest=finalText.replace(/\d/g,'0'), width=0;
  [finalText,...Array.from({length:10},(_,digit)=>finalText.replace(/\d/g,String(digit)))].forEach(candidate=>{
    probe.textContent=candidate;
    const candidateWidth=probe.getBoundingClientRect().width;
    if(candidateWidth>width){width=candidateWidth;widest=candidate;}
  });
  probe.remove();
  slot.dataset.metricReserve=widest;
  state.reservationMeasured=width>0;
}
function prepareMetricSlot(element,node,finalText) {
  element.classList.add('metric-fixed');
  const slot=document.createElement('span');slot.className='metric-number-slot';
  slot.dataset.metricReserve=finalText.replace(/\d/g,'0');
  const live=document.createElement('span');live.className='metric-number-live';
  node.replaceWith(slot);live.append(node);slot.append(live);
  return slot;
}
function fitMetricFacts() {
  document.querySelectorAll('.facts strong.metric-fixed').forEach(element=>{
    const state=metricCounters.get(element);if(!state)return;
    element.style.removeProperty('font-size');
    const style=getComputedStyle(element), available=element.clientWidth;
    const natural=state.slot.getBoundingClientRect().width;
    if(available>0&&natural>available+.1){
      element.style.fontSize=`${parseFloat(style.fontSize)*available/natural*.998}px`;
    }
  });
}
function refreshMetricLayout() {
  if(metricLayoutFrame)return;
  metricLayoutFrame=requestAnimationFrame(()=>{
    metricLayoutFrame=0;
    // Always measure at the stylesheet's font size before fitting a fact to
    // its column. Re-measuring an already fitted font can change glyph
    // rounding and cause a second, visible one-pixel adjustment on entry.
    document.querySelectorAll('.facts strong.metric-fixed').forEach(element=>element.style.removeProperty('font-size'));
    stableMetricCounters.forEach(state=>{
      if(state.element.isConnected)reserveMetricSlot(state);
      else stableMetricCounters.delete(state);
    });
    fitMetricFacts();
  });
}
function finishMetricCounter(state) {
  state.node.nodeValue = state.finalText;
  state.element.dataset.countComplete = 'true';
  state.done = true;
  activeMetricCounters.delete(state);
  registeredMetricCounters.delete(state);
  metricObserver?.unobserve(state.element);
}
function tickMetricCounters(now) {
  metricFrame = 0;
  activeMetricCounters.forEach(state => {
    if (!state.element.isConnected) { activeMetricCounters.delete(state); return; }
    if (!state.visible || document.hidden) { state.lastTime = 0; return; }
    if (state.lastTime) state.elapsed += Math.min(now - state.lastTime, 80);
    state.lastTime = now;
    const fraction = Math.min(1, state.elapsed / state.duration);
    const eased = 1 - Math.pow(1 - fraction, 3);
    if (fraction === 1) { finishMetricCounter(state); return; }
    const value = Math.abs(state.target) * eased;
    state.node.nodeValue = state.prefix + value.toLocaleString('en-US', {
      minimumFractionDigits: state.decimals,
      maximumFractionDigits: state.decimals,
      useGrouping: state.grouping
    }) + state.suffix;
  });
  if (!document.hidden && [...activeMetricCounters].some(state => state.visible))
    metricFrame = requestAnimationFrame(tickMetricCounters);
}
function requestMetricFrame() {
  if (!metricFrame && !document.hidden) metricFrame = requestAnimationFrame(tickMetricCounters);
}
const metricObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const state = metricCounters.get(entry.target);
    if (!state || state.done) return;
    state.visible = entry.isIntersecting;
    state.lastTime = 0;
    if (state.visible) {
      // Closed details have no measurable box until they are first opened.
      if (!state.reservationMeasured) { reserveMetricSlot(state);fitMetricFacts(); }
      activeMetricCounters.add(state);requestMetricFrame();
    }
  });
}, {threshold:0.35}) : null;
function registerMetricCounter(element) {
  if (metricCounters.has(element)) return;
  // Animate the numeric text node only, preserving nested % marks and labels.
  const node = [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && /^\s*[≈~+−-]?\s*\d[\d,]*(?:\.\d+)?\s*[%×]?\s*$/.test(child.nodeValue));
  if (!node) return;
  const match = node.nodeValue.match(/^(\s*[≈~+−-]?\s*)(\d[\d,]*(?:\.\d+)?)(\s*[%×]?\s*)$/);
  if (!match) return;
  const finalText = node.nodeValue;
  const target = Number(element.dataset.countTo ?? match[2].replaceAll(',', ''));
  if (!Number.isFinite(target)) return;
  const state = {element,node,finalText,target,prefix:match[1],suffix:match[3],
    decimals:(match[2].split('.')[1] || '').length, grouping:match[2].includes(','),
    duration:Math.min(1600,Math.max(700,Number(element.dataset.countDuration) || 1250)),
    elapsed:0,lastTime:0,visible:false,done:false};
  metricCounters.set(element,state);
  registeredMetricCounters.add(state);
  stableMetricCounters.add(state);
  element.dataset.countFinal = finalText.trim();
  element.setAttribute('aria-label', element.textContent.trim());
  state.slot=prepareMetricSlot(element,node,finalText);
  reserveMetricSlot(state);
  fitMetricFacts();
  if (reducedMotion.matches || !metricObserver) { finishMetricCounter(state); return; }
  node.nodeValue = state.prefix + (0).toLocaleString('en-US',{minimumFractionDigits:state.decimals,maximumFractionDigits:state.decimals}) + state.suffix;
  metricObserver.observe(element);
}
function unregisterMetricCounter(element) {
  const state = metricCounters.get(element);
  if (state) { activeMetricCounters.delete(state); registeredMetricCounters.delete(state); stableMetricCounters.delete(state); }
  metricObserver?.unobserve(element);
}
document.addEventListener('visibilitychange', () => {
  activeMetricCounters.forEach(state => { state.lastTime = 0; });
  if (!document.hidden) requestMetricFrame();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) registeredMetricCounters.forEach(finishMetricCounter);
});
window.A2ZMotion = Object.assign(window.A2ZMotion || {}, {registerCounter:registerMetricCounter});
window.addEventListener('resize',refreshMetricLayout,{passive:true});
document.fonts?.ready.then(refreshMetricLayout);
document.fonts?.addEventListener?.('loadingdone',refreshMetricLayout);

const barObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelector('.score-meter')?.classList.add('is-revealed');
    barObserver.unobserve(entry.target);
  });
}, {threshold:0.15, rootMargin:'0px 0px -16px 0px'}) : null;

function renderResults(section, split, axis = 'overall') {
  const sorted = [...benchmarkResults].sort((a,b) => benchmarkScore(b,split,axis) - benchmarkScore(a,split,axis));
  const approximate = split === 'all' && axis !== 'overall';
  const body = section.querySelector('[data-results-body]');
  if (!body) return;
  section.dataset.selectedSplit = split;
  section.dataset.selectedAxis = axis;
  const label = section.querySelector('[data-score-label]');
  if (label) label.textContent = benchmarkAxes[axis].label;
  const note = section.querySelector('[data-score-note]');
  if (note) note.hidden = !approximate;
  const caption = section.querySelector('caption');
  if (caption) caption.textContent = `${benchmarkAxes[axis].label} for ${split === 'all' ? 'all' : split === 'small' ? 'Small' : 'Big'} game designs. Scores range from zero to one hundred, ranked highest first.${approximate ? ' All per-axis scores average the reported Small and Big results and are approximate due to rounding.' : ''}`;
  body.querySelectorAll('tr').forEach(row => { barObserver?.unobserve(row); row.querySelectorAll('.score-value').forEach(unregisterMetricCounter); });
  body.replaceChildren();
  sorted.forEach((row,index) => {
    const value = benchmarkScore(row,split,axis);
    const tr = document.createElement('tr');
    if (index === 0) tr.className = 'top-result';
    const rank = document.createElement('td');
    rank.textContent=String(index+1).padStart(2,'0');
    const agent=document.createElement('td');
    const identity=document.createElement('span');identity.className='agent-identity';
    const mark=providerMarks[row.provider];
    const icon=document.createElement('img');
    icon.src=mark.src;icon.alt='';icon.setAttribute('aria-hidden','true');
    icon.width=24;icon.height=24;icon.className='agent-logo'+(mark.mono?' monochrome':'');
    const name=document.createElement('span');name.className='agent-name';name.textContent=row.name;
    identity.append(icon,name);agent.appendChild(identity);
    const score=document.createElement('td');score.className='score-cell';
    const prefix=document.createElement('span');prefix.className='score-approximation'+(approximate?'':' is-empty');
    prefix.textContent='≈';prefix.setAttribute('aria-hidden','true');score.appendChild(prefix);
    if (approximate) score.setAttribute('aria-label',`Approximately ${displayedBenchmarkScore(value)}`);
    const scoreValue=document.createElement('span');scoreValue.className='score-value';
    scoreValue.textContent=displayedBenchmarkScore(value);score.appendChild(scoreValue);
    const meter=document.createElement('span');meter.className='score-meter';
    meter.style.setProperty('--score',value);
    meter.style.setProperty('--bar-delay',`${index*35}ms`);
    meter.setAttribute('aria-hidden','true');score.appendChild(meter);
    tr.append(rank,agent,score);body.appendChild(tr);
    registerMetricCounter(scoreValue);
    if (barObserver && !reducedMotion.matches) barObserver.observe(tr);
    else meter.classList.add('is-revealed');
  });
  const status=section.querySelector('[data-results-status]');
  if (status) status.textContent=`Showing ${benchmarkAxes[axis].short}, ${split === 'all' ? 'all designs' : split + ' designs'}. Ranked by score.`;
}
document.querySelectorAll('[data-leaderboard]').forEach(section => {
  function select(button, attribute) {
    section.querySelectorAll(`[data-${attribute}]`).forEach(item => {
      const active=item===button;
      item.classList.toggle('active',active);
      item.setAttribute('aria-pressed',String(active));
    });
    const split = section.querySelector('[data-split].active')?.dataset.split || 'all';
    const axis = section.querySelector('[data-score-axis].active')?.dataset.scoreAxis || 'overall';
    renderResults(section,split,axis);
  }
  section.querySelectorAll('[data-split]').forEach(button => button.addEventListener('click',() => select(button,'split')));
  section.querySelectorAll('[data-score-axis]').forEach(button => button.addEventListener('click',() => select(button,'score-axis')));
  renderResults(section,'all','overall');
});
reducedMotion.addEventListener('change',event => {
  if (!event.matches) return;
  document.querySelectorAll('[data-results-body] tr').forEach(row => {
    barObserver?.unobserve(row);
    row.querySelector('.score-meter')?.classList.add('is-revealed');
  });
});
document.querySelectorAll('[data-paper-link]').forEach(link => {
  const paperUrl = window.A2Z_SITE?.paperUrl?.trim();
  if (paperUrl) {
    link.href = paperUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.removeAttribute('role');
  } else {
    link.removeAttribute('href');
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('role', 'link');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
  }
});

if (window.A2Z_SITE?.codeUrl) {
  document.querySelectorAll('[data-code-link]').forEach(item => {
    const link=document.createElement('a');
    link.className='code-nav';link.href=window.A2Z_SITE.codeUrl;
    link.target='_blank';link.rel='noopener';
    link.innerHTML='Code <span aria-hidden="true">↗</span>';
    item.replaceWith(link);
  });
}

// Interactive method diagrams.
document.querySelectorAll('[data-method-explorer]').forEach(explorer => {
  const buttons=Array.from(explorer.querySelectorAll('[data-method-target]'));
  const panels=Array.from(explorer.querySelectorAll('[data-method-panel]'));
  buttons.forEach(button => button.addEventListener('click',() => {
    buttons.forEach(item => {
      const selected=item===button;
      item.classList.toggle('active',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
    panels.forEach(panel => { panel.hidden=panel.dataset.methodPanel!==button.dataset.methodTarget; });
  }));
});

// Scroll is the single timeline for the backdrop, copy, and masked logo lines.
(function initHeroScroll() {
  const runway = document.querySelector('[data-hero-scroll]');
  if (!runway) return;
  const intro = runway.querySelector('[data-hero-intro]');
  const credits = runway.querySelector('.hero-credits');
  const title = intro.querySelector('h1');
  const masthead = document.querySelector('.masthead');
  const actions = intro.querySelectorAll('a, button');
  const stage = runway.querySelector('.hero-stage');
  const lines = Array.from(runway.querySelectorAll('.hero-logo-line'));
  const wordmark = runway.querySelector('.hero-wordmark');
  // Use the stable CSS viewport, not innerHeight, which changes with mobile
  // browser chrome. A hero runway magnifies that change across the whole page.
  const viewportSizer = document.createElement('span');
  viewportSizer.className = 'hero-viewport-sizer';
  viewportSizer.setAttribute('aria-hidden','true');
  runway.prepend(viewportSizer);
  let headerHeight = 0;
  let travel = 1;
  let frame = 0;
  let active = false;
  const clamp = value => Math.max(0, Math.min(1, value));
  const segment = (value, start, end) => clamp((value - start) / (end - start));
  const smooth = value => value * value * (3 - 2 * value);

  function paint() {
    frame = 0;
    if (!active || !runway.getClientRects().length) return;
    const progress = clamp((headerHeight - runway.getBoundingClientRect().top) / travel);
    const curtain = smooth(segment(progress, 0, .76));
    const copyOpacity = 1 - smooth(segment(progress, .03, .22));
    runway.style.setProperty('--curtain-y', `${(1 - curtain) * 100}%`);
    runway.style.setProperty('--intro-opacity', copyOpacity);
    const cue=runway.querySelector('[data-hero-scroll-cue]');
    if(cue)cue.inert=copyOpacity<.15;
    const authorsOpacity = smooth(segment(progress, .58, .88));
    runway.style.setProperty('--authors-opacity', authorsOpacity);
    if (credits) credits.inert = authorsOpacity < .15;
    window.A2ZRefreshHeroPlayback?.(progress);
    lines.forEach((line, index) => {
      const reveal = segment(progress, .22 + index * .035, .70 + index * .035);
      const eased = 1 - Math.pow(1 - reveal, 3);
      line.style.setProperty('--line-y', `${(1 - eased) * 110}%`);
    });
    // Keep the semantic heading available, but disable covered or faded actions.
    const curtainTop = stage.getBoundingClientRect().top + stage.clientHeight * (1 - curtain);
    actions.forEach(action => {
      action.inert = copyOpacity < .15 || (curtain > 0 && curtainTop <= action.getBoundingClientRect().bottom);
    });
  }

  function queuePaint() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function measure() {
    if (!runway.getClientRects().length) return;
    headerHeight = masthead.getBoundingClientRect().height;
    const height = viewportSizer.getBoundingClientRect().height - headerHeight;
    const introStyle = getComputedStyle(intro);
    const copyHeight = Array.from(intro.children).reduce((total, child) => {
      const style = getComputedStyle(child);
      return total + child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }, parseFloat(introStyle.paddingTop) + parseFloat(introStyle.paddingBottom));
    active = !reducedMotion.matches && height >= 440 && copyHeight <= height;
    travel = Math.round(height * 1.05);
    runway.style.setProperty('--hero-header', `${headerHeight}px`);
    runway.style.setProperty('--hero-height', `${height}px`);
    runway.style.setProperty('--hero-travel', `${travel}px`);
    runway.classList.toggle('is-scroll-ready', active);
    if (active) {
      // Measure after pinning. The wordmark never inherits the curtain's motion.
      const titleTop = title.getBoundingClientRect().top - stage.getBoundingClientRect().top;
      const bottomSpace = Math.max(145, height * .17);
      runway.style.setProperty('--logo-top', `${titleTop}px`);
      runway.style.setProperty('--logo-cap', `${Math.max(1, (height - titleTop - bottomSpace) / (3 * 1.18))}px`);
      paint();
    } else {
      runway.style.removeProperty('--curtain-y');
      runway.style.removeProperty('--intro-opacity');
      runway.style.removeProperty('--authors-opacity');
      if (credits) credits.inert = false;
      window.A2ZRefreshHeroPlayback?.(0);
      lines.forEach(line => line.style.removeProperty('--line-y'));
      actions.forEach(action => { action.inert = false; });
    }
    // Fit the unbroken wordmark to its container, including fallback fonts.
    runway.style.removeProperty('--logo-width-cap');
    if (wordmark && window.matchMedia('(max-width:760px)').matches) {
      const fontSize = parseFloat(getComputedStyle(wordmark).fontSize);
      const widthRatio = lines.reduce((ratio, line) => {
        const range = document.createRange();
        range.selectNodeContents(line.firstElementChild || line);
        const textWidth = range.getBoundingClientRect().width;
        return textWidth > 0 ? Math.min(ratio, line.clientWidth / textWidth) : ratio;
      }, 1);
      if (widthRatio < 1) runway.style.setProperty('--logo-width-cap', `${fontSize * widthRatio * .99}px`);
    }
  }

  window.addEventListener('scroll', queuePaint, {passive:true});
  window.addEventListener('resize', measure, {passive:true});
  window.addEventListener('pageshow', measure);
  window.addEventListener('hashchange', () => requestAnimationFrame(measure));
  reducedMotion.addEventListener('change', measure);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(masthead);
    observer.observe(intro);
  }
  document.fonts?.ready.then(measure);
  measure();
})();

// Manual case carousel: arrows, direct selection, keyboard, and touch swipes.
document.querySelectorAll('[data-revision-carousel]').forEach(carousel => {
  const cases = Array.from(carousel.querySelectorAll('[data-revision-case]'));
  const selectors = Array.from(carousel.querySelectorAll('[data-revision-go]'));
  const viewport = carousel.querySelector('[data-revision-viewport]');
  const rail = carousel.querySelector('[data-revision-nav]');
  const counter = carousel.querySelector('[data-revision-counter]');
  const status = carousel.querySelector('[data-revision-status]');
  let current = 0;
  let animation;
  let touchStart;
  function show(index, announce = true) {
    const next = (index + cases.length) % cases.length;
    const direction = index >= current ? 1 : -1;
    animation?.cancel();
    cases.forEach((slide, i) => { slide.hidden = i !== next; });
    cases[next].querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
    selectors.forEach((button, i) => button.setAttribute('aria-pressed', String(i === next)));
    counter.innerHTML = `${String(next + 1).padStart(2, '0')} <span>/ ${String(cases.length).padStart(2, '0')}</span>`;
    if (announce) {
      status.textContent = `Case ${next + 1} of ${cases.length}: ${cases[next].dataset.caseTitle}`;
      if (!reducedMotion.matches && cases[next].animate) {
        animation = cases[next].animate([
          {opacity:0, transform:`translateX(${direction * 18}px)`},
          {opacity:1, transform:'translateX(0)'}
        ], {duration:280, easing:'cubic-bezier(.2,.7,.2,1)'});
      }
      const button = selectors[next];
      const left = rail.scrollLeft + button.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - button.clientWidth) / 2;
      rail.scrollTo({left, behavior:reducedMotion.matches ? 'instant' : 'smooth'});
    }
    current = next;
  }
  carousel.querySelector('[data-revision-prev]').addEventListener('click', () => show(current - 1));
  carousel.querySelector('[data-revision-next]').addEventListener('click', () => show(current + 1));
  selectors.forEach((button, i) => button.addEventListener('click', () => show(i)));
  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  viewport.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { touchStart = null; return; }
    const touch = event.touches[0];
    touchStart = {x:touch.clientX, y:touch.clientY};
  }, {passive:true});
  viewport.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, {passive:true});
  viewport.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
  carousel.classList.add('is-carousel-ready');
  show(0, false);
});

/* Paper-inspired evaluation pipeline. Original figure objects, native animation. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const descriptions = [
    'A coding agent turns a long-form game design document into a source project and playable build.',
    'The dependency-aware contract defines what to verify: rules, invariants, and their connections. It stays fixed across builds and revisions.',
    'The contract guides source inspection. Test policies specify how to exercise the game through fixed replay inputs or inputs chosen from live observations.',
    'Requirement-level evidence becomes targeted feedback for the next revision, which is evaluated against the same contract.'
  ];
  const names = ['Build', 'Contract', 'Evaluate', 'Revise'];
  document.querySelectorAll('[data-a2z-pipeline]').forEach(panel => {
    if (panel.dataset.pipelineReady) return;
    panel.dataset.pipelineReady = 'true';
    const canvas = panel.querySelector('.pp-canvas');
    if (!canvas) return;
    const svg = panel.querySelector('.pp-wires');
    const buttons = [...panel.querySelectorAll('[data-pipeline-step]')];
    const nodes = [...panel.querySelectorAll('[data-pipeline-stage]')];
    const axes = [...panel.querySelectorAll('[data-pipeline-axis]')];
    const transport = panel.querySelector('[data-pipeline-toggle]');
    const transportLabel = panel.querySelector('[data-pipeline-toggle-label]');
    const description = panel.querySelector('[data-pipeline-description]');
    const announcement = panel.querySelector('[data-pipeline-announcement]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 760px)');
    let stage = 0, elapsed = 0, previousTime = 0, frame = 0, userPaused = false, inView = false, paths = [];
    const duration = () => stage === 2 ? 8400 : 5500;
    const element = (tag, attributes) => { const el = document.createElementNS(NS, tag); Object.entries(attributes).forEach(([key,value]) => el.setAttribute(key,value)); return el; };
    const wireState = () => paths.forEach(({base,trace,arrow,step}) => [base,trace,arrow].forEach(el => el.classList.toggle('is-current',step===stage)));
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
      svg.replaceChildren(); paths=[];
      const rect = name => {
        const r = panel.querySelector(`[data-pipeline-node="${name}"]`).getBoundingClientRect();
        return {x:r.left-box.left,y:r.top-box.top,w:r.width,h:r.height};
      };
      const point = (r,edge,fraction=.5) => edge==='right'?[r.x+r.w,r.y+r.h*fraction]:edge==='left'?[r.x,r.y+r.h*fraction]:edge==='top'?[r.x+r.w*fraction,r.y]:[r.x+r.w*fraction,r.y+r.h];
      const add = (d,end,direction,step) => {
        const base=element('path',{d,class:'pp-wire'}),trace=element('path',{d,class:'pp-wire-trace',pathLength:1});
        const [x,y]=end;
        const points=direction==='down'?`${x},${y} ${x-3},${y-5} ${x+3},${y-5}`:direction==='up'?`${x},${y} ${x-3},${y+5} ${x+3},${y+5}`:`${x},${y} ${x-5},${y-3} ${x-5},${y+3}`;
        const arrow=element('polygon',{points,class:'pp-arrow'}); svg.append(base,trace,arrow); paths.push({base,trace,arrow,step});
      };
      const horizontal = (from,to,step,fraction=.48) => {
        const a=point(rect(from),'right',fraction),b=point(rect(to),'left',fraction),middle=(a[0]+b[0])/2;
        a[0]+=1;b[0]-=5;
        add(`M${a[0]} ${a[1]}C${middle} ${a[1]} ${middle} ${b[1]} ${b[0]} ${b[1]}`,b,'right',step);
      };
      const vertical = (from,to,step,fromFraction=.5,toFraction=.5) => {
        const a=point(rect(from),'bottom',fromFraction),b=point(rect(to),'top',toFraction),middle=(a[1]+b[1])/2;
        a[1]+=2;b[1]-=5;
        add(`M${a[0]} ${a[1]}V${middle}H${b[0]}V${b[1]}`,b,'down',step);
      };
      horizontal('design','builder',0,.44);
      if(mobile.matches) vertical('builder','build',0);
      else horizontal('builder','build',0,.44);
      vertical('design','contract',1);
      if(mobile.matches) vertical('contract','evaluation',2,.5,.2);
      else horizontal('contract','evaluation',2,.49);
      vertical('build','evaluation',2,.5,.8);
      vertical('evaluation','feedback',3,.47,.27);
      const feedback=rect('feedback'),builder=rect('builder');
      const a=point(feedback,'right',.44),b=point(builder,'top',.64),side=box.width+(mobile.matches?7:12),top=8;
      add(`M${a[0]+3} ${a[1]}H${side}V${top}H${b[0]}V${b[1]-5}`,[b[0],b[1]-5],'down',3);
      wireState();
    };
    const updateAxis = () => {
      const current = Math.min(2,Math.floor(elapsed/2800));
      axes.forEach((axis,i) => axis.classList.toggle('is-active',stage===2 && (reducedMotion.matches || i===current)));
      panel.querySelector('[data-pipeline-policies]')?.classList.toggle('is-active',stage===2 && (reducedMotion.matches || current>0));
    };
    const select = (next,announce=false) => {
      stage=next;elapsed=0;panel.dataset.stage=String(stage);panel.style.setProperty('--pipeline-progress','0');
      buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===stage)));
      nodes.forEach(node=>node.classList.toggle('is-active',node.dataset.pipelineStage.split(' ').includes(String(stage))));
      description.textContent=descriptions[stage];wireState();updateAxis();
      if(announce) announcement.textContent=`${names[stage]}. ${descriptions[stage]}`;
    };
    const tick = time => {
      if(!frame) return;
      if(previousTime) elapsed+=Math.min(time-previousTime,100);
      previousTime=time;
      if(elapsed>=duration()) select((stage+1)%4);
      panel.style.setProperty('--pipeline-progress',String(Math.min(elapsed/duration(),1)));updateAxis();
      frame=requestAnimationFrame(tick);
    };
    const syncPlayback = () => {
      const paused=userPaused||reducedMotion.matches,running=!mobile.matches&&!paused&&inView&&!document.hidden;
      panel.classList.toggle('is-running',running);panel.classList.toggle('is-paused',paused);
      transport.setAttribute('aria-pressed',String(paused));transport.setAttribute('aria-label',paused?'Play pipeline animation':'Pause pipeline animation');
      transportLabel.textContent=paused?'Play':'Pause';transport.hidden=reducedMotion.matches;
      if(running&&!frame){previousTime=0;frame=requestAnimationFrame(tick);}
      else if(!running&&frame){cancelAnimationFrame(frame);frame=0;previousTime=0;}
      updateAxis();
    };
    buttons.forEach(button=>button.addEventListener('click',()=>{userPaused=true;select(Number(button.dataset.pipelineStep),true);syncPlayback();}));
    transport.addEventListener('click',()=>{userPaused=!userPaused;syncPlayback();});
    document.addEventListener('visibilitychange',syncPlayback);reducedMotion.addEventListener('change',syncPlayback);mobile.addEventListener('change',()=>{measure();syncPlayback();});
    if('IntersectionObserver' in window){new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncPlayback();},{threshold:.12}).observe(panel);}else{inView=true;}
    if('ResizeObserver' in window) new ResizeObserver(measure).observe(canvas);else window.addEventListener('resize',measure,{passive:true});
    document.fonts?.ready.then(measure);panel.querySelectorAll('img').forEach(img=>img.addEventListener('load',measure));
    select(0);measure();syncPlayback();
  });
})();

/* Scenario-specific paper screenshots; no continuous replay is implied. */
(() => {
  const GAMES = [{"slug":"cloud-cast","name":"Cloud Cast","figure":"S26","panel":"a","frames":[{"label":"Reeling gauges","detail":"42% catch progress with A/D and J/K cues","src":"assets/replay/fig-s27-cloud-cast-01.jpeg"},{"label":"Cloudstorm readability","detail":"Timing gauges remain visible during the storm","src":"assets/replay/fig-s27-cloud-cast-02.jpeg"},{"label":"Catch summary","detail":"Perfect grade, 90.3 cm, and +108 coins","src":"assets/replay/fig-s27-cloud-cast-03.jpeg"}]},{"slug":"afterglow-network","name":"Afterglow Network","figure":"S26","panel":"b","frames":[{"label":"Tool interaction","detail":"E — TAKE CUTTER appears beside the tool","src":"assets/replay/fig-s27-afterglow-network-01.jpeg"},{"label":"Regulator hold","detail":"HOLD E — INSTALL REGULATOR 4.0s","src":"assets/replay/fig-s27-afterglow-network-02.jpeg"},{"label":"Defense readouts","detail":"Core, barrier, and turret ammo readouts","src":"assets/replay/fig-s27-afterglow-network-03.jpeg"}]},{"slug":"siege-deck-2d","name":"Siege Deck 2D","figure":"S26","panel":"c","frames":[{"label":"Deployment cells","detail":"Blue placement markers and the roster tray","src":"assets/replay/fig-s27-siege-deck-2d-01.jpeg"},{"label":"Order slots","detail":"Three empty slots beneath the battle board","src":"assets/replay/fig-s27-siege-deck-2d-02.jpeg"},{"label":"Reward cards","detail":"Three card offers beside the 13/30 deck count","src":"assets/replay/fig-s27-siege-deck-2d-03.jpeg"}]},{"slug":"wham-bam-logistics","name":"Wham Bam Logistics","figure":"S26","panel":"d","frames":[{"label":"Cargo priorities","detail":"Four ordered cargo classes in the Route panel","src":"assets/replay/fig-s27-wham-bam-logistics-01.jpeg"},{"label":"Fleet catalog","detail":"Vehicle prices and facility purchase controls","src":"assets/replay/fig-s27-wham-bam-logistics-02.jpeg"},{"label":"Facility loads","detail":"Normal/Warning labels, queues, and capacity bars","src":"assets/replay/fig-s27-wham-bam-logistics-03.jpeg"}]},{"slug":"chromashade","name":"ChromaShade","figure":"S27","panel":"a","frames":[{"label":"Shadow controls","detail":"Slide, resize, and jump hints","src":"assets/replay/fig-s28-chromashade-01.jpeg"},{"label":"Stepped route","detail":"Four stepped platforms above floor spikes","src":"assets/replay/fig-s28-chromashade-02.jpeg"},{"label":"Light selection","detail":"Two lights and the Tab-switching hint","src":"assets/replay/fig-s28-chromashade-03.jpeg"}]},{"slug":"ssitgim","name":"Ssitgim","figure":"S27","panel":"b","frames":[{"label":"Soul labels","detail":"Soul names above red vigor bars","src":"assets/replay/fig-s28-ssitgim-01.jpeg"},{"label":"Cleansing prompt","detail":"Cleansing Ring · K · 0/4 progress","src":"assets/replay/fig-s28-ssitgim-02.jpeg"},{"label":"Boss identity","detail":"Jeongwol’s name and bottom vigor bar","src":"assets/replay/fig-s28-ssitgim-03.jpeg"}]},{"slug":"alias-alchemy-shop","name":"Alias Alchemy Shop","figure":"S27","panel":"c","frames":[{"label":"Alias choices","detail":"Three signboards and permanent upgrades","src":"assets/replay/fig-s28-alias-alchemy-shop-01.jpeg"},{"label":"Production screen","detail":"Cauldron, shared stock, and order cards","src":"assets/replay/fig-s28-alias-alchemy-shop-02.jpeg"},{"label":"Closure preview","detail":"Reset and retained resources in two columns","src":"assets/replay/fig-s28-alias-alchemy-shop-03.jpeg"}]},{"slug":"strata-keepers","name":"Strata Keepers","figure":"S27","panel":"d","frames":[{"label":"Context record","detail":"Layer, samples, and orientation marked","src":"assets/replay/fig-s28-strata-keepers-01.jpeg"},{"label":"Joining puzzle","detail":"Seven fragments and 0/7 progress","src":"assets/replay/fig-s28-strata-keepers-02.png"},{"label":"Hypothesis board","detail":"Evidence slots and a confidence display","src":"assets/replay/fig-s28-strata-keepers-03.jpeg"}]}];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selectionTimes = [700, 1800, 2900];
  const duration = 4300;
  function initScenarioEvidence(scope = document) {
    const roots = scope.matches?.('[data-scenario-evidence]') ? [scope] : scope.querySelectorAll('[data-scenario-evidence]');
    roots.forEach(root => {
      if (root.dataset.seReady) return;
      root.dataset.seReady = 'true';
      const scene = root.querySelector('[data-se-spatial-scene]');
      const picker = root.querySelector('[data-se-game]');
      const toggle = root.querySelector('[data-se-autoplay]');
      const label = root.querySelector('[data-se-auto-label]');
      const replayControl = !!root.closest('main[data-view="glance"]'); // FIGURE_CONTROLS_V35
      const status = root.querySelector('[data-se-status]');
      const source = root.querySelector('[data-se-source]');
      const cards = [...root.querySelectorAll('[data-se-card]')];
      const slices = [...root.querySelectorAll('[data-se-slice]')];
      const buttons = [...root.querySelectorAll('[data-se-observation]')];
      let gameIndex = Math.max(0, GAMES.findIndex(game => game.slug === (root.dataset.seDefaultGame || picker.value)));
      let clock = 0, last = 0, frame = 0, inView = false, paused = false, phase = -1, focus = -1, ready = false;
      const canRun = () => ready && inView && !paused && !reduced.matches && clock < duration && !document.hidden && !root.closest('[data-method-suspended="true"]') && !!root.getClientRects().length;
      const frameUrl = item => root.dataset.seAssetBase ? root.dataset.seAssetBase.replace(/\/?$/, '/') + item.src.split('/').pop() : item.src;
      function selectFocus(next) {
        if (focus === next) return;
        focus = next; root.dataset.seFocus = String(next);
        buttons.forEach((button,index) => button.setAttribute('aria-pressed', String(index === next)));
      }
      function paint() {
        const nextPhase = reduced.matches ? 4 : clock < 700 ? 0 : clock < 1800 ? 1 : clock < 2900 ? 2 : clock < duration ? 3 : 4;
        if (nextPhase === phase) return;
        phase = nextPhase;
        root.dataset.sePhase = phase === 0 ? 'scan' : phase === 4 ? 'evidence' : `extract-${phase}`;
        slices.forEach((slice,index) => slice.classList.toggle('is-chosen',reduced.matches || clock >= selectionTimes[index]));
        cards.forEach((card,index) => {
          const selected = reduced.matches || clock >= selectionTimes[index];
          card.classList.toggle('is-retrieved',selected);
          buttons[index].tabIndex = selected ? 0 : -1;
        });
        if (!reduced.matches && !paused && phase > 0) selectFocus(Math.min(2,phase-1));
        else if (focus < 0) selectFocus(0);
      }
      function tick(time) {
        if (!frame) return;
        if (last) clock = Math.min(duration,clock+Math.min(80,time-last));
        last = time; paint();
        if (clock >= duration) { frame=0; last=0; sync(); return; }
        frame = requestAnimationFrame(tick);
      }
      function sync() {
        const run = canRun(), complete = clock >= duration;
        root.dataset.sePlaying = String(run);
        root.classList.toggle('is-retrieval-still',reduced.matches);
        toggle.hidden = reduced.matches;
        toggle.style.visibility = complete && !replayControl ? 'hidden' : '';
        toggle.setAttribute('aria-pressed', String(!complete && paused));
        const action = complete && replayControl ? 'Replay' : paused ? 'Play' : 'Pause';
        toggle.setAttribute('aria-label', `${action} frame selection animation`);
        label.textContent = action;
        if (run && !frame) { last=0; frame=requestAnimationFrame(tick); }
        else if (!run && frame) { cancelAnimationFrame(frame); frame=0; last=0; }
        paint();
      }
      function showGame(index, announce=false) {
        gameIndex=index;
        const game=GAMES[index]; picker.value=game.slug;
        source.textContent="Paper appendix · Selected screenshots";
        cards.forEach((card,i)=>{
          const item=game.frames[i], image=card.querySelector('[data-se-image]');
          const alt=`${game.name}. ${item.label}. ${item.detail}. Screenshot from Figure ${game.figure}(${game.panel}).`;
          image.src=frameUrl(item); image.alt=alt;
          card.querySelector('[data-se-frame-title]').textContent=item.label;
          card.querySelector('[data-se-frame-detail]').textContent=item.detail;
          buttons[i].setAttribute('aria-label',`Inspect ${item.label}: ${item.detail}`);
        });
        phase=-1;focus=-1;clock=0;selectFocus(0);paint();sync();
        if(announce) status.textContent=`${game.name}. Three screenshots selected from the paper examples.`;
      }
      picker.addEventListener('change',()=>{
        const index=GAMES.findIndex(game=>game.slug===picker.value);
        if(index>=0) showGame(index,true);
      });
      buttons.forEach((button,index)=>button.addEventListener('click',()=>{
        clock=duration;paused=false;paint();selectFocus(index);sync();
        const item=GAMES[gameIndex].frames[index];status.textContent=`${item.label}. ${item.detail}.`;
      }));
      toggle.addEventListener('click',()=>{
        if (replayControl && clock >= duration) { clock=0;last=0;phase=-1;focus=-1;paused=false; }
        else paused=!paused;
        sync();
      });
      reduced.addEventListener('change',()=>{phase=-1;sync();});
      document.addEventListener('visibilitychange',sync);
      document.addEventListener('a2z-method-visibility',sync);
      if('IntersectionObserver' in window) new IntersectionObserver(entries=>{
        inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=.2;sync();
      },{threshold:[0,.2]}).observe(scene);
      else inView=true;
      root.classList.add('is-retrieval-ready');ready=true;showGame(gameIndex);sync();
    });
  }
  window.initScenarioEvidence=initScenarioEvidence;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>initScenarioEvidence());
  else initScenarioEvidence();
})();

window.A2Z_MEDIA = {"ssitgim":{"name":"Ssitgim","image":"assets/gallery/ssitgim.webp","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","video":"assets/media/ssitgim.mp4","split":"Big","genre":"Action platformer","brief":"Wield a spirit sword and ritual bells through a silent shrine, soothing restless souls and guiding them toward the afterlife.","goal":"Free the souls bound to a silent shrine and guide them toward the afterlife.","gameplay":"Chain spirit-sword attacks, ring ritual bells, and perform the Ssitgim rite to release a great soul.","motionId":"video-ssitgim"},"toybox-rider":{"name":"Toybox Rider","image":"assets/gallery/toybox-rider.webp","description":"Recorded gameplay from an agent-generated build.","credit":"After two rounds of benchmark feedback. Shown at original speed.","split":"Big","genre":"Stunt racing","brief":"Ride an endless toy track, time your jumps, and rotate the bike for clean landings while collecting Bolts and chasing distance records.","goal":"Travel farther along an endless toy track while building records and collecting upgrade Bolts.","gameplay":"Time your jumps and rotate the airborne bike to land cleanly and retain screen position."},"bloom-or-weed":{"name":"Bloom or Weed","image":"assets/gallery/bloom-or-weed.webp","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","video":"assets/media/bloom-or-weed.mp4","split":"Small","genre":"Reaction game","brief":"Click each flower and leave weeds untouched during a forty-five-second run, testing your accuracy as the time to respond shrinks.","goal":"Achieve the highest possible accuracy in a forty-five-second test of reaction and restraint.","gameplay":"Click each flower and ignore every weed as the time available to respond gets shorter.","motionId":"video-bloom-or-weed"},"snowfall-draw":{"name":"Snowfall Draw","image":"assets/gallery/snowfall-draw.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Big","genre":"Drawing · Survival","brief":"Draw ice ramps and shields to guide a falling snow sprite through gunfire, balancing each rescue against a slowly refilling ink supply.","goal":"Descend as far as possible through a dangerous shaft with a falling snow sprite.","gameplay":"Draw ramps to redirect the fall and shields to stop bullets while rationing your ink."},"pixel-pennant":{"name":"Pixel Pennant","image":"assets/gallery/pixel-pennant.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Big","genre":"Baseball · Career","brief":"Pitch, bat, and field through a baseball season, using precise timing and lineup decisions to lead your club toward a championship.","goal":"Lead your baseball club through a season and compete for the league championship.","gameplay":"Control pitching, batting, and fielding, pairing precise timing with decisions about your club lineup."},"borrowed-faces-2d":{"name":"Borrowed Faces","image":"assets/gallery/borrowed-faces-2d.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Big","genre":"Social stealth · RPG","brief":"Borrow identities to enter restricted districts, read social cues, and uncover secrets before conversations expose your disguise and spread rumors across the city.","goal":"Uncover the secrets of Halen Port by entering districts closed to your own identity.","gameplay":"Borrow a disguise, read social cues, and choose dialogue carefully before acquaintances expose your borrowed face."},"the-librarians-hook":{"name":"The Librarian’s Hook","image":"assets/gallery/the-librarians-hook.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Big","genre":"Grappling · Collection","brief":"Swing between floating bookshelves, hook wandering memory creatures, and tame them through rhythm challenges to restore the Library of Memories.","goal":"Restore the Library of Memories by returning forgotten memories to its empty floating shelves.","gameplay":"Swing with a grappling hook, snag memory creatures, and tame them in short rhythm challenges."},"whispers-of-the-wild":{"name":"Whispers of the Wild","image":"assets/gallery/whispers-of-the-wild.webp","description":"Recorded gameplay from an agent-generated build.","credit":"After two rounds of benchmark feedback. Shown at original speed.","video":"assets/media/whispers-revision.mp4","split":"Big","genre":"Photography · Adventure","brief":"Follow tracks through a misty forest, approach animals quietly, and frame their photographs to complete a wildlife codex without frightening them away.","goal":"Photograph twelve animal species to complete your wildlife Codex in the misty forest reserve.","gameplay":"Follow footprints and calls, sneak into range, and frame clear photographs without alarming the animals.","motionId":"video-whispers-revision"},"lighthouse-mirrors":{"name":"Lighthouse Mirrors","image":"assets/gallery/lighthouse-mirrors.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Light routing puzzle","brief":"Rotate three one-sided mirrors to guide a beam into the target, solving three fixed optical puzzles by reading each reflection.","goal":"Guide a beam into its target to solve three fixed arrangements of mirrors.","gameplay":"Rotate the three one-sided mirrors and follow the beam to predict where each reflection leads."},"odd-patch":{"name":"Odd Patch","image":"assets/gallery/odd-patch.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Reaction puzzle","brief":"Spot the patch with a different color or shape across fifteen rounds, balancing accurate picks against your selection time.","goal":"Identify the patch that differs in color or shape through fifteen increasingly demanding rounds.","gameplay":"Compare the patches, select the odd one, and balance accurate answers against selection time."},"color-flood":{"name":"Color Flood","image":"assets/gallery/color-flood.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Color puzzle","brief":"Choose colors to expand a connected region across the board, absorbing adjacent tiles until every cell is covered within the move limit.","goal":"Cover the entire board with one connected region before using all available moves.","gameplay":"Choose a new color to absorb matching adjacent cells, planning how each expansion opens the next."},"pancake-prefix":{"name":"Pancake Prefix","image":"assets/gallery/pancake-prefix.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Sequence puzzle","brief":"Flip the top portion of a numbered stack by selecting dividers, arranging every block into the target order within limited moves.","goal":"Arrange the numbered stack into its target order before running out of allowed moves.","gameplay":"Choose a divider to flip everything above it, planning how each reversal changes the stack."},"blackout-dispatch":{"name":"Blackout Dispatch","image":"assets/gallery/blackout-dispatch.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Resource planning","brief":"Allocate two power tokens across three bars, balancing restoration and escalating decay to keep every bar alive for six turns.","goal":"Keep all three power bars alive until the end of a six-turn emergency.","gameplay":"Allocate two power tokens each turn, weighing restoration against the decay of every bar."},"chalk-escape":{"name":"Chalk Escape","image":"assets/gallery/chalk-escape.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Precision maze","brief":"Draw one continuous line through three fixed mazes, reaching each goal while holding the pointer and keeping the entire path clear of walls.","goal":"Reach the goal in each of three fixed mazes without allowing the drawn path to touch walls.","gameplay":"Hold the pointer down and trace one continuous line, steering carefully through the narrow passages."},"untangled-cords":{"name":"Untangled Cords","image":"assets/gallery/untangled-cords.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Geometry puzzle","brief":"Drag connected points into a layout with no crossing lines, keeping every connection intact as the fixed puzzle’s time limit runs down.","goal":"Find a layout with no crossing lines before the fixed puzzle timer runs out.","gameplay":"Drag the connected points into new positions while keeping every original connection intact."},"shadow-pair":{"name":"Shadow Pair","image":"assets/gallery/shadow-pair.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Silhouette puzzle","brief":"Drag a circle and rectangle along horizontal rails until their combined silhouette matches the target, then hold the match before time expires.","goal":"Recreate the target silhouette by arranging two simple shapes before the session timer expires.","gameplay":"Drag the circle and rectangle along horizontal rails, then hold their combined silhouette in place."},"one-fold-letter":{"name":"One-Fold Letter","image":"assets/gallery/one-fold-letter.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Geometry puzzle","brief":"Choose the reflection axis that will carry a starting point onto its target, predicting each fold before the decision timer expires.","goal":"Find the reflection that carries the starting point exactly onto its target location.","gameplay":"Compare the available fold axes and predict the reflected position before the decision timer expires."},"backwalker-camp":{"name":"Backwalker Camp","image":"assets/gallery/backwalker-camp.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Big","genre":"Psychological horror","brief":"Explore an abandoned training center with a single flashlight, spotting changes in remembered objects while keeping a relentless pursuer at a distance.","goal":"Find a way out of the abandoned training center while escaping a relentless pursuer.","gameplay":"Aim your flashlight to detect changes in remembered objects or slow the threat behind you."},"beat-bistro":{"name":"Beat Bistro","image":"assets/gallery/beat-bistro.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Timing arcade","brief":"Press four lane keys as falling symbol cards reach the timing line, matching at least fifteen of twenty to clear the session.","goal":"Match at least fifteen of twenty falling cards to complete the timing challenge.","gameplay":"Watch four symbol lanes and press the matching key as each card reaches the timing line."},"peg-garden":{"name":"Peg Garden","image":"assets/gallery/peg-garden.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Peg solitaire","brief":"Jump pegs over neighboring pegs into empty holes, removing each crossed piece until a single peg remains before time runs out.","goal":"Clear the board until only one peg remains before the puzzle timer runs out.","gameplay":"Jump a peg over a neighboring peg into an empty hole, removing the piece crossed."},"pocket-curling":{"name":"Pocket Curling","image":"assets/gallery/pocket-curling.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Precision · Physics","brief":"Drag back a disc, judge the power and direction, then release a single shot to stop as close as possible to the target.","goal":"Make one disc stop as close as possible to the center of a fixed target.","gameplay":"Drag backward to set direction and power, then release and judge how friction slows the shot."},"three-letter-delivery":{"name":"Three Letter Delivery","image":"assets/gallery/three-letter-delivery.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Symbol transcription","brief":"Enter six three-symbol codes with J, K, and L before each timer expires, keeping every key press in the correct order.","goal":"Enter six short symbol codes in the correct order before each response timer expires.","gameplay":"Read each three-symbol code and reproduce it with the J, K, and L keys."},"traces-left":{"name":"Traces Left","image":"assets/gallery/traces-left.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Deduction puzzle","brief":"Place two sensors on a directed graph, observe one hidden traversal, and use the resulting signals to identify its cause.","goal":"Identify the hidden cause of a graph traversal using only the signals you observe.","gameplay":"Place two sensors on the directed graph, watch one traversal, and interpret the resulting evidence."},"stamp-register":{"name":"Stamp Register","image":"assets/gallery/stamp-register.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Precision alignment","brief":"Drag a translucent stamp onto its matching outline, then inspect the placement error and try to align the centers more precisely.","goal":"Align a translucent stamp with its matching outline while minimizing the error between their centers.","gameplay":"Drag the stamp into position, inspect the placement feedback, and refine your alignment on the next trial."},"crate-corner":{"name":"Crate Corner","image":"assets/gallery/crate-corner.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Sokoban puzzle","brief":"Push one crate onto its goal across three compact warehouse puzzles, planning each move to avoid trapping it against walls.","goal":"Move the crate onto its marked goal in each of three compact warehouse puzzles.","gameplay":"Plan your route around walls and push carefully to avoid trapping the crate in a corner."},"echo-three":{"name":"Echo Three","image":"assets/gallery/echo-three.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Memory game","brief":"Watch three panels flash, then repeat their order with mapped keys across ten short patterns that increase their flashing speed.","goal":"Reproduce ten short flashing patterns in order as their presentation speed gradually increases.","gameplay":"Watch the three panels, remember their flashing sequence, and repeat it with the mapped keys."},"mobile-balance":{"name":"Mobile Balance","image":"assets/gallery/mobile-balance.webp","description":"A gameplay view from an agent-generated game.","credit":"Game capture from the project’s playground collection.","split":"Small","genre":"Balance puzzle","brief":"Place two different weights on a bar’s hooks, using their masses and distances from the center to make both sides balance.","goal":"Balance both sides of a bar using two weights with different masses and four hooks.","gameplay":"Drag the weights onto hooks, comparing each mass multiplied by its distance from the central pivot."},"orbit":{"name":"Orbit","image":"assets/gallery/paper-orbit.webp","description":"The player moves between two concentric rings. The final frame shows a screen flash when the player reaches the red hazard.","credit":"Paper Figure S25(c). Outer Ring.","split":"Small","genre":"Reflex arcade","brief":"Hop between two orbital rings to dodge red blockers, collect gold motes, and build your multiplier as the pace rises.","goal":"Survive the rising pace while collecting gold motes and building a higher score multiplier.","gameplay":"Hop between the two orbital rings to avoid red blockers and line up collectible motes."},"key-under-cups":{"name":"Key Under Cups","image":"assets/gallery/paper-key-under-cups.webp","description":"The key is revealed before the cups move. After the shuffle, the selected cup lifts to expose the key, accompanied by a green check mark.","credit":"Paper Figure S26(a). Check the Choice.","split":"Small","genre":"Visual tracking","brief":"Remember the cup hiding a key, follow its identity through a series of swaps, then select where the key ended up.","goal":"Find the key by keeping track of its cup throughout a sequence of swaps.","gameplay":"Memorize the starting cup, follow its identity as positions change, then select its final location."},"bin-bit":{"name":"Bin Bit","image":"assets/gallery/paper-bin-bit.webp","description":"Blue and gold bins retain their curved and angular labels. Correct choices highlight the corresponding bin and increment the visible counter.","credit":"Paper Figure S26(b). Choose Angular.","split":"Small","genre":"Classification · Reflex","brief":"Read the category rules and send each incoming symbol left or right before its timer expires, balancing quick decisions with accuracy.","goal":"Classify as many symbols correctly as possible during a fixed forty-five-second sorting session.","gameplay":"Read the left and right category rules, then press the matching direction before each timer expires."},"greedy-die":{"name":"Greedy Die","image":"assets/gallery/paper-greedy-die.webp","description":"Separate panels distinguish banked points from the temporary total. Rolling adds five temporary points; banking then secures the target of ten.","credit":"Paper Figure S26(c). Bank the Total.","split":"Small","genre":"Push your luck","brief":"Roll a six-sided die to build a temporary score, then bank your points before a one wipes out your unbanked total.","goal":"Build a banked score by deciding how much unclaimed progress you are willing to risk.","gameplay":"Roll to grow the temporary total, or bank it before a one wipes it out."},"safe-dial":{"name":"Safe Dial","image":"assets/gallery/paper-safe-dial.webp","description":"With two entries already confirmed, the dial rotates toward the highlighted final target. A fixed pointer and progress cards expose the current state.","credit":"Paper Figure S26(d). Approach the Pointer.","split":"Small","genre":"Precision timing","brief":"Hold the indicated direction to turn a numbered dial, releasing at each of three targets to complete the displayed combination.","goal":"Complete the displayed combination by stopping the dial correctly at three successive target numbers.","gameplay":"Hold the indicated direction to rotate the dial and release when it reaches the required number."},"cloud-cast":{"name":"Cloud Cast","image":"assets/replay/fig-s27-cloud-cast-02.jpeg","description":"Casting prompts, reel controls, and timing cues support fishing. The catch screen reports the fish, its grade and size, and the coin reward.","credit":"Paper Figure S27(a). Reel In.","split":"Big","genre":"Rhythm · Fishing","brief":"Keep two rhythms at once to reel cloudfish from the sky, discover rare catches, and befriend the residents of a floating harbor.","goal":"Fill your cloudfish Codex and build friendships with the residents of a floating harbor.","gameplay":"Keep the reeling and line-tension rhythms together, then gift selected catches to the townsfolk."},"afterglow-network":{"name":"Afterglow Network","image":"assets/replay/fig-s27-afterglow-network-03.jpeg","description":"The selected states show tool pickup, a timed regulator installation prompt, and a defense site with separate core, barrier, and turret status.","credit":"Paper Figure S27(b). Night Defense.","split":"Big","genre":"Survival · Base defense","brief":"Scavenge and reconnect relay bases by day, then defend their light at night to reopen a protected route through a ruined world.","goal":"Reconnect fifteen relay sites to open a protected route through the ruined world.","gameplay":"Gather supplies and repair bases by day, then defend the network through the night."},"siege-deck-2d":{"name":"Siege Deck 2D","image":"assets/replay/fig-s27-siege-deck-2d-01.jpeg","description":"Deployment cells guide unit placement, and an order hand supports tactical planning. The victory screen offers new cards and deck modification options.","credit":"Paper Figure S27(c). Deploy Units.","split":"Big","genre":"Tactical deckbuilding","brief":"Choose three orders each turn, position your formations, and anticipate enemy actions as simultaneous battles unfold across a fortress conquest campaign.","goal":"Capture enemy fortresses through a tactical campaign built around formations and carefully timed orders.","gameplay":"Choose three order cards, assign their units and positions, and anticipate simultaneous enemy actions."},"wham-bam-logistics":{"name":"Wham Bam Logistics","image":"assets/replay/fig-s27-wham-bam-logistics-02.jpeg","description":"A shared city map connects route editing, vehicle and facility purchases, and hub dispatch. Dedicated panels expose cargo priorities and facility loads.","credit":"Paper Figure S27(d). Manage the Fleet.","split":"Big","genre":"Logistics management","brief":"Plan delivery routes while time is paused, then watch warehouses and vehicles carry out your choices as deadlines and growing districts test the network.","goal":"Grow a delivery company by meeting deadlines and maintaining service across Moa City districts.","gameplay":"Plan road routes while time is paused, then let warehouses and vehicles execute the delivery network."},"chromashade":{"name":"ChromaShade","image":"assets/replay/fig-s28-chromashade-03.jpeg","description":"Movement puzzles combine shadow controls with platform traversal. Selected stages show stepped obstacles and the option to switch between light sources.","credit":"Paper Figure S28(a). Switch Lights.","split":"Big","genre":"Puzzle platformer","brief":"Aim light to turn shadows into temporary platforms, then leap across them to recover color shards and restore a monochrome city.","goal":"Recover Color Shards to bring color back to the districts of a monochrome city.","gameplay":"Rotate and resize the light beam, then jump across the temporary platforms formed by its shadows."},"alias-alchemy-shop":{"name":"Alias Alchemy Shop","image":"assets/replay/fig-s28-alias-alchemy-shop-02.jpeg","description":"The shop combines production, shared inventory, and customer orders. Its closure screen lists resources that reset and progress that carries forward.","credit":"Paper Figure S28(c). Manage Production.","split":"Big","genre":"Idle management","brief":"Brew potions, automate an underground shop, and weigh forbidden profits against rising suspicion before inspectors force you to abandon your alias.","goal":"Grow an underground potion business while managing the suspicion that threatens your current alias.","gameplay":"Click to brew, automate production, and choose between lucrative forbidden orders and a timely retreat."},"strata-keepers":{"name":"Strata Keepers","image":"assets/replay/fig-s28-strata-keepers-02.png","description":"Artifact records preserve excavation context. A joining puzzle and an evidence board provide separate interfaces for restoration and research.","credit":"Paper Figure S28(d). Rejoin Fragments.","split":"Big","genre":"Excavation · Simulation","brief":"Choose tools and pressure to uncover buried artifacts, balancing speed against preserving fragile remains and the archaeological context needed to interpret them.","goal":"Recover buried artifacts while preserving the fragile remains and context needed to understand them.","gameplay":"Read the layers and materials, then choose tools, pressure, and excavation order for each stroke."},"video-bloom-or-weed":{"name":"Bloom or Weed","image":"assets/media/bloom-or-weed.webp","video":"assets/media/bloom-or-weed.mp4","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","split":"Small","genre":"Reaction game","brief":"Click each flower and leave weeds untouched during a forty-five-second run, testing your accuracy as the time to respond shrinks.","goal":"Achieve the highest possible accuracy in a forty-five-second test of reaction and restraint.","gameplay":"Click each flower and ignore every weed as the time available to respond gets shorter.","motionId":"video-bloom-or-weed"},"video-last-match":{"name":"Last Match","image":"assets/media/last-match.webp","video":"assets/media/last-match.mp4","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","split":"Small","genre":"Turn-based strategy","brief":"Take one or two matches from a shared pile, anticipate a predictable opponent, and claim the final match to win the round.","goal":"Win at least two of three rounds by taking the final match in each pile.","gameplay":"Choose one or two matches each turn, calculating what remains after the opponent makes its fixed response.","motionId":"video-last-match"},"video-ssitgim":{"name":"SSITGIM","image":"assets/media/ssitgim.webp","video":"assets/media/ssitgim.mp4","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","split":"Big","genre":"Action platformer","brief":"Wield a spirit sword and ritual bells through a silent shrine, soothing restless souls and guiding them toward the afterlife.","goal":"Free the souls bound to a silent shrine and guide them toward the afterlife.","gameplay":"Chain spirit-sword attacks, ring ritual bells, and perform the Ssitgim rite to release a great soul.","motionId":"video-ssitgim"},"video-acting-human-again":{"name":"Acting Human Again Today!","image":"assets/media/acting-human-again.webp","video":"assets/media/acting-human-again.mp4","description":"Recorded gameplay from an agent-generated build.","credit":"Gameplay recording from the project collection. Shown at original speed.","split":"Big","genre":"Romance visual novel","brief":"An alien intern tries to pass as human at a struggling observatory, building relationships while keeping a secret identity just below discovery.","goal":"Grow close to one of three observatory employees without revealing your alien identity too soon.","gameplay":"Choose dialogue responses and read reactions, balancing rising Affection against the risk of Suspicion.","motionId":"video-acting-human-again"},"video-whispers-revision":{"name":"Whispers of the Wild","image":"assets/media/whispers-revision.webp","video":"assets/media/whispers-revision.mp4","description":"Recorded gameplay from an agent-generated build.","credit":"After two rounds of benchmark feedback. Shown at original speed.","split":"Big","genre":"Photography · Adventure","brief":"Follow tracks through a misty forest, approach animals quietly, and frame their photographs to complete a wildlife codex without frightening them away.","goal":"Photograph twelve animal species to complete your wildlife Codex in the misty forest reserve.","gameplay":"Follow footprints and calls, sneak into range, and frame clear photographs without alarming the animals.","motionId":"video-whispers-revision"},"abyssal-chain":{"name":"Abyssal Chain","split":"Big","genre":"Action puzzle roguelike","brief":"Pilot a deep-sea submersible and set off chain reactions through an abyss of volatile creatures and mineral veins.","goal":"Break each floor's seals and descend before oxygen runs out.","gameplay":"Place sonar charges, detonate connected hazards, and collect minerals to upgrade the sub between dives.","image":"assets/gallery/abyssal-chain.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"magma-arc":{"name":"Magma Arc: Fall of the Archer","split":"Big","genre":"Archery wave defense","brief":"Hold the rim of a waking volcano with arrows that change size and trajectory in mid-flight.","goal":"Stop the creatures climbing out of the crater and survive successive waves.","gameplay":"Aim downward, set the bow's draw, then resize falling arrows to bend their path and build combos.","image":"assets/gallery/magma-arc.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"fable-knot":{"name":"The Fable Knot","split":"Big","genre":"Logic puzzle","brief":"Rewrite a fable by arranging portraits and relationship tokens, changing who follows, avoids, protects, or awakens whom.","goal":"Guide the characters into the arrangement pictured on each Ending Card.","gameplay":"Push tokens into three-slot rule strips, preview the resulting reactions, and undo turns to untangle the puzzle.","image":"assets/gallery/fable-knot.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"reef-bistro":{"name":"Reef Bistro: Tide Defense","split":"Big","genre":"Restaurant and tower defense","brief":"Run a coral-reef bistro by day and protect its display shelf from thieving sea creatures by night.","goal":"Keep customers satisfied and the shelf intact as the bistro advances toward a Kraken showdown.","gameplay":"Cook and serve along the counter, spend earnings on complementary defenses, and rebuild between nights.","image":"assets/gallery/reef-bistro.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"rainwright":{"name":"Rainwright: The Rain Sculptor","split":"Big","genre":"Runner puzzle platformer","brief":"Race through a drowning city, shaping falling rain into temporary bridges, launch-mounds, and rescue pillars.","goal":"Reach the exit by carving a route through gaps, obstacles, and the storm.","gameplay":"Absorb rain to refill a shared water supply, then spend it on ice, mud, or pillars while jumping and sliding forward.","image":"assets/gallery/rainwright.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"seamline":{"name":"Suture Line","split":"Big","genre":"Action roguelite","brief":"Two survivors from overlapping realities share one lifeline, swapping in and out to chain attacks through a collapsing city.","goal":"Clear three districts and the central boss while keeping the shared lifeline alive.","gameplay":"Hit with one survivor, swap during attack recovery, and let the incoming character consume the state left by the previous hit.","image":"assets/gallery/seamline.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Character and ability selection"},"harukaze-student-council-casebook":{"name":"Harukaze High School Student Council Casebook","split":"Big","genre":"School-life simulation","brief":"Balance student council duties, campus investigations, and relationships while classmates follow schedules of their own.","goal":"Resolve school incidents and shape the year-end outcome without losing trust in the student council.","gameplay":"Plan limited after-school time, visit locations, gather evidence, and choose how to mediate each conflict.","image":"assets/gallery/harukaze-student-council-casebook.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"night-shift-rx":{"name":"Night Shift Rx","split":"Big","genre":"Typing and triage","brief":"Take the hospital's night shift, typing symptoms and medicines while several patients need attention at once.","goal":"Treat patients before their life gauges run out and make it through each ward.","gameplay":"Choose whom to treat, type symptom words to diagnose them, then enter the correct medicine before moving to the next patient.","image":"assets/gallery/night-shift-rx.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"toyfit":{"name":"ToyFit","split":"Big","genre":"Spatial puzzle","brief":"Fit wooden pieces into a toy's silhouette and watch the completed shape come alive on the collection shelf.","goal":"Fill every silhouette without overlaps and complete the toy collection.","gameplay":"Drag and rotate blocks, account for color anchors and fixed pieces, and use undo or hints when a fit proves tricky.","image":"assets/gallery/toyfit.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Toy-shelf level selection"},"acting-human-again":{"name":"Acting Human Again Today!","split":"Big","genre":"Romance visual novel","brief":"An alien intern tries to pass as human at a struggling observatory, building relationships while keeping a secret identity just below discovery.","goal":"Grow close to one of three observatory employees without revealing your alien identity too soon.","gameplay":"Choose dialogue responses and read reactions, balancing rising Affection against the risk of Suspicion.","image":"assets/gallery/acting-human-again.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen","motionId":"video-acting-human-again"},"edens-debt":{"name":"Eden's Debt","split":"Big","genre":"Planetary governance simulation","brief":"Govern an unfamiliar planet by drawing zones and policies as residents, corporations, and a changing biosphere respond.","goal":"Keep the colony viable and decide whether to repay its charter debt or establish a different society.","gameplay":"Set development, conservation, and survey boundaries, advance time, and trace ecological, economic, and political consequences.","image":"assets/gallery/edens-debt.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"},"chroma-bastion":{"name":"Chroma Bastion","split":"Big","genre":"Action tower defense","brief":"Defend the last source of color by switching between a Painter and a Gunner, turning colored ink into ammunition.","goal":"Protect the Bastion Core and clear enemy waves before gray erosion overtakes the screen.","gameplay":"Paint the Core to choose a shot's color, switch roles to fire, and collect ink from defeated enemies.","image":"assets/gallery/chroma-bastion.webp","description":"A screenshot from an agent-generated game.","credit":"Game screenshot from the project art collection.","screenType":"Title screen"}};
// Gameplay media and gallery movement.
(function initGameMedia() {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const heroVideo = document.querySelector('[data-hero-video]');
  const heroAsset = value => window.A2Z_PREVIEW_ASSETS?.[value] || value;
  const heroSource = heroAsset(window.A2Z_SITE?.heroVideoUrl || heroVideo?.dataset.src || '');
  if (heroVideo) {
    heroVideo.hidden = !heroSource;
    heroVideo.dataset.src = heroSource;
    if (window.A2Z_SITE?.heroPosterUrl) heroVideo.poster = heroAsset(window.A2Z_SITE.heroPosterUrl);
  }
  let heroInView = false;
  let heroCovered = false;
  let heroPaused = motionQuery.matches;
  function updateHero() {
    if (!heroVideo || !heroSource) return;
    const play = heroInView && !heroCovered && !heroPaused && !document.hidden && !document.getElementById('krafton-loader');
    if (!play) { heroVideo.pause(); return; }
    if (!heroVideo.getAttribute('src')) heroVideo.src = heroVideo.dataset.src;
    heroVideo.muted = true;
    heroVideo.play().catch(error => {
      if(error.name==='AbortError')return;
      heroPaused = true;
    });
  }
  document.addEventListener('a2z-page-visible',updateHero);
  window.A2ZRefreshHeroPlayback = progress => {
    const covered = progress >= .70;
    if (covered !== heroCovered) { heroCovered = covered; updateHero(); }
  };
  if (heroVideo) {
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      heroInView = entries[0].isIntersecting; updateHero();
    }, {threshold:.1}).observe(heroVideo);
    else { heroInView = true; updateHero(); }
    motionQuery.addEventListener('change', event => { heroPaused = event.matches; updateHero(); });
  }

  document.querySelectorAll('[data-game-wall]').forEach(wall => {
    const button = wall.querySelector('[data-wall-pause]');
    let userPaused = false;
    let onScreen = false;
    let raf = 0;
    let lastTime = 0;
    const rows = Array.from(wall.querySelectorAll('.marquee-row')).map((row, index) => {
      const track = row.querySelector('.marquee-track');
      const group = row.querySelector('.marquee-group');
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('button').forEach(card => { card.tabIndex = -1; });
      track.appendChild(clone);
      return {row, track, group, width:0, offset:0, speed:0, direction:index % 2 ? -1 : 1, hover:false, focus:false};
    });
    const wrap = (value, width) => ((value % width) + width) % width;
    const paint = state => { state.track.style.transform = `translate3d(${-state.offset}px,0,0)`; };
    function enabled() { return onScreen && !document.hidden && !motionQuery.matches; }
    function requestTick() {
      if (!raf && enabled()) raf = requestAnimationFrame(tick);
    }
    function tick(now) {
      raf = 0;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
      lastTime = now;
      let moving = false;
      rows.forEach(state => {
        const target = !userPaused && !state.hover && !state.focus ? 1 : 0;
        state.speed += (target - state.speed) * (1 - Math.exp(-dt / .15));
        if (Math.abs(state.speed - target) < .002) state.speed = target;
        if (state.width && state.speed) {
          const duration = parseFloat(state.track.style.getPropertyValue('--drift-duration')) || 150;
          state.offset = wrap(state.offset + state.direction * state.width / duration * state.speed * dt, state.width);
          paint(state);
        }
        moving ||= state.speed > 0 || target > 0;
      });
      if (moving && enabled()) requestTick();
      else lastTime = 0;
    }
    function sync() {
      wall.dataset.paused = String(userPaused || motionQuery.matches);
      wall.dataset.onscreen = String(onScreen && !document.hidden);
      if (button) {
        button.hidden = motionQuery.matches;
        button.setAttribute('aria-pressed', String(userPaused));
        button.textContent = userPaused ? 'Resume motion' : 'Pause motion';
      }
      if (!enabled()) {
        cancelAnimationFrame(raf); raf = 0; lastTime = 0;
        rows.forEach(state => { state.speed = 0; });
      } else requestTick();
    }
    function measure() {
      rows.forEach(state => {
        state.width = state.group.getBoundingClientRect().width;
        if (motionQuery.matches) state.track.style.removeProperty('transform');
        else if (state.width) { state.offset = wrap(state.offset, state.width); paint(state); }
      });
      sync();
    }
    rows.forEach(state => {
      state.row.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        state.hover = true; requestTick();
      });
      state.row.addEventListener('pointerleave', () => { state.hover = false; requestTick(); });
      state.row.addEventListener('focusin', event => {
        state.focus = event.target.matches(':focus-visible');
        if (!motionQuery.matches && state.focus) {
          state.speed = 0;
          state.row.scrollLeft = 0;
          const card = event.target.getBoundingClientRect();
          const bounds = state.row.getBoundingClientRect();
          const inset = Math.min(24, bounds.width * .04);
          let delta = 0;
          if (card.left < bounds.left + inset) delta = card.left - bounds.left - inset;
          else if (card.right > bounds.right - inset) delta = card.right - bounds.right + inset;
          if (delta && state.width) { state.offset += delta; paint(state); }
        }
        requestTick();
      });
      state.row.addEventListener('focusout', () => {
        requestAnimationFrame(() => { state.focus = state.row.contains(document.activeElement) && document.activeElement.matches(':focus-visible'); requestTick(); });
      });
    });
    wall.classList.add('is-marquee-ready');
    button?.addEventListener('click', () => { userPaused = !userPaused; sync(); });
    motionQuery.addEventListener('change', measure);
    document.addEventListener('visibilitychange', sync);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(measure);
      rows.forEach(state => observer.observe(state.group));
    } else window.addEventListener('resize', measure);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      onScreen = entries[0].isIntersecting; sync();
    }, {threshold:.02}).observe(wall);
    else onScreen = true;
    measure();
  });

  const dialog = document.getElementById('game-dialog');
  if (dialog) {
    let currentItem = null;
    const picture = dialog.querySelector('#dialog-image');
    const watch = dialog.querySelector('[data-dialog-watch]');
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-media-id]');
      if (!button) return;
      const item = window.A2Z_MEDIA?.[button.dataset.mediaId];
      if (!item) return;
      currentItem = item;
      dialog.querySelector('#dialog-title').textContent = item.name;
      dialog.querySelector('#dialog-description').textContent = item.brief || item.description;
      picture.src = item.image;
      picture.alt = item.name + ' gameplay thumbnail';
      const meta = dialog.querySelector('[data-dialog-game-meta]');
      meta.replaceChildren(); meta.hidden = !item.split;
      if (item.split) {
        const badge = document.createElement('b'); badge.className = 'split-badge'; badge.dataset.split = item.split; badge.textContent = item.split;
        const genre = document.createElement('span'); genre.textContent = item.genre;
        meta.append(badge, genre);
      }
      const goal = dialog.querySelector('[data-dialog-goal]');
      const gameplay = dialog.querySelector('[data-dialog-gameplay]');
      goal.textContent = item.goal || '';
      gameplay.textContent = item.gameplay || '';
      goal.parentElement.hidden = !item.goal;
      gameplay.parentElement.hidden = !item.gameplay;
      watch.hidden = !item.motionId;
      dialog.showModal();
      document.body.classList.add('modal-open');
      document.dispatchEvent(new Event('a2z-game-dialog-change'));
    });
    watch.addEventListener('click', () => {
      const id = currentItem?.motionId;
      if (id) window.A2Z_PLAY_GAME?.(id);
    });
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      document.dispatchEvent(new Event('a2z-game-dialog-change'));
    });
  }

  document.querySelectorAll('[data-recorded-revisions]').forEach(section => {
    const buttons = Array.from(section.querySelectorAll('[data-recorded-select]'));
    const pairs = Array.from(section.querySelectorAll('[data-recorded-pair]'));
    const play = section.querySelector('[data-play-pair]');
    const stop = section.querySelector('[data-pause-pair]');
    let selected = 0;
    function pauseAll() { section.querySelectorAll('video').forEach(v => v.pause()); }
    function select(index) {
      pauseAll(); selected = index;
      pairs.forEach((pair, i) => {
        pair.hidden = i !== index;
        if (i === index) pair.querySelectorAll('video').forEach(v => { if (!v.getAttribute('src')) v.src = v.dataset.src; });
      });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    buttons.forEach((button, i) => button.addEventListener('click', () => select(i)));
    play.addEventListener('click', () => {
      pairs[selected].querySelectorAll('video').forEach(video => {
        video.currentTime = 0; video.muted = true; video.play().catch(() => {});
      });
    });
    stop.addEventListener('click', pauseAll);
    window.addEventListener('hashchange', () => { if (!section.getClientRects().length) pauseAll(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pauseAll(); }).observe(section);
    select(0);
  });
  document.addEventListener('visibilitychange', () => {
    updateHero();
    if (document.hidden) dialog?.querySelector('video')?.pause();
  });
})();

/* Continuous ambient gameplay footage. */
(function initAmbientGameplay() {
  const section = document.querySelector('[data-motion-section]');
  if (!section) return;
  const video = section.querySelector('[data-motion-video]');
  const toggle = section.querySelector('[data-motion-toggle]');
  const label = section.querySelector('[data-motion-toggle-label]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const gameplayClips = {
    'video-ssitgim':'assets/media/ssitgim.mp4',
    'video-bloom-or-weed':'assets/media/bloom-or-weed.mp4',
    'video-acting-human-again':'assets/media/acting-human-again.mp4',
    'video-last-match':'assets/media/last-match.mp4',
    'video-whispers-revision':'assets/media/whispers-revision.mp4',
    'video-abyssal-chain':'assets/media/abyssal-showcase.mp4',
    'video-chroma-bastion':'assets/media/chroma-showcase.mp4',
    'video-clockwork-cascade':'assets/media/clockwork-showcase.mp4'
  };
  let inView = false, userPaused = reduced.matches;
  function updateControl() {
    if (!toggle || !label) return;
    label.textContent = userPaused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.setAttribute('aria-label', `${userPaused ? 'Play' : 'Pause'} background gameplay`);
    toggle.classList.toggle('is-paused', userPaused);
    toggle.querySelector('.ambient-toggle-icon').textContent = userPaused ? '▶' : 'Ⅱ';
  }
  function sync() {
    updateControl();
    const shouldPlay = inView && !userPaused && !document.hidden && section.getClientRects().length && !document.querySelector('#game-dialog[open]');
    if (!shouldPlay) { video.pause(); return; }
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.muted = true;
    video.play().catch(error => {
      if (error.name === 'AbortError' || !inView) return;
      userPaused = true;
      updateControl();
    });
  }
  video.addEventListener('error', () => { userPaused = true; updateControl(); });
  toggle?.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; sync();
  }, {threshold:.12}).observe(section.querySelector('.motion-cinema'));
  else { inView = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('a2z-game-dialog-change', sync);
  window.addEventListener('hashchange', () => {
    if (!section.getClientRects().length) { inView = false; video.pause(); }
  });
  reduced.addEventListener('change', event => { userPaused = event.matches; sync(); });
  const profile = document.getElementById('game-dialog');
  let profilePlayer = null;
  function clearProfileVideo() {
    if (!profilePlayer) return;
    profilePlayer.pause();
    profilePlayer.parentElement.hidden = true;
    profilePlayer.removeAttribute('src');
    profilePlayer.load();
  }
  profile?.addEventListener('close', clearProfileVideo);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-media-id]')) clearProfileVideo();
  });
  window.A2Z_PLAY_GAME = id => {
    const source = gameplayClips[id];
    if (!source || !profile) return;
    if (!profilePlayer) {
      const frame = document.createElement('div');
      frame.className = 'profile-gameplay';
      profilePlayer = document.createElement('video');
      profilePlayer.controls = true;
      profilePlayer.playsInline = true;
      profilePlayer.muted = true;
      profilePlayer.loop = true;
      profilePlayer.preload = 'metadata';
      frame.append(profilePlayer);
      profile.querySelector('.profile-heading').after(frame);
    }
    profilePlayer.setAttribute('aria-label', profile.querySelector('#dialog-title').textContent + ' gameplay');
    profilePlayer.parentElement.hidden = false;
    const resolved = window.A2Z_PREVIEW_ASSETS?.[source] || source;
    if (profilePlayer.getAttribute('src') !== resolved) profilePlayer.src = resolved;
    profilePlayer.play().catch(() => {});
    profilePlayer.scrollIntoView({block:'nearest',behavior:'instant'});
  };
  sync();
})();



/* Adaptive playtest: explore, initialize a separate test, and gather trace evidence. */
(() => {
  const phases = ['Explore from the start', 'Observe an unmet precondition', 'Initialize a targeted adversarial test', 'Play forward and observe', 'Link evidence to requirements'];
  const thresholds = [0, 5200, 6900, 8200, 12500];
  const duration = 14000;
  document.querySelectorAll('[data-adaptive-lab]').forEach(lab => {
    if (lab.dataset.adaptiveReady) return;
    lab.dataset.adaptiveReady = 'true';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const toggle = lab.querySelector('[data-adaptive-toggle]');
    const label = lab.querySelector('[data-adaptive-toggle-label]');
    const status = lab.querySelector('[data-adaptive-status]');
    let paused = false, visible = false, frame = 0, previous = 0, elapsed = 0;
    const showPhase = () => {
      const phase = reduce.matches ? 4 : thresholds.reduce((found, start, index) => elapsed >= start ? index : found, 0);
      lab.dataset.adaptivePhase = String(phase);
      status.textContent = phases[phase];
    };
    const tick = time => {
      if (!frame) return;
      if (previous) elapsed = (elapsed + Math.min(time - previous, 100)) % duration;
      previous = time;
      showPhase();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const running = visible && !lab.closest('[data-method-suspended="true"]') && !paused && !reduce.matches && !document.hidden;
      lab.classList.toggle('is-running', running);
      toggle.hidden = reduce.matches;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Play playtest animation' : 'Pause playtest animation');
      toggle.firstElementChild.textContent = paused ? '▶' : 'Ⅱ';
      label.textContent = paused ? 'Play' : 'Pause';
      if (running && !frame) { previous = 0; frame = requestAnimationFrame(tick); }
      else if (!running && frame) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
      showPhase();
    };
    toggle.addEventListener('click', () => { paused = !paused; sync(); });
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('a2z-method-visibility', sync);
    reduce.addEventListener('change', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .15 }).observe(lab);
    else visible = true;
    sync();
  });
})();
/* End adaptive playtest animation. */

/* Evidence cases. */
// Evidence magnifies in a fixed inset. Original pixels never travel across the frame.
(function initEvidenceCases() {
  const gallery=document.querySelector('[data-evidence-gallery]');if(!gallery)return;
  gallery.dataset.ecStaged='true';
  const cases=[
  {
    "id": "siege",
    "name": "Siege Deck 2D",
    "title": "A reward skips the rule.",
    "axis": "Rule: Source pass → Playtest violation",
    "requirement": "At 30 cards, remove one before any card gain.",
    "observed": "The deck grows from 30 to 31. No card was removed.",
    "frames": [
      {
        "src": "assets/evidence/siege-before.webp",
        "label": "Before reward",
        "alt": "Full Siege Deck 2D reward screen before reward acceptance, showing a full deck of 30 cards.",
        "boxes": [
          [
            1470,
            393,
            265,
            113
          ]
        ]
      },
      {
        "src": "assets/evidence/siege-after.webp",
        "label": "After reward",
        "alt": "Full Siege Deck 2D reward screen after reward acceptance, showing 31 of 30 cards.",
        "boxes": [
          [
            1470,
            393,
            265,
            113
          ],
          [
            485,
            445,
            270,
            370
          ]
        ]
      }
    ],
    "initial": 1,
    "details": [
      {
        "src": "assets/evidence/siege-before.webp",
        "label": "Before reward",
        "caption": "The deck is already full.",
        "rect": [
          1475,
          382,
          285,
          142
        ]
      },
      {
        "src": "assets/evidence/siege-after.webp",
        "label": "After reward",
        "caption": "One card added. No card removed.",
        "rect": [
          1475,
          382,
          285,
          142
        ]
      }
    ],
    "document": {
      "file": "siege_deck_2d.md",
      "section": "Deckbuilding Rewards",
      "label": "Skip/removal",
      "before": [
        "Skip opens the current deck and requires removal of one card",
        "Other removals occur only at a Deck event, camp, Refit, Sacrifice, or when the deck would exceed thirty."
      ],
      "focus": "A gain at thirty opens removal first",
      "after": [
        "canceling removal cancels the gain.",
        "Deck minimum is five, so removal actions are disabled at five."
      ],
      "line": [
        749,
        752
      ],
      "emphasis": "opens removal first"
    },
    "inset": [
      0.05,
      0.48,
      0.61
    ],
    "zoomRect": [
      1475,
      382,
      285,
      142
    ]
  },
  {
    "id": "rainwright",
    "name": "Rainwright",
    "title": "The warning arrives too late.",
    "axis": "Rule: Source pass → Playtest violation",
    "requirement": "While build input is held, an unaffordable preview turns red.",
    "observed": "Only 8% water. The unaffordable preview stays teal.",
    "frames": [
      {
        "src": "assets/evidence/rain-affordable.webp",
        "label": "Affordable build",
        "alt": "Rainwright while build input is held with 50% water, showing an affordable teal preview.",
        "boxes": [
          [
            44,
            34,
            310,
            160
          ],
          [
            730,
            750,
            285,
            135
          ]
        ]
      },
      {
        "src": "assets/evidence/rain-unaffordable.webp",
        "label": "Unaffordable build",
        "alt": "Rainwright while build input is held with 8% water, showing a teal preview instead of the required red warning.",
        "boxes": [
          [
            44,
            34,
            310,
            160
          ],
          [
            730,
            750,
            285,
            135
          ]
        ]
      }
    ],
    "initial": 1,
    "details": [
      {
        "src": "assets/evidence/rain-affordable.webp",
        "label": "50% water",
        "caption": "Affordable preview.",
        "rect": [
          700,
          710,
          380,
          205
        ]
      },
      {
        "src": "assets/evidence/rain-unaffordable.webp",
        "label": "8% water",
        "caption": "Still teal when unaffordable.",
        "rect": [
          700,
          710,
          380,
          205
        ]
      }
    ],
    "document": {
      "file": "rainwright.md",
      "section": "Transform",
      "label": "UX",
      "before": [
        "spends gauge DBT-16 on success only",
        "a ghost preview of the resolved construct renders at the build point during the decide window (mouse) or on button-down (gamepad)"
      ],
      "focus": "tinted red if the attempt would fail",
      "after": [
        "Construct-count pips update in the HUD on spawn."
      ],
      "line": [
        104,
        108
      ],
      "emphasis": "tinted red"
    },
    "inset": [
      0.49,
      0.14,
      0.47
    ],
    "zoomRect": [
      700,
      710,
      380,
      205
    ]
  },
  {
    "id": "chroma",
    "name": "Chroma Bastion",
    "title": "The score loses its link.",
    "axis": "Rule: Source pass → Playtest violation",
    "requirement": "When the run ends, stage its score for submission.",
    "observed": "4,869 points earned. Only 2,760 staged.",
    "frames": [
      {
        "src": "assets/evidence/chroma-after.webp",
        "label": "Run complete",
        "alt": "Chroma Bastion completed run screen displaying 4,869 points and last-run staged score 2,760.",
        "boxes": [
          [
            1435,
            685,
            180,
            58
          ],
          [
            639,
            842,
            330,
            48
          ]
        ]
      }
    ],
    "initial": 0,
    "details": [
      {
        "src": "assets/evidence/chroma-after.webp",
        "label": "Completed run",
        "caption": "4,869 points earned.",
        "rect": [
          1400,
          661,
          255,
          104
        ]
      },
      {
        "src": "assets/evidence/chroma-after.webp",
        "label": "Staged for submission",
        "caption": "2,760 points staged.",
        "rect": [
          620,
          810,
          395,
          100
        ]
      }
    ],
    "document": {
      "file": "chroma_bastion.md",
      "section": "Leaderboard (Endless)",
      "label": "Transitions",
      "before": [
        "global top scores (rank, name, score) from the online service",
        "navigate tabs/rows; Confirm on Submit (posts last run's score); Cancel→Title."
      ],
      "focus": "from Endless run end → auto-opens here with the run's score staged for submit.",
      "after": [
        "Autosave & error feedback"
      ],
      "line": [
        869,
        874
      ],
      "emphasis": "the run's score"
    },
    "inset": [
      0.055,
      0.13,
      0.61
    ],
    "zoomRect": [
      620,
      810,
      395,
      100
    ]
  },
  {
    "id": "neon",
    "name": "Neon Spray",
    "title": "A menu misses the screen.",
    "axis": "Replay evidence",
    "requirement": "The pause menu includes a readable settings entry.",
    "observed": "The settings label is clipped by the screen edge.",
    "frames": [
      {
        "src": "assets/evidence/neon-pause.webp",
        "label": "Pause menu",
        "alt": "Neon Spray replay frame showing the settings label clipped off the left screen edge.",
        "boxes": [
          [
            0,
            26,
            155,
            64
          ]
        ]
      }
    ],
    "initial": 0,
    "details": [
      {
        "src": "assets/evidence/neon-pause.webp",
        "label": "Pause-menu detail",
        "caption": "The start of “SETTINGS” is clipped.",
        "rect": [
          0,
          24,
          190,
          84
        ]
      }
    ],
    "document": {
      "file": "neon_spray.md",
      "section": "Pause Menu (overlay)",
      "label": "Contents",
      "before": [
        "dimmed live stage behind"
      ],
      "focus": "buttons Resume, Restart Stage, Settings, Quit to Map",
      "after": [
        "a mini-legend (controls). Shows current score/timer frozen.",
        "navigate; Confirm; Cancel = Resume; Restart bound to X/R (Input Map)."
      ],
      "line": [
        927,
        935
      ],
      "emphasis": "Settings"
    },
    "inset": [
      0.52,
      0.16,
      0.44
    ],
    "zoomRect": [
      0,
      24,
      190,
      84
    ]
  },
  {
    "id": "seamline",
    "name": "Seamline",
    "title": "The choice does not carry over.",
    "axis": "Observed runtime · Starting character",
    "requirement": "Start the run with the character chosen at the Stable Point.",
    "observed": "Sion is selected. The first combat room starts with Haewon.",
    "frames": [
      {
        "src": "assets/evidence/seamline-before.webp",
        "label": "Sion selected",
        "alt": "Seamline's Stable Point shows TRACTION LINE SELECTED, SION, and RESONANCE 0 above the reward wall.",
        "boxes": [
          [
            1004,
            368,
            98,
            33
          ]
        ]
      },
      {
        "src": "assets/evidence/seamline-after.webp",
        "label": "Haewon starts",
        "alt": "The first Seamline combat room shows Haewon's teal portrait active and her teal character in the arena, while Sion's crimson portrait is dimmed.",
        "boxes": [
          [
            37,
            40,
            106,
            102
          ],
          [
            912,
            741,
            146,
            159
          ]
        ]
      }
    ],
    "initial": 1,
    "details": [
      {
        "src": "assets/evidence/seamline-before.webp",
        "label": "Chosen survivor",
        "caption": "Sion is selected.",
        "rect": [
          950,
          350,
          190,
          70
        ]
      },
      {
        "src": "assets/evidence/seamline-after.webp",
        "label": "First combat room",
        "caption": "Haewon is active. Sion is dimmed.",
        "rect": [
          25,
          28,
          230,
          123
        ]
      }
    ],
    "document": {
      "file": "seamline.md",
      "section": "Stable Point",
      "label": "Actions",
      "before": [
        "Contents: two character stands",
        "a 12-sigil reward wall (all always usable)"
      ],
      "focus": "pick starting character",
      "after": [
        "pick 1 of 12 initial rewards, set Resonance tier, view Archive, Start Run.",
        "Exit: Start Run → first Path Selection."
      ],
      "line": [
        639,
        641
      ],
      "emphasis": "starting character"
    },
    "inset": [
      0.53,
      0.16,
      0.43
    ],
    "zoomRect": [
      25,
      28,
      230,
      123
    ]
  },
  {
    "id": "magma",
    "name": "Magma Arc",
    "title": "Size changes. The color cue does not.",
    "axis": "Rendered evidence · Arrow-size cue",
    "requirement": "Use pale cyan for XS arrows and deep crimson for XL arrows.",
    "observed": "XS and XL arrows keep the same gold coloring. The required color cue is missing.",
    "frames": [
      {
        "src": "assets/evidence/magma-xs.webp",
        "label": "XS arrow",
        "alt": "Magma Arc with a normal XS arrow in flight. The arrow uses a gold sprite rather than the GDD-required pale cyan.",
        "boxes": [
          [
            935,
            330,
            50,
            85
          ]
        ]
      },
      {
        "src": "assets/evidence/magma-xl.webp",
        "label": "XL arrow",
        "alt": "Magma Arc with a normal XL arrow in flight. The arrow uses a gold sprite rather than the GDD-required deep crimson.",
        "boxes": [
          [
            935,
            330,
            50,
            85
          ]
        ]
      }
    ],
    "initial": 1,
    "details": [
      {
        "src": "assets/evidence/magma-xs.webp",
        "label": "XS arrow",
        "caption": "XS arrow remains gold instead of pale cyan.",
        "rect": [
          935,
          349,
          50,
          50
        ]
      },
      {
        "src": "assets/evidence/magma-xl.webp",
        "label": "XL arrow",
        "caption": "XL arrow remains gold instead of deep crimson.",
        "rect": [
          915,
          330,
          90,
          90
        ]
      }
    ],
    "document": {
      "file": "magma_arc.md",
      "section": "Size Arrow",
      "label": "Size → color",
      "before": [
        "Slender bolt with a fletch",
        "size → color ramp (DBT-COLOR)"
      ],
      "focus": "XS pale cyan, S teal, M amber, L orange, XL deep crimson",
      "after": [
        "so the player reads size at a glance.",
        "Silhouette scales with width"
      ],
      "line": [
        201,
        204
      ],
      "emphasis": "XS pale cyan"
    },
    "inset": [
      0.07,
      0.2,
      0.55
    ],
    "zoomRect": [
      925,
      333,
      70,
      87
    ]
  },
  {
    "id": "fable-knot",
    "name": "The Fable Knot",
    "title": "The starting connection is missing.",
    "axis": "Observed runtime · Puzzle setup",
    "requirement": "Puzzle 1-02 must start with Ru–Follow–Bell active.",
    "observed": "Chapter 1-02 starts with zero active threads.",
    "frames": [
      {
        "src": "assets/evidence/fable-second.webp",
        "label": "Puzzle 1-02 · Turn 0",
        "alt": "The Fable Knot opens Break the Good Rule, puzzle 1-02, at turn 0 with Active threads 0. The Ru portrait sits below the relationship strip instead of completing Ru–Follow–Bell.",
        "boxes": [
          [
            1265,
            448,
            240,
            98
          ],
          [
            65,
            36,
            250,
            45
          ]
        ]
      }
    ],
    "initial": 0,
    "details": [
      {
        "src": "assets/evidence/fable-second.webp",
        "label": "Chapter 1-02 · Turn 0",
        "caption": "Turn 0. Active threads: 0.",
        "rect": [
          1265,
          448,
          240,
          98
        ]
      }
    ],
    "document": {
      "file": "fable_knot.md",
      "section": "First Ten Minutes",
      "label": "Chapter 1-02",
      "before": [
        "The player completes Ru–Follow–Bell, observes Ru react after each successful move, reaches the Ending Space, receives the first Binding Stamp, and returns to the map."
      ],
      "focus": "Chapter 1-02 starts with Ru–Follow–Bell active.",
      "after": [
        "The player must break that valid rule before Ru reaches Ink and reconnect Ru to Noa."
      ],
      "line": [
        413,
        414
      ],
      "emphasis": "starts with Ru–Follow–Bell active"
    },
    "inset": [
      0.54,
      0.64,
      0.4
    ],
    "zoomRect": [
      1265,
      448,
      240,
      98
    ]
  }
];
  const viewport=gallery.querySelector('[data-ec-viewport]'),inset=gallery.querySelector('[data-ec-inset]');
  const mainImage=gallery.querySelector('[data-ec-image]'),frameControls=gallery.querySelector('[data-ec-frames]'),roiHost=gallery.querySelector('[data-ec-boxes]'),connector=gallery.querySelector('[data-ec-link]'),line=connector.querySelector('path');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),NS='http://www.w3.org/2000/svg';
  let caseIndex=0,frameIndex=cases[0].initial,visible=false,serial=0,animations=[],timers=[],sizeKey='';
  const text=(selector,value)=>{gallery.querySelector(selector).textContent=value;};
  function cropElement(detail){
    const[x,y,w,h]=detail.rect,crop=document.createElement('span');crop.className='ec-crop';crop.style.aspectRatio=`${w} / ${h}`;crop.style.maxWidth=`calc(var(--ec-crop-height, 90px) * ${w} / ${h})`;
    const img=document.createElement('img');img.src=detail.src;img.alt=detail.caption;img.width=1920;img.height=1080;img.style.width=`${1920/w*100}%`;img.style.left=`${-x/w*100}%`;img.style.top=`${-y/h*100}%`;crop.append(img);return crop;
  }
  function activeDetail(){const selected=cases[caseIndex],frame=selected.frames[frameIndex];let index=-1;selected.details.forEach((detail,i)=>{if(detail.src===frame.src)index=i;});return Math.max(0,index);}
  function stop(){serial++;animations.forEach(a=>a.cancel());animations=[];timers.forEach(clearTimeout);timers=[];}
  function reset(){stop();gallery.dataset.ecPhase='idle';inset.style.opacity='0';inset.style.transform='none';connector.style.opacity='0';roiHost.querySelectorAll('rect').forEach(r=>{r.style.opacity='0';r.style.strokeDashoffset='1';});}
  function animate(el,keyframes,options){const a=el.animate(keyframes,{fill:'both',...options});animations.push(a);return a;}
  function drawRegions(){
    const selected=cases[caseIndex],frame=selected.frames[frameIndex],detail=selected.details[activeDetail()];
    const overlap=(a,b)=>{let ix=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])),iy=Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return ix*iy/Math.min(a[2]*a[3],b[2]*b[3]);};
    const regions=[detail.rect,...frame.boxes.filter(r=>overlap(r,detail.rect)<.55)];
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 1920 1080');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('ec-roi-outline');
    regions.forEach(([x,y,w,h],i)=>{const r=document.createElementNS(NS,'rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('pathLength','1');r.setAttribute('vector-effect','non-scaling-stroke');r.classList.add('ec-roi-rect');if(i)r.classList.add('ec-roi-context');svg.append(r);});roiHost.replaceChildren(svg);
  }
  function geometry(){
    const selected=cases[caseIndex],index=activeDetail(),detail=selected.details[index],crop=inset.children[index]?.querySelector('.ec-crop');if(!crop)return null;
    const v=viewport.getBoundingClientRect(),b=crop.getBoundingClientRect(),vw=viewport.clientWidth,vh=viewport.clientHeight;if(!vw||!vh||!b.width||!b.height)return null;
    const[x,y,w,h]=detail.rect,tx=b.left-v.left-viewport.clientLeft,ty=b.top-v.top-viewport.clientTop;
    line.setAttribute('pathLength','1');line.setAttribute('d',`M${x+w/2} ${y+h/2} L${(tx+b.width/2)/vw*1920} ${(ty+b.height/2)/vh*1080}`);
    return true;
  }
  function settle(){
    stop();geometry();gallery.dataset.ecPhase='settled';connector.style.opacity='.72';inset.style.opacity='1';inset.style.transform='none';roiHost.querySelectorAll('rect').forEach(r=>{r.style.opacity='1';r.style.strokeDashoffset='0';});
  }
  async function playFocus(){
    reset();const token=serial;
    if(reduced.matches){settle();return;}
    if(!visible||document.hidden)return;
    await Promise.all([mainImage,...inset.querySelectorAll('img')].map(im=>im.decode?.().catch(()=>{})));
    await new Promise(requestAnimationFrame);
    if(token!==serial||!visible||document.hidden)return;
    if(!geometry()){settle();return;}
    gallery.dataset.ecPhase='focus';
    const easing='cubic-bezier(.22,.61,.36,1)';
    roiHost.querySelectorAll('rect').forEach((r,i)=>animate(r,[{opacity:0,strokeDashoffset:1},{opacity:1,strokeDashoffset:0}],{duration:520,delay:i?60:0,easing}));
    animate(connector,[{opacity:0},{opacity:.72}],{duration:500,delay:170,easing});
    animate(inset,[{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}],{duration:650,delay:150,easing});
    for(const[delay,phase]of[[150,'magnify'],[840,'settled']])timers.push(setTimeout(()=>{if(token===serial)gallery.dataset.ecPhase=phase;},delay));
  }
  function renderFrame(){
    reset();const selected=cases[caseIndex],frame=selected.frames[frameIndex];mainImage.src=frame.src;mainImage.alt=frame.alt;drawRegions();
    frameControls.replaceChildren();if(selected.frames.length>1)selected.frames.forEach((f,i)=>{const button=document.createElement('button');button.type='button';button.textContent=f.label;button.setAttribute('aria-pressed',String(i===frameIndex));button.addEventListener('click',()=>{if(frameIndex===i)return;frameIndex=i;renderFrame();playFocus();});frameControls.append(button);});
  }
  function renderDocument(doc){
    text('[data-ec-doc-section]',doc.section);text('[data-ec-doc-label]',doc.label);
    for(const[key,selector]of[['before','[data-ec-doc-before]'],['after','[data-ec-doc-after]']]){const node=gallery.querySelector(selector);node.replaceChildren();doc[key].forEach(value=>{const p=document.createElement('p');p.textContent=value;node.append(p);});}
    const focus=gallery.querySelector('[data-ec-doc-focus]');focus.replaceChildren();const at=doc.focus.indexOf(doc.emphasis);if(at<0){focus.textContent=doc.focus;return;}focus.append(document.createTextNode(doc.focus.slice(0,at)));const mark=document.createElement('mark');mark.textContent=doc.emphasis;focus.append(mark,document.createTextNode(doc.focus.slice(at+doc.emphasis.length)));
  }
  function renderCase(index){
    reset();caseIndex=index;const selected=cases[index];frameIndex=selected.initial;
    gallery.querySelectorAll('[data-ec-case]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.ecCase)===index)));
    text('[data-ec-name]',selected.name);text('[data-ec-observed]',selected.observed);text('[data-ec-axis]',selected.axis);renderDocument(selected.document);
    inset.replaceChildren();inset.classList.toggle('is-single',selected.details.length===1);inset.style.setProperty('--ec-inset-left',`${selected.inset[0]*100}%`);inset.style.setProperty('--ec-inset-top',`${selected.inset[1]*100}%`);inset.style.setProperty('--ec-inset-width',`${selected.inset[2]*100}%`);
    selected.details.forEach(detail=>{const figure=document.createElement('figure');figure.className='ec-inset-detail';const label=document.createElement('figcaption');label.className='ec-inset-label';label.textContent=detail.label;const pad=document.createElement('span');pad.className='ec-inset-crop-pad';pad.append(cropElement(detail));figure.append(label,pad);inset.append(figure);});
    renderFrame();playFocus();
  }
  gallery.querySelectorAll('[data-ec-case]').forEach(button=>button.addEventListener('click',()=>{const next=Number(button.dataset.ecCase);if(next!==caseIndex)renderCase(next);}));
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>entries.forEach(entry=>{const next=entry.isIntersecting&&entry.intersectionRatio>=.15;if(next===visible)return;visible=next;if(visible)playFocus();else reset();}),{threshold:[0,.15]}).observe(viewport);else visible=true;
  if('ResizeObserver'in window)new ResizeObserver(()=>{const key=`${viewport.clientWidth}:${viewport.clientHeight}`;if(key===sizeKey)return;sizeKey=key;if(visible&&gallery.dataset.ecPhase!=='idle')settle();}).observe(viewport);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else if(visible)playFocus();});
  reduced.addEventListener('change',()=>{if(reduced.matches)settle();else if(visible)playFocus();});
  renderCase(0);
})();




/* Editorial metric motion. */
(() => {
  document.querySelectorAll('.facts > div > strong, .finding-numbers > div > strong, .split-finding > strong, .split-finding > p > b, .revision-lift > strong, .revision-bars b, [data-count-to]').forEach(registerMetricCounter);
  const revisionBars = document.querySelectorAll('.revision-bars i');
  const revisionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('metric-bar-revealed');
      revisionObserver.unobserve(entry.target);
    });
  }, {threshold:0.25}) : null;
  revisionBars.forEach((bar,index) => {
    bar.style.setProperty('--metric-delay', `${index * 130}ms`);
    if (!reducedMotion.matches && revisionObserver) {
      bar.classList.add('metric-bar-ready'); revisionObserver.observe(bar);
    }
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) revisionBars.forEach(bar => {
      revisionObserver?.unobserve(bar); bar.classList.add('metric-bar-revealed');
    });
  });

  // The arrows retain the dependency direction. A short light pulse traces
  // downstream reach back toward each prerequisite; weights remain exact.
  document.querySelectorAll('.dependency-weighted').forEach(graph => {
    const button = graph.querySelector('[data-weight-motion]');
    const status = graph.parentElement.querySelector('[data-weight-status]');
    const supportsMotion = typeof Element.prototype.animate === 'function';
    const duration = 4600;
    let animations = [], inView = false, userPaused = false, done = false, hasStarted = false;
    let clock = null;
    const pulsePaths = [];
    graph.querySelectorAll('svg').forEach(svg => {
      svg.querySelectorAll('.dw-edge').forEach((path,index) => {
        const pulse = path.cloneNode(false);
        pulse.setAttribute('class','dw-flow-pulse');
        pulse.setAttribute('pathLength','100');
        pulse.dataset.edgeIndex = index;
        pulse.setAttribute('aria-hidden','true');
        path.parentElement.appendChild(pulse);
        pulsePaths.push(pulse);
      });
    });
    function updateButton() {
      if (!button) return;
      button.textContent = done ? 'Replay' : userPaused ? 'Play' : 'Pause';
      button.setAttribute('aria-label', done ? 'Replay rule-weight animation' : userPaused ? 'Play rule-weight animation' : 'Pause rule-weight animation');
      button.setAttribute('aria-pressed',String(!done && userPaused));
    }
    function sync() {
      const play = inView && !graph.closest('[data-method-suspended="true"]') && !document.hidden && !userPaused && !done && !reducedMotion.matches;
      animations.forEach(animation => play ? animation.play() : animation.pause());
      graph.classList.toggle('dw-motion-running',play);
      updateButton();
    }
    function finish() {
      done = true;
      animations.forEach(animation => { try { animation.finish(); } catch {} });
      graph.classList.remove('dw-motion-running');
      if (status) status.textContent = 'Greater downstream reach, greater weight.';
      updateButton();
    }
    function start() {
      animations.forEach(animation => animation.cancel());
      animations = []; clock = null; done = false; hasStarted = true; userPaused = false;
      if (!supportsMotion || reducedMotion.matches) { finish(); return; }
      const delays = [3000,2000,2000,1000,0,0];
      graph.querySelectorAll('.dw-node').forEach(node => {
        const index = Number([...node.classList].find(name => /^dw-node-\d$/.test(name)).split('-').pop());
        const disc = node.querySelector('.dw-disc');
        const finalWeight = Number(node.querySelector('.dw-weight')?.textContent || 1);
        const glow = 4 + finalWeight * 9;
        const animation = disc.animate([
          {transform:'scale(.82)', filter:'saturate(.15) brightness(.52) drop-shadow(0 0 0px rgba(249,66,58,0))'},
          {offset:.5,transform:'scale(1.055)',filter:`saturate(1) brightness(1.05) drop-shadow(0 0 ${glow}px rgba(249,66,58,.46))`},
          {transform:'scale(1)',filter:'saturate(1) brightness(1) drop-shadow(0 0 0px rgba(249,66,58,0))'}
        ],{duration:950,delay:delays[index],fill:'both',easing:'cubic-bezier(.2,.7,.25,1)'});
        animation.pause(); animations.push(animation);
      });
      pulsePaths.forEach(pulse => {
        const index = Number(pulse.dataset.edgeIndex);
        const delay = index >= 3 ? 580 : index >= 1 ? 1580 : 2580;
        const animation = pulse.animate([
          {strokeDashoffset:'-100',opacity:0},
          {offset:.15,strokeDashoffset:'-84',opacity:1},
          {offset:.85,strokeDashoffset:'-4',opacity:1},
          {strokeDashoffset:'12',opacity:0}
        ],{duration:650,delay,fill:'both',easing:'linear'});
        animation.pause(); animations.push(animation);
      });
      clock = graph.animate([{outlineColor:'transparent'},{outlineColor:'transparent'}],{duration,fill:'both'});
      clock.pause(); animations.push(clock);
      clock.onfinish = finish;
      if (status) status.textContent = 'Trace downstream reach back to each prerequisite.';
      sync();
    }
    button?.addEventListener('click', () => {
      if (done) start(); else { userPaused = !userPaused; sync(); }
    });
    document.addEventListener('visibilitychange',sync);
    document.addEventListener('a2z-method-visibility',sync);
    reducedMotion.addEventListener('change',event => { if (event.matches) finish(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        if (inView && !hasStarted) start(); else sync();
      },{threshold:.35}).observe(graph);
    } else { inView = true; start(); }
    document.querySelectorAll('[data-method-target="source"]').forEach(tab => tab.addEventListener('click', () => {
      if (graph.closest('[data-method-panel="source"]')) start();
    }));
  });
})();




/* Design horizon. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-design-horizon]').forEach(section => {
    const video = section.querySelector('[data-horizon-video]');
    let inView = false, playRequest = 0;
    function sync() {
      const request = ++playRequest;
      const play = inView && !reduce.matches && !document.hidden && section.getClientRects().length > 0;
      section.dataset.playing = String(play);
      if (!play) { video.pause(); return; }
      if (!video.getAttribute('src')) video.src = window.A2Z_PREVIEW_ASSETS?.[video.dataset.src] || video.dataset.src;
      video.muted = true;
      video.play().catch(() => { if(request===playRequest) section.dataset.playing = 'false'; });
    }
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('hashchange',sync);
    reduce.addEventListener('change',sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      sync();
    },{threshold:.12}).observe(section);
    else { inView = true; sync(); }
  });
})();

/* Gdd document rollout. */
(function initGddArc(){
 const root=document.querySelector('[data-gdd-rollout]');if(!root)return;
 const pairs=[...root.querySelectorAll('[data-gdd-pair]')],stage=root.querySelector('[data-gdd-stage]'),status=root.querySelector('[data-gdd-announcement]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),count=pairs.length;
 const rows=pairs.map(pair=>[...pair.querySelectorAll('[data-gdd-requirement]')]);
 const masthead=document.querySelector('.masthead');
 let current=0,rowIndex=0,step=520,visible=false,hover=false,focused=false,manual=false,moving=false,focusTimer=0,arcTimer=0,visibilityFrame=0,touchStart=null,animations=[],inputMode='pointer',focusBox=null;
 const wrap=value=>((value+count/2)%count+count)%count-count/2;
 const relative=index=>wrap(index-current);
 function pose(position){
  const angle=position*.40,radius=step/Math.sin(.40),distance=Math.abs(position);
  const x=radius*Math.sin(angle),y=radius*(1-Math.cos(angle))*.44;
  const scale=.39+.61*Math.exp(-2.4*distance*distance);
  const opacity=distance<1?1-.43*distance:Math.max(0,.57-(distance-1)*.40);
  return{transform:`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${(position*5).toFixed(2)}deg) scale(${scale.toFixed(4)})`,opacity:opacity.toFixed(3)};
 }
 function apply(){
  pairs.forEach((pair,index)=>{
   const position=relative(index),distance=Math.abs(position),focus=distance===0;
   pair.hidden=false;Object.assign(pair.style,pose(position));pair.style.zIndex=String(10-Math.round(distance));
   pair.classList.toggle('is-gdd-focus',focus);pair.classList.toggle('is-gdd-neighbor',distance===1);
   pair.setAttribute('aria-hidden',String(!focus));rows[index].forEach(row=>row.tabIndex=focus?0:-1);
   const select=pair.querySelector('[data-gdd-select]');select.setAttribute('aria-label','Read '+pair.querySelector('.gdd-document-game').textContent+' design document');
   if(distance<2)pair.querySelector('img').loading='eager';
  });
  root.dataset.gddActive=String(current);
  const paper=pairs[current].querySelector('.gdd-document').getBoundingClientRect(),base=stage.getBoundingClientRect();
  if(paper.width>0)focusBox={top:paper.top-base.top,left:paper.left-base.left,width:paper.width,height:paper.height};
 }
 function stopFocusClock(){clearTimeout(focusTimer);focusTimer=0;}
 function stopArcClock(){clearTimeout(arcTimer);arcTimer=0;}
 function keyboardReading(){return inputMode==='keyboard'&&rows[current].includes(document.activeElement);}
 function scheduleFocus(){
  if(!visible||document.hidden||moving||keyboardReading()){stopFocusClock();return;}
  if(focusTimer)return;
  // Emphasis keeps cycling under the pointer and after manual document navigation.
  // Reduced motion keeps the same cycle with instantaneous, fully readable rows.
  focusTimer=setTimeout(()=>{focusTimer=0;focusRequirement(rowIndex+1);scheduleFocus();},4500);
 }
 function scheduleArc(){
  if(!visible||document.hidden||moving||hover||focused||manual||reduced.matches){stopArcClock();return;}
  if(arcTimer)return;
  // A separate clock reserves a full reading cycle before a document can move.
  arcTimer=setTimeout(()=>{arcTimer=0;navigate(1,false);},18000);
 }
 function schedule(){scheduleFocus();scheduleArc();}
 function focusRequirement(index,isManual=false){
  rowIndex=(index+rows[current].length)%rows[current].length;
  if(isManual){manual=true;stopArcClock();stopFocusClock();}
  rows[current].forEach((row,i)=>{const active=i===rowIndex;row.classList.toggle('is-requirement-focus',active);row.setAttribute('aria-pressed',String(active));});
  root.dataset.gddFocusedRequirement=String(rowIndex);
  if(isManual)schedule();
 }
 function syncVisibility(){
  visibilityFrame=0;
  const paper=pairs[current].querySelector('.gdd-document'),base=stage.getBoundingClientRect();
  const rect=focusBox?{top:base.top+focusBox.top,bottom:base.top+focusBox.top+focusBox.height,left:base.left+focusBox.left,right:base.left+focusBox.left+focusBox.width,width:focusBox.width,height:focusBox.height}:paper.getBoundingClientRect();
  const top=Math.max(0,Math.min(masthead?.getBoundingClientRect().bottom||0,innerHeight*.3));
  const shownHeight=Math.min(rect.bottom,innerHeight)-Math.max(rect.top,top);
  const minimum=Math.min(120,rect.height*.2,innerHeight*.2);
  // Test the focused paper's stable reading position, not the taller arc stage.
  // This also avoids pausing an incoming mobile card before it can reach the center.
  const next=paper.getClientRects().length>0&&rect.width>0&&rect.left<innerWidth&&rect.right>0&&shownHeight>=minimum;
  if(next!==visible){
   visible=next;root.dataset.gddVisible=String(visible);
   animations.forEach(animation=>visible&&!document.hidden?animation.play():animation.pause());
  }
  // Existing clocks are retained during scrolling and route/layout checks.
  schedule();
 }
 function queueVisibility(){if(!visibilityFrame)visibilityFrame=requestAnimationFrame(syncVisibility);}
 function navigate(delta,isManual=true){
  if(isManual){manual=true;stopArcClock();}
  if(moving)return;
  stopFocusClock();stopArcClock();
  const from=pairs.map((_,index)=>relative(index));
  const previousFocus=document.activeElement;
  const focusedPair=previousFocus?.closest('[data-gdd-pair]');
  const keepRowFocus=inputMode==='keyboard'&&rows[current].includes(previousFocus);
  // Never move a focused button offscreen with its departing document. Keep
  // keyboard reading in the new card, and pointer/swipe focus on the stable stage.
  if(focusedPair&&root.contains(focusedPair))stage.focus({preventScroll:true});
  current=(current+delta+count)%count;focusRequirement(0);apply();
  if(keepRowFocus)rows[current][0].focus({preventScroll:true});
  if(isManual)status.textContent=pairs[current].getAttribute('aria-label');
  if(reduced.matches){syncVisibility();return;}
  moving=true;root.classList.add('is-gdd-moving');
  animations=pairs.map((pair,index)=>{
   const start=from[index],end=start-delta;
   if(Math.abs(start)>2&&Math.abs(end)>2)return null;
   const frames=Array.from({length:17},(_,sample)=>pose(start+(end-start)*sample/16));
   return pair.animate(frames,{duration:760,easing:'cubic-bezier(.25,.1,.25,1)'});
  }).filter(Boolean);
  if(!visible||document.hidden)animations.forEach(animation=>animation.pause());
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
   animations=[];moving=false;root.classList.remove('is-gdd-moving');apply();syncVisibility();
  });
 }
 function measure(){
  step=innerWidth<=760?Math.min(440,innerWidth*.88):Math.min(610,Math.max(405,innerWidth*.39));
  if(!moving)apply();queueVisibility();
 }
 root.querySelector('[data-gdd-prev]').addEventListener('click',()=>navigate(-1));
 root.querySelector('[data-gdd-next]').addEventListener('click',()=>navigate(1));
 pairs.forEach((pair,index)=>pair.querySelector('[data-gdd-select]').addEventListener('click',()=>{const position=relative(index);if(Math.abs(position)===1)navigate(position);}));
 rows.forEach((group,pairIndex)=>group.forEach((row,index)=>row.addEventListener('click',()=>{if(pairIndex===current)focusRequirement(index,true);})));
 addEventListener('keydown',()=>{inputMode='keyboard';},{capture:true});
 stage.addEventListener('keydown',event=>{
  focused=true;stopArcClock();
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);}
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();focusRequirement(rowIndex+(event.key==='ArrowDown'?1:-1),true);rows[current][rowIndex].focus({preventScroll:true});}
  scheduleFocus();
 });
 stage.addEventListener('pointerdown',event=>{inputMode='pointer';focused=false;if(event.pointerType!=='mouse')hover=false;schedule();});
 // A pointer should not make the browser scroll to a scaled neighbor card or
 // the stage's large focus box. Retain normal button focus, without auto-scroll.
 // This does not cancel touchstart/touchmove, native vertical pan, or pinch zoom.
 root.addEventListener('mousedown',event=>{
  if(event.button!==0)return;
  const control=event.target.closest('[data-gdd-prev],[data-gdd-next],[data-gdd-requirement],[data-gdd-select],[data-gdd-stage]');
  if(!control||!root.contains(control))return;
  inputMode='pointer';focused=false;
  event.preventDefault();
  (control.matches('[data-gdd-select]')?stage:control).focus({preventScroll:true});
 });
 stage.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover: hover)').matches){hover=true;stopArcClock();}});
 stage.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hover=false;scheduleArc();}});
 stage.addEventListener('focusin',event=>{
  focused=inputMode==='keyboard';
  const row=event.target.closest('[data-gdd-requirement]');
  if(focused&&row)focusRequirement(Number(row.dataset.gddRequirement),true);
  schedule();
 });
 stage.addEventListener('focusout',()=>requestAnimationFrame(()=>{focused=inputMode==='keyboard'&&stage.contains(document.activeElement);schedule();}));
 stage.addEventListener('touchstart',event=>{inputMode='pointer';focused=false;hover=false;stopArcClock();touchStart=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
 stage.addEventListener('touchend',event=>{if(!touchStart||!event.changedTouches.length)return;const t=event.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(dx<0?1:-1);else schedule();},{passive:true});
 stage.addEventListener('touchcancel',()=>{touchStart=null;});
 addEventListener('scroll',queueVisibility,{passive:true});addEventListener('resize',measure,{passive:true});addEventListener('pageshow',measure);
 addEventListener('hashchange',()=>requestAnimationFrame(measure));
 document.addEventListener('visibilitychange',()=>{
  animations.forEach(animation=>visible&&!document.hidden?animation.play():animation.pause());
  syncVisibility();
 });
 reduced.addEventListener('change',()=>{animations.forEach(animation=>animation.finish());schedule();});
 if('IntersectionObserver'in window)new IntersectionObserver(queueVisibility,{threshold:[0,.1,.2,.4,.65,1]}).observe(stage);
 measure();focusRequirement(0);syncVisibility();
})();



/* Source runtime chart. */
(() => {
  document.querySelectorAll('[data-source-runtime-chart]').forEach(chart => {
    const data = JSON.parse(chart.querySelector('[data-chart-values]').textContent);
    const tooltip = chart.querySelector('[data-chart-tooltip]');
    const legend = [...chart.querySelectorAll('[data-chart-legend]')];
    const points = [...chart.querySelectorAll('[data-chart-agent]')];
    const panels = chart.querySelector('[data-chart-panels]');
    const tabs = [...chart.querySelectorAll('[data-chart-panel]')];
    const mobile = window.matchMedia('(max-width:900px)');
    let pinned = null, current = null;
    chart.classList.add('src-ready');
    function focusAgent(id, anchor) {
      current = id;
      points.forEach(point => {
        point.classList.toggle('is-muted',!!id && point.dataset.chartAgent !== id);
        point.classList.toggle('is-highlighted',point.dataset.chartAgent === id);
      });
      if (!id) { tooltip.hidden = true; return; }
      const model = data[0].points.find(point => point.id === id);
      tooltip.replaceChildren();
      tooltip.style.setProperty('--agent-color',model.color);
      const name = document.createElement('strong');name.textContent = model.name;tooltip.append(name);
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Split</th><th>Source</th><th>Runtime</th></tr></thead>';
      const body = document.createElement('tbody');
      data.forEach(panel => {
        const point = panel.points.find(item => item.id === id);
        const row = document.createElement('tr');
        [panel.label,point.source.toFixed(2),point.runtime.toFixed(2)].forEach(value => {const cell=document.createElement('td');cell.textContent=value;row.append(cell);});
        body.append(row);
      });
      table.append(body);tooltip.append(table);tooltip.hidden = false;
      const box = chart.getBoundingClientRect();
      const target = (anchor || legend.find(button => button.dataset.chartLegend === id)).getBoundingClientRect();
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      tooltip.style.left = `${Math.max(0,Math.min(box.width-width,target.left-box.left+target.width/2-width/2))}px`;
      tooltip.style.top = `${Math.max(0,target.top-box.top-height-10)}px`;
    }
    function restore() {
      const focused = document.activeElement.closest?.('[data-chart-legend]');
      focusAgent(focused?.dataset.chartLegend || pinned,focused);
    }
    legend.forEach(button => {
      const id = button.dataset.chartLegend;
      button.addEventListener('pointerenter',() => focusAgent(id,button));
      button.addEventListener('pointerleave',restore);
      button.addEventListener('focus',() => focusAgent(id,button));
      button.addEventListener('blur',() => requestAnimationFrame(restore));
      button.addEventListener('click',() => {
        pinned = pinned === id ? null : id;
        legend.forEach(item => item.setAttribute('aria-pressed',String(item.dataset.chartLegend === pinned)));
        focusAgent(pinned,button);
      });
    });
    points.forEach(point => {
      point.addEventListener('pointerenter',() => focusAgent(point.dataset.chartAgent,point));
      point.addEventListener('pointerleave',restore);
    });
    chart.addEventListener('keydown',event => {
      if (event.key !== 'Escape') return;
      pinned=null;legend.forEach(button=>button.setAttribute('aria-pressed','false'));focusAgent(null);
    });
    // Mobile charts share a fixed plot area and dissolve in place.
    const panelItems = [...panels.querySelectorAll('.src-panel')];
    let activePanel = 0, gesture = null;
    chart.classList.add('src-fade-ready');
    function selectTab(index) {
      activePanel = Math.min(tabs.length-1,Math.max(0,index));
      tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===activePanel));tab.tabIndex=i===activePanel?0:-1;});
      panelItems.forEach((panel,i)=>{
        const hidden = mobile.matches && i!==activePanel;
        panel.classList.toggle('is-current',i===activePanel);
        panel.inert=hidden;
        if(mobile.matches){
          panel.setAttribute('aria-hidden',String(hidden));
          panel.setAttribute('role','tabpanel');
          panel.setAttribute('aria-labelledby',tabs[i].id);
        }else{
          panel.removeAttribute('aria-hidden');panel.removeAttribute('role');
          panel.setAttribute('aria-labelledby',panel.querySelector('h4').id);
        }
      });
      tooltip.hidden=true;
    }
    tabs.forEach((tab,index) => {
      tab.addEventListener('click',()=>selectTab(index));
      tab.addEventListener('keydown',event => {
        let next=index;
        if(event.key==='ArrowRight')next=(index+1)%tabs.length;
        else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=tabs.length-1;
        else return;
        event.preventDefault();selectTab(next);tabs[next].focus();
      });
    });
    panels.addEventListener('pointerdown',event=>{
      if(!mobile.matches||!event.isPrimary||event.button!==0)return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
      panels.setPointerCapture(event.pointerId);
    });
    panels.addEventListener('pointerup',event=>{
      if(!gesture||gesture.id!==event.pointerId)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      gesture=null;
      if(mobile.matches&&Math.abs(dx)>=36&&Math.abs(dx)>Math.abs(dy)*1.25)
        selectTab(activePanel+(dx<0?1:-1));
    });
    panels.addEventListener('pointercancel',()=>{gesture=null;});
    mobile.addEventListener('change',()=>{gesture=null;panels.scrollLeft=0;selectTab(0);focusAgent(null);});
    selectTab(0);
    window.addEventListener('resize',()=>{if(current)focusAgent(current);});
  });
})();




/* Mobile pipeline carousel. */
(function mobilePipelineOverview(){
  'use strict';
  const mobile=window.matchMedia('(max-width:760px)');
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');
  const names=['Build','Contract','Source','Replay','Playtest','Feedback'];
  let nextID=0;
  document.querySelectorAll('[data-a2z-pipeline]').forEach(panel=>{
    if(panel.querySelector('[data-mobile-pipeline]')) return;
    const id=`mobile-pipeline-${++nextID}`;
    const cloneVisual=(selector)=>{
      const original=panel.querySelector(selector);
      if(!original) return '';
      const node=original.cloneNode(true),idMap=new Map();
      [node,...node.querySelectorAll('*')].forEach(el=>{
        [...el.attributes].forEach(attr=>{if(attr.name.startsWith('data-pipeline')||attr.name==='aria-describedby'||attr.name==='aria-labelledby')el.removeAttribute(attr.name);});
        if(el.id){const old=el.id,unique=`${id}-${old}`;idMap.set(old,unique);el.id=unique;}
      });
      [node,...node.querySelectorAll('*')].forEach(el=>[...el.attributes].forEach(attr=>{
        let value=attr.value;
        idMap.forEach((unique,old)=>{value=value.replaceAll(`url(#${old})`,`url(#${unique})`);if(value===`#${old}`)value=`#${unique}`;});
        if(value!==attr.value)el.setAttribute(attr.name,value);
      }));
      if(node.tagName==='IMG'){node.removeAttribute('loading');node.setAttribute('draggable','false');node.setAttribute('alt','');node.setAttribute('aria-hidden','true');}
      return node.outerHTML;
    };
    const gdd=cloneVisual('.pp-design .pp-art img'),agent=cloneVisual('.pp-builder .pp-art img'),game=cloneVisual('.pp-build .pp-art img');
    const contract=cloneVisual('.pp-dependencies'),code=cloneVisual('.pp-code'),route=cloneVisual('.pp-exploration'),revise=cloneVisual('.pp-revise>img'),evaluator=cloneVisual('.pp-evidence>img');
    const replayImages=[...document.querySelectorAll('.scenario-evidence .se-frame-strip img')].slice(0,3);
    const replayDefaults=['assets/replay/fig-s27-cloud-cast-01.jpeg','assets/replay/fig-s27-cloud-cast-02.jpeg','assets/replay/fig-s27-cloud-cast-03.jpeg'];
    const frames=replayDefaults.map((src,index)=>{
      const img=document.createElement('img');img.src=replayImages[index]?.currentSrc||replayImages[index]?.src||src;img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.width=400;img.height=225;return `<figure>${img.outerHTML}</figure>`;
    }).join('');
    const slides=[
      {kicker:'FROM THE DESIGN',title:'Build the intended game.',visual:`<div class="pm-build-flow"><figure>${gdd}<figcaption>Game design</figcaption></figure><figure>${agent}<figcaption>Coding agent</figcaption></figure><figure>${game}<figcaption>Game build</figcaption></figure></div>`,caption:'A coding agent turns the game design document into source code and a playable build.'},
      {kicker:'WHAT TO VERIFY',title:'A dependency-aware contract.',visual:`<div class="pm-contract-plate"><strong>Rules that work together</strong>${contract}<span>Rules · Invariants · Dependencies</span></div>`,caption:'The same contract stays fixed across builds and revisions.'},
      {kicker:'SOURCE-CODE ANALYSIS',title:'Inspect the implementation.',visual:`<div class="pm-source-visual">${code}<div class="pm-source-checks"><span><i aria-hidden="true">✓</i>Condition</span><span><i aria-hidden="true">✓</i>Trigger</span><span><i aria-hidden="true">✓</i>Expected effect</span></div></div>`,caption:'Inspect the source against each requirement and retain the code references.'},
      {kicker:'HOW TO TEST · FIXED POLICY',title:'Replay prescribed inputs.',kind:'pm-policy',visual:`<div class="pm-replay-visual"><div class="pm-slice-bank" aria-hidden="true"><i class="pm-frame-slice"></i><i class="pm-frame-slice pm-selected-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice pm-selected-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice"></i><i class="pm-frame-slice pm-selected-slice"></i><i class="pm-frame-slice"></i></div><svg class="pm-selection-links" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M65 0C65 13 50 10 50 24"/><path d="M145 0C145 13 150 10 150 24"/><path d="M237 0C237 13 250 10 250 24"/><path class="pm-extraction-path" pathLength="1" d="M65 0C65 13 50 10 50 24"/><path class="pm-extraction-path" pathLength="1" d="M145 0C145 13 150 10 150 24"/><path class="pm-extraction-path" pathLength="1" d="M237 0C237 13 250 10 250 24"/></svg><div class="pm-film" aria-label="Three selected replay frames provide visual evidence">${frames}</div></div>`,caption:'Replay a shared scenario, then select frames that reveal the specified visual responses.'},
      {kicker:'HOW TO TEST · ADAPTIVE POLICY',title:'Explore through live play.',kind:'pm-policy',visual:`<div class="pm-playtest-map">${route}</div>`,caption:'Choose inputs from live observations. Explore branches and record what happens.'},
      {kicker:'REQUIREMENT-LEVEL FEEDBACK',title:'Connect evidence to each rule.',visual:`<div class="pm-feedback-visual"><div class="pm-evidence-inputs"><span>Code</span><span>Frames</span><span>Traces</span></div><svg class="pm-evidence-merge" viewBox="0 0 300 32" aria-hidden="true"><path d="M48 0V11Q48 20 61 20H150V32"/><path d="M150 0V32"/><path d="M252 0V11Q252 20 239 20H150V32"/><path class="pm-merge-stream" pathLength="1" d="M48 0V11Q48 20 61 20H150V32"/><path class="pm-merge-stream" pathLength="1" d="M150 0V32"/><path class="pm-merge-stream" pathLength="1" d="M252 0V11Q252 20 239 20H150V32"/></svg><div class="pm-feedback-review">${evaluator}<div class="pm-feedback-rule"><i aria-hidden="true">r</i><span>Requirement-level feedback</span></div></div><div class="pm-revise-loop"><b aria-hidden="true">↻</b>${revise}<span>Revise. Evaluate again.</span></div></div>`,caption:'Evaluate the next revision against the same contract and all three evidence sources.'}
    ];
    const carousel=document.createElement('section');carousel.className='pm-carousel';carousel.dataset.mobilePipeline='';carousel.setAttribute('aria-label','Evaluation overview');carousel.setAttribute('aria-roledescription','carousel');
    carousel.innerHTML=`<div class="pm-toolbar"><span class="pm-position"><b data-pm-position>01</b> / 06</span><div class="pm-controls"><button type="button" data-pm-prev aria-label="Previous overview step">←</button><button type="button" data-pm-next aria-label="Next overview step">→</button><button type="button" class="pm-toggle" data-pm-toggle aria-label="Pause overview animation" aria-pressed="false"><span data-pm-icon aria-hidden="true">Ⅱ</span><span data-pm-label>Pause</span></button></div></div><div class="pm-stage" data-pm-stage tabindex="0" aria-label="Overview slides. Swipe horizontally or use the arrow keys.">${slides.map((slide,index)=>`<article class="pm-slide ${slide.kind||''}" id="${id}-slide-${index}" data-pm-slide="${index}" role="group" aria-roledescription="slide" aria-label="${index+1} of 6: ${names[index]}"${index?' hidden':''}><span class="pm-kicker">${slide.kicker}</span><h3>${slide.title}</h3><div class="pm-visual">${slide.visual}</div><p class="pm-caption">${slide.caption}</p></article>`).join('')}</div><div class="pm-tabs" role="group" aria-label="Choose an overview step">${names.map((name,index)=>`<button class="pm-tab" type="button" data-pm-go="${index}" aria-controls="${id}-slide-${index}" aria-pressed="${!index}"><span aria-hidden="true">${String(index+1).padStart(2,'0')}</span>${name}</button>`).join('')}</div><span class="sr-only" data-pm-status role="status" aria-live="polite" aria-atomic="true"></span>`;
    panel.append(carousel);panel.classList.add('pp-mobile-ready');
    const slideEls=[...carousel.querySelectorAll('[data-pm-slide]')],tabs=[...carousel.querySelectorAll('[data-pm-go]')],stage=carousel.querySelector('[data-pm-stage]'),toggle=carousel.querySelector('[data-pm-toggle]'),label=carousel.querySelector('[data-pm-label]'),icon=carousel.querySelector('[data-pm-icon]'),position=carousel.querySelector('[data-pm-position]'),status=carousel.querySelector('[data-pm-status]');
    let selected=0,userPaused=false,inView=false,frame=0,elapsed=0,last=0,pointer=null;
    const duration=()=>selected===4?10000:6500;
    const ancestorsVisible=()=>!panel.closest('[hidden]')&&panel.getClientRects().length>0;
    let fadeGeneration=0,fadeAnimations=[],contentPaused=false;
    const showSlides=(previous,next)=>{
      const outgoing=slideEls[previous],incoming=slideEls[next];
      const wasVisible=outgoing&&!outgoing.hidden;
      const outgoingOpacity=wasVisible?getComputedStyle(outgoing).opacity:'1';
      const generation=++fadeGeneration;
      fadeAnimations.forEach(animation=>animation.cancel());fadeAnimations=[];
      slideEls.forEach((el,i)=>{el.hidden=i!==next;el.inert=i!==next;el.setAttribute('aria-hidden',String(i!==next));});
      if(previous===next||!wasVisible||!mobile.matches||reduced.matches||!inView||document.hidden||!ancestorsVisible())return;
      outgoing.hidden=false;
      const options={duration:340,easing:'cubic-bezier(.2,.6,.25,1)',fill:'both'};
      const animations=[outgoing.animate([{opacity:outgoingOpacity},{opacity:0}],options),incoming.animate([{opacity:0},{opacity:1}],options)];
      fadeAnimations=animations;
      Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
        if(generation!==fadeGeneration)return;
        slideEls.forEach((el,i)=>el.hidden=i!==selected);
        animations.forEach(animation=>animation.cancel());fadeAnimations=[];
      });
    };
    const select=(index,manual=false)=>{
      const previous=selected;
      selected=(index+slides.length)%slides.length;elapsed=0;last=0;
      carousel.dataset.slide=String(selected);carousel.style.setProperty('--pm-progress','0');
      showSlides(previous,selected);tabs.forEach((el,i)=>el.setAttribute('aria-pressed',String(i===selected)));
      position.textContent=String(selected+1).padStart(2,'0');
      if(manual){userPaused=true;status.textContent=`${names[selected]}. ${slides[selected].title} ${slides[selected].caption}`;}
      sync();
    };
    const tick=time=>{
      frame=0;
      if(!canRun()){sync();return;}
      if(last)elapsed+=Math.min(time-last,100);last=time;
      if(elapsed>=duration()){select(selected+1);return;}
      carousel.style.setProperty('--pm-progress',String(Math.min(1,elapsed/duration())));
      frame=requestAnimationFrame(tick);
    };
    const canRun=()=>mobile.matches&&!reduced.matches&&!userPaused&&inView&&!document.hidden&&ancestorsVisible();
    function sync(){
      const running=canRun(),paused=contentPaused||reduced.matches;
      panel.classList.toggle('pm-content-running',mobile.matches&&!reduced.matches&&!contentPaused&&inView&&!document.hidden&&ancestorsVisible());
      panel.classList.toggle('pm-running',running);carousel.classList.toggle('is-paused',userPaused||reduced.matches);carousel.dataset.running=String(running);
      toggle.hidden=reduced.matches;toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Play overview animation':'Pause overview animation');label.textContent=paused?'Play':'Pause';icon.textContent=paused?'▶':'Ⅱ';
      if(running&&!frame){last=0;frame=requestAnimationFrame(tick);}
      if(!running&&frame){cancelAnimationFrame(frame);frame=0;last=0;}
    }
    tabs.forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.pmGo),true)));
    carousel.querySelector('[data-pm-prev]').addEventListener('click',()=>select(selected-1,true));carousel.querySelector('[data-pm-next]').addEventListener('click',()=>select(selected+1,true));
    toggle.addEventListener('click',()=>{contentPaused=!contentPaused;userPaused=contentPaused;sync();});
    stage.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();select(selected+(event.key==='ArrowRight'?1:-1),true);}});
    stage.addEventListener('dragstart',event=>event.preventDefault());
    stage.addEventListener('pointerdown',event=>{if(event.isPrimary&&event.button===0){pointer={x:event.clientX,y:event.clientY,id:event.pointerId};stage.setPointerCapture?.(event.pointerId);}});
    stage.addEventListener('pointerup',event=>{if(!pointer||event.pointerId!==pointer.id)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)select(selected+(dx<0?1:-1),true);});
    stage.addEventListener('pointercancel',()=>pointer=null);
    document.addEventListener('visibilitychange',sync);mobile.addEventListener('change',sync);reduced.addEventListener('change',sync);
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.18}).observe(panel);else inView=true;
    // Refresh layout when page visibility changes.
    const main=panel.closest('main');if(main)new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['hidden','class','style']});
    select(0);sync();
  });
})();

/* Example requirements. */
/* The paired excerpts describe intended behavior, independent of video playback. */
(function initExampleRequirements(){
  const DATA={"replay":{"cloud-cast":{"name":"Cloud Cast","mode":"excerpt","frames":[{"text":"Bottom-left: the reel gauge (Reel Track card) + \"A ◄ ► D\" hint. … Bottom-right: the tension gauge (Tension Track card) + \"J / K\" hint.","source_section":"Reeling HUD"},{"text":"gauges, pips, and the haul-ribbon render above weather grades (§Art readability rule) so a Cloudstorm never obscures them.","source_section":"HUD layering"},{"text":"size cm rolled (DBT-5), Grade banner (DBT-9), coins earned (LED-6) counting up","source_section":"Catch Summary"}]},"afterglow-network":{"name":"Afterglow Network","mode":"excerpt","frames":[{"text":"E picks up or operates within DBT-PLY-07.","source_section":"Seo-jin · PLY-V2"},{"text":"During daylight at Operating R5-B3, with no defense active, holding E for 4 seconds at the regulator socket","source_section":"Phase Regulator"},{"text":"Core and Barrier HP bars occupy top center beneath remaining night time. … Turret ammo appears beside Core HP when installed.","source_section":"Night Defense HUD"}]},"siege-deck-2d":{"name":"Siege Deck 2D","mode":"excerpt","frames":[{"text":"Legal cells use a blue inset diamond, illegal cells red crosshatch, and selected formation footprint a white outline.","source_section":"Deployment"},{"text":"Bottom 260 px holds five-card fan and three-slot ribbon.","source_section":"Assignment screen"},{"text":"zero to three candidate cards from REW-R1 stand center … deck count and thirty-card cap are right","source_section":"Battle Reward"}]},"wham-bam-logistics":{"name":"Wham Bam Logistics","mode":"excerpt","frames":[{"text":"The selected route header shows ID, endpoints, distance class, exact game-minute ETA by compatible class, assigned vehicles by state, waiting bundles by type, cargo-priority slots","source_section":"Route panel"},{"text":"Left catalog shows unlocked assets with price/fixed cost/stats","source_section":"Construction and Fleet"},{"text":"Queue by type, used/total throughput, task finish time, tier, fixed cost, forecast inflow, and first blocked route.","source_section":"Facility panel"}]},"chromashade":{"name":"ChromaShade","mode":"excerpt","frames":[{"text":"← → slide the shadow · ↑ ↓ resize · Space to jump","source_section":"First Light · tutorial hint"},{"text":"STEP shape (two-height hop) for climbing","source_section":"Staircase · stage design"},{"text":"Tab switches which light you control","source_section":"Switchboard · tutorial hint"}]},"ssitgim":{"name":"Ssitgim","mode":"excerpt","frames":[{"text":"On perception, if this placement's codex bit is off, display Empty Rhythm · Nameless Soul … plus a 48×3 px vigor bar above the head for 2 seconds","source_section":"Musician Soul · UX"},{"text":"Show only the current requirement at bottom center through bell, spirit-sword, or movement symbols and bindings.","source_section":"Ssitgim Rite · UX"},{"text":"After the entrance, show Drowned Mother Soul · Jeongwol and a 480×8 px vigor bar at the bottom of the screen.","source_section":"Jeongwol · UX"}]},"alias-alchemy-shop":{"name":"Alias Alchemy Shop","mode":"excerpt","frames":[{"text":"Three signboards across center","source_section":"Alias Selection"},{"text":"Cauldron center … facilities left … stock upper center … active orders and previews right","source_section":"Main Shop"},{"text":"Two columns list reset fields and retained fields","source_section":"Voluntary Closure"}]},"strata-keepers":{"name":"Strata Keepers","mode":"excerpt","frames":[{"text":"Record-pin panel: three-element checkboxes + nearby-sample list + pose/orientation slider.","source_section":"Position Record · UX"},{"text":"Fragment tray + target silhouette, progress “5/8 fragments.”","source_section":"Joining Puzzle · UX"},{"text":"Hypothesis list (50, grouped by site + 2 civilization-wide), slot-requirement tooltip, current confidence gauge + level label.","source_section":"Hypothesis Board · UX"}]}},"recorded":[{"name":"Whispers of the Wild","slug":"whispers-of-the-wild","rule":"RT-AWARE R1/R4","text":"Entering an animal’s personal space triggers Flee movement at its specified flee speed.","mode":"summary"},{"name":"Fogfall Delivery","slug":"fogfall-delivery","rule":"RT-ESTIMATE R3","text":"Cells up to four steps beyond the reveal radius, without lighthouse coverage, show estimate icons with confidence and a color-coded badge.","mode":"summary"},{"name":"Chameleon Slide","slug":"chameleon-slide","rule":"RT-COLOR K1","text":"At rest, a color key changes the body color immediately without advancing the world or move counter.","mode":"summary"}]};
  document.querySelectorAll('[data-se-requirement]').forEach(node=>{
    if(node.dataset.requirementReady)return;node.dataset.requirementReady='true';
    const root=node.closest('[data-scenario-evidence]'),select=root?.querySelector('[data-se-game]');if(!select)return;
    const label=node.querySelector('[data-requirement-label]'),copy=node.querySelector('[data-requirement-text]');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let currentKey='',lastWidth=0,fitFrame=0;
    const write=(target,item)=>{
      target.querySelector('[data-requirement-label]').textContent='GDD excerpt · '+item.source_section;
      target.querySelector('[data-requirement-text]').textContent='“'+item.text+'”';
    };
    function fit(force=false){
      cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(()=>{
        const width=node.getBoundingClientRect().width,item=DATA.replay[select.value];
        if(!width||!item||(!force&&Math.abs(width-lastWidth)<1))return;
        lastWidth=width;
        const probe=node.cloneNode(true);probe.removeAttribute('data-se-requirement');probe.setAttribute('aria-hidden','true');
        probe.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;width:${width}px;min-height:0;height:auto;inset:0 auto auto 0;`;
        node.parentElement.append(probe);
        let height=0;
        item.frames.forEach(frame=>{write(probe,frame);height=Math.max(height,probe.getBoundingClientRect().height);});
        probe.remove();node.style.minHeight=Math.ceil(height)+'px';
      });
    }
    function update(){
      const item=DATA.replay[select.value];if(!item){node.hidden=true;return;}node.hidden=false;
      const index=Math.max(0,Math.min(2,Number(root.dataset.seFocus)||0)),frame=item.frames[index],key=select.value+':'+index;
      if(key===currentKey)return;
      const gameChanged=currentKey.split(':')[0]!==select.value;currentKey=key;
      write(node,frame);node.dataset.requirementFrame=String(index);node.setAttribute('aria-label',item.name+' GDD excerpt for '+frame.source_section);
      if(!reduced.matches&&copy.animate)copy.animate([{opacity:.3},{opacity:1}],{duration:220,easing:'ease-out'});
      if(gameChanged)fit(true);
    }
    select.addEventListener('change',update);
    new MutationObserver(update).observe(root,{attributes:true,attributeFilter:['data-se-focus']});
    if('ResizeObserver'in window)new ResizeObserver(()=>fit()).observe(node);
    document.fonts?.ready.then(()=>fit(true));update();
  });
  document.querySelectorAll('[data-recorded-requirement]').forEach(node=>{
    if(node.dataset.requirementReady)return;node.dataset.requirementReady='true';const root=node.closest('[data-recorded-revisions]');if(!root)return;
    function update(index){const item=DATA.recorded[index];if(!item)return;node.querySelector('[data-requirement-text]').textContent=item.text;node.setAttribute('aria-label',item.name+' intended design context');}
    root.querySelectorAll('[data-recorded-select]').forEach(button=>button.addEventListener('click',()=>update(Number(button.dataset.recordedSelect))));const current=root.querySelector('[data-recorded-select][aria-pressed="true"]');update(Number(current?.dataset.recordedSelect||0));
  });
})();


/* Responsive method slides. */
(() => {
  const mobile = matchMedia('(max-width: 760px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const methods = ['source', 'replay', 'adaptive'];
  const names = ['Source code', 'Replay', 'Playtest'];
  const summaries = [
    'Inspect conditions, triggers, and effects. Weight rules by their downstream reach.',
    'Replay fixed scenario inputs, then retrieve frames that show the required visual responses.',
    'Bots explore normal play and initialized tests, then link observed behavior to each requirement.'
  ];
  const decks = [];
  document.querySelectorAll('[data-method-explorer]').forEach(root => {
    if (root.dataset.responsiveMethods) return;
    const panels = methods.map(name => root.querySelector(`[data-method-panel="${name}"]`));
    if (panels.some(panel => !panel)) return;
    const rail = document.createElement('div');
    rail.className = 'method-slide-rail';
    root.insertBefore(rail, panels[0]);
    panels.forEach(panel => rail.append(panel));
    decks.push({root,rail,panels,buttons:[...root.querySelectorAll('[data-method-target]')],home:true});
  });
  document.querySelectorAll('.method-editorial > .shell').forEach(container => {
    if (container.querySelector('[data-responsive-methods]')) return;
    const panels = methods.map(name => container.querySelector(`.method-story.story-${name}`));
    if (panels.some(panel => !panel)) return;
    const root = document.createElement('div');
    root.className = 'method-mobile-deck';
    const tabs = document.createElement('div');
    tabs.className = 'method-mobile-tabs';
    tabs.setAttribute('role','group');
    tabs.setAttribute('aria-label','Evaluation method');
    const buttons = methods.map((name,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mobileMethodTarget = name;
      const number = document.createElement('b'); number.textContent = `0${index + 1}`;
      const title = document.createElement('span'); title.textContent = names[index];
      button.append(number,title); tabs.append(button); return button;
    });
    const rail = document.createElement('div');
    rail.className = 'method-slide-rail';
    const between = [];
    let node = panels[0];
    while (node) { between.push(node); if (node === panels[2]) break; node = node.nextSibling; }
    container.insertBefore(root,panels[0]);
    root.append(tabs,rail);
    between.forEach(node => rail.append(node));
    decks.push({root,rail,panels,buttons,home:false});
  });
  decks.forEach(({root,rail,panels,buttons,home},deckIndex) => {
    root.dataset.responsiveMethods = home ? 'home' : 'glance';
    rail.setAttribute('aria-label','Swipe or choose an evaluation method');
    const fadeDuration = 340;
    let active = 0, fadeTimer = 0, fitFrame = 0;
    let measuredWidth = 0, stageHeight = 0, gesture = null, suppressClickUntil = 0;
    panels.forEach((panel,index) => {
      panel.dataset.methodSlide = methods[index];
      if (!panel.id) panel.id = `responsive-method-${deckIndex}-${methods[index]}`;
      buttons[index].setAttribute('aria-controls',panel.id);
      const copy = panel.querySelector('.story-copy,.explorer-copy');
      if (!copy.querySelector('.method-mobile-copy')) {
        const paragraph = document.createElement('p');
        paragraph.className = 'method-mobile-copy';
        paragraph.textContent = summaries[index];
        copy.append(paragraph);
      }
    });
    const notify = () => document.dispatchEvent(new Event('a2z-method-visibility'));
    function fit() {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        if (!mobile.matches) { rail.style.removeProperty('height'); return; }
        const width = rail.getBoundingClientRect().width;
        if (!width) return;
        if (Math.abs(width - measuredWidth) > 1) { measuredWidth = width; stageHeight = 0; }
        // The Glance panels carry different amounts of evidence. Size to the active panel,
        // not the tallest hidden panel, so Source and Replay do not inherit the case's height.
        const maximum = Math.ceil((home ? Math.max(...panels.map(panel => panel.getBoundingClientRect().height)) : panels[active].getBoundingClientRect().height) + 2);
        stageHeight = home ? Math.max(stageHeight, maximum) : maximum;
        if (stageHeight > 0) rail.style.height = `${stageHeight}px`;
      });
    }
    function finishFade() {
      clearTimeout(fadeTimer);
      panels.forEach((panel,index) => {
        panel.classList.toggle('method-fade-visible',index === active);
        panel.dataset.methodSuspended = String(index !== active);
      });
      root.dataset.methodFading = 'false';
      notify();
    }
    function select(index,{instant=false,restart=false}={}) {
      const previous = active;
      active = Math.max(0,Math.min(panels.length - 1,index));
      root.dataset.methodSelected = methods[active];
      buttons.forEach((button,i) => {
        button.classList.toggle('active',i === active);
        button.setAttribute('aria-pressed',String(i === active));
      });
      clearTimeout(fadeTimer);
      if (!mobile.matches) return;
      const immediate = instant || reduced.matches || previous === active;
      root.classList.toggle('method-fade-instant',immediate);
      panels.forEach((panel,i) => {
        panel.hidden = false;
        panel.inert = i !== active;
        if (i !== active) panel.setAttribute('aria-hidden','true');
        else panel.removeAttribute('aria-hidden');
        if (immediate) {
          panel.classList.toggle('method-fade-visible',i === active);
          panel.classList.toggle('method-fade-active',i === active);
          panel.dataset.methodSuspended = String(i !== active);
        } else if (i === active) {
          panel.classList.add('method-fade-visible');
          panel.dataset.methodSuspended = 'false';
        }
      });
      if (!immediate) {
        void rail.offsetWidth;
        panels.forEach((panel,i) => panel.classList.toggle('method-fade-active',i === active));
        root.dataset.methodFading = 'true';
        fadeTimer = setTimeout(finishFade,fadeDuration + 24);
      } else root.dataset.methodFading = 'false';
      notify(); fit();
      if (active === 0 && (previous !== 0 || restart) && !reduced.matches) {
        panels[0].querySelector('[data-weight-motion][aria-label="Replay rule-weight animation"]')?.click();
      }
    }
    buttons.forEach((button,index) => button.addEventListener('click',() => {
      if (mobile.matches) select(index,{restart:true});
      else active = index;
    }));
    rail.addEventListener('pointerdown',event => {
      if (!mobile.matches || !event.isPrimary || event.target.closest('select,input,textarea,video')) return;
      gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),swiping:false};
    },{passive:true});
    rail.addEventListener('pointermove',event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.35) gesture.swiping = true;
      if (gesture.swiping && event.cancelable) event.preventDefault();
    },{passive:false});
    rail.addEventListener('pointerup',event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.35 && performance.now() - gesture.time < 1000) {
        suppressClickUntil = performance.now() + 350;
        select(active + (dx < 0 ? 1 : -1));
      }
      gesture = null;
    });
    rail.addEventListener('pointercancel',() => { gesture = null; });
    rail.addEventListener('click',event => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    },true);
    rail.addEventListener('keydown',event => {
      if (!mobile.matches || !['ArrowLeft','ArrowRight'].includes(event.key) || event.target.closest('button,select,input,textarea')) return;
      event.preventDefault(); select(active + (event.key === 'ArrowRight' ? 1 : -1));
    });
    function syncLayout() {
      clearTimeout(fadeTimer);
      if (mobile.matches) {
        const selected = buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true' || button.classList.contains('active'));
        select(selected >= 0 ? selected : active,{instant:true});
      } else {
        rail.style.removeProperty('height'); measuredWidth = 0; stageHeight = 0;
        root.dataset.methodFading = 'false';
        root.classList.remove('method-fade-instant');
        panels.forEach((panel,index) => {
          panel.hidden = home && index !== active;
          panel.inert = false;
          panel.removeAttribute('aria-hidden');
          panel.removeAttribute('data-method-suspended');
          panel.classList.remove('method-fade-active','method-fade-visible');
        });
        notify();
      }
      rail.scrollLeft = 0;
    }
    mobile.addEventListener('change',syncLayout);
    reduced.addEventListener('change',() => { if (mobile.matches) select(active,{instant:true}); });
    addEventListener('resize',fit,{passive:true});
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(fit);
      panels.forEach(panel => observer.observe(panel));
    }
    document.fonts?.ready.then(fit);
    root.querySelectorAll('img').forEach(image => image.addEventListener('load',fit));
    syncLayout();
  });
})();


/* Ambient gameplay additions. */
// Existing gallery cards can seek to their corresponding recorded gameplay.
Object.entries({'abyssal-chain':'video-abyssal-chain','chroma-bastion':'video-chroma-bastion'}).forEach(([slug,motionId])=>{if(window.A2Z_MEDIA?.[slug])window.A2Z_MEDIA[slug].motionId=motionId;});



/* Contract construction example. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 760px)');
  const graphEdges=[{"from":"F1","to":"F5","via":["phase"]},{"from":"F1","to":"I1","via":["phase"]},{"from":"F1","to":"I2","via":["phase"]},{"from":"F1","to":"P1","via":["phase"]},{"from":"F1","to":"P2","via":["phase"]},{"from":"F1","to":"T1","via":["phase"]},{"from":"F1","to":"T6","via":["phase","traceElapsed"]},{"from":"F3","to":"F5","via":["focusWasRestored"]},{"from":"F3","to":"F6","via":["focusWasRestored"]},{"from":"F5","to":"F1","via":["phase"]},{"from":"F5","to":"I1","via":["phase"]},{"from":"F5","to":"I2","via":["phase"]},{"from":"F5","to":"P1","via":["phase"]},{"from":"F5","to":"P2","via":["phase"]},{"from":"F5","to":"T1","via":["phase"]},{"from":"F5","to":"T6","via":["phase","traceElapsed"]},{"from":"F6","to":"F1","via":["phase"]},{"from":"F6","to":"F5","via":["phase"]},{"from":"F6","to":"I1","via":["phase"]},{"from":"F6","to":"I2","via":["phase"]},{"from":"F6","to":"P1","via":["phase"]},{"from":"F6","to":"P2","via":["phase"]},{"from":"F6","to":"T1","via":["phase"]},{"from":"F6","to":"T6","via":["phase"]},{"from":"I1","to":"F1","via":["phase"]},{"from":"I1","to":"F5","via":["phase"]},{"from":"I1","to":"I2","via":["phase","selectedCause"]},{"from":"I1","to":"P1","via":["phase"]},{"from":"I1","to":"P2","via":["phase"]},{"from":"I1","to":"T1","via":["phase"]},{"from":"I1","to":"T6","via":["phase"]},{"from":"I2","to":"F1","via":["phase"]},{"from":"I2","to":"F5","via":["phase"]},{"from":"I2","to":"I1","via":["phase","selectedCause"]},{"from":"I2","to":"P1","via":["phase"]},{"from":"I2","to":"P2","via":["phase"]},{"from":"I2","to":"T1","via":["phase"]},{"from":"I2","to":"T6","via":["phase"]},{"from":"P1","to":"P2","via":["sensorNodes"]},{"from":"P1","to":"P4","via":["sensorNodes"]},{"from":"P2","to":"P1","via":["sensorNodes"]},{"from":"P2","to":"P4","via":["sensorNodes"]},{"from":"P4","to":"F1","via":["phase"]},{"from":"P4","to":"F5","via":["phase"]},{"from":"P4","to":"I1","via":["phase"]},{"from":"P4","to":"I2","via":["phase"]},{"from":"P4","to":"P1","via":["phase"]},{"from":"P4","to":"P2","via":["phase"]},{"from":"P4","to":"T1","via":["phase"]},{"from":"P4","to":"T2","via":["time"]},{"from":"P4","to":"T3","via":["time"]},{"from":"P4","to":"T4","via":["events","time"]},{"from":"P4","to":"T6","via":["phase"]},{"from":"T1","to":"T2","via":["relayVisited"]},{"from":"T1","to":"T3","via":["outputVisited"]},{"from":"T1","to":"T6","via":["traceElapsed"]},{"from":"T2","to":"T4","via":["events"]},{"from":"T3","to":"T4","via":["events"]},{"from":"T4","to":"F1","via":["phase"]},{"from":"T4","to":"F5","via":["phase"]},{"from":"T4","to":"I1","via":["phase"]},{"from":"T4","to":"I2","via":["phase"]},{"from":"T4","to":"P1","via":["phase"]},{"from":"T4","to":"P2","via":["phase"]},{"from":"T4","to":"T1","via":["phase"]},{"from":"T4","to":"T6","via":["phase"]}];
  const graphExamples={
    P1:['P1','P4','sensorNodes','Removing a sensor changes the set that P4 reads before it can accept Run.'],
    P2:['P2','P4','sensorNodes','P2 updates the sensor set. P4 reads its count and requires two sensors before Run.'],
    P4:['P4','T1','phase','P4 enters TRACE. T1 reads that phase to initialize the traversal.'],
    T1:['T1','T2','relayVisited','T1 clears the relay-visit flag. T2 reads it so the relay event fires only once.'],
    T2:['T2','T4','events','T2 records the relay events. T4 requires the scheduled events to finish before INFER.'],
    T3:['T3','T4','events','T3 records the output event. T4 checks that the required events have executed.'],
    T4:['T4','I1','phase','T4 enters INFER. I1 reads that phase before resolving the selected cause.'],
    T6:['T1','T6','traceElapsed','T1 resets elapsed time. T6 reads and advances it toward the next deadline.'],
    I1:['T4','I1','phase','T4 enters INFER. I1 reads that phase before recording a correct inference.'],
    I2:['T4','I2','phase','T4 enters INFER. I2 reads that phase before recording an incorrect inference.'],
    F1:['F1','F5','phase','F1 enters FOCUS_HOLD. F5 reads the phase before a manual resume.'],
    F3:['F3','F5','focusWasRestored','F3 records the return of focus. F5 requires that fact before resuming the trace.'],
    F5:['F5','T6','traceElapsed','F5 restores the saved elapsed time. T6 reads it to continue the trace.'],
    F6:['F6','P2','phase','F6 changes the session phase. P2 reads the phase as part of its placement conditions.']
  };

  const entries=[
    {kind:'Rule <b>P2</b>',title:'Place a sensor',binding:'Linked to GDD row P2.',fields:[['conditions','Conditions','PLACE, an empty eligible node, fewer than two sensors, trace unused.'],['trigger','Trigger','Toggle the node.'],['effects','Effects','Add the sensor, sort <code>sensorNodes</code>, and play the placement cue.']]},
    {kind:'Rule <b>P4</b>',title:'Commit the run',binding:'Linked to GDD row P4.',fields:[['conditions','Conditions','Two sensors placed, trace unused.'],['trigger','Trigger','Activate Run.'],['effects','Effects','Lock placement, initialize the trace state, and enter TRACE.']]},
    {kind:'Rule <b>T4</b>',title:'Complete the trace',binding:'Linked to GDD row T4.',fields:[['conditions','Conditions','2.600 seconds reached, required events executed.'],['trigger','Trigger','The trace timer reaches its end.'],['effects','Effects','Keep the final sensor readings visible, play the completion cue, and enter INFER.']]}
  ];
  document.querySelectorAll('[data-contract-example]').forEach(root=>{
    const rows=[...root.querySelectorAll('[data-ce-entry]')];
    const network=root.querySelector('.ce-network'),edgeLayer=root.querySelector('[data-ce-edge-layer]');
    const nodeButtons=[...root.querySelectorAll('[data-ce-node]')],nodeMap=new Map(nodeButtons.map(node=>[node.dataset.ceNode,node]));
    let selectedGraph='P2';
    const svgNS='http://www.w3.org/2000/svg';
    const edgeNodes=graphEdges.map(edge=>{const path=document.createElementNS(svgNS,'path');path.setAttribute('class','ce-network-edge');path.dataset.from=edge.from;path.dataset.to=edge.to;path.setAttribute('marker-end','url(#ce-arrow-quiet)');edgeLayer.append(path);return{edge,path};});
    function drawGraph(){
      const box=network.getBoundingClientRect();if(!box.width||!box.height)return;
      const positions=new Map(nodeButtons.map(node=>{const b=node.getBoundingClientRect();return[node.dataset.ceNode,{x:b.x-box.x,y:b.y-box.y,w:b.width,h:b.height}];}));
      edgeNodes.forEach(({edge,path})=>{
        const a=positions.get(edge.from),b=positions.get(edge.to);let d='';
        const sameColumn=Math.abs(a.x-b.x)<12;
        if(sameColumn){const side=a.x+a.w*.5>box.width*.5?-1:1,x1=side>0?a.x+a.w:a.x,y1=a.y+a.h*.48,x2=side>0?b.x+b.w:b.x,y2=b.y+b.h*.52;const out=x1+side*Math.min(16,6+Math.abs(y2-y1)*.1);d=`M${x1} ${y1} C${out} ${y1},${out} ${y2},${x2+side} ${y2}`;}
        else{const forward=b.x>a.x;const x1=forward?a.x+a.w:a.x,y1=a.y+a.h*.5,x2=forward?b.x-1:b.x+b.w+1,y2=b.y+b.h*.5;const dx=Math.max(18,Math.abs(x2-x1)*.46),sign=forward?1:-1;d=`M${x1} ${y1} C${x1+dx*sign} ${y1},${x2-dx*sign} ${y2},${x2} ${y2}`;}
        path.setAttribute('d',d);
      });
    }
    function selectGraph(id){
      selectedGraph=id;root.dataset.ceGraph=id;
      const upstream=new Set(graphEdges.filter(edge=>edge.to===id).map(edge=>edge.from));
      const downstream=new Set(graphEdges.filter(edge=>edge.from===id).map(edge=>edge.to));
      const example=graphExamples[id];
      nodeButtons.forEach(node=>{const key=node.dataset.ceNode;node.classList.toggle('is-selected',key===id);node.classList.toggle('is-upstream',upstream.has(key));node.classList.toggle('is-downstream',downstream.has(key));if(node.tagName==='BUTTON')node.setAttribute('aria-pressed',String(key===id));});
      edgeNodes.forEach(({edge,path})=>{const incoming=edge.to===id,outgoing=edge.from===id,featured=edge.from===example[0]&&edge.to===example[1];path.classList.toggle('is-incoming',incoming);path.classList.toggle('is-outgoing',outgoing);path.classList.toggle('is-featured',featured);path.setAttribute('marker-end',`url(#ce-arrow-${outgoing||featured?'out':incoming?'in':'quiet'})`);});
      edgeNodes.filter(({edge})=>edge.from===id||edge.to===id).forEach(({path})=>edgeLayer.append(path));
      root.querySelector('[data-ce-relation-label]').textContent=`${example[0]} → ${example[1]} · ${example[2]}`;
      root.querySelector('[data-ce-relation-copy]').textContent=example[3];
    }

    const views=[root.querySelector('.ce-document'),root.querySelector('.ce-rule'),root.querySelector('.ce-relations')];
    const names=['GDD','Rule','Connections'];
    const positions=views.map(node=>{const marker=document.createComment('Contract example position');node.before(marker);return{node,marker};});
    const tabs=document.createElement('div');tabs.className='ce-mobile-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Explore the contract example');
    const stage=document.createElement('div');stage.className='ce-mobile-stage';
    root.querySelector('.ce-example-grid').before(tabs,stage);
    const buttons=names.map((name,index)=>{const button=document.createElement('button');button.type='button';button.textContent=name;button.id=`ce-tab-${index}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`ce-view-${index}`);tabs.append(button);return button;});
    let elapsed=0,viewElapsed=0,last=0,frame=0,inView=false,active=0,manual=false,selected=-1,held=false;
    let mobileMounted=false,fitFrame=0,seenWidth=0,stableHeights=[0,0,0],visibilityObserver=null;
    function measureMobileViews(){
      const fields=root.querySelector('[data-ce-rule-fields]'),savedFields=fields.innerHTML;
      const title=root.querySelector('[data-ce-rule-title]'),savedTitle=title.textContent;
      const label=root.querySelector('[data-ce-relation-label]'),copy=root.querySelector('[data-ce-relation-copy]'),savedLabel=label.textContent,savedCopy=copy.textContent;
      const heights=[Math.ceil(views[0].getBoundingClientRect().height),0,0];
      entries.forEach((entry,index)=>{
        fields.innerHTML=entry.fields.map(([key,label,text])=>`<div data-ce-target="${key}"><dt>${label}</dt><dd>${text}</dd></div>`).join('');title.textContent=entry.title;
        heights[1]=Math.max(heights[1],Math.ceil(views[1].getBoundingClientRect().height));
        const example=graphExamples[['P2','P4','T4'][index]];label.textContent=`${example[0]} → ${example[1]} · ${example[2]}`;copy.textContent=example[3];
        heights[2]=Math.max(heights[2],Math.ceil(views[2].getBoundingClientRect().height));
      });
      fields.innerHTML=savedFields;title.textContent=savedTitle;label.textContent=savedLabel;copy.textContent=savedCopy;
      stableHeights=heights;
    }
    function fit(){
      cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(()=>{
        drawGraph();if(!mobile.matches||!mobileMounted)return;
        const width=stage.getBoundingClientRect().width;if(!width)return;
        if(Math.abs(width-seenWidth)>1){seenWidth=width;measureMobileViews();}
        stage.style.height=`${stableHeights[active]||Math.ceil(views[active].getBoundingClientRect().height)}px`;
      });
    }
    function showView(next){
      active=next;root.dataset.ceView=names[next].toLowerCase();
      buttons.forEach((button,index)=>{button.setAttribute('aria-selected',String(index===next));button.tabIndex=index===next?0:-1;});
      views.forEach((view,index)=>{view.classList.toggle('is-active',index===next);view.inert=index!==next;view.setAttribute('aria-hidden',String(index!==next));});fit();
    }
    function selectEntry(index){
      if(index===selected)return;selected=index;root.dataset.ceEntry=String(index);
      const entry=entries[index];selectGraph(['P2','P4','T4'][index]);
      rows.forEach((row,i)=>{row.classList.toggle('is-selected',i===index);row.setAttribute('aria-pressed',String(i===index));});
      root.querySelector('[data-ce-rule-kind]').innerHTML=entry.kind;
      root.querySelector('[data-ce-rule-title]').textContent=entry.title;
      root.querySelector('[data-ce-binding]').textContent=entry.binding;
      const fields=root.querySelector('[data-ce-rule-fields]');
      fields.innerHTML=entry.fields.map(([key,label,copy])=>`<div data-ce-target="${key}"><dt>${label}</dt><dd>${copy}</dd></div>`).join('');
      fields.classList.remove('is-entering');void fields.offsetWidth;fields.classList.add('is-entering');fit();
    }
    function paint(){
      const index=Math.min(2,Math.floor((elapsed%15000)/5000));
      selectEntry(index);
      const within=elapsed%5000;
      const field=['conditions','trigger','effects'][Math.min(2,Math.floor(within/(5000/3)))];
      root.dataset.ceStage=index===0?'0':index===1?'1':'3';
      root.querySelectorAll('[data-ce-match]').forEach(mark=>mark.classList.toggle('is-current',mark.closest('[data-ce-entry]')===rows[index]&&mark.dataset.ceMatch===field));
      root.querySelectorAll('[data-ce-target]').forEach(node=>node.classList.toggle('is-current',node.dataset.ceTarget===field));
    }
    function tick(time){
      if(!frame)return;const dt=last?Math.min(80,time-last):0;last=time;
      elapsed=(elapsed+dt)%15000;
      // Mobile views change only on a deliberate tab selection. Source focus keeps looping.
      paint();frame=requestAnimationFrame(tick);
    }
    function sync(){
      const run=inView&&!document.hidden&&!reduced.matches&&!held;
      root.dataset.cePlaying=String(run);
      if(run&&!frame){last=0;frame=requestAnimationFrame(tick);}
      else if(!run&&frame){cancelAnimationFrame(frame);frame=0;last=0;}
      paint();
    }
    nodeButtons.filter(node=>node.tagName==='BUTTON').forEach(node=>node.addEventListener('click',()=>{const index=['P2','P4','T4'].indexOf(node.dataset.ceNode);elapsed=index*5000;held=true;manual=true;paint();sync();}));
    rows.forEach((row,index)=>row.addEventListener('click',()=>{elapsed=index*5000;held=true;manual=true;paint();sync();}));
    buttons.forEach((button,index)=>{
      button.addEventListener('click',()=>{manual=true;showView(index);sync();});
      button.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();buttons[next].click();buttons[next].focus();});
    });
    root.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){held=true;sync();}});
    root.addEventListener('focusout',()=>{setTimeout(()=>{if(!root.contains(document.activeElement)){held=false;sync();}},0);});
    function layout(){
      if(mobile.matches&&!mobileMounted){views.forEach((view,index)=>{stage.append(view);view.classList.add('ce-mobile-view');view.id=`ce-view-${index}`;view.setAttribute('role','tabpanel');view.setAttribute('aria-labelledby',buttons[index].id);});root.classList.add('ce-mobile-ready');mobileMounted=true;showView(active);fit();}
      else if(!mobile.matches&&mobileMounted){positions.forEach(({node,marker})=>{marker.after(node);node.classList.remove('ce-mobile-view','is-active');node.inert=false;node.removeAttribute('aria-hidden');node.removeAttribute('role');node.removeAttribute('aria-labelledby');});root.classList.remove('ce-mobile-ready');mobileMounted=false;stage.style.removeProperty('height');}
      if(visibilityObserver){visibilityObserver.disconnect();visibilityObserver.observe(root);}sync();
    }
    if('IntersectionObserver'in window)visibilityObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=.03;sync();},{threshold:[0,.03]});else inView=true;
    if('ResizeObserver'in window){const observer=new ResizeObserver(fit);views.forEach(view=>observer.observe(view));observer.observe(network);}
    root.querySelectorAll('img').forEach(image=>image.addEventListener('load',fit));document.fonts?.ready.then(()=>{seenWidth=0;fit();});
    reduced.addEventListener('change',sync);mobile.addEventListener('change',layout);document.addEventListener('visibilitychange',sync);addEventListener('resize',fit,{passive:true});layout();requestAnimationFrame(drawGraph);
  });
})();

/* Unified revision. */
(function initRevisionImages(){
 document.querySelectorAll('[data-unified-revision]').forEach(root=>{
  if(root.dataset.ready)return;root.dataset.ready='true';
  const cases=[...root.querySelectorAll('[data-ur-case]')],tabs=[...root.querySelectorAll('[data-ur-game]')],rail=root.querySelector('.ur-game-tabs'),status=root.querySelector('[data-ur-status]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let current=0,animation;
  function show(index,focus=false){
   current=(index+cases.length)%cases.length;
   cases.forEach((el,i)=>el.hidden=i!==current);
   tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===current));tab.tabIndex=i===current?0:-1;});
   cases[current].querySelectorAll('img').forEach(img=>img.loading='eager');
   const tab=tabs[current],left=rail.scrollLeft+tab.getBoundingClientRect().left-rail.getBoundingClientRect().left-(rail.clientWidth-tab.clientWidth)/2;
   rail.scrollTo({left,behavior:reduced.matches?'instant':'smooth'});
   if(focus)tab.focus({preventScroll:true});
   status.textContent=tab.textContent;animation?.cancel();
   if(!reduced.matches&&cases[current].animate)animation=cases[current].animate([{opacity:.3},{opacity:1}],{duration:260,easing:'ease-out'});
  }
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>show(i));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();show(event.key==='Home'?0:event.key==='End'?cases.length-1:i+(event.key==='ArrowRight'?1:-1),true);});});
  root.querySelector('[data-ur-prev]').addEventListener('click',()=>show(current-1));root.querySelector('[data-ur-next]').addEventListener('click',()=>show(current+1));
  show(0);
 });
})();

/* Research references. */
document.querySelectorAll('[data-citation]').forEach(section=>{
  const button=section.querySelector('[data-copy-citation]'),code=section.querySelector('[data-citation-text]'),label=section.querySelector('[data-copy-label]'),status=section.querySelector('[data-copy-status]');
  let resetTimer=0;
  function legacyCopy(text){
    const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.setAttribute('aria-hidden','true');Object.assign(field.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});document.body.appendChild(field);field.select();field.setSelectionRange(0,text.length);let copied=false;try{copied=document.execCommand('copy');}catch(_){}field.remove();button.focus({preventScroll:true});return copied;
  }
  button.addEventListener('click',async()=>{
    clearTimeout(resetTimer);let copied=false;const text=code.textContent.trim();
    if(location.protocol!=='file:'&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);copied=true;}catch(_){}}
    if(!copied)copied=legacyCopy(text);
    button.classList.toggle('is-copied',copied);
    if(copied){label.textContent='Copied';status.textContent='BibTeX citation copied to clipboard.';}
    else{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);code.parentElement.focus({preventScroll:true});label.textContent='Text selected';status.textContent='Citation selected. Use your browser’s Copy command.';}
    resetTimer=setTimeout(()=>{button.classList.remove('is-copied');label.textContent='Copy BibTeX';status.textContent='';},2600);
  });
});


/* Glance reading layout. */
/* Reserve the actual enlarged-detail caption height as text reflows. */
(() => {
 const scope=document.querySelector('main[data-view="glance"]');
 if(!scope)return;
 scope.querySelectorAll('[data-evidence-gallery]').forEach(root=>{
  const viewport=root.querySelector('[data-ec-viewport]'),inset=root.querySelector('[data-ec-inset]'),stage=root.querySelector('.ec-media-stage');
  if(!viewport||!inset||!stage)return;
  let frame=0;
  const fit=()=>{frame=0;stage.style.paddingBottom=`${Math.ceil(Math.max(2,inset.offsetTop+inset.offsetHeight-viewport.clientHeight+8))}px`;};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
  new ResizeObserver(schedule).observe(viewport);new ResizeObserver(schedule).observe(inset);
  new MutationObserver(schedule).observe(inset,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  document.fonts?.ready.then(schedule);schedule();
 });
})();


/* Glance svg legibility. */
/* At-a-Glance SVG labels have a 12 CSS-pixel floor at their actual screen scale.
   Only text and its immediate label container change; data and diagram scale do not. */
(() => {
  const scope = document.querySelector('main[data-view="glance"]');
  if (!scope) return;
  const selector = '.dependency-weighted svg,.al-world,.a2z-pipeline svg,.pm-carousel svg,.src-svg';
  const floors = new WeakMap();
  let frame = 0;
  const update = () => {
    frame = 0;
    scope.querySelectorAll(selector).forEach(svg => {
      const matrix = svg.getScreenCTM();
      const scale = matrix && Math.hypot(matrix.a,matrix.b);
      if (!scale || !svg.getBoundingClientRect().width) return;
      svg.querySelectorAll('text').forEach(text => {
        if (!floors.has(text)) floors.set(text, parseFloat(getComputedStyle(text).fontSize));
        const minimum = text.closest('.src-badge') ? 13.05 : 12.05;
        text.style.fontSize = `${Math.max(floors.get(text),minimum/scale)}px`;
      });
      svg.querySelectorAll('.src-badge').forEach(badge => {
        const text = badge.querySelector('text'), rect = badge.querySelector('rect');
        if (!text || !rect) return;
        const box = text.getBBox(), left = Number(rect.getAttribute('x'));
        rect.setAttribute('width', Math.max(44,box.x+box.width+5-left));
        const height = Math.max(24,box.height+6);
        rect.setAttribute('height',height);rect.setAttribute('y',-height/2);
      });
      svg.querySelectorAll('.pp-feedback-title').forEach((text,index) => {
        text.setAttribute('y',index ? 64 : 44);
      });
      svg.querySelectorAll('.src-tick[text-anchor="end"]').forEach(text => {
        text.setAttribute('x',scale < .75 ? 46 : 40);
      });
      svg.querySelectorAll('.al-unmet').forEach(label => {
        const text = label.querySelector('text'),rect = label.querySelector('rect');
        const box = text.getBBox(),width = Math.min(306,box.width+16),height = Math.max(23,box.height+8);
        text.setAttribute('x',310-width/2);text.setAttribute('y',7+height/2+box.height*.32);
        rect.setAttribute('x',310-width);rect.setAttribute('width',width);rect.setAttribute('height',height);
      });
    });
  };
  const schedule = () => { if (!frame) frame=requestAnimationFrame(update); };
  const observer = new ResizeObserver(schedule);
  scope.querySelectorAll(selector).forEach(svg => observer.observe(svg));
  window.addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();



/* Dataset scope. */
(() => {
  document.querySelectorAll('[data-dataset-scope]').forEach(root => {
    const tabs = [...root.querySelectorAll('[data-ds-select]')];
    const cards = [...root.querySelectorAll('[data-ds-split]')];
    const compact = window.matchMedia('(max-width: 760px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let step = 0, visible = false, timer;
    const paint = () => cards.forEach(card => {
      card.querySelectorAll('[data-ds-row],[data-ds-node]').forEach(item => item.classList.toggle('is-focused', Number(item.dataset.dsRow ?? item.dataset.dsNode) === step));
    });
    const accessibility = () => cards.forEach(card => { card.inert = compact.matches && card.dataset.dsSplit !== root.dataset.dsActive; });
    const select = id => { root.dataset.dsActive = id; tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.dsSelect === id))); accessibility(); };
    tabs.forEach(tab => { tab.addEventListener('click', () => select(tab.dataset.dsSelect)); tab.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const target = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-tabs.indexOf(tab)]; select(target.dataset.dsSelect); target.focus(); }); });
    const schedule = () => { clearInterval(timer); if (visible && !document.hidden && !reduced.matches) timer = setInterval(() => { step = (step + 1) % 3; paint(); }, 4600); };
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) root.classList.add('is-visible'); schedule(); }, {threshold:0.08}).observe(root);
    document.addEventListener('visibilitychange', schedule);
    compact.addEventListener('change',accessibility);
    reduced.addEventListener('change',schedule);
    accessibility(); paint();
  });
})();


/* Gdd semantics. */
(() => {
  const root=document.querySelector('[data-gdd-rollout]');
  if(!root)return;
  const pairs=[...root.querySelectorAll('[data-gdd-pair]')];
  const render=()=>{
    const active=Number(root.dataset.gddActive||0), focus=Number(root.dataset.gddFocusedRequirement||0);
    pairs.forEach((pair,index)=>{
      const states=pair.querySelectorAll('[data-gdd-semantic]');
      const selected=index===active?focus:Number(pair.querySelector('[data-gdd-requirement].is-requirement-focus')?.dataset.gddRequirement||0);
      states.forEach(state=>{const show=Number(state.dataset.gddSemantic)===selected;state.classList.toggle('is-semantic-active',show);state.setAttribute('aria-hidden',String(!show));});
      pair.querySelector('[data-gdd-semantics]')?.setAttribute('data-semantic-row',String(selected));
    });
  };
  new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-gdd-active','data-gdd-focused-requirement']});
  render();
})();


/* Glance background. */
(() => {
  const hero = document.querySelector('[data-glance-hero]');
  if (!hero) return;
  const video = hero.querySelector('[data-glance-video]');
  const config = window.A2Z_SITE || {};
  const resolve = value => window.A2Z_PREVIEW_ASSETS?.[value] || value;
  const source = resolve(config.glanceVideoUrl || video.dataset.src || '');
  const poster = resolve(config.glancePosterUrl || '');
  if (poster) video.poster = poster;
  video.hidden = !source;
  if (!source) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, failed = false;
  function sync() {
    const play = visible && !document.hidden && hero.getClientRects().length && !reduce.matches && !failed;
    if (!play) { video.pause(); return; }
    if (!video.getAttribute('src')) video.src = source;
    video.muted = true;
    video.play().catch(error => { if (error.name !== 'AbortError') failed = true; });
  }
  video.addEventListener('error', () => { failed = true; video.hidden = true; });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; sync();
  }, {threshold:.05}).observe(hero);
  else { visible = true; sync(); }
  reduce.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('hashchange', sync);
})();


/* 3d recorded evidence. */
(() => {
 const cases = [{"id":"sonic_course_spin_dash","game":"sonic","title":"Spin dash","file":"assets/extension/sonic-spin-dash.mp4","poster":"assets/extension/sonic-spin-dash.webp"},{"id":"sonic_course_rail_jump","game":"sonic","title":"Rail jump","file":"assets/extension/sonic-rail-jump.mp4","poster":"assets/extension/sonic-rail-jump.webp"},{"id":"sonic_course_homing_hit","game":"sonic","title":"Homing attack","file":"assets/extension/sonic-homing-hit.mp4","poster":"assets/extension/sonic-homing-hit.webp"},{"id":"sonic_course_focus_return","game":"sonic","title":"Focus return","file":"assets/extension/sonic-focus-return.mp4","poster":"assets/extension/sonic-focus-return.webp"},{"id":"rocket_goal","game":"rocket_league","title":"Goal and score","file":"assets/extension/rocket-goal.mp4","poster":"assets/extension/rocket-goal.webp"},{"id":"rocket_jump","game":"rocket_league","title":"First jump","file":"assets/extension/rocket-jump.mp4","poster":"assets/extension/rocket-jump.webp"},{"id":"rocket_league_opponent_jump","game":"rocket_league","title":"Opponent jump","file":"assets/extension/rocket-opponent-jump.mp4","poster":"assets/extension/rocket-opponent-jump.webp"},{"id":"rocket_pitch_cancel","game":"rocket_league","title":"Pitch cancellation","file":"assets/extension/rocket-pitch-cancel.mp4","poster":"assets/extension/rocket-pitch-cancel.webp"}];
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const resolve = value => window.A2Z_PREVIEW_ASSETS?.[value] || value;
 document.querySelectorAll('[data-xe-player]').forEach(root => {
  const video = root.querySelector('[data-xe-video]');
  const games = [...root.querySelectorAll('[data-xe-game]')];
  const choices = [...root.querySelectorAll('[data-xe-case]')];
  const panels = [...root.querySelectorAll('[data-xe-panel]')];
  const status = root.querySelector('[data-xe-status]');
  let active = cases[0], visible = false, manuallyPaused = false, userStarted = false, request = 0, changing = false;
  const remembered = {sonic: cases[0].id, rocket_league: cases.find(c => c.game === 'rocket_league').id};
  function sync() {
   const ticket = ++request;
   if (!visible || document.hidden) { video.pause(); return; }
   if (!video.getAttribute('src')) { video.src = resolve(active.file); video.load(); }
   if (manuallyPaused || (reduced.matches && !userStarted)) { video.pause(); return; }
   video.play().then(() => {
    if (ticket !== request && (!visible || document.hidden || manuallyPaused)) video.pause();
   }).catch(() => {});
  }
  function select(id, announce = false) {
   const next = cases.find(c => c.id === id);
   if (!next) return;
   changing = true;
   active = next;
   remembered[next.game] = next.id;
   root.dataset.xeActive = next.id;
   root.dataset.xeGame = next.game;
   games.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.xeGame === next.game)));
   choices.forEach(button => {
    button.hidden = button.dataset.xeFor !== next.game;
    button.setAttribute('aria-pressed', String(button.dataset.xeCase === next.id));
   });
   panels.forEach(panel => { panel.hidden = panel.dataset.xePanel !== next.id; });
   video.pause();
   video.poster = resolve(next.poster);
   video.src = resolve(next.file);
   video.setAttribute('aria-label', next.title + ' gameplay');
   video.playbackRate = 1;
   video.load();
   manuallyPaused = false;
   if (announce) status.textContent = next.title + ' selected.';
   sync();
  }
  choices.forEach(button => button.addEventListener('click', () => select(button.dataset.xeCase, true)));
  games.forEach(button => button.addEventListener('click', () => {
   select(remembered[button.dataset.xeGame], true);
   root.querySelector('.xe-clip-list').scrollLeft = 0;
  }));
  video.addEventListener('pause', () => {
   if (!changing && visible && !document.hidden && video.readyState >= 3 && !video.seeking && video.currentTime > 0) manuallyPaused = true;
  });
  video.addEventListener('play', () => { manuallyPaused = false; userStarted = true; });
  video.addEventListener('loadeddata', () => { changing = false; sync(); });
  if ('IntersectionObserver' in window) {
   new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, {threshold: .1}).observe(root.querySelector('.xe-screen'));
  } else { visible = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  root.dataset.xeActive = active.id;
  root.dataset.xeGame = active.game;
 });
})();


/* Dataset connection alignment. */
(() => {
 document.querySelectorAll('.ds-map-big').forEach(map=>{
  const svg=map.querySelector('svg'),paths=[...svg.querySelectorAll(':scope > path')];
  function draw(){
   const box=map.getBoundingClientRect();if(!box.width||paths.length!==7)return;
   svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
   const b={};['a','b','c','d','e','f'].forEach(key=>{const r=map.querySelector('.ds-node-'+key).getBoundingClientRect();b[key]={x:r.x-box.x,y:r.y-box.y,w:r.width,h:r.height};});
   const midY=n=>n.y+n.h/2,bottom=n=>n.y+n.h;
   const leftward=(a,z)=>`M${a.x-1} ${midY(a)} H${z.x+z.w+2}`;
   const rightward=(a,z)=>`M${a.x+a.w+1} ${midY(a)} H${z.x-2}`;
   const y=bottom(b.b)+(b.d.y-bottom(b.b))*.52;
   const ds=[
    leftward(b.b,b.a),rightward(b.b,b.c),
    `M${b.b.x+b.b.w*.4} ${bottom(b.b)+1} L${b.d.x+b.d.w*.65} ${b.d.y-2}`,
    rightward(b.d,b.e),rightward(b.e,b.f),
    `M${b.a.x+b.a.w*.5} ${bottom(b.a)+1} V${y} H${b.b.x+b.b.w*.25} V${bottom(b.b)+2}`,
    `M${b.c.x+b.c.w*.5} ${bottom(b.c)+1} V${y} H${b.b.x+b.b.w*.75} V${bottom(b.b)+2}`
   ];
   paths.forEach((path,index)=>path.setAttribute('d',ds[index]));
  }
  if('ResizeObserver'in window)new ResizeObserver(draw).observe(map);else addEventListener('resize',draw,{passive:true});
  document.fonts?.ready.then(draw);draw();
 });
})();


/* Adaptive gameplay. */
(() => {
  const root = document.querySelector('main[data-view="glance"] [data-agp-comparison]');
  if (!root) return;
  const episodes = {"normal":{"src":"assets/adaptive/abyssal-art-normal.mp4","poster":"assets/adaptive/abyssal-art-normal-poster.webp","width":1280,"height":720,"label":"Normal play in Abyssal Chain, with the seal intact and gate opening unverified","phases":[{"at":0,"id":"normal","action":"Try the normal controls.","result":"testing","gate":"closed","seal":"intact"},{"at":1.85,"id":"unverified","action":"Gate opening is unverified.","result":"unverified","gate":"closed","seal":"intact"}]},"targeted":{"src":"assets/adaptive/abyssal-art-target.mp4","poster":"assets/adaptive/abyssal-art-target-poster.webp","width":1280,"height":720,"label":"Targeted adversarial test in Abyssal Chain, where a placed charge breaks the final seal and opens the Rift Gate","phases":[{"at":0,"id":"initialize","action":"Start beside the last weakened seal.","result":"testing","gate":"closed","seal":"intact"},{"at":1.7,"id":"approach","action":"Approach the seal.","result":"testing","gate":"closed","seal":"intact"},{"at":2.5,"id":"nearby","action":"Approach the seal.","result":"testing","gate":"closed","seal":"intact"},{"at":4.5,"id":"place","action":"Place a charge.","result":"testing","gate":"closed","seal":"intact"},{"at":5.4,"id":"armed","action":"Charge ready.","result":"testing","gate":"closed","seal":"intact"},{"at":7.4,"id":"detonate","action":"Detonate.","result":"testing","gate":"closed","seal":"intact"},{"at":7.6,"id":"outcome","action":"The seal breaks. The gate opens.","result":"satisfied","gate":"open","seal":"broken"}]}};
  const cards = [...root.querySelectorAll('[data-agp-case]')];
  const normal = root.querySelector('[data-agp-video="normal"]');
  const target = root.querySelector('[data-agp-video="targeted"]');
  const videos = [normal, target];
  const toggle = root.querySelector('[data-agp-toggle]');
  const seek = root.querySelector('[data-agp-seek]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, userStarted = false, userPaused = false, complete = false;
  let frame = 0, request = 0, pending = false;
  const shortActions = {
    normal:'Try normal controls', unverified:'Seal intact', initialize:'Last seal weakened',
    approach:'Approach the seal', nearby:'Approach the seal', place:'Place a charge',
    armed:'Charge ready', detonate:'Detonate', outcome:'Seal breaks, gate opens'
  };
  const duration = () => Number.isFinite(target.duration) ? target.duration : 11.88;
  const formatTime = time => `0:${String(Math.round(time)).padStart(2,'0')}`;
  function render() {
    cards.forEach(card => {
      const name = card.dataset.agpCase;
      const episode = episodes[name];
      const video = name === 'normal' ? normal : target;
      const time = video.currentTime || 0;
      const phase = [...episode.phases].reverse().find(item => time >= item.at) || episode.phases[0];
      card.dataset.agpPhase = phase.id;
      card.querySelector('[data-agp-action]').textContent = shortActions[phase.id];
      const result = card.querySelector('[data-agp-result]');
      result.dataset.agpResult = phase.result;
      card.querySelector('[data-agp-result-text]').textContent = phase.result === 'satisfied' ? 'Satisfied' : phase.result === 'unverified' ? 'Unverified' : 'Testing';
      card.querySelector('[data-agp-result-icon]').textContent = phase.result === 'satisfied' ? '✓' : phase.result === 'unverified' ? '○' : '·';
      const path = card.querySelector('[data-agp-trajectory]');
      const gateOpen = name === 'targeted' && time >= 7.48;
      const chargePlaced = name === 'targeted' && time >= 4.5;
      const frontier = name === 'normal' ? 0 : gateOpen ? 3 : chargePlaced ? 2 : 1;
      path.dataset.stopped = String(name === 'normal' && phase.result === 'unverified');
      path.dataset.complete = String(gateOpen);
      path.querySelectorAll('[data-agp-node]').forEach(node => {
        const index = Number(node.dataset.agpNode);
        node.dataset.reached = String(name === 'normal' ? index === 0 : index >= 1 && index <= frontier);
        node.dataset.current = String(index === frontier);
      });
      // The strip is a test trajectory, not an inferred player location.
      const progress = gateOpen ? 100 : chargePlaced ? 50 + 50 * Math.min(1, (time - 4.5) / (7.48 - 4.5)) : 50 * Math.max(0, Math.min(1, (time - 1.7) / (4.5 - 1.7)));
      const trail = path.querySelector('[data-agp-path-progress]');
      trail.setAttribute('d', `M100 6H${100 + 2 * progress}`);
      trail.style.opacity = progress > 0 ? '1' : '0';
      path.setAttribute('aria-label', name === 'normal'
        ? 'Normal play does not reach the final seal. Gate opening remains unverified.'
        : gateOpen ? 'The targeted test placed a charge, destroyed the final seal and opened the Rift Gate.'
        : chargePlaced ? 'Initialized beside the final seal, the targeted test has placed a charge. The gate is still closed.'
        : 'The targeted test initializes beside the last live seal, then tests the steps leading to opening the Rift Gate.');
    });
    const running = !target.paused && !target.ended;
    const label = complete ? 'Replay' : running ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', `${label} comparison`);
    root.querySelector('[data-agp-toggle-text]').textContent = label;
    root.querySelector('[data-agp-toggle-icon]').textContent = complete ? '↻' : running ? 'Ⅱ' : '▶';
    // Keep the toolbar footprint stable and present one Replay action at completion.
    const replay = root.querySelector('[data-agp-replay]');
    replay.style.visibility = complete ? 'hidden' : '';
    replay.disabled = complete;
    seek.max = duration();
    seek.value = target.currentTime || 0;
    seek.setAttribute('aria-valuetext', `${formatTime(target.currentTime || 0)} of ${formatTime(duration())}`);
    root.querySelector('[data-agp-time]').textContent = `${formatTime(target.currentTime || 0)} / ${formatTime(duration())}`;
    root.dataset.agpPlaying = String(running);
  }
  function canPlay() {
    return visible && !document.hidden && root.dataset.methodSuspended !== 'true' && !userPaused && !complete && (!reduced.matches || userStarted);
  }
  function pause() {
    videos.forEach(video => video.pause());
    cancelAnimationFrame(frame);
    render();
  }
  function alignNormal(force = false) {
    if (!Number.isFinite(normal.duration)) return;
    const end = Math.max(0, normal.duration - .025);
    const desired = Math.min(target.currentTime || 0, end);
    if (force || Math.abs(normal.currentTime - desired) > .16) normal.currentTime = desired;
    if ((target.currentTime || 0) >= end) normal.pause();
  }
  function tick() {
    alignNormal();
    render();
    if (!target.paused && !target.ended) frame = requestAnimationFrame(tick);
  }
  function sync() {
    const ticket = ++request;
    if (!canPlay()) { pause(); return; }
    if (pending) return;
    if (normal.readyState < 2 || target.readyState < 2) {
      videos.forEach(video => {
        video.preload = 'auto';
        if (!video.getAttribute('src')) {
          video.src = window.A2Z_PREVIEW_ASSETS?.[video.dataset.src] || video.dataset.src;
          video.load();
        }
      });
      return;
    }
    alignNormal();
    pending = true;
    const playable = (target.currentTime || 0) < normal.duration - .025 ? videos : [target];
    Promise.all(playable.map(video => video.play())).then(() => {
      if (ticket !== request && !canPlay()) pause();
      else { cancelAnimationFrame(frame); tick(); }
    }).catch(() => { pause(); }).finally(() => { pending = false; render(); });
  }
  function restart() {
    pause();
    complete = false;
    target.currentTime = 0;
    normal.currentTime = 0;
    userStarted = true;
    userPaused = false;
    render();
    sync();
  }
  toggle.addEventListener('click', () => {
    if (complete) { restart(); return; }
    userStarted = true;
    userPaused = !target.paused;
    sync();
  });
  root.querySelector('[data-agp-replay]').addEventListener('click', restart);
  seek.addEventListener('input', () => {
    const time = Number(seek.value);
    complete = time >= duration();
    target.currentTime = time;
    alignNormal(true);
    render();
    if (complete) pause();
    else sync();
  });
  videos.forEach(video => {
    video.controls = false;
    video.addEventListener('loadedmetadata', render);
    video.addEventListener('loadeddata', sync);
    video.addEventListener('canplay', sync);
    video.addEventListener('timeupdate', render);
    video.addEventListener('seeked', render);
  });
  target.addEventListener('ended', () => { complete = true; pause(); });
  normal.addEventListener('ended', render);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('a2z-method-visibility', sync);
  reduced.addEventListener('change', () => { userStarted = false; sync(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
    sync();
  }, {threshold:[0,.15]}).observe(root.querySelector('.agp-comparison'));
  else visible = true;
  root.querySelectorAll('[data-agp-controls]').forEach(node => { node.hidden = false; });
  render();
  sync();
})();


/* Root details. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('details.abstract').forEach(details => {
    const summary = details.querySelector('summary');
    if (!summary || details.dataset.overviewReady) return;
    let animation = null, expanded = details.open;
    details.dataset.overviewReady = 'true';
    function settle() {
      if (animation) { animation.cancel(); animation = null; }
      details.open = expanded;
      details.style.height = '';
      details.dataset.overviewExpanded = String(expanded);
      summary.setAttribute('aria-expanded', String(expanded));
    }
    function change() {
      const from = details.getBoundingClientRect().height;
      if (animation) { animation.cancel(); animation = null; }
      expanded = !expanded;
      details.dataset.overviewExpanded = String(expanded);
      summary.setAttribute('aria-expanded', String(expanded));
      if (reduced.matches || !details.animate) { settle(); return; }
      details.style.height = '';
      details.open = true;
      const style = getComputedStyle(details);
      const closed = summary.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const to = expanded ? details.getBoundingClientRect().height : closed;
      details.style.height = `${to}px`;
      animation = details.animate([{height:`${from}px`},{height:`${to}px`}],{duration:360,easing:'cubic-bezier(.22,.61,.36,1)'});
      animation.onfinish = settle;
    }
    summary.addEventListener('click', event => { event.preventDefault(); change(); });
    reduced.addEventListener('change', settle);
    let width = details.getBoundingClientRect().width;
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      const next = details.getBoundingClientRect().width;
      if (Math.abs(next-width)>.5) { width=next; settle(); }
    }).observe(details);
    settle();
  });

  const frame = document.querySelector('[data-glance-feature-film]');
  const video = frame?.querySelector('[data-feature-video]');
  if (!video) return;
  let visible=false, manuallyPaused=false, userStarted=false, request=0, loaded=false, internalPause=false;
  const load = () => {
    if (loaded) return;
    loaded=true;
    const source=video.dataset.src;
    video.src=window.A2Z_PREVIEW_ASSETS?.[source] || source;
    video.preload='metadata';
    video.load();
  };
  const pause = () => { if(video.paused)return;internalPause=true;video.pause(); };
  function sync() {
    const ticket=++request;
    if (!visible || document.hidden || manuallyPaused || (reduced.matches && !userStarted)) { pause();return; }
    load();
    video.play().then(()=>{if(ticket!==request&&(!visible||document.hidden||manuallyPaused))pause();}).catch(()=>{});
  }
  video.addEventListener('pause',()=>{if(internalPause){internalPause=false;return;}if(visible&&!document.hidden&&!video.seeking&&video.readyState>=3&&video.currentTime>0)manuallyPaused=true;});
  video.addEventListener('play',()=>{manuallyPaused=false;userStarted=true;});
  video.addEventListener('pointerdown',load,{once:true});
  video.addEventListener('keydown',load,{once:true});
  video.addEventListener('loadeddata',sync);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.2; if(visible)load();sync();},{threshold:[0,.2]}).observe(video);
  else {visible=true;load();sync();}
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
})();




/* Home film. */
(() => {
  const cue=document.querySelector('[data-hero-scroll-cue]');
  const runway=document.querySelector('[data-hero-scroll]');
  if(!cue || !runway)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  cue.addEventListener('click',() => {
    const header=document.querySelector('.masthead')?.getBoundingClientRect().height || 0;
    const travel=parseFloat(getComputedStyle(runway).getPropertyValue('--hero-travel')) || window.innerHeight;
    const top=window.scrollY+runway.getBoundingClientRect().top-header+travel*.9;
    window.scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
  });
})();

window.A2ZLoader?.ready();
})().catch(error => {
  window.A2ZLoader?.ready();
  console.error('Site initialization failed:', error);
});
