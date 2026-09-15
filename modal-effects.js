(function(){
  if(window.__financeModalEffectsLoaded)return;
  window.__financeModalEffectsLoaded=true;

  const STYLE_ID='finance-modal-effects-style';

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .modal-backdrop{
        display:flex!important;
        align-items:center;
        justify-content:center;
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        background:rgba(2,6,23,.16)!important;
        backdrop-filter:blur(7px);
        -webkit-backdrop-filter:blur(7px);
        transition:opacity .20s ease,visibility 0s linear .24s;
      }
      .modal-backdrop.open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
        transition:opacity .20s ease,visibility 0s linear 0s;
      }
      .modal-backdrop>.modal{
        opacity:0;
        transform:translateY(14px) scale(.982);
        transform-origin:center center;
        transition:opacity .20s ease,transform .24s cubic-bezier(.2,.8,.2,1);
        background:#111827!important;
      }
      .modal-backdrop.open>.modal{
        opacity:1;
        transform:translateY(0) scale(1);
      }
      @media(max-width:700px){
        .modal-backdrop>.modal{transform:translateY(18px) scale(.99)}
        .modal-backdrop.open>.modal{transform:translateY(0) scale(1)}
      }
      @media(prefers-reduced-motion:reduce){
        .modal-backdrop,.modal-backdrop>.modal{transition:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();
})();
