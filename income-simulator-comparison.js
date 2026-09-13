(function(){
  function cleanupLegacyLayout(){
    const modal=document.getElementById('incomeSimulationModal');
    const body=modal?.querySelector('.modal-body');
    if(!modal||!body)return false;

    const grid=document.getElementById('incomeSimulationGraphGrid');
    if(grid){
      const comparisonCard=grid.querySelector('#incomeSimulationComparisonChart')?.closest('.card')||grid.querySelectorAll('.card')[1]||null;
      if(comparisonCard){
        body.insertBefore(comparisonCard,grid);
        comparisonCard.style.marginBottom='0';
        const wrap=comparisonCard.querySelector('.chart-wrap');
        if(wrap)wrap.style.minHeight='340px';
        const title=comparisonCard.querySelector('.section-head h3');
        const sub=comparisonCard.querySelector('.section-head .muted');
        if(title)title.textContent='Comparação da projeção';
        if(sub){
          const months=typeof window.getProjectionMonths==='function'?window.getProjectionMonths():(Number(state?.settings?.projectionMonths)===24?24:12);
          sub.textContent=`Projeção atual e projeção com a receita nos próximos ${months} meses, na mesma escala.`;
        }
      }
      grid.remove();
    }

    document.getElementById('incomeSimulationCurrentChart')?.closest('.card')?.remove();
    return true;
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(cleanupLegacyLayout()||tries>120)clearInterval(timer);
    },100);

    const observer=new MutationObserver(()=>cleanupLegacyLayout());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(function(){
  if(window.__pendingProjectionCoreFix)return;
  window.__pendingProjectionCoreFix=true;

  const round=v=>typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100;
  const monthOf=v=>String(v||'').slice(0,7);
  const allSources=()=>({transactions:true,incomes:true,cards:true,debts:true});
  const dashboardSources=()=>{
    const s=state?.settings?.dashboardProjectionSources||{};
    return{transactions:s.transactions!==false,incomes:s.incomes!==false,cards:s.cards!==false,debts:s.debts!==false};
  };

  function sourceAllowed(tx,cfg){
    const isDebt=tx?.debtManaged===true;
    const isIncome=tx?.incomeManaged===true;
    if(isDebt)return cfg.debts;
    if(isIncome)return cfg.incomes;
    return cfg.transactions;
  }

  function selectedMonthProjectedClosing(selectedYm,cfg){
    let closing=typeof actualForMonth==='function'?(Number(actualForMonth(selectedYm).closing)||0):0;
    for(const tx of state?.transactions||[]){
      if(monthOf(tx.date)!==selectedYm)continue;
      if(String(tx.status||'').trim().toLowerCase()!=='pendente')continue;
      if(!sourceAllowed(tx,cfg))continue;
      const amount=Number(tx.amount)||0;
      if(tx.type==='Receita')closing+=amount;
      else if(tx.type==='Despesa')closing-=amount;
    }
    if(cfg.cards&&typeof cardForecast==='function'){
      for(const card of (state?.cards||[]).filter(c=>c.active!==false)){
        const inv=typeof getInvoice==='function'?getInvoice(card.id,selectedYm):null;
        if(inv?.status==='Paga')continue;
        closing-=Number(cardForecast(card,selectedYm).total)||0;
      }
    }
    return round(closing);
  }

  function buildProjection(selectedYm,count,cfg){
    const rows=[];
    let opening=selectedMonthProjectedClosing(selectedYm,cfg);
    for(let i=1;i<=count;i++){
      const ym=typeof ymAdd==='function'?ymAdd(selectedYm,i):selectedYm;
      let income=0,otherExpense=0,benefits=0;
      for(const tx of state?.transactions||[]){
        if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
        if(!sourceAllowed(tx,cfg))continue;
        if(tx.type==='Receita')income+=Number(tx.amount)||0;
        else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
        else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0;
      }
      const invoices=cfg.cards&&typeof cardForecast==='function'?(state?.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0):0;
      const expense=otherExpense+invoices;
      const result=income-expense;
      const closing=round(opening+result);
      rows.push({ym,opening,income,otherExpense,invoices,expense,benefits,result,closing});
      opening=closing;
    }
    return rows;
  }

  function fixedProjectionFrom(selectedYm,count=12){
    return buildProjection(selectedYm,Number(count)||12,allSources());
  }
  fixedProjectionFrom.__pendingCurrentMonthFixed=true;
  window.projectionFrom=fixedProjectionFrom;
  try{projectionFrom=fixedProjectionFrom}catch(e){}
  window.projectedClosingForSelectedMonth=(ym,cfg)=>selectedMonthProjectedClosing(ym,cfg||allSources());

  const previousDraw=window.drawLineChart;
  if(typeof previousDraw==='function'&&!previousDraw.__pendingCurrentMonthFixed){
    const wrappedDraw=function(id,data){
      if((id==='projectionChart'||id==='projectionChartLarge')&&state?.settings?.selectedMonth){
        const count=Math.max(1,Array.isArray(data)?data.length:12);
        const cfg=id==='projectionChart'?dashboardSources():allSources();
        const rows=buildProjection(state.settings.selectedMonth,count,cfg);
        data=rows.map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing}));
        arguments[1]=data;
      }
      return previousDraw.apply(this,arguments);
    };
    wrappedDraw.__pendingCurrentMonthFixed=true;
    window.drawLineChart=wrappedDraw;
    try{drawLineChart=wrappedDraw}catch(e){}
  }

  const previousRenderProjection=window.renderProjection;
  if(typeof previousRenderProjection==='function'){
    const fixedRenderProjection=function(){
      const selected=state?.settings?.selectedMonth;
      if(!selected)return previousRenderProjection.apply(this,arguments);
      const count=typeof window.getProjectionMonths==='function'?window.getProjectionMonths():12;
      const rows=buildProjection(selected,count,allSources());
      const opening=document.getElementById('projOpening'),lowest=document.getElementById('projLowest'),cards=document.getElementById('projCardsTotal'),end=document.getElementById('projEnd'),body=document.getElementById('projectionBody');
      if(opening)opening.textContent=typeof fmtMoney==='function'?fmtMoney(rows[0]?.opening||selectedMonthProjectedClosing(selected,allSources())):String(rows[0]?.opening||0);
      if(lowest){const v=Math.min(...rows.map(r=>r.closing));lowest.textContent=fmtMoney(v);lowest.className='v '+(v<0?'negative':'')}
      if(cards)cards.textContent=fmtMoney(rows.reduce((s,r)=>s+r.invoices,0));
      if(end)end.textContent=fmtMoney(rows.at(-1)?.closing||0);
      if(body)body.innerHTML=rows.map(r=>`<tr><td>${fmtMonth(r.ym)}</td><td class="num">${fmtMoney(r.opening)}</td><td class="num positive">${fmtMoney(r.income)}</td><td class="num">${fmtMoney(r.otherExpense)}</td><td class="num">${fmtMoney(r.invoices)}</td><td class="num ${r.result<0?'negative':'positive'}">${fmtMoney(r.result)}</td><td class="num ${r.closing<0?'negative':''}"><strong>${fmtMoney(r.closing)}</strong></td></tr>`).join('');
      if(typeof drawLineChart==='function')drawLineChart('projectionChartLarge',rows.map(r=>({label:fmtMonth(r.ym),value:r.closing})));
    };
    fixedRenderProjection.__pendingCurrentMonthFixed=true;
    window.renderProjection=fixedRenderProjection;
    try{renderProjection=fixedRenderProjection}catch(e){}
  }

  setTimeout(()=>{
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
    }catch(e){console.error('pending projection refresh',e)}
  },0);
})();
