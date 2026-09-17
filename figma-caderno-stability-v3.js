(function(){
  if(window.__cadernoStabilityV3Loaded)return;
  window.__cadernoStabilityV3Loaded=true;
  const VERSION='20260916-stability7';
  const PROFILE_SKINS=['profile-panel-skin-v1.js?v=20260916-profile2','profile-panel-skin-v2.js?v=20260916-profilepalette2'];
  const FEATURE_SCRIPTS=['goal-participant-avatars-v7.js?v=20260916-goalavatars1'];
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

  function boot(){
    ensureThemeLink();
    normalizeUi();
    keepThemeLast();
    ensureProfileSkins();
    ensureFeatureScripts();

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
