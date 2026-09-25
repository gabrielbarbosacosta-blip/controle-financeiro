(function(){
  if(window.__prumoPullRefresh)return;
  window.__prumoPullRefresh=true;

  const THRESHOLD=76;
  const MAX_PULL=118;
  let startY=0,startX=0,pull=0,tracking=false,armed=false,refreshing=false;
  let indicator=null,ring=null,label=null,appRoot=null;

  function haptic(pattern=10){
    try{
      if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate(pattern);
    }catch(_e){}
  }

  function ensureUi(){
    if(indicator)return indicator;
    const style=document.createElement('style');
    style.id='prumo-pull-refresh-style';
    style.textContent=`
      html,body{overscroll-behavior-y:none}
      html.prumo-pull-refresh-active,html.prumo-pull-refresh-active body{overscroll-behavior-y:none}
      #appRoot.prumo-ptr-dragging{
        will-change:transform!important;
        transition:none!important;
      }
      #appRoot.prumo-ptr-releasing{
        will-change:transform!important;
        transition:transform .32s cubic-bezier(.22,1,.36,1)!important;
      }
      html.prumo-pull-refresh-active .prumo-bottom-nav,
      html.prumo-pull-refresh-active .prumo-bottom-nav-shell,
      html.prumo-pull-refresh-active .prumo-bottom-nav-animator{
        visibility:visible!important;
        opacity:1!important;
      }
      html.prumo-pull-refresh-active .prumo-bottom-nav-item{
        visibility:visible!important;
        opacity:1!important;
        clip-path:none!important;
        -webkit-clip-path:none!important;
      }
      #prumoPullRefresh{
        position:fixed;
        z-index:10020;
        top:calc(10px + env(safe-area-inset-top,0px));
        left:50%;
        width:154px;
        height:46px;
        transform:translate3d(-50%,-34px,0) scale(.92);
        opacity:0;
        pointer-events:none;
        display:grid;
        grid-template-columns:28px 1fr;
        align-items:center;
        justify-items:start;
        gap:6px;
        padding:0 12px;
        border:1px solid rgba(255,255,255,.20);
        border-radius:999px;
        background:rgba(7,16,29,.76);
        box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12);
        -webkit-backdrop-filter:blur(24px) saturate(1.3);
        backdrop-filter:blur(24px) saturate(1.3);
        transition:opacity .16s ease,transform .16s ease,width .18s ease;
        color:#e7edf5;
      }
      #prumoPullRefresh.visible{opacity:1}
      #prumoPullRefresh.refreshing{width:132px;border-radius:24px}
      #prumoPullRefresh .prumo-ptr-ring{
        width:22px;height:22px;border-radius:50%;
        border:2px solid rgba(231,237,245,.22);
        border-top-color:#ddeaac;
        transform:rotate(0deg);
      }
      #prumoPullRefresh.refreshing .prumo-ptr-ring{animation:prumoPtrSpin .72s linear infinite}
      #prumoPullRefresh .prumo-ptr-label{
        display:block;
        font:700 11px/1.1 Manrope,Arial,sans-serif;
        white-space:nowrap;
      }
      @keyframes prumoPtrSpin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){
        #prumoPullRefresh{transition:none}
        #prumoPullRefresh.refreshing .prumo-ptr-ring{animation-duration:1.5s}
      }
    `;
    document.head.appendChild(style);

    indicator=document.createElement('div');
    indicator.id='prumoPullRefresh';
    indicator.setAttribute('aria-hidden','true');
    indicator.innerHTML='<div class="prumo-ptr-ring"></div><div class="prumo-ptr-label">Puxe para atualizar</div>';
    document.body.appendChild(indicator);
    ring=indicator.querySelector('.prumo-ptr-ring');
    label=indicator.querySelector('.prumo-ptr-label');
    return indicator;
  }

  function appReady(){
    const app=document.getElementById('appRoot');
    if(!app||app.hidden||app.classList.contains('hidden')||app.classList.contains('auth-hidden')||app.getAttribute('aria-hidden')==='true')return false;
    if(document.querySelector('.modal-backdrop.open'))return false;
    return !!window.financeCloud?.ready;
  }

  function atTop(){
    const scroller=document.scrollingElement||document.documentElement;
    return (window.scrollY||scroller.scrollTop||0)<=1;
  }

  function damp(distance){
    return Math.min(MAX_PULL,Math.pow(Math.max(0,distance),.88)*1.22);
  }

  function pageOffset(){
    return Math.min(84,pull*.62);
  }

  function paint(){
    ensureUi();
    const progress=Math.min(1,pull/THRESHOLD);
    const offset=pageOffset();
    const scale=.92+progress*.08;
    indicator.classList.toggle('visible',pull>2||refreshing);

    appRoot=document.getElementById('appRoot');
    if(appRoot&&!refreshing){
      appRoot.classList.add('prumo-ptr-dragging');
      appRoot.classList.remove('prumo-ptr-releasing');
      appRoot.style.setProperty('transform',`translate3d(0,${offset}px,0)`,'important');
    }

    if(!refreshing)indicator.style.transform=`translate3d(-50%,${-34+offset}px,0) scale(${scale})`;
    if(ring&&!refreshing)ring.style.transform=`rotate(${Math.round(progress*250)}deg)`;
    if(label&&!refreshing)label.textContent=armed?'Solte para atualizar':'Puxe para atualizar';
  }

  function reset(){
    tracking=false;armed=false;pull=0;
    appRoot=appRoot||document.getElementById('appRoot');
    if(appRoot){
      appRoot.classList.remove('prumo-ptr-dragging','prumo-ptr-releasing');
      appRoot.style.removeProperty('transform');
    }
    if(indicator){
      indicator.classList.remove('visible');
      indicator.style.transform='translate3d(-50%,-34px,0) scale(.92)';
      if(ring)ring.style.transform='rotate(0deg)';
    }
    document.documentElement.classList.remove('prumo-pull-refresh-active');
  }

  function releasePage({keepIndicator=false}={}){
    return new Promise(resolve=>{
      appRoot=appRoot||document.getElementById('appRoot');
      if(!appRoot){resolve();return}
      appRoot.classList.remove('prumo-ptr-dragging');
      appRoot.classList.add('prumo-ptr-releasing');
      appRoot.style.setProperty('transform','translate3d(0,0,0)','important');

      if(indicator){
        indicator.style.transition='opacity .16s ease,transform .32s cubic-bezier(.22,1,.36,1),width .18s ease';
        indicator.style.transform='translate3d(-50%,0,0) scale(1)';
        if(!keepIndicator)indicator.style.opacity='0';
      }

      setTimeout(()=>{
        appRoot?.classList.remove('prumo-ptr-releasing');
        appRoot?.style.removeProperty('transform');
        if(indicator)indicator.style.removeProperty('opacity');
        resolve();
      },330);
    });
  }

  async function waitForPendingSave(){
    if(!window.financeCloud?.hasPendingLocalWrite)return true;
    const start=Date.now();
    try{if(typeof pushStateToCloud==='function')pushStateToCloud()}catch(_e){}
    while(window.financeCloud?.hasPendingLocalWrite&&Date.now()-start<4500){
      await new Promise(r=>setTimeout(r,100));
    }
    return !window.financeCloud?.hasPendingLocalWrite;
  }

  async function refresh(){
    if(refreshing)return;
    refreshing=true;tracking=false;
    ensureUi();
    indicator.classList.add('visible','refreshing');
    indicator.style.transform='translate3d(-50%,0,0) scale(1)';
    if(label)label.textContent='Atualizando…';
    haptic(12);

    try{
      const safe=await waitForPendingSave();
      if(!safe)throw new Error('pending_local_write');
      const result=await window.financeCloud.refresh();
      if(result===null&&window.financeCloud?.hasPendingLocalWrite)throw new Error('pending_local_write');
      if(label)label.textContent='Atualizado';
      haptic([12,28,12]);
      try{window.dispatchEvent(new CustomEvent('prumo:pull-refresh',{detail:{ok:true}}))}catch(_e){}
      await new Promise(r=>setTimeout(r,520));
    }catch(error){
      console.error('Falha no pull-to-refresh:',error);
      if(label)label.textContent=error?.message==='pending_local_write'?'Aguarde sincronizar':'Falha ao atualizar';
      haptic([22,45,22]);
      try{if(typeof setSyncStatus==='function')setSyncStatus('Falha ao atualizar dados',true)}catch(_e){}
      try{window.dispatchEvent(new CustomEvent('prumo:pull-refresh',{detail:{ok:false,error}}))}catch(_e){}
      await new Promise(r=>setTimeout(r,850));
    }finally{
      refreshing=false;
      indicator?.classList.remove('refreshing');
      reset();
    }
  }

  function onStart(e){
    if(refreshing||!appReady()||!atTop()||e.touches?.length!==1)return;
    if(e.target?.closest?.('.prumo-bottom-nav,input,textarea,select,[contenteditable="true"]'))return;
    const t=e.touches[0];
    startY=t.clientY;startX=t.clientX;pull=0;tracking=true;armed=false;
  }

  function onMove(e){
    if(!tracking||refreshing)return;
    const t=e.touches?.[0];if(!t)return;
    const dy=t.clientY-startY,dx=Math.abs(t.clientX-startX);
    if(dy<=0||dx>Math.abs(dy)*.72){if(dy<0)reset();return}
    if(!atTop()&&pull<3){reset();return}
    if(dy<=1)return;

    e.preventDefault();
    document.documentElement.classList.add('prumo-pull-refresh-active');
    pull=damp(dy);
    const nowArmed=pull>=THRESHOLD;
    if(nowArmed&&!armed)haptic(8);
    armed=nowArmed;
    paint();
  }

  async function onEnd(){
    if(!tracking||refreshing)return;
    const shouldRefresh=armed;
    tracking=false;
    if(shouldRefresh){
      await releasePage({keepIndicator:true});
      pull=0;armed=false;
      await refresh();
    }else{
      await releasePage({keepIndicator:false});
      reset();
    }
  }

  function init(){
    ensureUi();
    document.addEventListener('touchstart',onStart,{passive:true});
    document.addEventListener('touchmove',onMove,{passive:false,capture:true});
    document.addEventListener('touchend',onEnd,{passive:true});
    document.addEventListener('touchcancel',()=>{if(tracking){tracking=false;releasePage({keepIndicator:false}).then(reset)}else reset()},{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();