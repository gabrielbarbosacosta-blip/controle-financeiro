(function(){
  if(window.__purchaseAccordionLoaded)return;
  window.__purchaseAccordionLoaded=true;

  if(!document.querySelector('script[data-purchase-sticky-sections]')){
    const stickyScript=document.createElement('script');
    stickyScript.src='purchase-sticky-sections.js';
    stickyScript.async=false;
    stickyScript.dataset.purchaseStickySections='1';
    document.head.appendChild(stickyScript);
  }

  let syncing=false;
  let focusTimer=null;
  const preClickState=new WeakMap();
  const OPEN_TOP_GAP=20;
  const TRANSITION_SETTLE_MS=410;

  function reducedMotion(){
    return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function openedModule(button){
    if(!(button instanceof HTMLElement))return null;
    if(button.classList.contains('purchase-section-toggle')){
      return button.closest('.invoice-purchase-group')||button.closest('.purchase-section-row')||button;
    }
    if(button.classList.contains('purchase-name-toggle')){
      return button.closest('.purchase-name-group')||button.closest('.purchase-name-group-row')||button;
    }
    return button;
  }

  function containingSection(button){
    if(!(button instanceof HTMLElement))return null;
    return button.closest('.invoice-purchase-group')||button.closest('.purchase-section-row');
  }

  function invoiceModule(){
    const host=document.getElementById('cardDetail');
    if(!host)return null;
    return host.querySelector('.invoice-layout > .card:first-child')||host;
  }

  function scrollToTarget(target,button=null,topGap=OPEN_TOP_GAP){
    if(!(target instanceof HTMLElement))return;
    if(button instanceof HTMLElement){
      try{button.focus({preventScroll:true})}catch(e){}
    }

    const rect=target.getBoundingClientRect();
    const top=Math.max(0,window.scrollY+rect.top-Math.max(0,Number(topGap)||0));
    window.scrollTo({
      top,
      behavior:reducedMotion()?'auto':'smooth'
    });
  }

  function focusOpened(button){
    if(!(button instanceof HTMLElement))return;
    clearTimeout(focusTimer);

    // Aguarda a troca abrir/fechar terminar para o scroll não competir com a alteração de altura.
    const delay=reducedMotion()?0:TRANSITION_SETTLE_MS;
    focusTimer=setTimeout(()=>{
      if(!button.isConnected||button.getAttribute('aria-expanded')!=='true')return;
      const module=openedModule(button);
      scrollToTarget(module,button,OPEN_TOP_GAP);
    },delay);
  }

  function scrollBackToInvoice(){
    clearTimeout(focusTimer);
    const delay=reducedMotion()?0:TRANSITION_SETTLE_MS+30;

    focusTimer=setTimeout(()=>{
      const module=invoiceModule();
      if(!(module instanceof HTMLElement))return;

      // Se outra seção principal foi aberta nesse intervalo, ela passa a ser a referência da tela.
      const openInInvoice=document.querySelector('#cardDetail .purchase-section-toggle[aria-expanded="true"]');
      if(openInInvoice)return;

      // Remove o foco do botão recolhido para o navegador não tentar mantê-lo visível.
      const active=document.activeElement;
      if(active instanceof HTMLElement&&active.matches('.purchase-section-toggle'))active.blur();

      // Calcula a posição final do card após a retração. É mais previsível que scrollIntoView
      // quando a altura da página muda durante a animação do accordion.
      const rect=module.getBoundingClientRect();
      const top=Math.max(0,window.scrollY+rect.top-8);

      const root=document.documentElement;
      const oldAnchor=root.style.overflowAnchor;
      root.style.overflowAnchor='none';
      window.scrollTo({top,behavior:reducedMotion()?'auto':'smooth'});
      setTimeout(()=>{root.style.overflowAnchor=oldAnchor},reducedMotion()?0:500);
    },delay);
  }

  function scrollBackToSection(button){
    if(!(button instanceof HTMLElement))return;
    const section=containingSection(button);
    if(!(section instanceof HTMLElement))return;

    clearTimeout(focusTimer);
    const delay=reducedMotion()?0:TRANSITION_SETTLE_MS+30;

    focusTimer=setTimeout(()=>{
      if(!section.isConnected)return;

      // Se outro agrupamento foi aberto nesse intervalo, ele passa a controlar o foco da tela.
      const sectionKey=button.dataset.nameSection||'';
      const openNameGroups=[...document.querySelectorAll('.purchase-name-toggle[aria-expanded="true"]')]
        .some(btn=>(btn.dataset.nameSection||'')===sectionKey);
      if(openNameGroups)return;

      const active=document.activeElement;
      if(active instanceof HTMLElement&&active.matches('.purchase-name-toggle'))active.blur();

      const rect=section.getBoundingClientRect();
      const top=Math.max(0,window.scrollY+rect.top-OPEN_TOP_GAP);

      const root=document.documentElement;
      const oldAnchor=root.style.overflowAnchor;
      root.style.overflowAnchor='none';
      window.scrollTo({top,behavior:reducedMotion()?'auto':'smooth'});
      setTimeout(()=>{root.style.overflowAnchor=oldAnchor},reducedMotion()?0:500);
    },delay);
  }

  function collapseOtherSections(activeKey){
    const seen=new Set();
    const buttons=[...document.querySelectorAll('.purchase-section-toggle[aria-expanded="true"]')];
    for(const btn of buttons){
      const key=btn.dataset.sectionToggle||'';
      if(!key||key===activeKey||seen.has(key))continue;
      seen.add(key);
      btn.click();
    }
  }

  function collapseOtherNameGroups(sectionKey,activeNameKey){
    const seen=new Set();
    const buttons=[...document.querySelectorAll('.purchase-name-toggle[aria-expanded="true"]')];
    for(const btn of buttons){
      const key=btn.dataset.nameGroup||'';
      const section=btn.dataset.nameSection||'';
      if(!key||section!==sectionKey||key===activeNameKey||seen.has(key))continue;
      seen.add(key);
      btn.click();
    }
  }

  // Captura o estado ANTES do onclick do componente alterar aria-expanded.
  document.addEventListener('click',event=>{
    if(syncing)return;
    const target=event.target instanceof Element?event.target:null;
    const btn=target?.closest('.purchase-section-toggle,.purchase-name-toggle');
    if(btn instanceof HTMLElement){
      preClickState.set(btn,btn.getAttribute('aria-expanded')==='true');
    }
  },true);

  document.addEventListener('click',event=>{
    if(syncing)return;
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;

    const sectionBtn=target.closest('.purchase-section-toggle');
    if(sectionBtn){
      const wasExpanded=preClickState.get(sectionBtn)===true;
      preClickState.delete(sectionBtn);

      setTimeout(()=>{
        if(!sectionBtn.isConnected)return;
        const expanded=sectionBtn.getAttribute('aria-expanded')==='true';

        // Fechamento manual: antes estava aberta e agora está recolhida.
        if(wasExpanded&&!expanded){
          if(sectionBtn.closest('#cardDetail'))scrollBackToInvoice();
          return;
        }

        if(!expanded)return;
        const activeKey=sectionBtn.dataset.sectionToggle||'';
        if(!activeKey)return;
        syncing=true;
        try{collapseOtherSections(activeKey)}finally{syncing=false}
        focusOpened(sectionBtn);
      },0);
      return;
    }

    const nameBtn=target.closest('.purchase-name-toggle');
    if(nameBtn){
      const wasExpanded=preClickState.get(nameBtn)===true;
      preClickState.delete(nameBtn);

      setTimeout(()=>{
        if(!nameBtn.isConnected)return;
        const expanded=nameBtn.getAttribute('aria-expanded')==='true';

        // Fechamento manual de um agrupamento por nome: volta ao topo da seção principal.
        if(wasExpanded&&!expanded){
          if(nameBtn.closest('#cardDetail'))scrollBackToSection(nameBtn);
          return;
        }

        if(!expanded)return;
        const sectionKey=nameBtn.dataset.nameSection||'';
        const activeNameKey=nameBtn.dataset.nameGroup||'';
        if(!sectionKey||!activeNameKey)return;
        syncing=true;
        try{collapseOtherNameGroups(sectionKey,activeNameKey)}finally{syncing=false}
        focusOpened(nameBtn);
      },0);
    }
  });
})();
