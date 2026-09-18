(function(){
  if(window.__cadernoStabilityV3Loaded)return;
  window.__cadernoStabilityV3Loaded=true;
  const VERSION='20260918-stability24-splash-prumo-hold';
  const PROFILE_SKINS=['profile-panel-skin-v1.js?v=20260916-profile2','profile-panel-skin-v2.js?v=20260916-profilepalette2'];
  const FEATURE_SCRIPTS=['profile-avatar-performance-v1.js?v=20260917-avatarperf1','goal-participant-avatars-v7.js?v=20260916-goalavatars2','goal-recurring-terminology-v1.js?v=20260916-goalterms2','goal-recurring-participants-v2.js?v=20260916-goalsharedrecurring1','goal-effective-metrics-v1.js?v=20260916-goaleffective1','goal-extra-delete-v1.js?v=20260916-goalextra2','kpi-countup-v1.js?v=20260918-kpicount3'];
  let moving=false;

  function ensureThemeLink(){
    let link=document.getElementById('caderno-stability-v3');
    if(!link){
      link=document.createElement('link');
      link.id='caderno-stability-v3';
      link.rel='stylesheet';
      link.href=`figma-caderno-stability-v3.css?v=${VERSION}`;
      document.head.appendChild(link);
    }
    return link;
  }

  function ensureScripts(list){
    list.forEach(src=>{
      const file=String(src).split('?')[0];
      if([...document.scripts].some(s=>String(s.getAttribute('src')||'').split('?')[0].endsWith(file)))return;
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      document.body.appendChild(script);
    });
  }

  function ensureProfileSkins(){ensureScripts(PROFILE_SKINS)}
  function ensureFeatureScripts(){ensureScripts(FEATURE_SCRIPTS)}

  function keepThemeLast(){
    if(moving)return;
    const link=ensureThemeLink();
    if(document.head.lastElementChild===link)return;
    moving=true;
    document.head.appendChild(link);
    queueMicrotask(()=>{moving=false});
  }

  function fallbackName(){
    try{
      const meta=currentUser?.user_metadata||{};
      const full=String(meta.full_name||meta.name||meta.nome||'').trim();
      const email=String(currentUser?.email||'').trim();
      const base=full||email.split('@')[0].replace(/[._-]+/g,' ')||'Gabriel';
      return base.split(/\s+/)[0]||'Gabriel';
    }catch(e){return'Gabriel'}
  }

  function profileNickname(){
    const nick=String(document.getElementById('profileNickname')?.value||'').trim();
    return nick||fallbackName();
  }

  function refreshGreeting(){
    const active=document.querySelector('.nav button.active')?.dataset.page||'';
    if(active&&active!=='dashboard')return;
    const title=document.getElementById('pageTitle');
    if(!title)return;
    const hour=new Date().getHours();
    const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
    const wanted=`${greeting}, ${profileNickname()}.`;
    if(title.textContent!==wanted)title.textContent=wanted;
  }

  function normalizeUi(){
    document.documentElement.classList.add('caderno-theme','caderno-dark','caderno-stable');
    document.querySelectorAll('.caderno-profile').forEach(el=>el.setAttribute('hidden',''));
    const title=document.getElementById('pageTitle');
    if(title)title.classList.add('caderno-page-title');
    document.querySelectorAll('.page').forEach(page=>page.classList.add('caderno-page'));
    refreshGreeting();
  }

  function startSplashRelease(){
    const started=performance.now();
    const MIN_VISIBLE=3100;
    const SETTLE_AFTER_READY=520;
    const CHART_LEAD=420;
    let finished=false;
    let chartTriggered=false;
    let pollTimer=0;
    let chartTimer=0;
    let releaseTimer=0;

    const release=()=>{
      if(finished)return;
      finished=true;
      clearInterval(pollTimer);
      clearTimeout(chartTimer);
      clearTimeout(releaseTimer);
      document.body?.classList.add('caderno-splash-done');
      try{window.dispatchEvent(new CustomEvent('caderno:splash-done'))}catch(e){}
    };

    const triggerChart=()=>{
      if(chartTriggered||finished)return;
      chartTriggered=true;
      try{window.dispatchEvent(new CustomEvent('caderno:chart-intro-start'))}catch(e){}
      try{window.financeStartFirstLoadChart?.()}catch(e){}
    };

    const scheduleRelease=(baseDelay,withChart)=>{
      if(finished)return;
      clearInterval(pollTimer);
      clearTimeout(chartTimer);
      clearTimeout(releaseTimer);
      const minRemaining=Math.max(0,MIN_VISIBLE-(performance.now()-started));
      const delay=Math.max(Number(baseDelay)||0,minRemaining);
      if(withChart&&!chartTriggered){
        chartTimer=setTimeout(triggerChart,Math.max(0,delay-CHART_LEAD));
      }
      releaseTimer=setTimeout(release,delay);
    };

    const dashboardReady=()=>{
      const app=document.getElementById('appRoot');
      const month=document.getElementById('monthSelect');
      const opening=String(document.getElementById('kpiOpening')?.textContent||'').trim();
      return window.__prumoInitialModulesReady===true&&!!app&&!app.classList.contains('auth-hidden')&&(month?.options?.length||0)>0&&opening&&opening!=='—';
    };

    pollTimer=setInterval(()=>{
      if(!dashboardReady())return;
      scheduleRelease(SETTLE_AFTER_READY,true);
    },50);

    try{
      const client=typeof sb!=='undefined'?sb:window.sb;
      client?.auth?.getSession?.().then(({data})=>{
        if(!data?.session)scheduleRelease(0,false);
      }).catch(()=>{});
    }catch(e){}

    setTimeout(()=>{
      if(finished)return;
      if(dashboardReady()){
        triggerChart();
        setTimeout(release,CHART_LEAD);
      }else release();
    },8000);
  }

  function boot(){
    ensureThemeLink();
    normalizeUi();
    keepThemeLast();
    ensureProfileSkins();
    ensureFeatureScripts();
    startSplashRelease();

    let queued=false;
    const schedule=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        normalizeUi();
        keepThemeLast();
        ensureProfileSkins();
        ensureFeatureScripts();
      });
    };

    new MutationObserver(schedule).observe(document.head,{childList:true});
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('input',e=>{
      if(e.target?.id==='profileNickname')schedule();
    },true);
    document.addEventListener('click',e=>{
      if(e.target.closest('.nav button,[data-page],.btn,.credit-card'))setTimeout(schedule,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
