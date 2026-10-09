/* Visitor-local lighting: illustrative clock windows, no location or storage. */
(() => {
  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const stops=[0,.075,.15,.3,.5,.75,1];
  const phases={
    sunrise:{label:'Sunrise',hour:6.5,palette:['#2c1c36','#2c1c36','#57344d','#ab6878','#e89a92','#f6c9af','#f9e8c8'],paper:'#fff1d8',ink:'#2c1c36',accent:'#efb69a',heading:'#813f54',reply:'#39233e',hover:'#56344f'},
    day:{label:'Daytime',hour:12,palette:['#0b3546','#0b3546','#1d779f','#2aadd0','#68d2e2','#a7e0fb','#ecfaff'],buildings:['#31545d','#31545d','#7899a2','#b1c5c7','#d1dcd4','#f0e9d4','#fff7dd'],paper:'#fffae8',ink:'#123b46',accent:'#d7e9bd',heading:'#174559',reply:'#123e4b',hover:'#1d5360'},
    sunset:{label:'Sunset',hour:18.5,palette:null,paper:'#ffe8cf',ink:'#230210',accent:'#ff9b9b',heading:'#000000',reply:'#230210',hover:'#431323'},
    night:{label:'Night',hour:23,palette:['#070f1c','#070f1c','#172c3f','#345a72','#39586f','#182d47','#0d1b32'],paper:'#e3edf0',ink:'#142738',accent:'#a3c8d8',heading:'#c7e0e8',reply:'#0e1e30',hover:'#233b51'}
  };
  const keys=Object.keys(phases);
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const hex=channels=>'#'+channels.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');
  function sample(palette,value) {
    let i=0;while(i<stops.length-2&&value>stops[i+1])i++;
    const a=rgb(palette[i]),b=rgb(palette[i+1]);
    const t=Math.max(0,Math.min(1,(value-stops[i])/(stops[i+1]-stops[i])));
    return a.map((c,j)=>c+(b[j]-c)*t);
  }
  // Long clock handovers; presets land in each state's settled plateau.
  const handovers=[
    {start:270,end:360,from:'night',to:'sunrise'},
    {start:420,end:540,from:'sunrise',to:'day'},
    {start:990,end:1110,from:'day',to:'sunset'},
    {start:1140,end:1260,from:'sunset',to:'night'}
  ];
  function clockState(minutes) {
    const weights=Object.fromEntries(keys.map(k=>[k,0]));
    const window=handovers.find(w=>minutes>=w.start&&minutes<w.end);
    if(window) {
      const t=(minutes-window.start)/(window.end-window.start);
      const amount=t*t*(3-2*t);
      weights[window.from]=1-amount;weights[window.to]=amount;
      return {weights,from:window.from,to:window.to,amount};
    }
    const phase=minutes<270||minutes>=1260?'night':minutes<420?'sunrise':minutes<990?'day':'sunset';
    weights[phase]=1;return {weights,from:phase,to:phase,amount:0};
  }
  const dominant=weights=>keys.reduce((a,b)=>weights[a]>=weights[b]?a:b);
  // Color is prepared once in lossless assets. No animated SVG recoloring.
  // Alpha-bounded images retain their original source-coordinate projection.
  const artwork=[...document.querySelectorAll('#parallax .parallax-layer > picture')].map(picture=>{
    const number=picture.querySelector('img').getAttribute('src').match(/bg(\d)@/)[1];
    const stack=document.createElement('div');stack.className='time-art';stack.setAttribute('aria-hidden','true');
    picture.after(stack);return {picture,stack,number,images:{},loads:{},bounds:null,placement:null};
  });
  function positionArtwork() {
    const hero=document.getElementById('parallax'),w=hero.clientWidth,h=hero.clientHeight;
    const foregroundTop=Math.max(0,h+(696-1125)*Math.max(w/1800,h/1125)-2);
    document.getElementById('foreground-canvas').style.clipPath=`inset(${foregroundTop}px 0 0)`;
    document.getElementById('water-canvas').style.clipPath='inset(54% 0 0)';
    for(const layer of artwork) {
      if(!layer.bounds)continue;
      const {source,box}=layer.bounds,scale=Math.max(w/source[0],h/source[1]);
      const x=(w-source[0]*scale)/2+box[0]*scale,y=h-source[1]*scale+box[1]*scale;
      const width=(box[2]-box[0])*scale,height=(box[3]-box[1])*scale;
      const left=Math.max(0,x),top=Math.max(0,y),right=Math.min(w,x+width),bottom=Math.min(h,y+height);
      Object.assign(layer.picture.parentElement.style,{left:left+'px',top:top+'px',right:'auto',bottom:'auto',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px',overflow:'hidden'});
      layer.placement={position:'absolute',left:(x-left)+'px',top:(y-top)+'px',width:width+'px',height:height+'px',objectFit:'fill'};
      for(const image of [layer.picture.querySelector('img'),...Object.values(layer.images)])Object.assign(image.style,layer.placement);
    }
  }
  const sourceCaches=Object.fromEntries([['foreground','1'],['water','9'],['reflection','10']].map(([name,id])=>{
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1125;
    return [name,{id,canvas,ctx:canvas.getContext('2d',{willReadFrequently:name==='foreground'}),images:{},loads:{},bounds:null}];
  }));
  const boundsReady=fetch('images/local-light/bounds.json?v=4').then(r=>r.json()).then(bounds=>{
    for(const cache of Object.values(sourceCaches))cache.bounds=bounds[cache.id].box;
    for(const layer of artwork) {
      layer.bounds=bounds[layer.number];
      layer.picture.querySelector('source').srcset=`images/local-light/original/bg${layer.number}.webp?v=4`;
      layer.picture.querySelector('img').src=`images/local-light/original/bg${layer.number}.webp?v=4`;
    }
    positionArtwork();
  });
  window.addEventListener('resize',positionArtwork);
  async function prepareArtwork(weights) {
    await boundsReady;
    await Promise.all(Object.entries(sourceCaches).flatMap(([name,cache])=>keys.filter(k=>weights[k]>1e-8).map(key=>{
      if(!cache.loads[key]) {
        const image=new Image();cache.images[key]=image;
        image.src=`images/local-light/${key}/${name}.webp?v=4`;cache.loads[key]=image.decode();
      }
      return cache.loads[key];
    })));
    await Promise.all(artwork.flatMap(layer=>keys.filter(k=>weights[k]>1e-8).map(key=>{
      if(!layer.loads[key]) {
        const image=new Image();image.alt='';image.className='time-art-image';image.hidden=true;
        layer.images[key]=image;layer.stack.append(image);
        if(layer.placement)Object.assign(image.style,layer.placement);
        image.src=`images/local-light/${key}/bg${layer.number}.webp?v=4`;
        layer.loads[key]=image.decode();
      }
      return layer.loads[key];
    })));
  }
  function paintArtwork(weights,nativeSunset) {
    if(nativeSunset) {window.__timeForeground=null;window.__timeWater=null;}
    else {
      for(const cache of Object.values(sourceCaches)) {
        cache.ctx.clearRect(0,0,1800,1125);cache.ctx.globalCompositeOperation='lighter';
        for(const key of keys)if(weights[key]>1e-8) {
          cache.ctx.globalAlpha=weights[key];
          cache.ctx.drawImage(cache.images[key],cache.bounds[0],cache.bounds[1]);
        }
        cache.ctx.globalAlpha=1;
      }
      window.__timeForeground=sourceCaches.foreground.canvas;
      window.__timeWater={water:sourceCaches.water.canvas,reflection:sourceCaches.reflection.canvas};
    }
    window.__timeForegroundRedraw?.();window.__timeWaterRedraw?.();
    for(const layer of artwork) {
      layer.picture.style.opacity=nativeSunset?'1':'0';
      for(const [key,image]of Object.entries(layer.images)) {
        const amount=nativeSunset?0:weights[key];
        image.hidden=amount<1e-8;image.style.opacity=String(amount);
      }
    }
  }

  // Quiet, deterministic points in the sky, behind the skyline and headings.
  const stars=document.createElement('div');
  stars.className='parallax-layer time-stars';stars.dataset.speed='0.1';stars.setAttribute('aria-hidden','true');
  let seed=73;
  const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const starGroups=Array.from({length:4},(_,i)=>{
    const group=document.createElement('div');group.className='time-star-group';
    group.style.cssText=`--star-period:${6+i*1.3}s;--star-delay:${-i*2.7}s`;
    stars.append(group);return group;
  });
  for(let i=0;i<96;i++) {
    let x=random()*96+2,y=random()*29+2;
    if(x>15&&x<85&&y>11&&y<23)y=3+random()*6;
    const point=document.createElement('span');point.className='time-star';
    const size=(1+random()*1.6).toFixed(2);
    point.style.cssText=`left:${x.toFixed(2)}%;top:${(y/33*100).toFixed(2)}%;width:${size}px;height:${size}px;opacity:${(.35+random()*.6).toFixed(2)}`;
    starGroups[i%4].append(point);
  }
  document.querySelector('.birds-layer').before(stars);
  const birds=document.querySelector('.birds-layer');birds.setAttribute('aria-hidden','true');

  let visibleWeights,goal,frame=0,lastPaint=0,renderEpoch=0;
  function mixedColor(property,weights) {
    return hex([0,1,2].map(j=>keys.reduce((v,k)=>v+rgb(phases[k][property])[j]*weights[k],0)));
  }
  const floors={sunrise:sample(phases.sunrise.palette,.05),day:sample(phases.day.palette,.05),sunset:rgb('#21040f'),night:sample(phases.night.palette,.05)};
  const skies={sunrise:sample(phases.sunrise.palette,.83),day:sample(phases.day.palette,.83),sunset:rgb('#fadac3'),night:sample(phases.night.palette,.83)};
  function paint(weights) {
    visibleWeights={...weights};
    const nativeSunset=weights.sunset>1-1e-8;
    root.toggleAttribute('data-time-grading',!nativeSunset);
    root.dataset.timeOfDay=dominant(weights);
    paintArtwork(weights,nativeSunset);
    // Match the actual blended dock pixels, including 8-bit canvas rounding.
    const floor=nativeSunset?floors.sunset:Array.from(sourceCaches.foreground.ctx.getImageData(900,1100,1,1).data).slice(0,3);
    root.style.setProperty('--scene-floor',hex(floor));
    root.style.setProperty('--time-sky',hex([0,1,2].map(j=>keys.reduce((v,k)=>v+skies[k][j]*weights[k],0))));
    for(const[property,name]of[['paper','--encounter-paper'],['ink','--encounter-ink'],['accent','--encounter-accent'],['accent','--time-accent'],['heading','--time-heading'],['reply','--time-reply'],['hover','--time-reply-hover']])root.style.setProperty(name,mixedColor(property,weights));
    root.style.setProperty('--time-day',String(weights.day));
    root.style.setProperty('--time-night',String(weights.night));
    root.dataset.timeSky=weights.night>.999?'night':weights.night<.001?'day':'changing';
    birds.style.opacity=String(1-weights.night);
    if(window.__timeOfDay)Object.assign(window.__timeOfDay,{weights:{...weights},transitioning:!!frame,nightAmount:weights.night});
  }
  async function render(animate=true) {
    const epoch=++renderEpoch;
    const date=new Date();
    const minutes=date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
    const state=clockState(minutes),phase=dominant(state.weights);
    const target=state.weights;
    try {
      await prepareArtwork(Object.fromEntries(keys.map(k=>[k,Math.max(target[k],visibleWeights?.[k]||0)])));
    } catch (error) {
      // A failed optional palette must not break the conversation or form.
      console.warn('Local lighting could not load; keeping the current scene.',error);
      return;
    }
    if(epoch!==renderEpoch)return;
    goal=target;
    window.__timeOfDay={mode:'auto',phase,minutes,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,clockBlend:state,weights:{...(visibleWeights||goal)},nightAmount:(visibleWeights||goal).night,transitioning:false,geometry:'original',locationAccess:false,solarTimes:false};
    cancelAnimationFrame(frame);frame=0;
    const unchanged=visibleWeights&&keys.every(k=>Math.abs(visibleWeights[k]-goal[k])<1e-8);
    if(unchanged) {Object.assign(window.__timeOfDay,{weights:{...visibleWeights},transitioning:false,nightAmount:visibleWeights.night});return;}
    if(!animate||reduced.matches||document.hidden||scrollY>innerHeight/.8||!visibleWeights) {paint(goal);return;}
    const from={...visibleWeights},start=performance.now();lastPaint=0;
    function tick(now) {
      const t=Math.min(1,(now-start)/2400),ease=t*t*(3-2*t);
      if(now-lastPaint>=40||t===1) {
        lastPaint=now;paint(Object.fromEntries(keys.map(k=>[k,from[k]+(goal[k]-from[k])*ease])));
      }
      if(t<1)frame=requestAnimationFrame(tick);
      else {frame=0;paint(goal);}
    }
    frame=requestAnimationFrame(tick);
    window.__timeOfDay.transitioning=true;
  }
  render(false);
  setInterval(()=>{if(!document.hidden)render()},30000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;if(window.__timeOfDay)window.__timeOfDay.transitioning=false;root.classList.add('time-paused');}else{root.classList.remove('time-paused');render(false);}});
  reduced.addEventListener('change',()=>render(false));
  window.addEventListener('pageshow',()=>render(false));
})();
