(function(){
  // A edição versionada de receitas agora está integrada diretamente em incomes.js.
  // Este arquivo permanece por compatibilidade e também inicializa a integração com o ChatGPT Plus.
  if(!document.querySelector('script[data-chatgpt-finance-loader]')){
    const script=document.createElement('script');
    script.src='invoice-ai-client.js';
    script.async=false;
    script.dataset.chatgptFinanceLoader='1';
    document.head.appendChild(script);
  }
  if(typeof window.incomeAmountForMonth==='function')return;
})();
