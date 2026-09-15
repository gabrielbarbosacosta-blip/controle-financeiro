(function(){
  // Sticky desativado: restaura o comportamento normal das seções.
  document.getElementById('purchase-sticky-sections-style')?.remove();
  document.getElementById('purchase-sticky-top-mask')?.remove();

  document.querySelectorAll('#cardDetail .purchase-expand-shell').forEach(shell=>{
    if(shell instanceof HTMLElement){
      shell.style.clipPath='';
      shell.style.willChange='';
    }
  });

  document.querySelectorAll('#cardDetail .invoice-purchase-group-head').forEach(head=>{
    if(!(head instanceof HTMLElement))return;
    head.classList.remove('purchase-section-head-stuck');
    head.style.position='';
    head.style.top='';
    head.style.zIndex='';
    head.style.borderRadius='';
    head.style.boxShadow='';
    head.style.overflow='';
    head.style.isolation='';
  });

  window.__purchaseStickySectionsLoaded=true;
})();
