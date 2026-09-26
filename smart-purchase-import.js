(function(){
  // Compatibility shim: the previous smart CSV importer used the same modal id
  // and overwrote window.openCsvImport, hiding the newer AI-prompt workflow.
  // Keep this file harmless because older cached pages may still request it.
  function cleanupLegacy(){
    const modal=document.getElementById('csvPurchaseModal');
    if(modal&&modal.dataset?.csvUiVersion!=='ai-prompt-v3')modal.remove();
    const old=document.getElementById('importPurchasesBtn');
    if(old)old.remove();
  }

  function loadPromptImporter(){
    cleanupLegacy();
    if(window.__prumoCsvPromptUiVersion==='ai-prompt-v3'&&typeof window.openCsvImport==='function')return;
    if(document.querySelector('script[data-prumo-csv-prompt-v3]'))return;
    const s=document.createElement('script');
    s.src='csv-import.js?v=20260926-aiprompt3';
    s.async=false;
    s.dataset.prumoCsvPromptV3='1';
    document.head.appendChild(s);
  }

  cleanupLegacy();
  loadPromptImporter();

  if(document.body){
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        cleanupLegacy();
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }
})();