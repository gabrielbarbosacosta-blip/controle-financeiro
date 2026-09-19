(function(){
  function horizon(){
    if(typeof window.getProjectionMonths==='function')return window.getProjectionMonths();
    const n=Number(state?.settings?.projectionMonths);
    return n===24?24:12;
  }

  function addMonth(ym,n){
    if(typeof ymAdd==='function')return ymAdd(ym,n);
    const [y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function monthLabel(ym){return typeof fmtMonth==='function'?fmtMonth(ym):ym}
  function round(v){return typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100}
  function monthOf(date){return String(date||'').slice(0,7)}

  function planFromForm(){
    const form=document.getElementById('incomeForm');
    if(!form||!form.reportValidity())return null;
    const mode=document.getElementById('incomeMode')?.value||'unica';
    const firstMonth=document.getElementById('incomeFirstMonth')?.value;
    const openEnded=mode==='mensal'&&document.getElementById('incomeNoEnd')?.checked===true;
    const lastMonth=mode==='mensal'&&!openEnded?document.getElementById('incomeLastMonth')?.value:firstMonth;
    if(!firstMonth)return null;
    if(mode==='mensal'&&!openEnded&&!lastMonth){alert('Informe o último mês ou marque Sem data final.');return null}
    if(lastMonth&&lastMonth<firstMonth){alert('O último mês não pode ser anterior ao primeiro mês.');return null}
    const amount=Number(document.getElementById('incomeAmount')?.value)||0;
    if(amount<=0){alert('Informe um valor de receita maior que zero.');return null}
    return {
      id:document.getElementById('incomeId')?.value||null,
      name:document.getElementById('incomeName')?.value.trim()||'Receita simulada',
      amount,mode,firstMonth,lastMonth:openEnded?null:lastMonth,openEnded,
      dueDay:Number(document.getElementById('incomeDueDay')?.value)||1
    };
  }

  function candidateAmount(plan,ym){
    if(plan.mode==='unica')return ym===plan.firstMonth?plan.amount:0;
    if(ym<plan.firstMonth)return 0;
    if(!plan.openEnded&&plan.lastMonth&&ym>plan.lastMonth)return 0;
    return plan.amount;
  }

  function pendingAmount(type,ym,excludePlanId=null,scenarioKey=null){
    const normalized=String(type).toLowerCase();
    let total=(state.transactions||[]).filter(t=>{
      if(excludePlanId&&t.incomeManaged===true&&t.incomePlanId===excludePlanId)return false;
      if(scenarioKey&&window.financeSimulationScenario?.isExcluded(scenarioKey,t.id))return false;
      return String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym;
    }).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function existingPlanImpactForSelected(planId,ym){
    if(!planId)return 0;
    return (state.transactions||[]).filter(t=>t.incomeManaged===true&&t.incomePlanId===planId&&monthOf(t.date)===ym&&String(t.status||'').toLowerCase()!=='pendente').reduce((s,t)=>s+(Number(t.amount)||0),0);
  }

  function projectedSelectedClosing(excludePlanId=null,scenarioKey=null){
    const ym=state.settings.selectedMonth;
    const actual=typeof actualForMonth==='function'?Number(actualForMonth(ym).closing)||0:0;
    const oldImpact=excludePlanId?existingPlanImpactForSelected(excludePlanId,ym):0;
    const scenario=window.financeSimulationScenario;
    const skip=excludePlanId?(tx=>tx.incomeManaged===true&&tx.incomePlanId===excludePlanId):null;
    const adjustment=scenarioKey&&scenario?scenario.selectedAdjustment(scenarioKey,ym,skip):0;
    return round(actual-oldImpact+pendingAmount('Receita',ym,excludePlanId,scenarioKey)-pendingAmount('Despesa',ym,null,scenarioKey)+adjustment);
  }

  function monthFlows(ym,excludePlanId=null,scenarioKey=null){
    let income=0,otherExpense=0,benefits=0;
    for(const tx of state.transactions||[]){
      if(excludePlanId&&tx.incomeManaged===true&&tx.incomePlanId===excludePlanId)continue;
      if(scenarioKey&&window.financeSimulationScenario?.isExcluded(scenarioKey,tx.id))continue;
      if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
      if(typeof isProjectedTxInMonth!=='function'&&monthOf(tx.date)!==ym)continue;
      if(tx.type==='Receita')income+=Number(tx.amount)||0;
      else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
      else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0;
    }
    const adj=scenarioKey&&window.financeSimulationScenario?window.financeSimulationScenario.amountsForMonth(scenarioKey,ym):{income:0,expense:0};
    income+=Number(adj.income)||0;otherExpense+=Number(adj.expense)||0;
    const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(typeof cardForecast==='function'?(Number(cardForecast(c,ym).total)||0):0),0);
    return{income:round(income),otherExpense:round(otherExpense),benefits:round(benefits),invoices:round(invoices)};
  }

  function buildProjection(plan,withCandidate,excludeExisting=false,scenarioKey=null){
    const selected=state.settings.selectedMonth;
    const replaceId=(withCandidate||excludeExisting)?plan.id:null;
    let opening=projectedSelectedClosing(replaceId,scenarioKey);
    if(withCandidate)opening=round(opening+candidateAmount(plan,selected));
    const rows=[];
    for(let i=1;i<=horizon();i++){
      const ym=addMonth(selected,i),flows=monthFlows(ym,replaceId,scenarioKey);
      const candidate=withCandidate?candidateAmount(plan,ym):0;
      const income=round(flows.income+candidate),expense=round(flows.otherExpense+flows.invoices),result=round(income-expense),closing=round(opening+result);
      rows.push({ym,opening,income,otherExpense:flows.otherExpense,invoices:flows.invoices,expense,result,closing,candidate});
      opening=closing;
    }
    return rows;
  }

  function buildModal(){
    const existing=document.getElementById('incomeSimulationModal');
    if(existing?.querySelector('#incomeSimulationComparisonChart'))return;
    if(existing)existing.remove();
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="incomeSimulationModal" style="z-index:1300"><div class="modal" style="max-width:1180px;width:min(1180px,96vw)"><div class="modal-head"><div><h3>Simulação da receita</h3><div class="muted" id="incomeSimulationSubtitle"></div></div><button type="button" class="btn ghost" id="incomeSimulationClose">✕</button></div><div class="modal-body"><div class="summary-strip" style="margin-bottom:14px"><div class="mini"><div class="t" id="incomeSimCurrentLabel">Saldo projetado atual</div><div class="v" id="incomeSimCurrent">—</div><div class="muted" id="incomeSimCurrentMonth" style="margin-top:4px"></div></div><div class="mini"><div class="t" id="incomeSimWithLabel">Saldo projetado com a receita</div><div class="v" id="incomeSimWith">—</div><div class="muted" id="incomeSimImpact" style="margin-top:4px"></div></div></div><div id="incomeSimulationScenario"></div><div class="card"><div class="section-head"><div><h3>Comparação da projeção</h3><div class="muted" id="incomeSimulationHorizonLabel">As duas linhas estão no mesmo gráfico e na mesma escala.</div></div><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px"><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#60a5fa;border-radius:999px;display:inline-block"></span><span id="incomeSimCurrentLegend">Projeção atual</span></span><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#22c55e;border-radius:999px;display:inline-block"></span>Com a receita</span></div></div><div class="chart-wrap small" style="min-height:340px"><canvas id="incomeSimulationComparisonChart"></canvas></div></div></div><div class="modal-foot"><button type="button" class="btn" id="incomeSimulationBack">Voltar</button><button type="button" class="btn primary" id="incomeSimulationConfirm">Cadastrar receita</button></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('incomeSimulationClose').onclick=closeSimulation;
    document.getElementById('incomeSimulationBack').onclick=closeSimulation;
    document.getElementById('incomeSimulationModal').addEventListener('click',e=>{if(e.target.id==='incomeSimulationModal')closeSimulation()});
    document.getElementById('incomeSimulationConfirm').onclick=()=>{closeSimulation();document.getElementById('incomeForm')?.requestSubmit()};
  }

  function drawComparisonChart(current,simulated,editing=false){
    const canvas=document.getElementById('incomeSimulationComparisonChart');if(!canvas)return;
    const currentData=current.map(r=>({label:monthLabel(r.ym),value:Number(r.closing)||0}));
    const simulatedData=simulated.map(r=>({label:monthLabel(r.ym),value:Number(r.closing)||0}));
    const values=[...currentData,...simulatedData].map(x=>x.value);
    let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1}
    const pad=(max-min)*.1;max+=pad;min-=pad;

    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,cssW=Math.max(360,rect.width||980),cssH=Math.max(280,rect.height||340);
    canvas.width=cssW*dpr;canvas.height=cssH*dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const W=cssW,H=cssH,p={l:68,r:22,t:24,b:48};
    const count=Math.max(currentData.length,simulatedData.length);
    const x=i=>p.l+(W-p.l-p.r)*(count<=1?.5:i/(count-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));

    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const val=min+(max-min)*i/4,yy=y(val);
      ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();
      ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4);
    }
    if(min<0&&max>0){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}

    const drawSeries=(data,color)=>{
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
      data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});
      ctx.stroke();
      data.forEach((d,i)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(i),y(d.value),4,0,Math.PI*2);ctx.fill()});
    };

    drawSeries(currentData,'#60a5fa');
    drawSeries(simulatedData,'#22c55e');

    currentData.forEach((d,i)=>{
      if(currentData.length<=12||i%2===0){
        ctx.save();ctx.translate(x(i),H-14);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore();
      }
    });

    if(typeof window.bindFinancialChartTooltip==='function'){
      const points=[
        ...currentData.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:d.value,series:editing?'Sem esta receita':'Projeção atual'})),
        ...simulatedData.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:d.value,series:'Com a receita'}))
      ];
      setTimeout(()=>window.bindFinancialChartTooltip(canvas,points),120);
    }
  }
  window.drawIncomeSimulationComparison=drawComparisonChart;

  function openSimulation(resetScenario=true){
    const plan=planFromForm();if(!plan)return;
    buildModal();
    const scenario=window.financeSimulationScenario;
    if(resetScenario)scenario?.reset('income');
    scenario?.mount('income',document.getElementById('incomeSimulationScenario'),()=>openSimulation(false));
    const editing=!!plan.id;
    const current=buildProjection(plan,false,editing),simulated=buildProjection(plan,true,false,'income');
    const currentFinal=current.at(-1)?.closing??projectedSelectedClosing(editing?plan.id:null),simFinal=simulated.at(-1)?.closing??currentFinal,impact=round(simFinal-currentFinal),endMonth=simulated.at(-1)?.ym||state.settings.selectedMonth;
    document.getElementById('incomeSimulationSubtitle').textContent=`${plan.name} • ${money(plan.amount)}${plan.mode==='mensal'?' por mês':''}`;
    document.getElementById('incomeSimCurrent').textContent=money(currentFinal);
    document.getElementById('incomeSimWith').textContent=money(simFinal);
    const withLabel=document.getElementById('incomeSimWithLabel');if(withLabel)withLabel.textContent=scenario?.count('income')?'Saldo projetado no cenário ajustado':'Saldo projetado com a receita';
    document.getElementById('incomeSimCurrentMonth').textContent=`ao fim de ${monthLabel(endMonth)}`;
    const currentLabel=document.getElementById('incomeSimCurrentLabel');if(currentLabel)currentLabel.textContent=editing?'Saldo projetado sem esta receita':'Saldo projetado atual';
    const currentLegend=document.getElementById('incomeSimCurrentLegend');if(currentLegend)currentLegend.textContent=editing?'Sem esta receita':'Projeção atual';
    const impactEl=document.getElementById('incomeSimImpact');impactEl.textContent=`Impacto: ${impact>=0?'+':''}${money(impact)}`;impactEl.style.color=impact>=0?'#86efac':'#fca5a5';
    const label=document.getElementById('incomeSimulationHorizonLabel');if(label)label.textContent=scenario?.count('income')?`Projeção atual comparada ao cenário ajustado nos próximos ${horizon()} meses.`:(editing?`Projeção sem esta receita e projeção com a receita editada nos próximos ${horizon()} meses, na mesma escala.`:`Projeção atual e projeção com a receita nos próximos ${horizon()} meses, na mesma escala.`);
    document.getElementById('incomeSimulationModal').classList.add('open');
    requestAnimationFrame(()=>requestAnimationFrame(()=>drawComparisonChart(current,simulated,editing)));
  }
  function closeSimulation(){document.getElementById('incomeSimulationModal')?.classList.remove('open')}

  function install(){
    const form=document.getElementById('incomeForm'),foot=form?.querySelector('.modal-foot');
    if(!form||!foot)return false;
    let btn=document.getElementById('incomeSimulateBtn');
    const save=foot.querySelector('button[type="submit"]');if(!save)return false;
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='incomeSimulateBtn';btn.textContent='Simular';foot.insertBefore(btn,save)}
    btn.onclick=e=>{e?.stopImmediatePropagation();openSimulation(true)};
    buildModal();
    return true;
  }

  function init(){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();