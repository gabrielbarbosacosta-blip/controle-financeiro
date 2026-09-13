(function(){
  if(window.__financialChartTooltipsLoaded)return;
  window.__financialChartTooltipsLoaded=true;

  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const month=v=>typeof fmtMonth==='function'?fmtMonth(v):String(v||'');
  const round=v=>typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100;
  const monthOf=v=>String(v||'').slice(0,7);
  const addMonth=(ym,n)=>typeof ymAdd==='function'?ymAdd(ym,n):(()=>{const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})();
  const horizon=()=>typeof window.getProjectionMonths==='function'?window.getProjectionMonths():(Number(state?.settings?.projectionMonths)===24?24:12);

  function tooltipFor(canvas){
    const host=canvas.parentElement;if(!host)return null;
    host.style.position='relative';
    let tip=host.querySelector(':scope > .financial-chart-tooltip');
    if(!tip){
      tip=document.createElement('div');
      tip.className='financial-chart-tooltip';
      tip.style.cssText='display:none;position:absolute;z-index:30;pointer-events:none;min-width:120px;padding:7px 9px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.28);white-space:nowrap;transform:translate(-50%,-100%)';
      host.appendChild(tip);
    }
    return tip;
  }

  function bind(canvas,points){
    if(!canvas||!Array.isArray(points)||!points.length)return;
    canvas.__financialTooltipPoints=points;
    const tip=tooltipFor(canvas);if(!tip)return;
    if(canvas.__financialTooltipBound)return;
    canvas.__financialTooltipBound=true;
    canvas.addEventListener('mousemove',e=>{
      const list=canvas.__financialTooltipPoints||[];
      const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
      let nearest=null,best=Infinity;
      for(const pt of list){const dist=Math.hypot(mx-pt.x,my-pt.y);if(dist<best){best=dist;nearest=pt}}
      if(!nearest||best>14){tip.style.display='none';canvas.style.cursor='default';return}
      tip.innerHTML=`<strong>${nearest.series||'Valor'}</strong><br><span style="color:#94a3b8">${nearest.label||''}</span><br>${money(nearest.value)}`;
      tip.style.left=`${canvas.offsetLeft+nearest.x}px`;
      tip.style.top=`${canvas.offsetTop+nearest.y-8}px`;
      tip.style.display='block';canvas.style.cursor='pointer';
    });
    canvas.addEventListener('mouseleave',()=>{tip.style.display='none';canvas.style.cursor='default'});
  }
  window.bindFinancialChartTooltip=bind;

  function standardPoints(canvas,data,series='Valor'){
    if(!canvas||!Array.isArray(data)||!data.length)return[];
    const rect=canvas.getBoundingClientRect(),W=Math.max(300,rect.width||700),H=Math.max(220,rect.height||300),p={l:62,r:18,t:20,b:42};
    const vals=data.map(d=>Number(d.value)||0);let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    return data.map((d,i)=>({x:x(i),y:y(Number(d.value)||0),label:d.label,value:Number(d.value)||0,series}));
  }

  const originalDraw=window.drawLineChart;
  if(typeof originalDraw==='function'&&!originalDraw.__withVertexTooltip){
    const wrapped=function(id,data){
      const result=originalDraw.apply(this,arguments);
      const canvas=document.getElementById(id);
      const series=id==='cardProjectionChart'?'Fatura projetada':id==='projectionChart'||id==='projectionChartLarge'?'Saldo projetado':'Valor';
      if(canvas)requestAnimationFrame(()=>bind(canvas,standardPoints(canvas,data,series)));
      return result;
    };
    wrapped.__withVertexTooltip=true;
    window.drawLineChart=wrapped;
    try{drawLineChart=wrapped}catch(e){}
  }

  function comparisonPoints(canvas,a,b,seriesA,seriesB){
    if(!canvas||(!a?.length&&!b?.length))return[];
    const values=[...(a||[]),...(b||[])].map(x=>Number(x.value)||0);let min=Math.min(0,...values),max=Math.max(0,...values);if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;
    const rect=canvas.getBoundingClientRect(),W=Math.max(360,rect.width||980),H=Math.max(280,rect.height||340),p={l:68,r:22,t:24,b:48},count=Math.max(a?.length||0,b?.length||0);
    const x=i=>p.l+(W-p.l-p.r)*(count<=1?.5:i/(count-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    return[
      ...(a||[]).map((d,i)=>({x:x(i),y:y(Number(d.value)||0),label:d.label,value:Number(d.value)||0,series:seriesA})),
      ...(b||[]).map((d,i)=>({x:x(i),y:y(Number(d.value)||0),label:d.label,value:Number(d.value)||0,series:seriesB}))
    ];
  }

  function pendingAmount(type,ym,excludeIncomeId=null,excludeDebtId=null){
    const normalized=String(type||'').toLowerCase();
    let total=(state?.transactions||[]).filter(t=>{
      if(excludeIncomeId&&t.incomeManaged===true&&t.incomePlanId===excludeIncomeId)return false;
      if(excludeDebtId&&t.debtManaged===true&&t.debtId===excludeDebtId)return false;
      return String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym;
    }).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state?.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function incomeData(){
    const canvas=document.getElementById('incomeSimulationComparisonChart'),modal=document.getElementById('incomeSimulationModal');
    if(!canvas||!modal?.classList.contains('open')||typeof state==='undefined')return null;
    const mode=document.getElementById('incomeMode')?.value||'unica',firstMonth=document.getElementById('incomeFirstMonth')?.value,amount=Number(document.getElementById('incomeAmount')?.value)||0;
    if(!firstMonth||amount<=0)return null;
    const openEnded=mode==='mensal'&&document.getElementById('incomeNoEnd')?.checked===true,lastMonth=openEnded?null:(mode==='mensal'?document.getElementById('incomeLastMonth')?.value:firstMonth),planId=document.getElementById('incomeId')?.value||null;
    const candidate=ym=>mode==='unica'?(ym===firstMonth?amount:0):(ym>=firstMonth&&(!lastMonth||ym<=lastMonth)?amount:0);
    const existingSelected=(id,ym)=>!id?0:(state.transactions||[]).filter(t=>t.incomeManaged===true&&t.incomePlanId===id&&monthOf(t.date)===ym).reduce((s,t)=>s+(Number(t.amount)||0),0);
    const selected=state.settings.selectedMonth;
    const selectedClosing=id=>round((Number(actualForMonth(selected).closing)||0)-existingSelected(id,selected)+pendingAmount('Receita',selected,id,null)-pendingAmount('Despesa',selected));
    const flows=(ym,excludeId)=>{let income=0,expense=0;for(const tx of state.transactions||[]){if(excludeId&&tx.incomeManaged===true&&tx.incomePlanId===excludeId)continue;if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;if(tx.type==='Receita')income+=Number(tx.amount)||0;else if(tx.type==='Despesa')expense+=Number(tx.amount)||0}const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);return{income,expense,invoices}};
    const build=withCandidate=>{const excludeId=withCandidate?planId:null;let opening=selectedClosing(excludeId);if(withCandidate)opening=round(opening+candidate(selected));const rows=[];for(let i=1;i<=horizon();i++){const ym=addMonth(selected,i),f=flows(ym,excludeId),inc=round(f.income+(withCandidate?candidate(ym):0)),closing=round(opening+inc-f.expense-f.invoices);rows.push({label:month(ym),value:closing});opening=closing}return rows};
    return{canvas,current:build(false),simulated:build(true)};
  }

  function expenseData(){
    const canvas=document.getElementById('expenseSimulationComparisonChart'),modal=document.getElementById('expenseSimulationModal');
    if(!canvas||!modal?.classList.contains('open')||typeof state==='undefined')return null;
    const firstMonth=document.getElementById('debtFirstMonth')?.value,amount=Number(document.getElementById('debtInstallmentAmount')?.value)||0,firstInstallment=Math.max(1,Number(document.getElementById('debtFirstInstallment')?.value)||1),openEnded=document.getElementById('debtOpenEnded')?.checked===true,total=openEnded?null:Math.max(1,Number(document.getElementById('debtTotalInstallments')?.value)||1),debtId=document.getElementById('debtId')?.value||null;
    if(!firstMonth||amount<=0)return null;
    const diff=(a,b)=>{const[ya,ma]=a.split('-').map(Number),[yb,mb]=b.split('-').map(Number);return(yb-ya)*12+(mb-ma)};
    const candidate=ym=>{if(ym<firstMonth)return 0;const elapsed=diff(firstMonth,ym),n=firstInstallment+elapsed;if(elapsed<0||(!openEnded&&n>total))return 0;return amount};
    const selected=state.settings.selectedMonth;
    const settledExisting=(id,ym)=>!id?0:(state.transactions||[]).filter(t=>t.debtManaged===true&&t.debtId===id&&monthOf(t.date)===ym&&String(t.status||'').toLowerCase()!=='pendente').reduce((s,t)=>s+(Number(t.amount)||0),0);
    const selectedClosing=id=>round((Number(actualForMonth(selected).closing)||0)+settledExisting(id,selected)+pendingAmount('Receita',selected)-pendingAmount('Despesa',selected,null,id));
    const flows=(ym,excludeId)=>{let income=0,expense=0;for(const tx of state.transactions||[]){if(excludeId&&tx.debtManaged===true&&tx.debtId===excludeId)continue;if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;if(tx.type==='Receita')income+=Number(tx.amount)||0;else if(tx.type==='Despesa')expense+=Number(tx.amount)||0}const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);return{income,expense,invoices}};
    const build=withCandidate=>{const excludeId=withCandidate?debtId:null;let opening=selectedClosing(excludeId);if(withCandidate)opening=round(opening-candidate(selected));const rows=[];for(let i=1;i<=horizon();i++){const ym=addMonth(selected,i),f=flows(ym,excludeId),exp=round(f.expense+(withCandidate?candidate(ym):0)),closing=round(opening+f.income-exp-f.invoices);rows.push({label:month(ym),value:closing});opening=closing}return rows};
    return{canvas,current:build(false),simulated:build(true)};
  }

  function attachCustom(){
    const income=incomeData();if(income)bind(income.canvas,comparisonPoints(income.canvas,income.current,income.simulated,'Projeção atual','Com a receita'));
    const expense=expenseData();if(expense)bind(expense.canvas,comparisonPoints(expense.canvas,expense.current,expense.simulated,'Projeção atual','Com a despesa'));
  }

  function attachExistingStandard(){
    if(typeof state==='undefined'||!state?.settings?.selectedMonth||typeof projectionFrom!=='function')return;
    const rows=projectionFrom(state.settings.selectedMonth,horizon()),data=rows.map(r=>({label:month(r.ym),value:r.closing}));
    for(const id of ['projectionChart','projectionChartLarge']){const c=document.getElementById(id);if(c)bind(c,standardPoints(c,data,'Saldo projetado'))}
    const cardCanvas=document.getElementById('cardProjectionChart');
    try{
      if(cardCanvas&&typeof selectedCardId!=='undefined'&&typeof getCard==='function'&&typeof cardForecast==='function'){
        const card=getCard(selectedCardId);if(card){const d=[];for(let i=0;i<horizon();i++){const ym=addMonth(state.settings.selectedMonth,i);d.push({label:month(ym),value:Number(cardForecast(card,ym).total)||0})}bind(cardCanvas,standardPoints(cardCanvas,d,'Fatura projetada'))}
      }
    }catch(e){}
  }

  function refresh(){requestAnimationFrame(()=>requestAnimationFrame(()=>{attachExistingStandard();attachCustom()}))}
  refresh();
  const observer=new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
