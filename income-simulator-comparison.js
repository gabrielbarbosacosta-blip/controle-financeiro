(function(){
  function cleanupLegacyLayout(){
    const modal=document.getElementById('incomeSimulationModal');
    const body=modal?.querySelector('.modal-body');
    if(!modal||!body)return false;
    const grid=document.getElementById('incomeSimulationGraphGrid');
    if(grid){
      const comparisonCard=grid.querySelector('#incomeSimulationComparisonChart')?.closest('.card')||grid.querySelectorAll('.card')[1]||null;
      if(comparisonCard){
        body.insertBefore(comparisonCard,grid);comparisonCard.style.marginBottom='0';
        const wrap=comparisonCard.querySelector('.chart-wrap');if(wrap)wrap.style.minHeight='340px';
        const title=comparisonCard.querySelector('.section-head h3'),sub=comparisonCard.querySelector('.section-head .muted');
        if(title)title.textContent='Comparação da projeção';
        if(sub){const months=typeof window.getProjectionMonths==='function'?window.getProjectionMonths():(Number(state?.settings?.projectionMonths)===24?24:12);sub.textContent=`Projeção atual e projeção com a receita nos próximos ${months} meses, na mesma escala.`}
      }
      grid.remove();
    }
    document.getElementById('incomeSimulationCurrentChart')?.closest('.card')?.remove();
    return true;
  }
  function init(){let tries=0;const timer=setInterval(()=>{tries++;if(cleanupLegacyLayout()||tries>120)clearInterval(timer)},100);const observer=new MutationObserver(()=>cleanupLegacyLayout());observer.observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
  if(window.financeProjection||document.querySelector('script[data-projection-engine]'))return;
  const script=document.createElement('script');
  script.src='projection-engine.js';
  script.async=false;
  script.dataset.projectionEngine='1';
  script.onload=()=>{
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
    }catch(e){console.error('projection engine load',e)}
  };
  document.body.appendChild(script);
})();
