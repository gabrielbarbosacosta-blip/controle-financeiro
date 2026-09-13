(function(){
  // A edição versionada de receitas agora está integrada diretamente em incomes.js.
  // Este arquivo permanece por compatibilidade e inicializa integrações auxiliares da interface.
  if(!document.querySelector('script[data-chatgpt-finance-loader]')){
    const script=document.createElement('script');
    script.src='invoice-ai-client.js';
    script.async=false;
    script.dataset.chatgptFinanceLoader='1';
    document.head.appendChild(script);
  }

  if(!document.querySelector('script[data-invoice-clear-loader]')){
    const script=document.createElement('script');
    script.src='invoice-clear.js';
    script.async=false;
    script.dataset.invoiceClearLoader='1';
    document.head.appendChild(script);
  }

  if(typeof window.incomeAmountForMonth==='function')return;
})();
