(function(){
  if(window.__cadernoStabilityV3Loaded)return;
  window.__cadernoStabilityV3Loaded=true;
  const VERSION='20260916-stability3';
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

  function keepThemeLast(){
    if(moving)return;
    const link=ensureThemeLink();
    if(document.head.lastElementChild===link)return;
    moving=true;
    document.head.appendChild(link);
    queueMicrotask(()=>{moving=false});
  }

  function normalizeUi(){
    document.documentElement.classList.add('caderno-theme','caderno-dark','caderno-stable');
    document.querySelectorAll('.caderno-profile').forEach(el=>el.setAttribute('hidden',''));
    const title=document.getElementById('pageTitle');
    if(title)title.classList.add('caderno-page-title');
    document.querySelectorAll('.page').forEach(page=>page.classList.add('caderno-page'));
  }

  function boot(){
    ensureThemeLink();
    normalizeUi();
    keepThemeLast();

    let queued=false;
    const schedule=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        normalizeUi();
        keepThemeLast();
      });
    };

    new MutationObserver(schedule).observe(document.head,{childList:true});
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{
      if(e.target.closest('.nav button,[data-page],.btn,.credit-card'))setTimeout(schedule,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();