(function(){
  // A análise de faturas agora é feita pelo GPT conectado ao Controle Financeiro.
  // Mantemos este arquivo apenas para compatibilidade com deploys antigos, sem exibir a UI legada.
  window.__invoiceAiUiLoaded=true;

  function cleanupLegacyInvoiceAiUi(){
    document.getElementById('aiInvoiceAnalyzeBtn')?.remove();
    document.getElementById('aiInvoiceModal')?.remove();
  }

  cleanupLegacyInvoiceAiUi();

  if(document.body){
    const observer=new MutationObserver(cleanupLegacyInvoiceAiUi);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }
})();
