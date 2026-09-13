(function(){
  const DEFAULT_MONTHS=12;

  function months(){
    const n=Number(state?.settings?.projectionMonths);
    return n===24?24:DEFAULT_MONTHS;
  }
  function ensureSetting(){
    if(typeof state==='undefined'||!state?.settings)return DEFAULT_MONTHS;
    const n=months();
    if(state.settings.projectionMonths!==n)state.settings.projectionMonths=n;
    return n;
  }
  window.getProjectionMonths=months;

  const baseProjectionFrom=window.projectionFrom;
  if(typeof baseProjectionFrom==='function'&&!baseProjectionFrom.__globalPeriod){
    const wrapped=function(selectedYm,count){return baseProjectionFrom(selectedYm,count==null?months():count)};
    wrapped.__globalPeriod=true;
    window.projectionFrom=wrapped;
    try{projectionFrom=wrapped}catch(e){}
  }

  const baseAllMonthOptions=window.allMonthOptions;
  if(typeof baseAllMonthOptions==='function'&&!baseAllMonthOptions.__globalPeriod){
    const wrapped=function(){
      const list=baseAllMonthOptions.apply(this,arguments),set=new Set(list||[]),selected=state?.settings?.selectedMonth;
      if(selected&&typeof ymAdd==='function')for(let i=0;i<=months();i++)set.add(ymAdd(selected,i));
      return[...set].filter(Boolean).sort();
    };
    wrapped.__globalPeriod=true;
    window.allMonthOptions=wrapped;
    try{allMonthOptions=wrapped}catch(e){}
  }

  function sourceConfig(){
    const saved=state?.settings?.dashboardProjectionSources||{};
    return{transactions:saved.transactions!==false,incomes:saved.incomes!==false,cards:saved.cards!==false,debts:saved.debts!==false};
  }
  function dashboardRows(selectedYm,count){
    if(typeof actualForMonth!=='function')return[];
    const config=sourceConfig(),actual=actualForMonth(selectedYm),rows=[];
    let opening=Number(actual.closing)||0;
    for(let i=1;i<=count;i++){
      const ym=ymAdd(selectedYm,i);let income=0,otherExpense=0,benefits=0;
      for(const tx of state?.transactions||[]){
        if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
        const isDebt=tx.debtManaged===true,isIncome=tx.incomeManaged===true;
        if(isDebt&&!config.debts)continue;
        if(isIncome&&!config.incomes)continue;
        if(!isDebt&&!isIncome&&!config.transactions)continue;
        if(tx.type==='Receita')income+=Number(tx.amount)||0;
        else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
        else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0;
      }
      const invoices=config.cards?(state?.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0):0;
      const expense=otherExpense+invoices,result=income-expense,closing=typeof round2==='function'?round2(opening+result):Math.round((opening+result)*100)/100;
      rows.push({ym,opening,income,otherExpense,invoices,expense,benefits,result,closing});opening=closing;
    }
    return rows;
  }
  function redrawDashboard(){
    const selected=state?.settings?.selectedMonth;if(!selected)return;
    const count=months(),rows=dashboardRows(selected,count);
    if(typeof drawLineChart==='function')drawLineChart('projectionChart',rows.map(r=>({label:fmtMonth(r.ym),value:r.closing})));
    const chart=document.getElementById('projectionChart'),sub=chart?.closest('.card')?.querySelector('.section-head .muted');
    if(sub){
      const cfg=sourceConfig(),meta={transactions:'Lançamentos',incomes:'Receitas',cards:'Cartões',debts:'Despesas'};
      const active=Object.keys(meta).filter(k=>cfg[k]).map(k=>meta[k]);
      sub.textContent=`Próximos ${count} meses • ${active.length?active.join(' + '):'sem impactos futuros'}`;
    }
  }

  function updateProjectionLabels(){
    const count=months();
    const cardsTotal=document.getElementById('projCardsTotal'),end=document.getElementById('projEnd');
    const t1=cardsTotal?.closest('.mini')?.querySelector('.t'),t2=end?.closest('.mini')?.querySelector('.t');
    if(t1)t1.textContent=`Faturas projetadas (${count}m)`;
    if(t2)t2.textContent=`Saldo em ${count} meses`;
  }

  function redrawCardProjection(){
    const chart=document.getElementById('cardProjectionChart'),box=chart?.closest('.card');
    if(!chart||!box||typeof getCard!=='function'||typeof cardForecast!=='function')return;
    const card=getCard(selectedCardId);if(!card)return;
    const count=months(),proj=[];
    for(let i=0;i<count;i++){const ym=ymAdd(state.settings.selectedMonth,i),f=cardForecast(card,ym);proj.push({ym,...f})}
    const tbody=box.querySelector('table tbody');
    if(tbody)tbody.innerHTML=proj.map(r=>`<tr><td>${fmtMonth(r.ym)}</td><td class="num">${fmtMoney(r.known)}</td><td class="num">${fmtMoney(r.estimate)}</td><td class="num"><strong>${fmtMoney(r.total)}</strong></td></tr>`).join('');
    const sub=box.querySelector('.section-head .muted');if(sub)sub.textContent=`Parcelas conhecidas + estimativa de novas compras • ${count} meses`;
    if(typeof drawLineChart==='function')requestAnimationFrame(()=>drawLineChart('cardProjectionChart',proj.map(r=>({label:fmtMonth(r.ym),value:r.total}))));
  }

  function mountSetting(){
    ensureSetting();
    const grid=document.querySelector('#page-settings .settings-grid');if(!grid)return;
    let card=document.getElementById('projectionPeriodSettings');
    if(!card){
      card=document.createElement('div');card.className='card';card.id='projectionPeriodSettings';
      card.innerHTML='<h3>Período de projeção</h3><p class="muted">Define o horizonte usado nas projeções do Dashboard, cartões, projeção geral e simulações.</p><div class="field" style="margin-top:12px"><label>Horizonte</label><select id="projectionPeriodSelect"><option value="12">12 meses</option><option value="24">24 meses</option></select></div>';
      grid.appendChild(card);
      card.querySelector('#projectionPeriodSelect').addEventListener('change',e=>{
        state.settings.projectionMonths=Number(e.target.value)===24?24:12;
        if(typeof save==='function')save();
        if(typeof renderAll==='function')renderAll();
        setTimeout(()=>{mountSetting();redrawDashboard();redrawCardProjection();updateProjectionLabels();redrawOpenSimulations()},30);
      });
    }
    const select=document.getElementById('projectionPeriodSelect');if(select)select.value=String(months());
  }

  function round(v){return typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100}
  function monthOf(v){return String(v||'').slice(0,7)}
  function pendingAmount(type,ym,excludeIncomeId=null){
    const normalized=String(type||'').toLowerCase();
    let total=(state?.transactions||[]).filter(t=>{
      if(excludeIncomeId&&t.incomeManaged===true&&t.incomePlanId===excludeIncomeId)return false;
      return String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym;
    }).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state?.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function incomePlanFromForm(){
    const mode=document.getElementById('incomeMode')?.value||'unica',firstMonth=document.getElementById('incomeFirstMonth')?.value;
    if(!firstMonth)return null;
    const openEnded=mode==='mensal'&&document.getElementById('incomeNoEnd')?.checked===true;
    return{id:document.getElementById('incomeId')?.value||null,name:document.getElementById('incomeName')?.value.trim()||'Receita simulada',amount:Number(document.getElementById('incomeAmount')?.value)||0,mode,firstMonth,lastMonth:openEnded?null:(mode==='mensal'?document.getElementById('incomeLastMonth')?.value:firstMonth),openEnded};
  }
  function incomeCandidateAmount(plan,ym){if(plan.mode==='unica')return ym===plan.firstMonth?plan.amount:0;if(ym<plan.firstMonth)return 0;if(!plan.openEnded&&plan.lastMonth&&ym>plan.lastMonth)return 0;return plan.amount}
  function incomeExistingSelected(planId,ym){return !planId?0:(state?.transactions||[]).filter(t=>t.incomeManaged===true&&t.incomePlanId===planId&&monthOf(t.date)===ym).reduce((s,t)=>s+(Number(t.amount)||0),0)}
  function incomeSelectedClosing(planId=null){const ym=state.settings.selectedMonth,actual=Number(actualForMonth(ym).closing)||0;return round(actual-incomeExistingSelected(planId,ym)+pendingAmount('Receita',ym,planId)-pendingAmount('Despesa',ym))}
  function incomeFlows(ym,excludeId=null){
    let income=0,otherExpense=0;
    for(const tx of state?.transactions||[]){
      if(excludeId&&tx.incomeManaged===true&&tx.incomePlanId===excludeId)continue;
      if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
      if(tx.type==='Receita')income+=Number(tx.amount)||0;else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
    }
    const invoices=(state?.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    return{income:round(income),otherExpense:round(otherExpense),invoices:round(invoices)};
  }
  function incomeRows(plan,withCandidate){
    const selected=state.settings.selectedMonth,replaceId=withCandidate?plan.id:null,count=months();let opening=incomeSelectedClosing(replaceId);
    if(withCandidate)opening=round(opening+incomeCandidateAmount(plan,selected));
    const rows=[];
    for(let i=1;i<=count;i++){
      const ym=ymAdd(selected,i),flows=incomeFlows(ym,replaceId),candidate=withCandidate?incomeCandidateAmount(plan,ym):0,income=round(flows.income+candidate),expense=round(flows.otherExpense+flows.invoices),result=round(income-expense),closing=round(opening+result);
      rows.push({ym,opening,income,otherExpense:flows.otherExpense,invoices:flows.invoices,result,closing,candidate});opening=closing;
    }
    return rows;
  }
  function redrawIncomeSimulation(){
    const modal=document.getElementById('incomeSimulationModal');if(!modal?.classList.contains('open'))return;
    const plan=incomePlanFromForm();if(!plan||plan.amount<=0)return;
    const current=incomeRows(plan,false),sim=incomeRows(plan,true),cur=current.at(-1)?.closing??0,end=sim.at(-1)?.closing??cur,impact=round(end-cur),endMonth=sim.at(-1)?.ym||state.settings.selectedMonth;
    const curEl=document.getElementById('incomeSimCurrent'),withEl=document.getElementById('incomeSimWith'),monthEl=document.getElementById('incomeSimCurrentMonth'),impactEl=document.getElementById('incomeSimImpact');
    if(curEl)curEl.textContent=fmtMoney(cur);if(withEl)withEl.textContent=fmtMoney(end);if(monthEl)monthEl.textContent=`ao fim de ${fmtMonth(endMonth)}`;if(impactEl){impactEl.textContent=`Impacto: ${impact>=0?'+':''}${fmtMoney(impact)}`;impactEl.style.color=impact>=0?'#86efac':'#fca5a5'}
    const body=document.getElementById('incomeSimulationBody');
    if(body)body.innerHTML=sim.map(r=>`<tr><td>${fmtMonth(r.ym)}${r.candidate?'<div class="muted">inclui receita simulada</div>':''}</td><td class="num">${fmtMoney(r.opening)}</td><td class="num positive">${fmtMoney(r.income)}</td><td class="num">${fmtMoney(r.otherExpense)}</td><td class="num">${fmtMoney(r.invoices)}</td><td class="num ${r.result<0?'negative':'positive'}">${fmtMoney(r.result)}</td><td class="num ${r.closing<0?'negative':''}"><strong>${fmtMoney(r.closing)}</strong></td></tr>`).join('');
    if(typeof drawLineChart==='function'){
      if(document.getElementById('incomeSimulationCurrentChart'))drawLineChart('incomeSimulationCurrentChart',current.map(r=>({label:fmtMonth(r.ym),value:r.closing})));
      if(document.getElementById('incomeSimulationChart'))drawLineChart('incomeSimulationChart',sim.map(r=>({label:fmtMonth(r.ym),value:r.closing})));
    }
    modal.querySelectorAll('.section-head .muted').forEach(el=>{if(/próximos \d+ meses/i.test(el.textContent))el.textContent=el.textContent.replace(/próximos \d+ meses/i,`próximos ${months()} meses`)});
  }

  function purchaseCandidate(){
    const mode=document.getElementById('purchaseMode')?.value||'parcelada',firstInvoiceYm=document.getElementById('purchaseFirstInvoice')?.value,cardId=document.getElementById('purchaseCard')?.value;if(!firstInvoiceYm||!cardId)return null;
    const openEnded=mode!=='recorrente'&&document.getElementById('purchaseOpenEnded')?.checked===true,totalAmount=Number(document.getElementById('purchaseAmount')?.value)||0,installmentValue=Number(document.getElementById('purchaseInstallmentValue')?.value)||0,installments=mode==='recorrente'||openEnded?null:Math.max(1,Number(document.getElementById('purchaseInstallments')?.value)||1);
    return{id:document.getElementById('purchaseId')?.value||'__simulated_purchase__',cardId,date:document.getElementById('purchaseDate')?.value||`${firstInvoiceYm}-01`,description:document.getElementById('purchaseDescription')?.value.trim()||'Compra simulada',category:document.getElementById('purchaseCategory')?.value||'Compras',mode:openEnded?'parcelada':mode,totalAmount:openEnded?null:totalAmount,installments,installmentValue:openEnded?installmentValue:undefined,openEnded,firstInvoiceYm,recurringEnd:mode==='recorrente'?(document.getElementById('purchaseRecurringEnd')?.value||null):null,notes:document.getElementById('purchaseNotes')?.value.trim()||''};
  }
  function purchaseSelectedClosing(){const ym=state.settings.selectedMonth,actual=Number(actualForMonth(ym).closing)||0;return round(actual+pendingAmount('Receita',ym)-pendingAmount('Despesa',ym))}
  function purchaseRows(){
    const selected=state.settings.selectedMonth,count=months(),rows=[];let opening=purchaseSelectedClosing();
    for(let i=1;i<=count;i++){
      const ym=ymAdd(selected,i);let income=0,otherExpense=0;
      for(const tx of state?.transactions||[]){if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;if(tx.type==='Receita')income+=Number(tx.amount)||0;else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0}
      const invoices=(state?.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0),expense=round(otherExpense+invoices),result=round(income-expense),closing=round(opening+result);rows.push({ym,closing});opening=closing;
    }
    return rows;
  }
  function purchaseSimulatedRows(candidate){const original=state.purchases;try{const existing=document.getElementById('purchaseId')?.value||null;base=existing?original.filter(p=>p.id!==existing):original.slice();state.purchases=[...base,candidate];return purchaseRows()}finally{state.purchases=original}}
  function drawPurchaseComparison(current,simulated){
    const canvas=document.getElementById('purchaseSimulationComparisonChart');if(!canvas)return;
    const a=current.map(r=>({label:fmtMonth(r.ym),value:Number(r.closing)||0})),b=simulated.map(r=>({label:fmtMonth(r.ym),value:Number(r.closing)||0})),values=[...a,...b].map(x=>x.value);let min=Math.min(0,...values),max=Math.max(0,...values);if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.max(360,rect.width||980),H=Math.max(280,rect.height||340),p={l:68,r:22,t:24,b:48};canvas.width=W*dpr;canvas.height=H*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0),x=i=>p.l+(W-p.l-p.r)*(a.length<=1?.5:i/(a.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));ctx.clearRect(0,0,W,H);ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const val=min+(max-min)*i/4,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4)}
    const series=(data,color)=>{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();data.forEach((d,i)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(i),y(d.value),4,0,Math.PI*2);ctx.fill()})};series(a,'#60a5fa');series(b,'#f59e0b');a.forEach((d,i)=>{if(a.length<=12||i%2===0){ctx.save();ctx.translate(x(i),H-14);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore()}});
  }
  function redrawPurchaseSimulation(){
    const modal=document.getElementById('purchaseSimulationModal');if(!modal?.classList.contains('open'))return;const candidate=purchaseCandidate();if(!candidate)return;
    const current=purchaseRows(),sim=purchaseSimulatedRows(candidate),cur=current.at(-1)?.closing??0,end=sim.at(-1)?.closing??cur,impact=round(end-cur),endMonth=sim.at(-1)?.ym||state.settings.selectedMonth;
    const curEl=document.getElementById('purchaseSimCurrent'),withEl=document.getElementById('purchaseSimWith'),monthEl=document.getElementById('purchaseSimCurrentMonth'),impactEl=document.getElementById('purchaseSimImpact');if(curEl)curEl.textContent=fmtMoney(cur);if(withEl)withEl.textContent=fmtMoney(end);if(monthEl)monthEl.textContent=`ao fim de ${fmtMonth(endMonth)}`;if(impactEl){impactEl.textContent=`Impacto: ${impact>=0?'+':''}${fmtMoney(impact)}`;impactEl.style.color=impact<0?'#fca5a5':'#86efac'}
    requestAnimationFrame(()=>drawPurchaseComparison(current,sim));
  }

  function bindSimulatorButtons(){
    const income=document.getElementById('incomeSimulateBtn');if(income&&!income.dataset.periodBound){income.dataset.periodBound='1';income.addEventListener('click',()=>setTimeout(redrawIncomeSimulation,100))}
    const purchase=document.getElementById('purchaseSimulateBtn');if(purchase&&!purchase.dataset.periodBound){purchase.dataset.periodBound='1';purchase.addEventListener('click',()=>setTimeout(redrawPurchaseSimulation,100))}
  }
  function redrawOpenSimulations(){setTimeout(()=>{redrawIncomeSimulation();redrawPurchaseSimulation()},80)}

  const baseRenderDashboard=window.renderDashboard;
  if(typeof baseRenderDashboard==='function'&&!baseRenderDashboard.__globalPeriod){const wrapped=function(){const r=baseRenderDashboard.apply(this,arguments);redrawDashboard();return r};wrapped.__globalPeriod=true;window.renderDashboard=wrapped;try{renderDashboard=wrapped}catch(e){}}
  const baseRenderProjection=window.renderProjection;
  if(typeof baseRenderProjection==='function'&&!baseRenderProjection.__globalPeriod){const wrapped=function(){const r=baseRenderProjection.apply(this,arguments);updateProjectionLabels();return r};wrapped.__globalPeriod=true;window.renderProjection=wrapped;try{renderProjection=wrapped}catch(e){}}
  const baseRenderCardDetail=window.renderCardDetail;
  if(typeof baseRenderCardDetail==='function'&&!baseRenderCardDetail.__globalPeriod){const wrapped=function(){const r=baseRenderCardDetail.apply(this,arguments);redrawCardProjection();return r};wrapped.__globalPeriod=true;window.renderCardDetail=wrapped;try{renderCardDetail=wrapped}catch(e){}}
  const baseRenderSettings=window.renderSettings;
  if(typeof baseRenderSettings==='function'&&!baseRenderSettings.__globalPeriod){const wrapped=function(){const r=baseRenderSettings.apply(this,arguments);mountSetting();return r};wrapped.__globalPeriod=true;window.renderSettings=wrapped;try{renderSettings=wrapped}catch(e){}}

  function init(){
    ensureSetting();mountSetting();redrawDashboard();updateProjectionLabels();redrawCardProjection();bindSimulatorButtons();
    const observer=new MutationObserver(()=>{mountSetting();bindSimulatorButtons()});observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
