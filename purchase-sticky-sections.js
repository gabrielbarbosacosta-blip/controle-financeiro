(function(){
  if(window.__purchaseStickySectionsLoaded)return;
  window.__purchaseStickySectionsLoaded=true;

  const STYLE_ID='purchase-sticky-sections-style';
  const TOP_GAP=20;
  let raf=0;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #cardDetail .invoice-purchase-group{
        overflow:clip;
      }

      #cardDetail .invoice-purchase-group:not(.collapsed) > .invoice-purchase-group-head{
        position:sticky;
        top:${TOP_GAP}px;
        z-index:30;
        background:#111827;
        transition:box-shadow .2s ease,border-color .2s ease,background-color .2s ease;
      }

      #cardDetail .invoice-purchase-group:not(.collapsed) > .invoice-purchase-group-head.purchase-section-head-stuck{
        background:#111827;
        border-bottom-color:#3a475b;
        box-shadow:0 10px 24px rgba(2,6,23,.28),0 1px 0 rgba(148,163,184,.08);
      }

      /* Máscara que cobre o respiro de 20 px acima do cabeçalho sticky.
         Assim os lançamentos que passam por trás não ficam visíveis acima dele. */
      #cardDetail .invoice-purchase-group:not(.collapsed) > .invoice-purchase-group-head.purchase-section-head-stuck::before{
        content:"";
        position:absolute;
        left:-1px;
        right:-1px;
        top:-${TOP_GAP}px;
        height:${TOP_GAP}px;
        background:#0b1220;
        pointer-events:none;
        z-index:-1;
      }

      #cardDetail .invoice-purchase-group.collapsed > .invoice-purchase-group-head{
        position:relative;
        top:auto;
        z-index:auto;
        box-shadow:none;
      }

      @media (prefers-reduced-motion: reduce){
        #cardDetail .invoice-purchase-group > .invoice-purchase-group-head{
          transition:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function update(){
    raf=0;
    const groups=document.querySelectorAll('#cardDetail .invoice-purchase-group');
    groups.forEach(group=>{
      const head=group.querySelector(':scope > .invoice-purchase-group-head');
      if(!(head instanceof HTMLElement))return;
      if(group.classList.contains('collapsed')){
        head.classList.remove('purchase-section-head-stuck');
        return;
      }

      const groupRect=group.getBoundingClientRect();
      const headRect=head.getBoundingClientRect();
      const stuck=groupRect.top < TOP_GAP &&
        headRect.top <= TOP_GAP + 1 &&
        groupRect.bottom > TOP_GAP + headRect.height + 2;
      head.classList.toggle('purchase-section-head-stuck',stuck);
    });
  }

  function schedule(){
    if(raf)return;
    raf=requestAnimationFrame(update);
  }

  function init(){
    injectStyles();
    schedule();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});

    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
