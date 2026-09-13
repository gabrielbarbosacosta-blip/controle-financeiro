(function(){
  const HORIZON=12;

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

  function pendingAmount(type,ym,excludePlanId=null){
    const normalized=String(type).toLowerCase();
    let total=(state.transactions||[]).filter(t=>{
      if(excludePlanId&&t.incomeManaged===true&&t.incomePlanId===excludePlanId)return false;
      return String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym;
    }).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function existingPlanImpactForSelected(planId,ym){
    if(!planId)return 0;
    return (state.transactions||[]).filter(t=>t.incomeManaged===true&&t.incomePlanId===planId&&monthOf(t.date)===ym).reduce((s,t)=>s+(Number(t.amount)||0),0);
  }

  function projectedSelectedClosing(excludePlanId=null){
    const ym=state.settings.selectedMonth;
    const actual=typeof actualForMonth==='function'?Number(actualForMonth(ym).closing)||0:0;
    const oldImpact=excludePlanId?existingPlanImpactForSelected(excludePlanId,ym):0;
    return round(actual-oldImpact+pendingAmount('Receita',ym,excludePlanId)-pendingAmount('Despesa',ym));
  }

  function monthFlows(ym,excludePlanId=null){
    let income=0,otherExpense=0,benefits=0;
    for(const tx of state.transactions||[]){
      if(excludePlanId&&tx.incomeManaged===true&&tx.incomePlanId===excludePlanId)continue;
      if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
      if(typeof isProjectedTxInMonth!=='function'&&monthOf(tx.date)!==ym)continue;
      if(tx.type==='Receita')income+=Number(tx.amount)||0;
      else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
      else if(tx.type==='Benefício')benefits+=Number(tx.amount)||0;
    }
    const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(typeof cardForecast==='function'?(Number(cardForecast(c,ym).total)||0):0),0);
    return{income:round(income),otherExpense:round(otherExpense),benefits:round(benefits),invoices:round(invoices)};
  }

  function buildProjection(plan,withCandidate){
    const selected=state.settings.selectedMonth;
    const replaceId=withCandidate?plan.id:null;
    let opening=projectedSelectedClosing(replaceId);
    if(withCandidate)opening=round(opening+candidateAmount(plan,selected));
    const rows=[];
    for(let i=1;i<=HORIZON;i++){
      const ym=addMonth(selected,i),flows=monthFlows(ym,replaceId);
      const candidate=withCandidate?candidateAmount(plan,ym):0;
      const income=round(flows.income+candidate),expense=round(flows.otherExpense+flows.invoices),result=round(income-expense),closing=round(opening+result);
      rows.push({ym,opening,income,otherExpense:flows.otherExpense,invoices:flows.invoices,expense,result,closing,candidate});
      opening=closing;
    }
    return rows;
  }

  function buildModal(){
    if(document.getElementById('incomeSimulationModal'))return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="incomeSimulationModal" style="z-index:1200"><div class="modal" style="max-width:1120px;width:min(1120px,96vw)"><div class="modal-head"><div><h3>Simulação da receita</h3><div class="muted" id="incomeSimulationSubtitle"></div></div><button type="button" class="btn ghost" id="incomeSimulationClose">✕</button></div><div class="modal-body"><div class="summary-strip" style="margin-bottom:14px"><div class="mini"><div class="t">Saldo projetado atual</div><div class="v" id="incomeSimCurrent">—</div><div class="muted" id="incomeSimCurrentMonth" style="margin-top:4px"></div></div><div class="mini"><div class="t">Saldo projetado com a receita</div><div class="v" id="incomeSimWith">—</div><div class="muted" id="incomeSimImpact" style="margin-top:4px"></div></div></div><div class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>Projeção geral com a receita</h3><div class="muted">Mesma lógica da Projeção geral, considerando a receita preenchida sem salvá-la.</div></div></div><div class="chart-wrap small"><canvas id="incomeSimulationChart"></canvas></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mês</th><th class="num">Saldo inicial</th><th class="num">Receitas</th><th class="num">Outras despesas</th><th class="num">Cartões</th><th class="num">Resultado</th><th class="num">Saldo final</th></tr></thead><tbody id="incomeSimulationBody"></tbody></table></div></div></div><div class="modal-foot"><button type="button" class="btn" id="incomeSimulationBack">Voltar</button><button type="button" class="btn primary" id="incomeSimulationConfirm">Cadastrar receita</button></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('incomeSimulationClose').onclick=closeSimulation;
    document.getElementById('incomeSimulationBack').onclick=closeSimulation;
    document.getElementById('incomeSimulationModal').addEventListener('click',e=>{if(e.target.id==='incomeSimulationModal')closeSimulation()});
    document.getElementById('incomeSimulationConfirm').onclick=()=>{closeSimulation();document.getElementById('incomeForm')?.requestSubmit()};
  }

  function openSimulation(){
    const plan=planFromForm();if(!plan)return;
    buildModal();
    const current=buildProjection(plan,false),simulated=buildProjection(plan,true);
    const currentFinal=current.at(-1)?.closing??projectedSelectedClosing(),simFinal=simulated.at(-1)?.closing??currentFinal,impact=round(simFinal-currentFinal),endMonth=simulated.at(-1)?.ym||state.settings.selectedMonth;
    document.getElementById('incomeSimulationSubtitle').textContent=`${plan.name} • ${money(plan.amount)}${plan.mode==='mensal'?' por mês':''}`;
    document.getElementById('incomeSimCurrent').textContent=money(currentFinal);
    document.getElementById('incomeSimWith').textContent=money(simFinal);
    document.getElementById('incomeSimCurrentMonth').textContent=`ao fim de ${monthLabel(endMonth)}`;
    const impactEl=document.getElementById('incomeSimImpact');impactEl.textContent=`Impacto: ${impact>=0?'+':''}${money(impact)}`;impactEl.style.color=impact>=0?'#86efac':'#fca5a5';
    document.getElementById('incomeSimulationBody').innerHTML=simulated.map(r=>`<tr><td>${monthLabel(r.ym)}${r.candidate?'<div class="muted">inclui receita simulada</div>':''}</td><td class="num">${money(r.opening)}</td><td class="num positive">${money(r.income)}</td><td class="num">${money(r.otherExpense)}</td><td class="num">${money(r.invoices)}</td><td class="num ${r.result<0?'negative':'positive'}">${money(r.result)}</td><td class="num ${r.closing<0?'negative':''}"><strong>${money(r.closing)}</strong></td></tr>`).join('');
    document.getElementById('incomeSimulationModal').classList.add('open');
    if(typeof drawLineChart==='function')requestAnimationFrame(()=>drawLineChart('incomeSimulationChart',simulated.map(r=>({label:monthLabel(r.ym),value:r.closing}))));
  }
  function closeSimulation(){document.getElementById('incomeSimulationModal')?.classList.remove('open')}

  function install(){
    const form=document.getElementById('incomeForm'),foot=form?.querySelector('.modal-foot');
    if(!form||!foot)return false;
    if(document.getElementById('incomeSimulateBtn'))return true;
    const save=foot.querySelector('button[type="submit"]');
    if(!save)return false;
    const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='incomeSimulateBtn';btn.textContent='Simular';btn.onclick=openSimulation;foot.insertBefore(btn,save);
    buildModal();return true;
  }

  function init(){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();