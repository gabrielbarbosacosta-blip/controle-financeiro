(function(){
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function monthLabel(ym){return typeof fmtMonth==='function'?fmtMonth(ym):ym}

  function currentRows(){
    if(typeof projectionFrom!=='function'||!state?.settings?.selectedMonth)return[];
    return projectionFrom(state.settings.selectedMonth,12);
  }

  function fillCurrent(){
    const body=document.getElementById('incomeSimulationCurrentBody');
    if(!body)return;
    const rows=currentRows();
    body.innerHTML=rows.map(r=>`<tr><td>${monthLabel(r.ym)}</td><td class="num">${money(r.opening)}</td><td class="num positive">${money(r.income)}</td><td class="num">${money(r.otherExpense)}</td><td class="num">${money(r.invoices)}</td><td class="num ${r.result<0?'negative':'positive'}">${money(r.result)}</td><td class="num ${r.closing<0?'negative':''}"><strong>${money(r.closing)}</strong></td></tr>`).join('');
  }

  function enhance(){
    const modal=document.getElementById('incomeSimulationModal');
    const body=modal?.querySelector('.modal-body');
    const simCard=body?.querySelector('.card');
    if(!modal||!body||!simCard)return false;

    if(!document.getElementById('incomeSimulationComparisonGrid')){
      const currentCard=document.createElement('div');
      currentCard.className='card';
      currentCard.innerHTML=`<div class="section-head"><div><h3>Projeção atual</h3><div class="muted">Cenário atual, sem a receita que está sendo simulada.</div></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mês</th><th class="num">Saldo inicial</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Cartões</th><th class="num">Resultado</th><th class="num">Saldo final</th></tr></thead><tbody id="incomeSimulationCurrentBody"></tbody></table></div>`;

      const title=simCard.querySelector('.section-head h3');
      const sub=simCard.querySelector('.section-head .muted');
      if(title)title.textContent='Projeção com a receita';
      if(sub)sub.textContent='Cenário considerando a receita preenchida, antes de cadastrá-la.';

      const chart=simCard.querySelector('.chart-wrap');
      const grid=document.createElement('div');
      grid.id='incomeSimulationComparisonGrid';
      grid.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start';
      body.insertBefore(grid,simCard);
      grid.appendChild(currentCard);
      grid.appendChild(simCard);

      if(chart){
        const chartCard=document.createElement('div');
        chartCard.className='card';
        chartCard.style.marginTop='14px';
        chartCard.innerHTML='<div class="section-head"><div><h3>Evolução do saldo com a receita</h3><div class="muted">Cenário simulado nos próximos 12 meses.</div></div></div>';
        chartCard.appendChild(chart);
        grid.insertAdjacentElement('afterend',chartCard);
      }

      const style=document.createElement('style');
      style.textContent='@media(max-width:1050px){#incomeSimulationComparisonGrid{grid-template-columns:1fr!important}}';
      document.head.appendChild(style);
    }

    fillCurrent();
    return true;
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(enhance()||tries>150)clearInterval(timer)},100);
    const observer=new MutationObserver(()=>{
      const modal=document.getElementById('incomeSimulationModal');
      if(modal?.classList.contains('open'))setTimeout(()=>{enhance();fillCurrent()},0);
    });
    const watch=()=>{
      const modal=document.getElementById('incomeSimulationModal');
      if(!modal)return false;
      observer.observe(modal,{attributes:true,attributeFilter:['class']});
      return true;
    };
    let watchTries=0;
    const watchTimer=setInterval(()=>{watchTries++;if(watch()||watchTries>150)clearInterval(watchTimer)},100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();