(function(){
  window.__invoiceAiUiLoaded=true;
  function cleanup(){document.getElementById('aiInvoiceAnalyzeBtn')?.remove();document.getElementById('aiInvoiceModal')?.remove()}
  cleanup();
  if(document.body){const observer=new MutationObserver(cleanup);observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000)}

  const round=v=>typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100;
  const monthOf=v=>String(v||'').slice(0,7);
  const statusOf=v=>String(v||'').trim().toLowerCase();
  const addMonth=(ym,n)=>typeof ymAdd==='function'?ymAdd(ym,n):ym;
  let guardApplying=false,guardTimer=null,guardObserver=null,guardCanvas=null;

  function dashboardSources(){
    const s=state?.settings?.dashboardProjectionSources||{};
    return{transactions:s.transactions!==false,incomes:s.incomes!==false,cards:s.cards!==false,debts:s.debts!==false};
  }

  function installPendingProjectionFix(){
    const fp=window.financeProjection;
    if(!fp?.flowForMonth||!fp?.baseMonth)return false;
    if(fp.__sameMonthPendingFixed)return true;
    const originalFlow=fp.flowForMonth.bind(fp);
    const normalize=cfg=>fp.normalizeSources?fp.normalizeSources(cfg):(cfg||{transactions:true,incomes:true,cards:true,debts:true});
    const allowed=(tx,cfg)=>tx?.debtManaged===true?cfg.debts:tx?.incomeManaged===true?cfg.incomes:cfg.transactions;

    function extras(ym,cfg){
      const sources=normalize(cfg),bm=fp.baseMonth(),bd=String(state?.settings?.baseDate||`${bm}-01`);let income=0,expense=0,benefits=0;
      for(const tx of state?.transactions||[]){
        if(statusOf(tx?.status)!=='pendente'||monthOf(tx?.date)!==ym||!allowed(tx,sources))continue;
        if(tx?.projection!==false&&!(ym===bm&&String(tx?.date||'')<bd))continue;
        const amount=Number(tx.amount)||0;
        if(tx.type==='Receita')income+=amount;else if(tx.type==='Despesa')expense+=amount;else if(tx.type==='Benefício')benefits+=amount;
      }
      return{income:round(income),expense:round(expense),benefits:round(benefits)};
    }

    function flowForMonth(ym,cfg){
      const row=originalFlow(ym,cfg),x=extras(ym,cfg),income=round((Number(row.income)||0)+x.income),otherExpense=round((Number(row.otherExpense)||0)+x.expense),benefits=round((Number(row.benefits)||0)+x.benefits),invoices=Number(row.invoices)||0,expense=round(otherExpense+invoices),result=round(income-expense);
      return{...row,income,otherExpense,benefits,expense,result};
    }
    function closingAt(targetYm,cfg){
      const start=fp.baseMonth();if(!targetYm)return Number(state?.settings?.baseBalance)||0;if(targetYm<start)return typeof actualForMonth==='function'?(Number(actualForMonth(targetYm).closing)||0):(Number(state?.settings?.baseBalance)||0);
      let opening=Number(state?.settings?.baseBalance)||0,ym=start;
      for(let i=0;i<600&&ym<=targetYm;i++){const flow=flowForMonth(ym,cfg),closing=round(opening+flow.result);if(ym===targetYm)return closing;opening=closing;ym=addMonth(ym,1)}
      return round(opening);
    }
    function rowsFrom(selectedYm,count=12,cfg){
      const rows=[];let opening=closingAt(selectedYm,cfg);for(let i=1;i<=Math.max(0,Number(count)||0);i++){const ym=addMonth(selectedYm,i),flow=flowForMonth(ym,cfg),closing=round(opening+flow.result);rows.push({...flow,opening:round(opening),closing});opening=closing}return rows;
    }

    fp.flowForMonth=flowForMonth;fp.closingAt=closingAt;fp.rowsFrom=rowsFrom;fp.__sameMonthPendingFixed=true;
    window.projectedClosingForSelectedMonth=(ym,cfg)=>closingAt(ym,cfg||fp.allSources?.());
    const projection=(selectedYm,months=12)=>rowsFrom(selectedYm,months,fp.allSources?.());window.projectionFrom=projection;try{projectionFrom=projection}catch(e){}
    return true;
  }

  function installDashboardCanonicalDraw(){
    if(window.__dashboardCanonicalDrawInstalled)return true;
    const fp=window.financeProjection,base=window.drawLineChart;
    if(!fp?.rowsFrom||typeof base!=='function')return false;
    const wrapped=function(id,data){
      if(id==='projectionChart'&&state?.settings?.selectedMonth){
        const count=typeof window.getProjectionMonths==='function'?window.getProjectionMonths():(Array.isArray(data)&&data.length?data.length:12);
        const rows=fp.rowsFrom(state.settings.selectedMonth,count,dashboardSources());
        data=rows.map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing}));
        arguments[1]=data;
      }
      return base.apply(this,arguments);
    };
    wrapped.__dashboardCanonicalDraw=true;
    window.drawLineChart=wrapped;try{drawLineChart=wrapped}catch(e){}
    window.__dashboardCanonicalDrawInstalled=true;
    return true;
  }

  function redrawDashboardCanonical(){
    const fp=window.financeProjection,selected=state?.settings?.selectedMonth;
    if(!fp?.rowsFrom||!selected||typeof drawLineChart!=='function')return;
    const count=typeof window.getProjectionMonths==='function'?window.getProjectionMonths():12;
    const rows=fp.rowsFrom(selected,count,dashboardSources());
    guardApplying=true;
    try{drawLineChart('projectionChart',rows.map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing})))}finally{setTimeout(()=>{guardApplying=false},0)}
  }

  function scheduleCanonicalRedraw(){
    if(guardApplying)return;
    clearTimeout(guardTimer);
    guardTimer=setTimeout(()=>requestAnimationFrame(redrawDashboardCanonical),0);
  }

  function installCanvasGuard(){
    const canvas=document.getElementById('projectionChart');
    if(!canvas)return false;
    if(canvas===guardCanvas&&guardObserver)return true;
    guardObserver?.disconnect();guardCanvas=canvas;
    guardObserver=new MutationObserver(mutations=>{
      if(guardApplying)return;
      if(mutations.some(m=>m.type==='attributes'&&(m.attributeName==='width'||m.attributeName==='height')))scheduleCanonicalRedraw();
    });
    guardObserver.observe(canvas,{attributes:true,attributeFilter:['width','height']});
    return true;
  }

  function installFinalDashboardRenderHook(){
    if(window.__finalDashboardProjectionHook)return true;
    const base=window.renderDashboard;
    if(typeof base!=='function')return false;
    const wrapped=function(){
      const result=base.apply(this,arguments);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{installCanvasGuard();redrawDashboardCanonical()}));
      return result;
    };
    wrapped.__finalDashboardProjectionHook=true;
    window.renderDashboard=wrapped;try{renderDashboard=wrapped}catch(e){}
    window.__finalDashboardProjectionHook=true;
    return true;
  }

  function installBodyGuard(){
    if(window.__projectionBodyGuard)return true;
    if(!document.body)return false;
    const observer=new MutationObserver(()=>{
      if(document.getElementById('projectionChart')!==guardCanvas){installCanvasGuard();scheduleCanonicalRedraw()}
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.__projectionBodyGuard=observer;
    return true;
  }

  function refresh(){
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
      if(typeof window.renderProjectedClosing==='function')window.renderProjectedClosing();
      installCanvasGuard();
      requestAnimationFrame(()=>requestAnimationFrame(redrawDashboardCanonical));
    }catch(e){console.error('projection refresh',e)}
  }

  function installAll(){
    const a=installPendingProjectionFix(),b=installDashboardCanonicalDraw(),c=installFinalDashboardRenderHook(),d=installCanvasGuard(),e=installBodyGuard();
    if(a&&b&&c&&d&&e){requestAnimationFrame(refresh);setTimeout(redrawDashboardCanonical,150);setTimeout(redrawDashboardCanonical,700);setTimeout(redrawDashboardCanonical,1500);return true}
    return false;
  }

  if(!installAll()){let tries=0;const timer=setInterval(()=>{tries++;if(installAll()||tries>150)clearInterval(timer)},100)}
})();