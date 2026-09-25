(function(){
  if(window.__prumoPullRefresh)return;
  window.__prumoPullRefresh=true;

  const THRESHOLD=76;
  const MAX_PULL=118;
  let startY=0,startX=0,pull=0,tracking=false,armed=false,refreshing=false;
  let indicator=null,ring=null,label=null;

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
      html.prumo-pull-refresh-active,html.prumo-pull-refresh-active body{overscroll-behavior-y:contain}
      #prumoPullRefresh{
        position:fixed;
        z-index:10020;
        top:calc(10px + env(safe-area-inset-top,0px));
        left:50%;
        width:46px;
        height:46px;
        transform:translate3d(-50%,-72px,0) scale(.82);
        opacity:0;
        pointer-events:none;
        display:grid;
        place-items:center;
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
      #prumoPullRefresh.refreshing{width:118px;border-radius:24px;grid-template-columns:30px 1fr;padding:0 12px;gap:4px}
      #prumoPullRefresh .prumo-ptr-ring{
        width:22px;height:22px;border-radius:50%;
        border:2px solid rgba(231,237,245,.22);
        border-top-color:#ddeaac;
        transform:rotate(0deg);
      }
      #prumoPullRefresh.refreshing .prumo-ptr-ring{animation:prumoPtrSpin .72s linear infinite}
      #prumoPullRefresh .prumo-ptr-label{
        display:none;
        font:700 11px/1.1 Manrope,Arial,sans-serif;
        white-space:nowrap;
      }
      #prumoPullRefresh.refreshing .prumo-ptr-label{display:block}
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
    indicator.innerHTML='<div class="prumo-ptr-ring"></div><div class="prumo-ptr-label">Atualizando…</div>';
    document.body.appendChild(indicator);
    ring=indicator.querySelector('.prumo-ptr-ring');
    label=indicator.querySelector('.prumo-ptr-label');
    return indicator;
  }

  function appReady(){
    const app=document.getElementById('app');
    if(!app||app.classList.contains('hidden')||app.getAttribute('aria-hidden')==='true')return false;
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

  function paint(){
    ensureUi();
    const progress=Math.min(1,pull/THRESHOLD);
    const y=-58+(pull*.72);
    const scale=.82+progress*.18;
    indicator.classList.toggle('visible',pull>3||refreshing);
    if(!refreshing)indicator.style.transform=`translate3d(-50%,${y}px,0) scale(${scale})`;
    if(ring&&!refreshing)ring.style.transform=`rotate(${Math.round(progress*250)}deg)`;
  }

  function reset(){
    tracking=false;armed=false;pull=0;
    if(!indicator)return;
    indicator.classList.remove('visible');
    indicator.style.transform='translate3d(-50%,-72px,0) scale(.82)';
    if(ring)ring.style.transform='rotate(0deg)';
    document.documentElement.classList.remove('prumo-pull-refresh-active');
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
    const t=e.touches[0];
    startY=t.clientY;startX=t.clientX;pull=0;tracking=true;armed=false;
  }

  function onMove(e){
    if(!tracking||refreshing)return;
    const t=e.touches?.[0];if(!t)return;
    const dy=t.clientY-startY,dx=Math.abs(t.clientX-startX);
    if(dy<=0||dx>Math.abs(dy)*.72){if(dy<0)reset();return}
    if(!atTop()&&pull<3){reset();return}
    if(dy<5)return;

    e.preventDefault();
    document.documentElement.classList.add('prumo-pull-refresh-active');
    pull=damp(dy);
    const nowArmed=pull>=THRESHOLD;
    if(nowArmed&&!armed)haptic(8);
    armed=nowArmed;
    paint();
  }

  function onEnd(){
    if(!tracking||refreshing)return;
    const shouldRefresh=armed;
    tracking=false;
    if(shouldRefresh)refresh();
    else reset();
  }

  function init(){
    ensureUi();
    document.addEventListener('touchstart',onStart,{passive:true});
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('touchend',onEnd,{passive:true});
    document.addEventListener('touchcancel',reset,{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();