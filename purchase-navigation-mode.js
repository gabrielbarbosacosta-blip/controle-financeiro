(function(){
  if(window.__purchaseNavigationModeLoaded)return;
  window.__purchaseNavigationModeLoaded=true;

  const STORAGE_KEY='purchaseNavigationMode:v1';
  const SECTION_STORAGE_KEY='purchaseSectionsCollapsed:v2';
  const NAME_STORAGE_KEY='purchaseNameGroupsCollapsed:v1';
  const STYLE_ID='purchase-navigation-mode-style';
  let scheduled=false;

  function readObject(key){
    try{
      const value=JSON.parse(sessionStorage.getItem(key)||'{}');
      return value&&typeof value==='object'?value:{};
    }catch(e){return {}}
  }

  function readMode(){
    try{
      const value=localStorage.getItem(STORAGE_KEY);
      return value==='fixed'?'fixed':'dynamic';
    }catch(e){return 'dynamic'}
  }

  function writeMode(mode){
    try{localStorage.setItem(STORAGE_KEY,mode)}catch(e){}
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /*
        renderCardDetail cria primeiro as linhas cruas da fatura e, no frame seguinte,
        purchase-sections monta a estrutura final. Esconde apenas esse estado intermediário
        para evitar o flash de todos os lançamentos ao trocar rapidamente de página.
      */
      #cardDetail .invoice-layout > .card:first-child:not(:has(> .invoice-purchase-groups)) > .detail-line{
        visibility:hidden!important;
      }

      .purchase-navigation-mode-toggle{white-space:nowrap}
      .purchase-navigation-mode-toggle[data-mode="dynamic"]{
        border-color:#3b82f6;
        background:rgba(59,130,246,.12);
        color:#bfdbfe;
      }
      .purchase-navigation-mode-toggle[data-mode="fixed"]{
        border-color:#475569;
        background:rgba(71,85,105,.14);
        color:#e2e8f0;
      }

      body.purchase-navigation-fixed .purchase-section-toggle,
      body.purchase-navigation-fixed .purchase-name-toggle{
        cursor:default;
      }
      body.purchase-navigation-fixed .purchase-section-toggle:hover,
      body.purchase-navigation-fixed .purchase-name-toggle:hover{
        background:transparent!important;
      }
      body.purchase-navigation-fixed .purchase-section-chevron,
      body.purchase-navigation-fixed .purchase-name-chevron{
        visibility:hidden!important;
      }
      body.purchase-navigation-fixed .purchase-expand-shell,
      body.purchase-navigation-fixed .purchase-name-expand-shell{
        grid-template-rows:1fr!important;
        opacity:1!important;
        pointer-events:auto!important;
        transition:none!important;
      }
      body.purchase-navigation-fixed #purchaseManagerBody tr.purchase-section-item-collapsed,
      body.purchase-navigation-fixed #purchaseManagerBody tr.purchase-name-item-hidden{
        display:table-row!important;
      }
    `;
    document.head.appendChild(style);
  }

  function sectionCollapsed(key){
    const state=readObject(SECTION_STORAGE_KEY);
    return state[key]!==false;
  }

  function nameCollapsed(sectionKey,nameKey){
    const state=readObject(NAME_STORAGE_KEY);
    return state[`${sectionKey}|${nameKey}`]!==false;
  }

  function setButtonOpen(btn,open){
    if(!(btn instanceof HTMLElement))return;
    const expanded=open?'true':'false';
    if(btn.getAttribute('aria-expanded')!==expanded)btn.setAttribute('aria-expanded',expanded);
    if(readMode()==='fixed'){
      if(btn.getAttribute('aria-disabled')!=='true')btn.setAttribute('aria-disabled','true');
    }else if(btn.hasAttribute('aria-disabled'))btn.removeAttribute('aria-disabled');
  }

  function openEverything(){
    document.querySelectorAll('.invoice-purchase-group.collapsed,.purchase-name-group.collapsed').forEach(el=>el.classList.remove('collapsed'));
    document.querySelectorAll('.purchase-section-toggle,.purchase-name-toggle').forEach(btn=>setButtonOpen(btn,true));
    document.querySelectorAll('#purchaseManagerBody .purchase-section-item-collapsed').forEach(row=>row.classList.remove('purchase-section-item-collapsed'));
    document.querySelectorAll('#purchaseManagerBody .purchase-name-item-hidden').forEach(row=>row.classList.remove('purchase-name-item-hidden'));
  }

  function restoreDynamicState(){
    document.querySelectorAll('.invoice-purchase-group').forEach(group=>{
      const key=group.dataset.purchaseSection||group.querySelector('.purchase-section-toggle')?.dataset.sectionToggle||'';
      if(!key)return;
      const collapsed=sectionCollapsed(key);
      group.classList.toggle('collapsed',collapsed);
      setButtonOpen(group.querySelector(':scope > .invoice-purchase-group-head .purchase-section-toggle'),!collapsed);
    });

    document.querySelectorAll('.purchase-name-group').forEach(group=>{
      const sectionKey=group.dataset.nameSection||group.querySelector('.purchase-name-toggle')?.dataset.nameSection||'';
      const nameKey=group.dataset.nameGroup||group.querySelector('.purchase-name-toggle')?.dataset.nameGroup||'';
      if(!sectionKey||!nameKey)return;
      const collapsed=nameCollapsed(sectionKey,nameKey);
      group.classList.toggle('collapsed',collapsed);
      setButtonOpen(group.querySelector('.purchase-name-toggle'),!collapsed);
    });

    const body=document.getElementById('purchaseManagerBody');
    if(body){
      body.querySelectorAll('.purchase-section-row').forEach(header=>{
        const key=header.dataset.purchaseSection||header.querySelector('.purchase-section-toggle')?.dataset.sectionToggle||'';
        if(!key)return;
        const collapsed=sectionCollapsed(key);
        setButtonOpen(header.querySelector('.purchase-section-toggle'),!collapsed);
        body.querySelectorAll(`[data-purchase-section-item="${CSS.escape(key)}"]`).forEach(row=>{
          row.classList.toggle('purchase-section-item-collapsed',collapsed);
        });
      });

      body.querySelectorAll('.purchase-name-group-row .purchase-name-toggle').forEach(btn=>{
        const sectionKey=btn.dataset.nameSection||'';
        const nameKey=btn.dataset.nameGroup||'';
        if(!sectionKey||!nameKey)return;
        const collapsed=nameCollapsed(sectionKey,nameKey);
        setButtonOpen(btn,!collapsed);
        body.querySelectorAll(`tr.purchase-name-item[data-name-section="${CSS.escape(sectionKey)}"][data-name-group="${CSS.escape(nameKey)}"]`).forEach(row=>{
          row.classList.toggle('purchase-name-item-hidden',collapsed);
        });
      });
    }
  }

  function cleanupOrphanButtons(){
    document.querySelectorAll('.purchase-navigation-mode-toggle').forEach(btn=>{
      if(!btn.previousElementSibling?.classList?.contains('purchase-grouping-toggle'))btn.remove();
    });
  }

  function updateModeButtons(){
    const mode=readMode();
    document.querySelectorAll('.purchase-navigation-mode-toggle').forEach(btn=>{
      if(btn.dataset.mode!==mode)btn.dataset.mode=mode;
      const label=mode==='dynamic'?'Dinâmico':'Fixo';
      if(btn.textContent!==label)btn.textContent=label;
      const pressed=mode==='fixed'?'true':'false';
      if(btn.getAttribute('aria-pressed')!==pressed)btn.setAttribute('aria-pressed',pressed);
      btn.title=mode==='dynamic'?'Alternar para modo fixo: mostrar todos os lançamentos':'Alternar para modo dinâmico: usar expansão e retração';
    });
  }

  function ensureModeButtons(){
    cleanupOrphanButtons();
    document.querySelectorAll('.purchase-grouping-toggle').forEach(groupingBtn=>{
      let btn=groupingBtn.nextElementSibling;
      if(!btn?.classList?.contains('purchase-navigation-mode-toggle')){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='btn small purchase-navigation-mode-toggle';
        groupingBtn.insertAdjacentElement('afterend',btn);
        btn.onclick=()=>setMode(readMode()==='dynamic'?'fixed':'dynamic');
      }
    });
    updateModeButtons();
  }

  function applyMode(){
    scheduled=false;
    injectStyles();
    ensureModeButtons();
    const mode=readMode();
    window.purchaseNavigationMode=mode;
    document.body?.classList.toggle('purchase-navigation-fixed',mode==='fixed');
    if(mode==='fixed')openEverything();
    else restoreDynamicState();
  }

  function scheduleApply(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(applyMode);
  }

  function setMode(mode){
    mode=mode==='fixed'?'fixed':'dynamic';
    writeMode(mode);
    window.purchaseNavigationMode=mode;
    if(mode==='fixed'){
      document.activeElement instanceof HTMLElement&&document.activeElement.matches('.purchase-section-toggle,.purchase-name-toggle')&&document.activeElement.blur();
    }
    applyMode();
    window.dispatchEvent(new CustomEvent('purchase-navigation-mode-change',{detail:{mode}}));
  }

  document.addEventListener('click',event=>{
    if(readMode()!=='fixed')return;
    const target=event.target instanceof Element?event.target:null;
    if(!target?.closest('.purchase-section-toggle,.purchase-name-toggle'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  function init(){
    injectStyles();
    window.purchaseNavigationMode=readMode();
    applyMode();

    const observer=new MutationObserver(scheduleApply);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
