(function(){
  if(window.__prumoBottomNavLoaded)return;
  window.__prumoBottomNavLoaded=true;

  const MOBILE_QUERY='(max-width: 900px)';
  let root=null;
  let viewport=null;
  let track=null;
  let prevBtn=null;
  let nextBtn=null;
  let sourceNav=null;
  let sourceObserver=null;
  let activeObserver=null;
  let syncing=false;
  let pointerStartX=null;
  let pointerStartY=null;

  function injectStyles(){
    if(document.getElementById('prumo-bottom-nav-style'))return;
    const style=document.createElement('style');
    style.id='prumo-bottom-nav-style';
    style.textContent=`
      .prumo-bottom-nav{
        display:none;
        position:fixed;
        left:50%;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        width:min(92vw,430px);
        min-height:54px;
        z-index:24;
        align-items:center;
        gap:4px;
        padding:6px;
        border:1px solid rgba(92,116,143,.38);
        border-radius:18px;
        background:rgba(9,19,33,.92);
        box-shadow:0 14px 42px rgba(0,0,0,.30);
        -webkit-backdrop-filter:blur(18px) saturate(1.25);
        backdrop-filter:blur(18px) saturate(1.25);
      }
      .prumo-bottom-nav-arrow{
        flex:0 0 42px;
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        padding:0;
        border:0;
        border-radius:13px;
        background:transparent;
        color:#8fa3ba;
        font-size:24px;
        line-height:1;
        -webkit-tap-highlight-color:transparent;
      }
      .prumo-bottom-nav-arrow:active{background:#142338;color:#ddeaac}
      .prumo-bottom-nav-viewport{
        min-width:0;
        flex:1 1 auto;
        overflow-x:auto;
        overflow-y:hidden;
        scrollbar-width:none;
        scroll-snap-type:x mandatory;
        scroll-behavior:smooth;
        overscroll-behavior-x:contain;
        touch-action:pan-x;
        border-radius:12px;
      }
      .prumo-bottom-nav-viewport::-webkit-scrollbar{display:none}
      .prumo-bottom-nav-track{
        display:flex;
        align-items:center;
        min-width:max-content;
      }
      .prumo-bottom-nav-item{
        width:calc(min(92vw,430px) - 96px);
        min-width:calc(min(92vw,430px) - 96px);
        height:42px;
        flex:0 0 auto;
        scroll-snap-align:center;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        border:0;
        border-radius:12px;
        padding:0 12px;
        background:transparent;
        color:#8fa3ba;
        font-size:12px;
        font-weight:700;
        letter-spacing:-.01em;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        -webkit-tap-highlight-color:transparent;
        transition:background .18s ease,color .18s ease,transform .18s ease;
      }
      .prumo-bottom-nav-item[aria-current="page"]{
        background:#19263a;
        color:#f5f7fb;
      }
      .prumo-bottom-nav-item[aria-current="page"]::before{
        content:'';
        width:6px;height:6px;border-radius:999px;
        background:#ddeaac;
        box-shadow:0 0 0 3px rgba(221,234,172,.08);
        flex:0 0 6px;
      }
      .prumo-bottom-nav-item:active{transform:scale(.98)}
      @media(max-width:900px){
        .prumo-bottom-nav{display:flex}
        .sidebar .nav{display:none!important}
        .main{padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))!important}
        .modal-foot{padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
      }
      @media(min-width:901px){.prumo-bottom-nav{display:none!important}}
      @media(prefers-reduced-motion:reduce){
        .prumo-bottom-nav-viewport{scroll-behavior:auto}
        .prumo-bottom-nav-item{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  function buttons(){
    return sourceNav ? Array.from(sourceNav.querySelectorAll('button[data-page]')) : [];
  }

  function currentIndex(){
    const list=buttons();
    const index=list.findIndex(btn=>btn.classList.contains('active'));
    return index>=0?index:0;
  }

  function centerIndex(index,behavior='smooth'){
    if(!viewport||!track)return;
    const items=Array.from(track.children);
    const item=items[index];
    if(!item)return;
    const left=item.offsetLeft-(viewport.clientWidth-item.clientWidth)/2;
    viewport.scrollTo({left:Math.max(0,left),behavior});
  }

  function syncActive({center=true,behavior='smooth'}={}){
    if(syncing||!track)return;
    syncing=true;
    try{
      const list=buttons();
      const items=Array.from(track.querySelectorAll('.prumo-bottom-nav-item'));
      let active=0;
      list.forEach((btn,i)=>{
        const isActive=btn.classList.contains('active');
        if(isActive)active=i;
        const item=items[i];
        if(item){
          item.setAttribute('aria-current',isActive?'page':'false');
          item.tabIndex=isActive?0:-1;
        }
      });
      prevBtn.disabled=list.length<2;
      nextBtn.disabled=list.length<2;
      root.dataset.activeIndex=String(active);
      if(center)requestAnimationFrame(()=>centerIndex(active,behavior));
    }finally{syncing=false}
  }

  function rebuild(){
    if(!sourceNav||!track)return;
    const list=buttons();
    const activePage=list.find(btn=>btn.classList.contains('active'))?.dataset.page;
    track.innerHTML='';
    list.forEach((source,i)=>{
      const item=document.createElement('button');
      item.type='button';
      item.className='prumo-bottom-nav-item';
      item.dataset.page=source.dataset.page||'';
      item.textContent=(source.textContent||source.dataset.page||'Menu').trim();
      item.setAttribute('aria-label',`Abrir ${item.textContent}`);
      item.addEventListener('click',()=>{
        source.click();
        requestAnimationFrame(()=>syncActive({center:true}));
      });
      track.appendChild(item);
    });
    if(activePage){
      const source=list.find(btn=>btn.dataset.page===activePage);
      if(source)source.classList.add('active');
    }
    syncActive({center:true,behavior:'auto'});
    bindActiveObserver();
  }

  function move(step){
    const list=buttons();
    if(!list.length)return;
    let index=currentIndex()+step;
    if(index<0)index=list.length-1;
    if(index>=list.length)index=0;
    list[index]?.click();
    requestAnimationFrame(()=>syncActive({center:true}));
  }

  function bindActiveObserver(){
    activeObserver?.disconnect();
    if(!sourceNav)return;
    activeObserver=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='attributes'&&m.attributeName==='class'))syncActive({center:true});
    });
    buttons().forEach(btn=>activeObserver.observe(btn,{attributes:true,attributeFilter:['class']}));
  }

  function create(){
    sourceNav=document.querySelector('.sidebar .nav');
    if(!sourceNav)return false;
    injectStyles();

    root=document.createElement('nav');
    root.className='prumo-bottom-nav';
    root.setAttribute('aria-label','Navegação principal');

    prevBtn=document.createElement('button');
    prevBtn.type='button';
    prevBtn.className='prumo-bottom-nav-arrow';
    prevBtn.setAttribute('aria-label','Menu anterior');
    prevBtn.textContent='‹';

    viewport=document.createElement('div');
    viewport.className='prumo-bottom-nav-viewport';

    track=document.createElement('div');
    track.className='prumo-bottom-nav-track';
    viewport.appendChild(track);

    nextBtn=document.createElement('button');
    nextBtn.type='button';
    nextBtn.className='prumo-bottom-nav-arrow';
    nextBtn.setAttribute('aria-label','Próximo menu');
    nextBtn.textContent='›';

    root.append(prevBtn,viewport,nextBtn);
    document.body.appendChild(root);

    prevBtn.addEventListener('click',()=>move(-1));
    nextBtn.addEventListener('click',()=>move(1));

    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      pointerStartX=event.clientX;
      pointerStartY=event.clientY;
    });
    viewport.addEventListener('pointerup',event=>{
      if(pointerStartX===null)return;
      const dx=event.clientX-pointerStartX;
      const dy=event.clientY-pointerStartY;
      pointerStartX=null;pointerStartY=null;
      if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.25){
        move(dx<0?1:-1);
      }else{
        syncActive({center:true});
      }
    });
    viewport.addEventListener('pointercancel',()=>{pointerStartX=null;pointerStartY=null});

    sourceObserver=new MutationObserver(mutations=>{
      const structural=mutations.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='data-page'));
      if(structural)rebuild();
    });
    sourceObserver.observe(sourceNav,{childList:true,subtree:true,attributes:true,attributeFilter:['data-page']});

    sourceNav.addEventListener('click',event=>{
      if(event.target.closest('button[data-page]'))requestAnimationFrame(()=>syncActive({center:true}));
    });

    window.addEventListener('resize',()=>{
      if(window.matchMedia(MOBILE_QUERY).matches)syncActive({center:true,behavior:'auto'});
    },{passive:true});

    rebuild();
    return true;
  }

  function boot(){
    if(create())return;
    const observer=new MutationObserver(()=>{
      if(create())observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
