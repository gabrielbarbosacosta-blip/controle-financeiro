(function(){
  function monthLabel(ym){return typeof fmtMonth==='function'?fmtMonth(ym):ym}
  function currentRows(){
    if(typeof projectionFrom!=='function'||!state?.settings?.selectedMonth)return[];
    return projectionFrom(state.settings.selectedMonth,12);
  }
  function parseMoney(text){
    const cleaned=String(text||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    return Number(cleaned)||0;
  }
  function simulatedRowsFromTable(){
    const rows=[...document.querySelectorAll('#incomeSimulationBody tr')];
    return rows.map(row=>{
      const cells=row.querySelectorAll('td');
      const label=(cells[0]?.childNodes?.[0]?.textContent||cells[0]?.textContent||'').trim();
      const closing=parseMoney(cells[6]?.textContent||'0');
      return{label,value:closing};
    }).filter(r=>r.label);
  }
  function drawCurrent(){
    if(typeof drawLineChart!=='function')return;
    const data=currentRows().map(r=>({label:monthLabel(r.ym),value:Number(r.closing)||0}));
    requestAnimationFrame(()=>drawLineChart('incomeSimulationCurrentChart',data));
  }
  function redrawSimulated(){
    if(typeof drawLineChart!=='function')return;
    const data=simulatedRowsFromTable();
    if(data.length)requestAnimationFrame(()=>drawLineChart('incomeSimulationChart',data));
  }
  function enhance(){
    const modal=document.getElementById('incomeSimulationModal');
    const body=modal?.querySelector('.modal-body');
    const simCard=body?.querySelector('.card');
    if(!modal||!body||!simCard)return false;

    if(!document.getElementById('incomeSimulationGraphGrid')){
      const currentCard=document.createElement('div');
      currentCard.className='card';
      currentCard.innerHTML='<div class="section-head"><div><h3>Projeção atual</h3><div class="muted">Saldo projetado nos próximos 12 meses sem a nova receita.</div></div></div><div class="chart-wrap small"><canvas id="incomeSimulationCurrentChart"></canvas></div>';

      const title=simCard.querySelector('.section-head h3');
      const sub=simCard.querySelector('.section-head .muted');
      if(title)title.textContent='Projeção com a receita';
      if(sub)sub.textContent='Saldo projetado nos próximos 12 meses considerando a receita simulada.';

      const table=simCard.querySelector('.table-scroll');
      if(table)table.style.display='none';

      const grid=document.createElement('div');
      grid.id='incomeSimulationGraphGrid';
      grid.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:stretch';
      body.insertBefore(grid,simCard);
      grid.appendChild(currentCard);
      grid.appendChild(simCard);

      simCard.style.marginBottom='0';
      const chartWrap=simCard.querySelector('.chart-wrap');
      if(chartWrap)chartWrap.style.minHeight='300px';
      const currentWrap=currentCard.querySelector('.chart-wrap');
      if(currentWrap)currentWrap.style.minHeight='300px';

      const style=document.createElement('style');
      style.textContent='@media(max-width:1050px){#incomeSimulationGraphGrid{grid-template-columns:1fr!important}}';
      document.head.appendChild(style);
    }

    drawCurrent();
    redrawSimulated();
    return true;
  }
  function init(){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(enhance()||tries>150)clearInterval(timer)},100);
    const watch=()=>{
      const modal=document.getElementById('incomeSimulationModal');
      if(!modal)return false;
      new MutationObserver(()=>{
        if(modal.classList.contains('open'))setTimeout(()=>enhance(),30);
      }).observe(modal,{attributes:true,attributeFilter:['class']});
      return true;
    };
    let watchTries=0;
    const watchTimer=setInterval(()=>{watchTries++;if(watch()||watchTries>150)clearInterval(watchTimer)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();