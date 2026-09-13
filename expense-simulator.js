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
  function monthDiffLocal(a,b){
    const [ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);
    return (yb-ya)*12+(mb-ma);
  }
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function monthLabel(ym){return typeof fmtMonth==='function'?fmtMonth(ym):ym}
  function round(v){return typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100}
  function monthOf(date){return String(date||'').slice(0,7)}

  function planFromForm(){
    const form=document.getElementById('debtForm');
    if(!form||!form.reportValidity())return null;
    const openEnded=document.getElementById('debtOpenEnded')?.checked===true;
    const firstInstallment=Math.max(1,Number(document.getElementById('debtFirstInstallment')?.value)||1);
    const totalInstallments=openEnded?null:Math.max(1,Number(document.getElementById('debtTotalInstallments')?.value)||1);
    const firstMonth=document.getElementById('debtFirstMonth')?.value;
    const installmentAmount=Number(document.getElementById('debtInstallmentAmount')?.value)||0;
    if(!firstMonth)return null;
    if(installmentAmount<=0){alert('Informe um valor de parcela maior que zero.');return null}
    if(!openEnded&&firstInstallment>totalInstallments){alert('A parcela inicial não pode ser maior que o total de parcelas.');return null}
    return{
      id:document.getElementById('debtId')?.value||null,
      name:document.getElementById('debtName')?.value.trim()||'Despesa simulada',
      installmentAmount,firstInstallment,totalInstallments,firstMonth,openEnded
    };
  }

  function candidateAmount(plan,ym){
    if(ym<plan.firstMonth)return 0;
    const elapsed=monthDiffLocal(plan.firstMonth,ym);
    if(elapsed<0)return 0;
    const number=plan.firstInstallment+elapsed;
    if(!plan.openEnded&&number>plan.totalInstallments)return 0;
    return plan.installmentAmount;
  }

  function pendingAmount(type,ym,excludeDebtId=null){
    const normalized=String(type||'').toLowerCase();
    let total=(state.transactions||[]).filter(t=>{
      if(excludeDebtId&&t.debtManaged===true&&t.debtId===excludeDebtId)return false;
      return String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym;
    }).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function settledExistingExpense(debtId,ym){
    if(!debtId)return 0;
    return (state.transactions||[]).filter(t=>t.debtManaged===true&&t.debtId===debtId&&monthOf(t.date)===ym&&String(t.status||'').toLowerCase()!=='pendente').reduce((s,t)=>s+(Number(t.amount)||0),0);
  }

  function projectedSelectedClosing(excludeDebtId=null){
    const ym=state.settings.selectedMonth;
    const actual=typeof actualForMonth==='function'?(Number(actualForMonth(ym).closing)||0):0;
    const restored=excludeDebtId?settledExistingExpense(excludeDebtId,ym):0;
    return round(actual+restored+pendingAmount('Receita',ym)-pendingAmount('Despesa',ym,excludeDebtId));
  }

  function monthFlows(ym,excludeDebtId=null){
    let income=0,otherExpense=0;
    for(const tx of state.transactions||[]){
      if(excludeDebtId&&tx.debtManaged===true&&tx.debtId===excludeDebtId)continue;
      if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
      if(typeof isProjectedTxInMonth!=='function'&&monthOf(tx.date)!==ym)continue;
      if(tx.type==='Receita')income+=Number(tx.amount)||0;
      else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
    }
    const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(typeof cardForecast==='function'?(Number(cardForecast(c,ym).total)||0):0),0);
    return{income:round(income),otherExpense:round(otherExpense),invoices:round(invoices)};
  }

  function buildProjection(plan,withCandidate){
    const selected=state.settings.selectedMonth,replaceId=withCandidate?plan.id:null,count=horizon();
    let opening=projectedSelectedClosing(replaceId);
    if(withCandidate)opening=round(opening-candidateAmount(plan,selected));
    const rows=[];
    for(let i=1;i<=count;i++){
      const ym=addMonth(selected,i),flows=monthFlows(ym,replaceId),candidate=withCandidate?candidateAmount(plan,ym):0;
      const otherExpense=round(flows.otherExpense+candidate),expense=round(otherExpense+flows.invoices),result=round(flows.income-expense),closing=round(opening+result);
      rows.push({ym,opening:round(opening),income:flows.income,otherExpense,invoices:flows.invoices,expense,result,closing,candidate});
      opening=closing;
    }
    return rows;
  }

  function buildModal(){
    const existing=document.getElementById('expenseSimulationModal');
    if(existing?.querySelector('#expenseSimulationComparisonChart'))return;
    if(existing)existing.remove();
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="expenseSimulationModal" style="z-index:1300"><div class="modal" style="max-width:1180px;width:min(1180px,96vw)"><div class="modal-head"><div><h3>Simulação da despesa</h3><div class="muted" id="expenseSimulationSubtitle"></div></div><button type="button" class="btn ghost" id="expenseSimulationClose">✕</button></div><div class="modal-body"><div class="summary-strip" style="margin-bottom:14px"><div class="mini"><div class="t">Saldo projetado atual</div><div class="v" id="expenseSimCurrent">—</div><div class="muted" id="expenseSimCurrentMonth" style="margin-top:4px"></div></div><div class="mini"><div class="t">Saldo projetado com a despesa</div><div class="v" id="expenseSimWith">—</div><div class="muted" id="expenseSimImpact" style="margin-top:4px"></div></div></div><div class="card"><div class="section-head"><div><h3>Comparação da projeção</h3><div class="muted">As duas linhas estão no mesmo gráfico e na mesma escala.</div></div><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px"><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#60a5fa;border-radius:999px;display:inline-block"></span>Projeção atual</span><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#f59e0b;border-radius:999px;display:inline-block"></span>Com a despesa</span></div></div><div class="chart-wrap small" style="min-height:340px"><canvas id="expenseSimulationComparisonChart"></canvas></div></div></div><div class="modal-foot"><button type="button" class="btn" id="expenseSimulationBack">Voltar</button><button type="button" class="btn primary" id="expenseSimulationConfirm">Cadastrar despesa</button></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('expenseSimulationClose').onclick=closeSimulation;
    document.getElementById('expenseSimulationBack').onclick=closeSimulation;
    document.getElementById('expenseSimulationModal').addEventListener('click',e=>{if(e.target.id==='expenseSimulationModal')closeSimulation()});
    document.getElementById('expenseSimulationConfirm').onclick=()=>{closeSimulation();document.getElementById('debtForm')?.requestSubmit()};
  }

  function drawComparisonChart(current,simulated){
    const canvas=document.getElementById('expenseSimulationComparisonChart');if(!canvas)return;
    const a=current.map(r=>({label:monthLabel(r.ym),value:Number(r.closing)||0}));
    const b=simulated.map(r=>({label:monthLabel(r.ym),value:Number(r.closing)||0}));
    const values=[...a,...b].map(x=>x.value);let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1}const pad=(max-min)*.1;max+=pad;min-=pad;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.max(360,rect.width||980),H=Math.max(280,rect.height||340),p={l:68,r:22,t:24,b:48};
    canvas.width=W*dpr;canvas.height=H*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const count=Math.max(a.length,b.length),x=i=>p.l+(W-p.l-p.r)*(count<=1?.5:i/(count-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    ctx.clearRect(0,0,W,H);ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const val=min+(max-min)*i/4,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4)}
    if(min<0&&max>0){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    const series=(data,color)=>{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();data.forEach((d,i)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(i),y(d.value),4,0,Math.PI*2);ctx.fill()})};
    series(a,'#60a5fa');series(b,'#f59e0b');
    a.forEach((d,i)=>{if(a.length<=12||i%2===0){ctx.save();ctx.translate(x(i),H-14);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore()}});
  }

  function openSimulation(){
    const plan=planFromForm();if(!plan)return;
    buildModal();
    const current=buildProjection(plan,false),simulated=buildProjection(plan,true);
    const currentFinal=current.at(-1)?.closing??projectedSelectedClosing(),simulatedFinal=simulated.at(-1)?.closing??currentFinal,impact=round(simulatedFinal-currentFinal),endMonth=simulated.at(-1)?.ym||state.settings.selectedMonth;
    const range=plan.openEnded?'sem data final':`${plan.firstInstallment}/${plan.totalInstallments}`;
    document.getElementById('expenseSimulationSubtitle').textContent=`${plan.name} • ${money(plan.installmentAmount)} por mês • ${range}`;
    document.getElementById('expenseSimCurrent').textContent=money(currentFinal);
    document.getElementById('expenseSimWith').textContent=money(simulatedFinal);
    document.getElementById('expenseSimCurrentMonth').textContent=`ao fim de ${monthLabel(endMonth)}`;
    const impactEl=document.getElementById('expenseSimImpact');impactEl.textContent=`Impacto: ${impact>=0?'+':''}${money(impact)}`;impactEl.style.color=impact<0?'#fca5a5':'#86efac';
    document.getElementById('expenseSimulationModal').classList.add('open');
    requestAnimationFrame(()=>requestAnimationFrame(()=>drawComparisonChart(current,simulated)));
  }
  function closeSimulation(){document.getElementById('expenseSimulationModal')?.classList.remove('open')}

  function install(){
    const form=document.getElementById('debtForm'),foot=form?.querySelector('.modal-foot');
    if(!form||!foot)return false;
    let btn=document.getElementById('expenseSimulateBtn');
    const save=foot.querySelector('button[type="submit"]');if(!save)return false;
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='expenseSimulateBtn';btn.textContent='Simular';foot.insertBefore(btn,save)}
    btn.onclick=openSimulation;buildModal();return true;
  }

  function init(){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();