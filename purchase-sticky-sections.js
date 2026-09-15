(function(){
  if(window.__purchaseStickySectionsLoaded)return;
  window.__purchaseStickySectionsLoaded=true;

  const STYLE_ID='purchase-sticky-sections-style';
  const TOP_GAP=20;
  let raf=0;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;

    // Limpa artefatos de versões anteriores baseadas em máscara.
    document.getElementById('purchase-sticky-top-mask')?.remove();

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
        border-radius:11px 11px 0 0;
        overflow:hidden;
        isolation:isolate;
        box-shadow:0 8px 18px rgba(2,6,23,.18),0 1px 0 rgba(148,163,184,.06);
      }

      /*
        O conteúdo continua na posição normal do documento, mas sua pintura é
        recortada conforme passa por trás do cabeçalho sticky. Não há máscara,
        cor artificial nem alteração no formato visual da seção.
      */
      #cardDetail .invoice-purchase-group > .purchase-expand-shell{
        will-change:clip-path;
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

  function clearClip(group){
    const shell=group.querySelector(':scope > .purchase-expand-shell');
    if(shell instanceof HTMLElement&&shell.style.clipPath)shell.style.clipPath='';
  }

  function update(){
    raf=0;

    document.querySelectorAll('#cardDetail .invoice-purchase-group').forEach(group=>{
      if(!(group instanceof HTMLElement))return;
      if(group.classList.contains('collapsed')){
        clearClip(group);
        return;
      }

      const head=group.querySelector(':scope > .invoice-purchase-group-head');
      const shell=group.querySelector(':scope > .purchase-expand-shell');
      if(!(head instanceof HTMLElement)||!(shell instanceof HTMLElement))return;

      const groupRect=group.getBoundingClientRect();
      const headRect=head.getBoundingClientRect();
      const shellRect=shell.getBoundingClientRect();

      // Só recorta quando o cabeçalho realmente entrou no estado sticky.
      const sticky=groupRect.top < TOP_GAP && headRect.top <= TOP_GAP + 1;
      if(!sticky){
        if(shell.style.clipPath)shell.style.clipPath='';
        return;
      }

      // Tudo que subir além da borda inferior do cabeçalho deixa de ser pintado.
      // O fundo verdadeiro da página permanece visível nos 20 px acima dele.
      const overlap=Math.max(0,Math.min(shellRect.height,headRect.bottom-shellRect.top));
      const next=overlap>0.5?`inset(${overlap.toFixed(2)}px 0 0 0)`:'';
      if(shell.style.clipPath!==next)shell.style.clipPath=next;
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
    observer.observe(document.body,{
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:['class','aria-expanded']
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
