(() => {
  'use strict';
  const story = document.querySelector('.story-scroll');
  const stage = document.querySelector('.story-stage');
  const ink = document.querySelector('.scroll-ink');
  const words = [...ink.querySelectorAll('span')];
  const tabs = [...document.querySelectorAll('[data-scene]')];
  const cards = [...document.querySelectorAll('[data-card]')];
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;
  const clamp = n => Math.max(0, Math.min(1,n));
  function frame() {
    queued = false;
    if(preference.matches) return;
    const y = ink.getBoundingClientRect().top;
    const progress = clamp((innerHeight*.84-y)/(innerHeight*.68));
    words.forEach((word,i)=>word.style.setProperty('--fill', `${clamp(progress*(words.length+1)-i)*100}%`));
    const rect = story.getBoundingClientRect();
    const travel = Math.max(1,story.offsetHeight-stage.offsetHeight);
    const p = clamp((innerHeight*.1-rect.top)/travel);
    story.style.setProperty('--story-progress', p);
    const transition = clamp((p-.38)/.24);
    story.style.setProperty('--card-shift', transition);
    const active = p>.5 ? 1 : 0;
    tabs.forEach((tab,i)=>tab.setAttribute('aria-pressed',String(i===active)));
    cards.forEach((card,i)=>{
      card.setAttribute('aria-hidden',String(i!==active));
      card.querySelectorAll('a').forEach(a=>a.tabIndex=i===active ? 0 : -1);
    });
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(frame);}}
  function configure(){
    document.documentElement.classList.toggle('scroll-motion',!preference.matches);
    if(preference.matches){words.forEach(w=>w.style.setProperty('--fill','100%'));cards.forEach(c=>{c.removeAttribute('aria-hidden');c.querySelectorAll('a').forEach(a=>a.removeAttribute('tabindex'));});}
    schedule();
  }
  tabs.forEach((tab,i)=>tab.addEventListener('click',()=>{
    if(preference.matches) return;
    const top=story.getBoundingClientRect().top+scrollY;
    const travel=story.offsetHeight-stage.offsetHeight;
    scrollTo({top:Math.max(0,top-innerHeight*.1+travel*(i ? .8 : .12)),behavior:'smooth'});
  }));
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule);
  addEventListener('pageshow',schedule);
  preference.addEventListener('change',configure);
  configure();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('arrived');observer.unobserve(entry.target);}
  }),{threshold:.18});
  document.querySelectorAll('.steps article,.transition>div,.transition>p').forEach((el,i)=>{
    el.classList.add('enter-on-scroll');el.style.setProperty('--enter-delay',`${i%3*90}ms`);observer.observe(el);
  });
})();

// Pointer feedback is only enabled on devices that can actually hover.
(() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.orb').forEach(orb=>{
    const face=orb.querySelector('.orb-face');
    if(!face)return;
    orb.addEventListener('pointermove',event=>{
      if(!fine.matches||reduced.matches)return;
      const r=orb.getBoundingClientRect();
      face.style.setProperty('--mx',`${(event.clientX-r.left-r.width/2)*.22}px`);
      face.style.setProperty('--my',`${(event.clientY-r.top-r.height/2)*.22}px`);
    },{passive:true});
    orb.addEventListener('pointerleave',()=>{
      face.style.removeProperty('--mx');face.style.removeProperty('--my');
    });
  });
})();

