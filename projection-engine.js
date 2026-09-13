(function(){
  if(window.__financeProjectionEngineV1)return;
  window.__financeProjectionEngineV1=true;

  const round=v=>typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100;
  const monthOf=v=>String(v||'').slice(0,7);
  const statusOf=v=>String(v||'').trim().toLowerCase();
  const addMonth=(ym,n)=>typeof ymAdd==='function'?ymAdd(ym,n):(()=>{const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();

  function todayMonth(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function baseMonth(){return monthOf(state?.settings?.baseDate)||state?.settings?.selectedMonth||todayMonth()}
  function baseDate(){return String(state?.settings?.baseDate||`${baseMonth()}-01`)}
  function anchorMonth(){
    const configured=String(state?.settings?.projectionAnchorMonth||'');
    if(/^\d{4}-\d{2}$/.test(configured))return configured;
    const b=baseMonth(),today=todayMonth();
    return b>today?b:today;
  }
  function allSources(){return{transactions:true,incomes:true,cards:true,debts:true}}
  function normalizeSources(cfg){const c=cfg||{};return{transactions:c.transactions!==false,incomes:c.incomes!==false,cards:c.cards!==false,debts:c.debts!==false}}
  function sourceAllowed(tx,cfg){if(tx?.debtManaged===true)return cfg.debts;if(tx?.incomeManaged===true)return cfg.incomes;return cfg.transactions}

  function recurringFallback(tx,ym){
    const start=monthOf(tx?.date);if(!start||ym<start||tx?.projection===false)return false;
    if(tx?.recurringEnd&&ym>tx.recurringEnd)return false;
    if(tx?.nature==='Parcelamento'&&tx?.installmentCurrent&&tx?.installmentTotal){
      const [ya,ma]=start.split('-').map(Number),[yb,mb]=ym.split('-').map(Number),elapsed=(yb-ya)*12+(mb-ma);
      return Number(tx.installmentCurrent)+elapsed<=Number(tx.installmentTotal);
    }
    if(tx?.recurring)return true;
    return ym===start&&statusOf(tx?.status)==='pendente';
  }

  function transactionIncluded(tx,ym,cfg){
    const txMonth=monthOf(tx?.date);if(!txMonth)return false;
    const pending=statusOf(tx?.status)==='pendente';
    if(txMonth===ym){
      if(ym===baseMonth()&&String(tx.date||'')<baseDate())return false;
      if(!pending)return true;
      return tx?.projection!==false&&sourceAllowed(tx,cfg);
    }
    if(txMonth>ym||tx?.projection===false||!sourceAllowed(tx,cfg))return false;
    if(typeof isProjectedTxInMonth==='function')return !!isProjectedTxInMonth(tx,ym);
    return recurringFallback(tx,ym);
  }

  function canonicalCardForecast(card,ym){
    const known=typeof invoiceKnownTotal==='function'?(Number(invoiceKnownTotal(card.id,ym))||0):0;
    const inv=typeof getInvoice==='function'?getInvoice(card.id,ym):null;
    const status=statusOf(inv?.status||'Aberta');
    let estimate=0;
    if(card?.active!==false&&(!inv||status==='aberta')&&ym>anchorMonth())estimate=Number(card?.estimatedMonthlySpend)||0;
    return{known:round(known),estimate:round(estimate),total:round(known+estimate),status:inv?.status||'Aberta'};
  }

  function cardExpenseForMonth(ym,cfg){
    let total=0;
    for(const card of state?.cards||[]){
      const inv=typeof getInvoice==='function'?getInvoice(card.id,ym):null;
      const status=statusOf(inv?.status);
      if(status==='paga'){
        if(ym===baseMonth()&&typeof invoiceDueDate==='function'&&invoiceDueDate(card,ym)<baseDate())continue;
        total+=typeof invoiceKnownTotal==='function'?(Number(invoiceKnownTotal(card.id,ym))||0):0;
        continue;
      }
      if(card?.active===false||!cfg.cards)continue;
      total+=canonicalCardForecast(card,ym).total;
    }
    return round(total);
  }

  function flowForMonth(ym,cfg){
    const sources=normalizeSources(cfg);let income=0,otherExpense=0,benefits=0;
    for(const tx of state?.transactions||[]){
      if(!transactionIncluded(tx,ym,sources))continue;
      const amount=Number(tx.amount)||0;
      if(tx.type==='Receita')income+=amount;
      else if(tx.type==='Despesa')otherExpense+=amount;
      else if(tx.type==='Benefício')benefits+=amount;
    }
    const invoices=cardExpenseForMonth(ym,sources),expense=round(otherExpense+invoices),result=round(income-expense);
    return{ym,income:round(income),otherExpense:round(otherExpense),invoices,expense,benefits:round(benefits),result};
  }

  function closingAt(targetYm,cfg){
    const sources=normalizeSources(cfg),start=baseMonth();
    if(!targetYm)return Number(state?.settings?.baseBalance)||0;
    if(targetYm<start)return typeof actualForMonth==='function'?(Number(actualForMonth(targetYm).closing)||0):(Number(state?.settings?.baseBalance)||0);
    let opening=Number(state?.settings?.baseBalance)||0,ym=start;
    for(let guard=0;guard<600&&ym<=targetYm;guard++){
      const flow=flowForMonth(ym,sources);const closing=round(opening+flow.result);
      if(ym===targetYm)return closing;
      opening=closing;ym=addMonth(ym,1);
    }
    return round(opening);
  }

  function rowsFrom(selectedYm,count=12,cfg){
    const sources=normalizeSources(cfg),rows=[];let opening=closingAt(selectedYm,sources);
    const n=Math.max(0,Number(count)||0);
    for(let i=1;i<=n;i++){
      const ym=addMonth(selectedYm,i),flow=flowForMonth(ym,sources),closing=round(opening+flow.result);
      rows.push({...flow,opening:round(opening),closing});opening=closing;
    }
    return rows;
  }

  function audit(targetYm,starts,cfg){
    const list=Array.isArray(starts)&&starts.length?starts:[baseMonth(),state?.settings?.selectedMonth].filter(Boolean),expected=closingAt(targetYm,cfg);
    return{targetYm,expected,checks:list.map(start=>{const diff=typeof monthDiff==='function'?monthDiff(start,targetYm):0;if(diff<=0)return{start,value:closingAt(targetYm,cfg),ok:true};const row=rowsFrom(start,diff,cfg).find(r=>r.ym===targetYm);const value=row?.closing;return{start,value,ok:round(value-expected)===0}})};
  }

  const api={version:1,baseMonth,anchorMonth,allSources,normalizeSources,cardForecast:canonicalCardForecast,flowForMonth,closingAt,rowsFrom,audit};
  window.financeProjection=api;
  window.projectedClosingForSelectedMonth=(ym,cfg)=>closingAt(ym,cfg||allSources());
  window.cardForecast=canonicalCardForecast;try{cardForecast=canonicalCardForecast}catch(e){}
  const canonicalProjectionFrom=function(selectedYm,months=12){return rowsFrom(selectedYm,months,allSources())};
  canonicalProjectionFrom.__canonicalProjectionEngine=true;
  window.projectionFrom=canonicalProjectionFrom;try{projectionFrom=canonicalProjectionFrom}catch(e){}

  function refresh(){
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
      if(document.getElementById('page-cards')?.classList.contains('active')&&typeof renderCards==='function')renderCards();
    }catch(e){console.error('projection engine refresh',e)}
  }
  requestAnimationFrame(refresh);
})();
