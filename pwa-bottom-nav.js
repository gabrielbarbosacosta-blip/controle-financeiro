(function(){
  if(window.__prumoBottomNavLoaded)return;
  window.__prumoBottomNavLoaded=true;

  const MOBILE_QUERY='(max-width: 900px)';
  let root=null,viewport=null,track=null,sourceNav=null,sourceObserver=null,activeObserver=null;
  let syncing=false,pointerStartX=null,pointerStartY=null,pointerTargetItem=null,pointerType=null;
  let suppressClickUntil=0;
  let menuAnimated=false,lastVisible=false;

  const ICONS={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    history:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    cards:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    incomes:'<path d="M12 4v15"/><path d="m6.5 13.5 5.5 5.5 5.5-5.5"/>',
    debts:'<path d="M12 20V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/>',
    projection:'<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><circle cx="6" cy="15" r="1.1"/><circle cx="10" cy="11" r="1.1"/><circle cx="13" cy="14" r="1.1"/><circle cx="18" cy="8" r="1.1"/>',
    goals:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none"/>',
    objectives:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none"/>',
    sharing:'<path d="M8 19V5"/><path d="m4.5 8.5 3.5-3.5 3.5 3.5"/><path d="M16 5v14"/><path d="m12.5 15.5 3.5 3.5 3.5-3.5"/>',
    connections:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.1 2.5-5 5.5-5s5 1.9 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 15c.8-.5 1.7-.8 2.7-.8 2.4 0 4 1.6 4.3 4.3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.08 2.08-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55v.08h-3v-.08A1.7 1.7 0 0 0 10.72 18.6a1.7 1.7 0 0 0-1.88.34l-.06.06L6.7 16.92l.06-.06A1.7 1.7 0 0 0 7.1 15a1.7 1.7 0 0 0-1.55-1.03h-.08v-3h.08A1.7 1.7 0 0 0 7.1 9.94a1.7 1.7 0 0 0-.34-1.88L6.7 8 8.78 5.92l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55v-.08h3v.08a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z"/>'
  };

  function iconFor(source){
    const desktopSvg=source?.querySelector?.('.caderno-nav-icon svg');
    if(desktopSvg)return desktopSvg.outerHTML;
    const page=String(source?.dataset?.page||'').toLowerCase();
    const text=String(source?.textContent||'').toLowerCase();
    let path=ICONS[page];
    if(!path&&/objetiv|meta/.test(text))path=ICONS.goals;
    if(!path&&/receita/.test(text))path=ICONS.incomes;
    if(!path&&/despesa/.test(text))path=ICONS.debts;
    if(!path&&/cart/.test(text))path=ICONS.cards;
    if(!path&&/proje/.test(text))path=ICONS.projection;
    if(!path&&/compart/.test(text))path=ICONS.sharing;
    if(!path&&/conex/.test(text))path=ICONS.connections;
    if(!path&&/config/.test(text))path=ICONS.settings;
    if(!path&&/lanç|lanc|hist/.test(text))path=ICONS.history;
    path=path||ICONS.dashboard;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
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
        z-index:20!important;
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
        border:1px solid rgba(255,255,255,.24);
        border-radius:24px;
        background:rgba(255,255,255,.11);
        box-shadow:
          0 14px 38px rgba(0,0,0,.30),
          inset 0 1px 0 rgba(255,255,255,.14);
        -webkit-backdrop-filter:blur(30px) saturate(1.35);
        backdrop-filter:blur(30px) saturate(1.35);
        isolation:isolate;
      }
      .prumo-bottom-nav-animator{
        width:100%;height:100%;
        border-radius:inherit;
        transform-origin:50% 100%;
        will-change:transform,opacity,filter;
      }
      .prumo-bottom-nav-viewport{
        width:100%;height:100%;overflow-x:auto;overflow-y:hidden;position:relative;
        scrollbar-width:none;scroll-snap-type:x proximity;scroll-behavior:smooth;
        overscroll-behavior-x:contain;touch-action:pan-x;isolation:isolate;
      }
      .prumo-bottom-nav-viewport::-webkit-scrollbar{display:none}
      .prumo-bottom-nav-track{display:flex;align-items:stretch;gap:4px;min-width:max-content;height:100%}
      .prumo-bottom-nav-item{
        position:relative;
        flex:0 0 72px;width:72px;min-width:72px;height:58px;
        scroll-snap-align:center;
        border:0;border-radius:18px;padding:5px 4px 4px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        background:transparent;color:#c1cbd8;
        -webkit-tap-highlight-color:transparent;
        transition:
          background .28s cubic-bezier(.22,1,.36,1),
          color .28s cubic-bezier(.22,1,.36,1),
          transform .28s cubic-bezier(.22,1,.36,1),
          box-shadow .28s cubic-bezier(.22,1,.36,1);
      }
      .prumo-bottom-nav-icon{
        width:24px;height:24px;display:grid;place-items:center;flex:0 0 24px;
      }
      .prumo-bottom-nav-icon svg{
        width:23px;height:23px;display:block;
        fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;
      }
      .prumo-bottom-nav-label{
        width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        text-align:center;font-size:9px;font-weight:700;line-height:1.15;letter-spacing:-.01em;
      }
      @media(hover:hover) and (pointer:fine){
        .prumo-bottom-nav-item:hover{
          background:rgba(255,255,255,.06);
          color:#f7f9fc;
        }
      }
      .prumo-bottom-nav-item[aria-current="page"]{
        background:transparent;
        color:#ffffff;
        box-shadow:none;
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
        background:transparent;
        -webkit-backdrop-filter:none;
        backdrop-filter:none;
        box-shadow:none;
      }
      @media(hover:hover) and (pointer:fine){
        .prumo-bottom-nav-item[data-page="dashboard"]:hover{
          background:transparent;
        }
      }
      .prumo-bottom-nav-item[data-page="dashboard"][aria-current="page"]{
        background:transparent;
      }
      .prumo-bottom-nav-item:active{transform:scale(.975);background:transparent!important}
      .prumo-bottom-nav-item:focus{outline:none}
      .prumo-bottom-nav-item:focus-visible{
        outline:2px solid rgba(221,234,172,.72);
        outline-offset:-2px;
      }
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
    const animator=root.querySelector('.prumo-bottom-nav-animator');
    if(!animator)return;
    const reduced=(()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_e){return false}})();
    menuAnimated=true;

    const finish=()=>{
      animator.style.removeProperty('opacity');
      animator.style.removeProperty('filter');
      animator.style.removeProperty('transform');
    };

    if(reduced){finish();return}

    try{
      animator.getAnimations?.().forEach(a=>a.cancel());
      const anim=animator.animate([
        {opacity:0,transform:'translateY(18px) scale(.97)',filter:'blur(6px)'},
        {opacity:.82,transform:'translateY(-2px) scale(1.008)',filter:'blur(1px)',offset:.72},
        {opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}
      ],{
        duration:560,
        easing:'cubic-bezier(.22,1,.36,1)',
        fill:'forwards'
      });
      anim.finished.then(finish).catch(finish);

      const items=Array.from(track?.querySelectorAll('.prumo-bottom-nav-item')||[]);
      items.slice(0,8).forEach((item,index)=>{
        item.getAnimations?.().forEach(a=>a.cancel());
        item.animate([
          {opacity:0,transform:'translateY(8px) scale(.94)'},
          {opacity:1,transform:'translateY(0) scale(1)'}
        ],{
          duration:360,
          delay:105+(index*45),
          easing:'cubic-bezier(.22,1,.36,1)',
          fill:'backwards'
        });
      });

      const active=track?.querySelector('.prumo-bottom-nav-item[aria-current="page"] .prumo-bottom-nav-icon');
      if(active){
        active.animate([
          {transform:'scale(.84)',opacity:.5},
          {transform:'scale(1.13)',opacity:1,offset:.7},
          {transform:'scale(1)',opacity:1}
        ],{
          duration:440,
          delay:260,
          easing:'cubic-bezier(.22,1,.36,1)'
        });
      }
    }catch(_e){finish()}
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
    const shell=root.querySelector('.prumo-bottom-nav-shell');
    const animator=root.querySelector('.prumo-bottom-nav-animator');

    if(visible&&!lastVisible&&!menuAnimated&&animator){
      // Prepare the very first visible frame without touching the fixed shell.
      animator.style.opacity='0';
      animator.style.filter='blur(6px)';
      animator.style.transform='translateY(18px) scale(.97)';
    }

    root.style.setProperty('display',visible?'block':'none','important');
    root.style.setProperty('visibility',visible?'visible':'hidden','important');
    root.style.setProperty('opacity',visible?'1':'0','important');
    root.style.setProperty('pointer-events','none','important');
    if(shell) shell.style.setProperty('pointer-events',visible?'auto':'none','important');
    const ariaHidden=visible?'false':'true';
    if(root.getAttribute('aria-hidden')!==ariaHidden)root.setAttribute('aria-hidden',ariaHidden);

    if(visible&&!lastVisible){
      requestAnimationFrame(playLoadAnimation);
    }
    lastVisible=visible;
  }

  function buttons(){return sourceNav?Array.from(sourceNav.querySelectorAll('button[data-page]')):[]}
  function currentIndex(){const list=buttons(),i=list.findIndex(btn=>btn.classList.contains('active'));return i>=0?i:0}

  function clipBehindPinned(){
    if(!viewport||!track)return;
    const pinned=track.querySelector('.prumo-bottom-nav-item[data-page="dashboard"]');
    if(!pinned)return;
    const pinRect=pinned.getBoundingClientRect();
    Array.from(track.querySelectorAll('.prumo-bottom-nav-item')).forEach(item=>{
      if(item===pinned){item.style.removeProperty('clip-path');item.style.removeProperty('-webkit-clip-path');return}
      const r=item.getBoundingClientRect();
      const overlap=Math.max(0,Math.min(r.width,pinRect.right-r.left));
      const inset=Math.min(r.width,overlap);
      const clip=`inset(0 0 0 ${inset}px)`;
      item.style.clipPath=clip;
      item.style.webkitClipPath=clip;
    });
  }

  function centerIndex(index,behavior='smooth'){
    if(!viewport||!track)return;
    const item=track.children[index];if(!item)return;
    const left=item.offsetLeft-(viewport.clientWidth-item.clientWidth)/2;
    viewport.scrollTo({left:Math.max(0,left),behavior});
    requestAnimationFrame(clipBehindPinned);
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

  function activateNavItem(item){
    if(!item)return;
    const page=item.dataset.page||'';
    const source=buttons().find(btn=>(btn.dataset.page||'')===page);
    if(!source)return;
    source.click();
    requestAnimationFrame(()=>syncActive({center:true}));
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
      item.addEventListener('click',event=>{
        if(performance.now()<suppressClickUntil){event.preventDefault();return}
        activateNavItem(item);
      });
      track.appendChild(item);
    });
    syncActive({center:true,behavior:'auto'});bindActiveObserver();
    requestAnimationFrame(clipBehindPinned);
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
    const animator=document.createElement('div');animator.className='prumo-bottom-nav-animator';
    viewport=document.createElement('div');viewport.className='prumo-bottom-nav-viewport';
    track=document.createElement('div');track.className='prumo-bottom-nav-track';
    viewport.appendChild(track);animator.appendChild(viewport);shell.appendChild(animator);root.appendChild(shell);document.body.appendChild(root);

    // Reinforce viewport anchoring on iOS/PWA even if page CSS changes later.
    Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'20',pointerEvents:'none',transform:'none'});
    Object.assign(shell.style,{position:'absolute',left:'50%',bottom:'calc(26px + env(safe-area-inset-bottom, 0px))',transform:'translate3d(-50%,0,0)',pointerEvents:'auto'});

    viewport.addEventListener('scroll',clipBehindPinned,{passive:true});
    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      pointerStartX=event.clientX;
      pointerStartY=event.clientY;
      pointerType=event.pointerType||'touch';
      pointerTargetItem=event.target.closest('.prumo-bottom-nav-item');
    },{passive:true});

    viewport.addEventListener('pointerup',event=>{
      if(pointerStartX===null)return;
      const dx=event.clientX-pointerStartX,dy=event.clientY-pointerStartY;
      const absX=Math.abs(dx),absY=Math.abs(dy);
      const target=pointerTargetItem;
      const type=pointerType;

      pointerStartX=null;
      pointerStartY=null;
      pointerTargetItem=null;
      pointerType=null;

      // Touch/pen taps are handled directly instead of waiting for the browser's
      // click event. iOS may suppress click while the page has scroll momentum.
      if((type==='touch'||type==='pen')&&target&&absX<=14&&absY<=14){
        suppressClickUntil=performance.now()+550;
        activateNavItem(target);
        return;
      }

      if(absX>54&&absX>absY*1.3)move(dx<0?1:-1);
    },{passive:true});

    viewport.addEventListener('pointercancel',()=>{
      pointerStartX=null;
      pointerStartY=null;
      pointerTargetItem=null;
      pointerType=null;
    },{passive:true});

    sourceObserver=new MutationObserver(ms=>{
      if(ms.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='data-page')))rebuild();
    });
    sourceObserver.observe(sourceNav,{childList:true,subtree:true,attributes:true,attributeFilter:['data-page']});
    sourceNav.addEventListener('click',event=>{if(event.target.closest('button[data-page]'))requestAnimationFrame(()=>syncActive({center:true}))});
    let visibilitySyncQueued=false;
    const queueVisibilitySync=()=>{
      if(visibilitySyncQueued)return;
      visibilitySyncQueued=true;
      requestAnimationFrame(()=>{
        visibilitySyncQueued=false;
        syncVisibility();
      });
    };
    const visibilityObserver=new MutationObserver(mutations=>{
      const relevant=mutations.some(m=>{
        const target=m.target;
        if(target===root||target?.closest?.('.prumo-bottom-nav'))return false;
        if(m.type==='childList')return true;
        return m.type==='attributes'&&m.attributeName==='class';
      });
      if(relevant)queueVisibilitySync();
    });
    const app=document.getElementById('appRoot');
    const auth=document.getElementById('authScreen');
    if(app)visibilityObserver.observe(app,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    if(auth)visibilityObserver.observe(auth,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
    visibilityObserver.observe(document.body,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class']
    });

    window.addEventListener('resize',()=>{
      syncVisibility();
      if(window.matchMedia(MOBILE_QUERY).matches){
        syncActive({center:true,behavior:'auto'});
        requestAnimationFrame(clipBehindPinned);
      }
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
