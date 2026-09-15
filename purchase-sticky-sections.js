(function(){
  if(window.__purchaseStickySectionsLoaded)return;
  window.__purchaseStickySectionsLoaded=true;

  const STYLE_ID='purchase-sticky-sections-style';

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;

    // Remove a máscara usada pela versão anterior, caso ainda exista no DOM.
    document.getElementById('purchase-sticky-top-mask')?.remove();

    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #cardDetail .invoice-purchase-group{
        overflow:clip;
      }

      /*
        Os 20 px de respiro continuam sendo controlados pelo scroll de abertura.
        Durante a rolagem, o cabeçalho encosta naturalmente no topo da viewport.
        Assim não existe faixa vazia para os lançamentos aparecerem por trás.
      */
      #cardDetail .invoice-purchase-group:not(.collapsed) > .invoice-purchase-group-head{
        position:sticky;
        top:0;
        z-index:30;
        background:#111827;
        border-radius:11px 11px 0 0;
        overflow:hidden;
        isolation:isolate;
        box-shadow:0 8px 18px rgba(2,6,23,.18),0 1px 0 rgba(148,163,184,.06);
      }

      #cardDetail .invoice-purchase-group.collapsed > .invoice-purchase-group-head{
        position:relative;
        top:auto;
        z-index:auto;
        border-radius:0;
        box-shadow:none;
      }
    `;
    document.head.appendChild(style);
  }

  function init(){
    injectStyles();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
