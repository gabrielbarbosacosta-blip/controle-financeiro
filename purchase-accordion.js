(function(){
  if(window.__purchaseAccordionLoaded)return;
  window.__purchaseAccordionLoaded=true;

  let syncing=false;
  let focusTimer=null;

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

  function invoiceModule(){
    const host=document.getElementById('cardDetail');
    if(!host)return null;
    const heading=[...host.querySelectorAll('.invoice-layout > .card h3')]
      .find(h=>/^Fatura\b/i.test(String(h.textContent||'').trim()));
    return heading?.closest('.card')||host.querySelector('.invoice-layout > .card:first-child');
  }

  function scrollToTarget(target,button=null){
    if(!(target instanceof HTMLElement))return;
    if(button instanceof HTMLElement){
      try{button.focus({preventScroll:true})}catch(e){}
    }
    target.scrollIntoView({
      behavior:reducedMotion()?'auto':'smooth',
      block:'start',
      inline:'nearest'
    });
  }

  function focusOpened(button){
    if(!(button instanceof HTMLElement))return;
    clearTimeout(focusTimer);

    // Espera a animação das outras seções terminar para calcular a posição final correta.
    const delay=reducedMotion()?0:300;
    focusTimer=setTimeout(()=>{
      if(!button.isConnected||button.getAttribute('aria-expanded')!=='true')return;
      const module=openedModule(button);
      scrollToTarget(module,button);
    },delay);
  }

  function returnToInvoiceModule(button){
    if(!(button instanceof HTMLElement)||!button.closest('#cardDetail'))return;
    clearTimeout(focusTimer);

    // Só retorna à fatura quando o usuário realmente fechou a seção e nenhuma outra ficou aberta.
    const delay=reducedMotion()?0:300;
    focusTimer=setTimeout(()=>{
      if(!button.isConnected||button.getAttribute('aria-expanded')!=='false')return;
      const openInInvoice=document.querySelector('#cardDetail .purchase-section-toggle[aria-expanded="true"]');
      if(openInInvoice)return;
      scrollToTarget(invoiceModule());
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

  document.addEventListener('click',event=>{
    if(syncing)return;
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;

    const sectionBtn=target.closest('.purchase-section-toggle');
    if(sectionBtn){
      queueMicrotask(()=>{
        const expanded=sectionBtn.getAttribute('aria-expanded')==='true';
        if(!expanded){
          returnToInvoiceModule(sectionBtn);
          return;
        }
        const activeKey=sectionBtn.dataset.sectionToggle||'';
        if(!activeKey)return;
        syncing=true;
        try{collapseOtherSections(activeKey)}finally{syncing=false}
        focusOpened(sectionBtn);
      });
      return;
    }

    const nameBtn=target.closest('.purchase-name-toggle');
    if(nameBtn){
      queueMicrotask(()=>{
        if(nameBtn.getAttribute('aria-expanded')!=='true')return;
        const sectionKey=nameBtn.dataset.nameSection||'';
        const activeNameKey=nameBtn.dataset.nameGroup||'';
        if(!sectionKey||!activeNameKey)return;
        syncing=true;
        try{collapseOtherNameGroups(sectionKey,activeNameKey)}finally{syncing=false}
        focusOpened(nameBtn);
      });
    }
  });
})();
