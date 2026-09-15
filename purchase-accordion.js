(function(){
  if(window.__purchaseAccordionLoaded)return;
  window.__purchaseAccordionLoaded=true;

  let syncing=false;

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
        if(sectionBtn.getAttribute('aria-expanded')!=='true')return;
        const activeKey=sectionBtn.dataset.sectionToggle||'';
        if(!activeKey)return;
        syncing=true;
        try{collapseOtherSections(activeKey)}finally{syncing=false}
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
      });
    }
  });
})();
