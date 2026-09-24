(function(){
  if(window.__prumoBottomNavLoaded)return;
  window.__prumoBottomNavLoaded=true;

  const MOBILE_QUERY='(max-width: 900px)';
  let root=null,viewport=null,track=null,sourceNav=null,sourceObserver=null,activeObserver=null;
  let syncing=false,pointerStartX=null,pointerStartY=null;
  let menuAnimated=false,lastVisible=false;

  const ICONS={
    dashboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.7l8.5 6.8v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M9 20.5v-6h6v6"/></svg>',
    history:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14"/><path d="M3 5.5h.01M3 12h.01M3 18.5h.01"/></svg>',
    incomes:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/><path d="M5 20h14"/></svg>',
    debts:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15"/><path d="m6.5 13.5 5.5 5.5 5.5-5.5"/><path d="M5 4h14"/></svg>',
    cards:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M7 15h4"/></svg>',
    projection:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.55v-.08a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2V9.55h.08a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1A1.7 1.7 0 0 0 3.34 6.3l-.06-.06L6.14 3.4l.06.06A1.7 1.7 0 0 0 8.08 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2h4.05v.08a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4H21v4.05h-.08a1.7 1.7 0 0 0-1 .4 1.7 1.7 0 0 0-.52 1.15Z"/></svg>',
    goals:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/></svg>',
    objectives:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/></svg>'
  };

  function iconFor(source){
    const page=String(source?.dataset?.page||'').toLowerCase();
    const text=String(source?.textContent||'').toLowerCase();
    if(ICONS[page])return ICONS[page];
    if(/objetiv|meta/.test(text))return ICONS.goals;
    if(/receita/.test(text))return ICONS.incomes;
    if(/despesa/.test(text))return ICONS.debts;
    if(/cart/.test(text))return ICONS.cards;
    if(/proje/.test(text))return ICONS.projection;
    if(/config/.test(text))return ICONS.settings;
    if(/lanç|lanc|hist/.test(text))return ICONS.history;
    return ICONS.dashboard;
  }

  function injectStyles(){
    if(document.getElementById('prumo-bottom-nav-style'))return;
    const style=document.createElement('style');
    style.id='prumo-bottom-nav-style';
    style.textContent=`
      .prumo-bottom-nav{
        display:none!important;
        position:fixed!important;
        inset:0!important;
        z-index:2147483000!important;
        pointer-events:none!important;
        margin:0!important;
        padding:0!important;
        width:auto!important;height:auto!important;
        transform:none!important;
        contain:layout style;
      }
      .prumo-bottom-nav-shell{
        position:absolute!important;
        left:50%!important;
        bottom:calc(26px + env(safe-area-inset-bottom,0px))!important;
        transform:translate3d(-50%,0,0)!important;
        width:min(94vw,520px);height:72px;
        padding:7px 8px;
        pointer-events:auto!important;
        border:1px solid rgba(72,96,126,.52);
        border-radius:24px;
        background:rgba(9,19,33,.96);
        box-shadow:0 18px 48px rgba(0,0,0,.42);
        -webkit-backdrop-filter:blur(20px) saturate(1.25);
        backdrop-filter:blur(20px) saturate(1.25);
        isolation:isolate;
      }
      .prumo-bottom-nav-viewport{
        width:100%;height:100%;overflow-x:auto;overflow-y:hidden;position:relative;
        scrollbar-width:none;scroll-snap-type:x proximity;scroll-behavior:smooth;
        overscroll-behavior-x:contain;touch-action:pan-x;
      }
      .prumo-bottom-nav-viewport::-webkit-scrollbar{display:none}
      .prumo-bottom-nav-track{display:flex;align-items:stretch;gap:4px;min-width:max-content;height:100%}
      .prumo-bottom-nav-item{
        position:relative;
        flex:0 0 72px;width:72px;min-width:72px;height:58px;
        scroll-snap-align:center;
        border:0;border-radius:18px;padding:5px 4px 4px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        background:transparent;color:#9aabc0;
        -webkit-tap-highlight-color:transparent;
        transition:background .18s ease,color .18s ease,transform .18s ease;
      }
      .prumo-bottom-nav-icon{
        width:24px;height:24px;display:grid;place-items:center;flex:0 0 24px;
      }
      .prumo-bottom-nav-icon svg{
        width:23px;height:23px;display:block;
        fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;
      }
      .prumo-bottom-nav-label{
        width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        text-align:center;font-size:9px;font-weight:700;line-height:1.15;letter-spacing:-.01em;
      }
      .prumo-bottom-nav-item[aria-current="page"]{
        background:#18263a;color:#f3f6fb;
      }
      .prumo-bottom-nav-item[aria-current="page"] .prumo-bottom-nav-icon{
        color:#ddeaac;
      }
      .prumo-bottom-nav-item[aria-current="page"]::after{
        content:'';position:absolute;left:50%;bottom:2px;transform:translateX(-50%);
        width:20px;height:2px;border-radius:999px;background:#ddeaac;
      }
      .prumo-bottom-nav-item[data-page="dashboard"]{
        position:sticky!important;
        left:0!important;
        z-index:6;
        background:#091321;
        box-shadow:10px 0 16px -14px rgba(0,0,0,.95);
      }
      .prumo-bottom-nav-item[data-page="dashboard"][aria-current="page"]{
        background:#18263a;
      }
      .prumo-bottom-nav-item[data-page="dashboard"]::before{
        content:'';
        position:absolute;
        right:-3px;
        top:9px;
        bottom:9px;
        width:1px;
        background:rgba(91,113,140,.34);
      }
      .prumo-bottom-nav-item:active{transform:scale(.96)}
      .prumo-bottom-nav[aria-hidden="true"]{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
      @media(max-width:900px){
        .prumo-bottom-nav{display:block!important;visibility:visible!important;opacity:1!important}
        .prumo-bottom-nav[aria-hidden="true"]{display:none!important;visibility:hidden!important;opacity:0!important}
        .sidebar .nav{display:none!important}
        .main{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))!important}
        .modal-foot{padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
      }
      @media(max-width:420px){
        .prumo-bottom-nav-shell{width:calc(100vw - 20px)}
        .prumo-bottom-nav-item{flex-basis:68px;width:68px;min-width:68px}
      }
      @media(min-width:901px){.prumo-bottom-nav{display:none!important}}
      @media(prefers-reduced-motion:reduce){
        .prumo-bottom-nav-viewport{scroll-behavior:auto}.prumo-bottom-nav-item{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  function playLoadAnimation(){
    if(menuAnimated||!root)return;
    const shell=root.querySelector('.prumo-bottom-nav-shell');
    if(!shell)return;
    const reduced=(()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_e){return false}})();
    menuAnimated=true;
    if(reduced)return;

    try{
      shell.getAnimations?.().forEach(a=>a.cancel());
      shell.animate([
        {opacity:0,transform:'translate3d(-50%,18px,0) scale(.97)',filter:'blur(6px)'},
        {opacity:.78,transform:'translate3d(-50%,-2px,0) scale(1.008)',filter:'blur(1px)',offset:.72},
        {opacity:1,transform:'translate3d(-50%,0,0) scale(1)',filter:'blur(0)'}
      ],{
        duration:520,
        easing:'cubic-bezier(.22,1,.36,1)',
        fill:'none'
      });

      const items=Array.from(track?.querySelectorAll('.prumo-bottom-nav-item')||[]);
      items.slice(0,8).forEach((item,index)=>{
        item.getAnimations?.().forEach(a=>a.cancel());
        item.animate([
          {opacity:0,transform:'translateY(9px) scale(.94)'},
          {opacity:1,transform:'translateY(0) scale(1)'}
        ],{
          duration:360,
          delay:90+(index*42),
          easing:'cubic-bezier(.22,1,.36,1)',
          fill:'backwards'
        });
      });

      const active=track?.querySelector('.prumo-bottom-nav-item[aria-current="page"] .prumo-bottom-nav-icon');
      if(active){
        active.animate([
          {transform:'scale(.82)',opacity:.45},
          {transform:'scale(1.12)',opacity:1,offset:.72},
          {transform:'scale(1)',opacity:1}
        ],{
          duration:430,
          delay:230,
          easing:'cubic-bezier(.22,1,.36,1)'
        });
      }
    }catch(_e){}
  }

  function syncVisibility(){
    if(!root)return;
    const app=document.getElementById('appRoot');
    const auth=document.getElementById('authScreen');
    const appVisible=!!(app&&!app.hidden&&!app.classList.contains('auth-hidden'));
    const authVisible=!!(auth&&!auth.hidden&&!auth.classList.contains('hidden'));
    const splashActive=!!document.body?.classList.contains('prumo-app-splash')&&!document.body?.classList.contains('caderno-splash-done');
    const show=appVisible&&!authVisible&&!splashActive;
    const visible=show&&window.matchMedia(MOBILE_QUERY).matches;
    root.style.setProperty('display',visible?'block':'none','important');
    root.style.setProperty('visibility',visible?'visible':'hidden','important');
    root.style.setProperty('opacity',visible?'1':'0','important');
    root.style.setProperty('pointer-events',visible?'none':'none','important');
    const shell=root.querySelector('.prumo-bottom-nav-shell');
    if(shell) shell.style.setProperty('pointer-events',visible?'auto':'none','important');
    root.setAttribute('aria-hidden',visible?'false':'true');
    if(visible&&!lastVisible){
      requestAnimationFrame(()=>requestAnimationFrame(playLoadAnimation));
    }
    lastVisible=visible;
  }

  function buttons(){return sourceNav?Array.from(sourceNav.querySelectorAll('button[data-page]')):[]}
  function currentIndex(){const list=buttons(),i=list.findIndex(btn=>btn.classList.contains('active'));return i>=0?i:0}

  function centerIndex(index,behavior='smooth'){
    if(!viewport||!track)return;
    const item=track.children[index];if(!item)return;
    const left=item.offsetLeft-(viewport.clientWidth-item.clientWidth)/2;
    viewport.scrollTo({left:Math.max(0,left),behavior});
  }

  function syncActive({center=true,behavior='smooth'}={}){
    if(syncing||!track)return;syncing=true;
    try{
      const list=buttons(),items=Array.from(track.querySelectorAll('.prumo-bottom-nav-item'));
      let active=0;
      list.forEach((btn,i)=>{
        const isActive=btn.classList.contains('active');if(isActive)active=i;
        const item=items[i];if(item){item.setAttribute('aria-current',isActive?'page':'false');item.tabIndex=isActive?0:-1}
      });
      root.dataset.activeIndex=String(active);
      if(center)requestAnimationFrame(()=>centerIndex(active,behavior));
    }finally{syncing=false}
  }

  function rebuild(){
    if(!sourceNav||!track)return;
    const list=buttons();track.innerHTML='';
    list.forEach(source=>{
      const item=document.createElement('button');
      const label=(source.textContent||source.dataset.page||'Menu').trim();
      item.type='button';item.className='prumo-bottom-nav-item';item.dataset.page=source.dataset.page||'';
      item.setAttribute('aria-label',`Abrir ${label}`);
      item.innerHTML=`<span class="prumo-bottom-nav-icon">${iconFor(source)}</span><span class="prumo-bottom-nav-label"></span>`;
      item.querySelector('.prumo-bottom-nav-label').textContent=label;
      item.addEventListener('click',()=>{source.click();requestAnimationFrame(()=>syncActive({center:true}))});
      track.appendChild(item);
    });
    syncActive({center:true,behavior:'auto'});bindActiveObserver();
  }

  function move(step){
    const list=buttons();if(!list.length)return;
    let index=currentIndex()+step;if(index<0)index=list.length-1;if(index>=list.length)index=0;
    list[index]?.click();requestAnimationFrame(()=>syncActive({center:true}));
  }

  function bindActiveObserver(){
    activeObserver?.disconnect();if(!sourceNav)return;
    activeObserver=new MutationObserver(ms=>{if(ms.some(m=>m.type==='attributes'&&m.attributeName==='class'))syncActive({center:true})});
    buttons().forEach(btn=>activeObserver.observe(btn,{attributes:true,attributeFilter:['class']}));
  }

  function create(){
    sourceNav=document.querySelector('.sidebar .nav');if(!sourceNav)return false;
    injectStyles();
    root=document.createElement('nav');root.className='prumo-bottom-nav';root.setAttribute('aria-label','Navegação principal');
    const shell=document.createElement('div');shell.className='prumo-bottom-nav-shell';
    viewport=document.createElement('div');viewport.className='prumo-bottom-nav-viewport';
    track=document.createElement('div');track.className='prumo-bottom-nav-track';
    viewport.appendChild(track);shell.appendChild(viewport);root.appendChild(shell);document.body.appendChild(root);

    // Reinforce viewport anchoring on iOS/PWA even if page CSS changes later.
    Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'2147483000',pointerEvents:'none',transform:'none'});
    Object.assign(shell.style,{position:'absolute',left:'50%',bottom:'calc(26px + env(safe-area-inset-bottom, 0px))',transform:'translate3d(-50%,0,0)',pointerEvents:'auto'});

    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      pointerStartX=event.clientX;pointerStartY=event.clientY;
    });
    viewport.addEventListener('pointerup',event=>{
      if(pointerStartX===null)return;
      const dx=event.clientX-pointerStartX,dy=event.clientY-pointerStartY;
      pointerStartX=null;pointerStartY=null;
      if(Math.abs(dx)>54&&Math.abs(dx)>Math.abs(dy)*1.3)move(dx<0?1:-1);
    });
    viewport.addEventListener('pointercancel',()=>{pointerStartX=null;pointerStartY=null});

    sourceObserver=new MutationObserver(ms=>{
      if(ms.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='data-page')))rebuild();
    });
    sourceObserver.observe(sourceNav,{childList:true,subtree:true,attributes:true,attributeFilter:['data-page']});
    sourceNav.addEventListener('click',event=>{if(event.target.closest('button[data-page]'))requestAnimationFrame(()=>syncActive({center:true}))});
    const visibilityObserver=new MutationObserver(()=>syncVisibility());
    const app=document.getElementById('appRoot');
    const auth=document.getElementById('authScreen');
    if(app)visibilityObserver.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    if(auth)visibilityObserver.observe(auth,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    visibilityObserver.observe(document.body,{attributes:true,attributeFilter:['class']});

    window.addEventListener('resize',()=>{
      syncVisibility();
      if(window.matchMedia(MOBILE_QUERY).matches)syncActive({center:true,behavior:'auto'});
    },{passive:true});

    window.addEventListener('caderno:splash-done',syncVisibility);
    rebuild();
    syncVisibility();
    return true;
  }

  function boot(){
    if(create())return;
    const observer=new MutationObserver(()=>{if(create())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
