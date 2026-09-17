(function(){
  if(window.__prumoFinancialEntityFloatingV1)return;
  window.__prumoFinancialEntityFloatingV1=true;

  const PANEL_ID='page-financial-entity';
  const BACKDROP_ID='financialEntityBackdrop';
  const STYLE_ID='financial-entity-floating-v1-style';
  let sourcePage='';
  let savedTitle='';
  let savedSubtitle='';
  let syncing=false;
  let focusAfterClose=null;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${BACKDROP_ID}{position:fixed;inset:0;z-index:2147483000;background:rgba(2,7,14,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;pointer-events:none;transition:opacity .2s ease}
      body.entity-floating-open #${BACKDROP_ID}{opacity:1;pointer-events:auto}
      body.entity-floating-open{overflow:hidden!important}
      body.entity-floating-open #${PANEL_ID}{display:block!important;position:fixed!important;z-index:2147483001;left:50%;top:50%;width:min(1180px,calc(100vw - 72px));max-width:none!important;max-height:calc(100vh - 64px);margin:0!important;padding:25px 25px 28px!important;overflow:auto;overscroll-behavior:contain;background:#091523;border:1px solid #26384e;border-radius:22px;box-shadow:0 32px 90px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.025);transform:translate(-50%,-48%) scale(.985);opacity:0;animation:entityFloatingIn .23s cubic-bezier(.2,.75,.25,1) forwards;scrollbar-gutter:stable}
      body.entity-floating-open #${PANEL_ID} .entity-panel-back{display:none!important}
      .entity-floating-close{position:sticky;top:0;z-index:12;float:right;margin:-7px -7px 4px 12px;width:35px;height:35px;border-radius:999px;border:1px solid #31445b;background:rgba(13,25,41,.94);color:#b8c5d4;font-size:20px;line-height:1;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.28);backdrop-filter:blur(10px)}
      .entity-floating-close:hover{color:#fff;border-color:#4a627d;background:#142438}
      body.entity-floating-open .modal-backdrop.open{z-index:2147483200!important}
      @keyframes entityFloatingIn{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      @media(max-width:760px){body.entity-floating-open #${PANEL_ID}{left:10px;right:10px;top:10px;bottom:10px;width:auto;max-height:none;border-radius:18px;padding:20px 15px 24px!important;transform:none;animation:entityFloatingMobileIn .22s cubic-bezier(.2,.75,.25,1) forwards}.entity-floating-close{top:-4px;margin-right:-2px}@keyframes entityFloatingMobileIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}}
      @media(prefers-reduced-motion:reduce){#${BACKDROP_ID}{transition:none!important}body.entity-floating-open #${PANEL_ID}{animation:none!important;opacity:1!important;transform:translate(-50%,-50%)!important}@media(max-width:760px){body.entity-floating-open #${PANEL_ID}{transform:none!important}}}
    `;
    document.head.appendChild(style);
  }

  function ensureBackdrop(){
    let backdrop=document.getElementById(BACKDROP_ID);
    if(backdrop)return backdrop;
    backdrop=document.createElement('div');
    backdrop.id=BACKDROP_ID;
    backdrop.setAttribute('aria-hidden','true');
    backdrop.addEventListener('click',closePanel);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function activeSourcePage(){
    const direct=[...document.querySelectorAll('.page.active')].find(p=>p.id!==PANEL_ID);
    if(direct)return direct.id.replace(/^page-/,'');
    const nav=document.querySelector('.nav button.active[data-page]');
    return nav?.dataset.page||'';
  }

  function rememberContext(trigger){
    const current=activeSourcePage();
    if(current)sourcePage=current;
    const title=document.getElementById('pageTitle'),subtitle=document.getElementById('pageSubtitle');
    if(title&&title.textContent&&!/^Painel da (despesa|receita)$/i.test(title.textContent.trim()))savedTitle=title.textContent;
    if(subtitle&&subtitle.textContent&&subtitle.textContent!=='Competências, impacto, histórico e vínculos financeiros')savedSubtitle=subtitle.textContent;
    if(trigger instanceof HTMLElement)focusAfterClose=trigger;
  }

  function restoreUnderlyingPage(){
    const pageName=sourcePage||document.querySelector('.nav button.active[data-page]')?.dataset.page||'';
    if(!pageName)return;
    const page=document.getElementById(`page-${pageName}`);
    if(page)page.classList.add('active');
  }

  function restoreTopbar(){
    const title=document.getElementById('pageTitle'),subtitle=document.getElementById('pageSubtitle');
    if(title&&savedTitle)title.textContent=savedTitle;
    if(subtitle&&savedSubtitle)subtitle.textContent=savedSubtitle;
  }

  function ensureCloseButton(panel){
    let close=panel.querySelector('.entity-floating-close');
    if(close)return close;
    close=document.createElement('button');
    close.type='button';
    close.className='entity-floating-close';
    close.setAttribute('aria-label','Fechar painel');
    close.title='Fechar';
    close.textContent='×';
    close.addEventListener('click',closePanel);
    panel.prepend(close);
    return close;
  }

  function closePanel(){
    const panel=document.getElementById(PANEL_ID);
    if(!panel||!document.body.classList.contains('entity-floating-open'))return;
    document.body.classList.remove('entity-floating-open');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.removeAttribute('aria-label');
    document.getElementById(BACKDROP_ID)?.setAttribute('aria-hidden','true');
    const originalBack=panel.querySelector('#entityPanelBack');
    if(originalBack){originalBack.click()}
    else if(sourcePage){document.querySelector(`.nav button[data-page="${CSS.escape(sourcePage)}"]`)?.click()}
    requestAnimationFrame(()=>{
      restoreTopbar();
      if(focusAfterClose?.isConnected)focusAfterClose.focus({preventScroll:true});
      focusAfterClose=null;
    });
  }

  function syncFloatingState(){
    if(syncing)return;
    syncing=true;
    try{
      const panel=document.getElementById(PANEL_ID);
      if(!panel)return;
      const open=panel.classList.contains('active');
      if(open){
        if(!sourcePage)sourcePage=document.querySelector('.nav button.active[data-page]')?.dataset.page||'';
        ensureBackdrop();
        restoreUnderlyingPage();
        restoreTopbar();
        const close=ensureCloseButton(panel);
        panel.setAttribute('role','dialog');
        panel.setAttribute('aria-modal','true');
        panel.setAttribute('aria-label','Painel financeiro');
        document.getElementById(BACKDROP_ID)?.setAttribute('aria-hidden','false');
        const firstOpen=!document.body.classList.contains('entity-floating-open');
        document.body.classList.add('entity-floating-open');
        if(firstOpen)requestAnimationFrame(()=>close.focus({preventScroll:true}));
      }else if(document.body.classList.contains('entity-floating-open')){
        document.body.classList.remove('entity-floating-open');
        document.getElementById(BACKDROP_ID)?.setAttribute('aria-hidden','true');
      }
    }finally{syncing=false}
  }

  function scheduleSync(){queueMicrotask(syncFloatingState)}

  function init(){
    injectStyles();
    ensureBackdrop();
    document.addEventListener('click',e=>{
      const trigger=e.target?.closest?.('.entity-panel-btn,[data-entity-link-open]');
      if(trigger)rememberContext(trigger);
    },true);
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||!document.body.classList.contains('entity-floating-open'))return;
      if(document.querySelector('.modal-backdrop.open'))return;
      e.preventDefault();closePanel();
    });
    const observer=new MutationObserver(scheduleSync);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    syncFloatingState();
    window.closeFloatingFinancialEntityPanel=closePanel;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
