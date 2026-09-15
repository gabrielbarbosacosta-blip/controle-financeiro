(function(){
  if(window.__purchaseStickySectionsLoaded)return;
  window.__purchaseStickySectionsLoaded=true;

  const STYLE_ID='purchase-sticky-sections-style';
  const MASK_ID='purchase-sticky-top-mask';
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
        transition:box-shadow .2s ease,border-color .2s ease,background-color .2s ease,border-radius .2s ease;
      }

      #cardDetail .invoice-purchase-group:not(.collapsed) > .invoice-purchase-group-head.purchase-section-head-stuck{
        background:#111827;
        border:1px solid #344258;
        border-bottom-color:#3a475b;
        border-radius:11px 11px 0 0;
        box-shadow:0 10px 24px rgba(2,6,23,.28),0 1px 0 rgba(148,163,184,.08);
        overflow:hidden;
        isolation:isolate;
      }

      /* A máscara é independente do cabeçalho. Ela só cobre o respiro acima
         do sticky e não altera bordas, cantos ou dimensões da seção. */
      #${MASK_ID}{
        position:fixed;
        top:0;
        height:${TOP_GAP}px;
        display:none;
        pointer-events:none;
        z-index:29;
        background:rgba(11,18,32,.985);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
      }
      #${MASK_ID}.visible{display:block}

      #cardDetail .invoice-purchase-group.collapsed > .invoice-purchase-group-head{
        position:relative;
        top:auto;
        z-index:auto;
        border-radius:0;
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

  function ensureMask(){
    let mask=document.getElementById(MASK_ID);
    if(mask)return mask;
    mask=document.createElement('div');
    mask.id=MASK_ID;
    mask.setAttribute('aria-hidden','true');
    document.body.appendChild(mask);
    return mask;
  }

  function hideMask(){
    const mask=document.getElementById(MASK_ID);
    if(mask)mask.classList.remove('visible');
  }

  function placeMask(head){
    const mask=ensureMask();
    const rect=head.getBoundingClientRect();
    const left=Math.max(0,rect.left-1);
    const right=Math.min(window.innerWidth,rect.right+1);
    mask.style.left=`${left}px`;
    mask.style.width=`${Math.max(0,right-left)}px`;
    mask.classList.add('visible');
  }

  function update(){
    raf=0;
    const groups=document.querySelectorAll('#cardDetail .invoice-purchase-group');
    let activeHead=null;

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
      if(stuck)activeHead=head;
    });

    if(activeHead)placeMask(activeHead);else hideMask();
  }

  function schedule(){
    if(raf)return;
    raf=requestAnimationFrame(update);
  }

  function init(){
    injectStyles();
    ensureMask();
    schedule();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});

    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
