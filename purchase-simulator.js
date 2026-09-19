(function(){
  if(window.__purchaseSimulatorLoaded)return;
  window.__purchaseSimulatorLoaded=true;

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

  function purchaseFromForm(){
    const form=document.getElementById('purchaseForm');
    if(!form||!form.reportValidity())return null;
    const mode=document.getElementById('purchaseMode')?.value||'parcelada';
    const firstInvoiceYm=document.getElementById('purchaseFirstInvoice')?.value;
    const cardId=document.getElementById('purchaseCard')?.value;
    if(!firstInvoiceYm||!cardId)return null;

    const openEnded=mode!=='recorrente'&&document.getElementById('purchaseOpenEnded')?.checked===true;
    const totalAmount=Number(document.getElementById('purchaseAmount')?.value)||0;
    const installmentValue=Number(document.getElementById('purchaseInstallmentValue')?.value)||0;
    const installments=mode==='recorrente'||openEnded?null:Math.max(1,Number(document.getElementById('purchaseInstallments')?.value)||1);

    if(openEnded&&installmentValue<=0){alert('Informe o valor da parcela.');return null}
    if(!openEnded&&totalAmount<=0){alert('Informe o valor da compra.');return null}

    return {
      id:document.getElementById('purchaseId')?.value||'__simulated_purchase__',
      cardId,
      date:document.getElementById('purchaseDate')?.value||`${firstInvoiceYm}-01`,
      description:document.getElementById('purchaseDescription')?.value.trim()||'Compra simulada',
      category:document.getElementById('purchaseCategory')?.value||'Compras',
      mode:openEnded?'parcelada':mode,
      totalAmount:openEnded?null:totalAmount,
      installments,
      installmentValue:openEnded?installmentValue:undefined,
      openEnded,
      firstInvoiceYm,
      recurringEnd:mode==='recorrente'?(document.getElementById('purchaseRecurringEnd')?.value||null):null,
      notes:document.getElementById('purchaseNotes')?.value.trim()||''
    };
  }

  function pendingAmount(type,ym,scenarioKey=null){
    const normalized=String(type||'').toLowerCase();
    let total=(state.transactions||[]).filter(t=>!scenarioKey||!window.financeSimulationScenario?.isExcluded(scenarioKey,t.id)).filter(t=>String(t.type||'').toLowerCase()===normalized&&String(t.status||'').toLowerCase()==='pendente'&&monthOf(t.date)===ym).reduce((s,t)=>s+(Number(t.amount)||0),0);
    if(normalized==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards.filter(c=>c.active!==false).filter(c=>typeof getInvoice!=='function'||getInvoice(c.id,ym)?.status!=='Paga').reduce((s,c)=>s+(Number(cardForecast(c,ym).total)||0),0);
    }
    return round(total);
  }

  function projectedSelectedClosing(scenarioKey=null){
    const ym=state.settings.selectedMonth;
    const actual=typeof actualForMonth==='function'?(Number(actualForMonth(ym).closing)||0):0;
    const scenario=window.financeSimulationScenario;
    const adjustment=scenarioKey&&scenario?scenario.selectedAdjustment(scenarioKey,ym):0;
    return round(actual+pendingAmount('Receita',ym,scenarioKey)-pendingAmount('Despesa',ym,scenarioKey)+adjustment);
  }

  function projectionRows(scenarioKey=null){
    const selected=state.settings.selectedMonth;
    let opening=projectedSelectedClosing(scenarioKey);
    const rows=[];
    for(let i=1;i<=horizon();i++){
      const ym=addMonth(selected,i);
      let income=0,otherExpense=0;
      for(const tx of state.transactions||[]){
        if(scenarioKey&&window.financeSimulationScenario?.isExcluded(scenarioKey,tx.id))continue;
        if(typeof isProjectedTxInMonth==='function'&&!isProjectedTxInMonth(tx,ym))continue;
        if(typeof isProjectedTxInMonth!=='function'&&monthOf(tx.date)!==ym)continue;
        if(tx.type==='Receita')income+=Number(tx.amount)||0;
        else if(tx.type==='Despesa')otherExpense+=Number(tx.amount)||0;
      }
      const adj=scenarioKey&&window.financeSimulationScenario?window.financeSimulationScenario.amountsForMonth(scenarioKey,ym):{income:0,expense:0};
      income+=Number(adj.income)||0;otherExpense+=Number(adj.expense)||0;
      const invoices=(state.cards||[]).filter(c=>c.active!==false).reduce((s,c)=>s+(typeof cardForecast==='function'?(Number(cardForecast(c,ym).total)||0):0),0);
      const expense=round(otherExpense+invoices),result=round(income-expense),closing=round(opening+result);
      rows.push({ym,opening:round(opening),income:round(income),otherExpense:round(otherExpense),invoices:round(invoices),expense,result,closing});
      opening=closing;
    }
    return rows;
  }

  function projectionRowsWithoutPurchase(purchaseId,scenarioKey=null){
    if(!purchaseId)return projectionRows(scenarioKey);
    const original=state.purchases;
    try{
      state.purchases=original.filter(p=>p.id!==purchaseId);
      return projectionRows(scenarioKey);
    }finally{
      state.purchases=original;
    }
  }

  function simulatedRows(candidate,scenarioKey=null){
    const original=state.purchases;
    try{
      const existingId=document.getElementById('purchaseId')?.value||null;
      const base=existingId?original.filter(p=>p.id!==existingId):original.slice();
      state.purchases=[...base,candidate];
      return projectionRows(scenarioKey);
    }finally{
      state.purchases=original;
    }
  }

  function buildModal(){
    const all=[...document.querySelectorAll('#purchaseSimulationModal')];
    const existing=all[0]||null;
    all.slice(1).forEach(el=>el.remove());
    if(existing?.querySelector('#purchaseSimulationComparisonChart'))return;
    if(existing)existing.remove();
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="modal-backdrop" id="purchaseSimulationModal" style="z-index:1300"><div class="modal" style="max-width:1180px;width:min(1180px,96vw)"><div class="modal-head"><div><h3>Simulação da compra</h3><div class="muted" id="purchaseSimulationSubtitle"></div></div><button type="button" class="btn ghost" id="purchaseSimulationClose">✕</button></div><div class="modal-body"><div class="summary-strip" style="margin-bottom:14px"><div class="mini"><div class="t" id="purchaseSimCurrentLabel">Saldo projetado atual</div><div class="v" id="purchaseSimCurrent">—</div><div class="muted" id="purchaseSimCurrentMonth" style="margin-top:4px"></div></div><div class="mini"><div class="t" id="purchaseSimWithLabel">Saldo projetado com a compra</div><div class="v" id="purchaseSimWith">—</div><div class="muted" id="purchaseSimImpact" style="margin-top:4px"></div></div></div><div id="purchaseSimulationScenario"></div><div class="card"><div class="section-head"><div><h3>Comparação da projeção</h3><div class="muted">As duas linhas estão no mesmo gráfico e na mesma escala.</div></div><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px"><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#60a5fa;border-radius:999px;display:inline-block"></span><span id="purchaseSimCurrentLegend">Projeção atual</span></span><span style="display:flex;align-items:center;gap:6px"><span style="width:20px;height:3px;background:#f59e0b;border-radius:999px;display:inline-block"></span>Com a compra</span></div></div><div class="chart-wrap small" style="min-height:340px"><canvas id="purchaseSimulationComparisonChart"></canvas></div></div></div><div class="modal-foot"><button type="button" class="btn" id="purchaseSimulationBack">Voltar</button><button type="button" class="btn primary" id="purchaseSimulationConfirm">Cadastrar compra</button></div></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('purchaseSimulationClose').onclick=closeSimulation;
    document.getElementById('purchaseSimulationBack').onclick=closeSimulation;
    document.getElementById('purchaseSimulationModal').addEventListener('click',e=>{if(e.target.id==='purchaseSimulationModal')closeSimulation()});
    document.getElementById('purchaseSimulationConfirm').onclick=()=>{closeSimulation();document.getElementById('purchaseForm')?.requestSubmit()};
  }

  function bindVertexTooltip(canvas,points){
    const host=canvas.parentElement;if(!host)return;
    host.style.position='relative';
    let tip=host.querySelector('.purchase-chart-tooltip');
    if(!tip){
      tip=document.createElement('div');
      tip.className='purchase-chart-tooltip';
      tip.style.cssText='display:none;position:absolute;z-index:20;pointer-events:none;min-width:120px;padding:7px 9px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.28);white-space:nowrap;transform:translate(-50%,-100%)';
      host.appendChild(tip);
    }
    canvas.onmousemove=e=>{
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left,my=e.clientY-rect.top;
      let nearest=null,best=Infinity;
      for(const pt of points){const dx=mx-pt.x,dy=my-pt.y,dist=Math.hypot(dx,dy);if(dist<best){best=dist;nearest=pt}}
      if(!nearest||best>14){tip.style.display='none';canvas.style.cursor='default';return}
      tip.innerHTML=`<strong>${nearest.series}</strong><br><span style="color:#94a3b8">${nearest.label}</span><br>${money(nearest.value)}`;
      tip.style.left=`${canvas.offsetLeft+nearest.x}px`;
      tip.style.top=`${canvas.offsetTop+nearest.y-8}px`;
      tip.style.display='block';
      canvas.style.cursor='pointer';
    };
    canvas.onmouseleave=()=>{tip.style.display='none';canvas.style.cursor='default'};
  }

  function drawComparisonChart(current,simulated){
    const canvas=document.getElementById('purchaseSimulationComparisonChart');if(!canvas)return;
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
      data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);ctx.fillStyle=color;ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill()});
    };

    drawSeries(currentData,'#60a5fa');
    drawSeries(simulatedData,'#f59e0b');

    currentData.forEach((d,i)=>{
      if(currentData.length<=12||i%2===0){
        const xx=x(i);ctx.save();ctx.translate(xx,H-14);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore();
      }
    });

    const currentName=document.getElementById('purchaseSimCurrentLegend')?.textContent||'Projeção atual';
    const points=[
      ...currentData.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:d.value,series:currentName})),
      ...simulatedData.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:d.value,series:'Com a compra'}))
    ];
    bindVertexTooltip(canvas,points);
  }

  function openSimulation(resetScenario=true){
    const candidate=purchaseFromForm();if(!candidate)return;
    buildModal();
    const scenario=window.financeSimulationScenario;
    if(resetScenario)scenario?.reset('purchase');
    scenario?.mount('purchase',document.getElementById('purchaseSimulationScenario'),()=>openSimulation(false));
    const existingId=document.getElementById('purchaseId')?.value||null;
    const current=existingId?projectionRowsWithoutPurchase(existingId):projectionRows();
    const simulated=simulatedRows(candidate,'purchase');
    const currentFinal=current.at(-1)?.closing??projectedSelectedClosing();
    const simulatedFinal=simulated.at(-1)?.closing??currentFinal;
    const impact=round(simulatedFinal-currentFinal);
    const endMonth=simulated.at(-1)?.ym||state.settings.selectedMonth;
    const card=typeof getCard==='function'?getCard(candidate.cardId):state.cards?.find(c=>c.id===candidate.cardId);
    const amountLabel=candidate.openEnded?`${money(candidate.installmentValue)} por mês`:candidate.mode==='recorrente'?`${money(candidate.totalAmount)} por mês`:candidate.installments>1?`${money(candidate.totalAmount)} em ${candidate.installments}x`:money(candidate.totalAmount);
    document.getElementById('purchaseSimulationSubtitle').textContent=`${candidate.description} • ${card?.name||'Cartão'} • ${amountLabel}`;
    document.getElementById('purchaseSimCurrent').textContent=money(currentFinal);
    document.getElementById('purchaseSimWith').textContent=money(simulatedFinal);
    const withLabel=document.getElementById('purchaseSimWithLabel');if(withLabel)withLabel.textContent=scenario?.count('purchase')?'Saldo projetado no cenário ajustado':'Saldo projetado com a compra';
    document.getElementById('purchaseSimCurrentMonth').textContent=`ao fim de ${monthLabel(endMonth)}`;
    const currentLabel=document.getElementById('purchaseSimCurrentLabel');if(currentLabel)currentLabel.textContent=existingId?'Saldo projetado sem esta compra':'Saldo projetado atual';
    const currentLegend=document.getElementById('purchaseSimCurrentLegend');if(currentLegend)currentLegend.textContent=existingId?'Sem esta compra':'Projeção atual';
    const impactEl=document.getElementById('purchaseSimImpact');impactEl.textContent=`Impacto: ${impact>=0?'+':''}${money(impact)}`;impactEl.style.color=impact<0?'#fca5a5':'#86efac';
    document.getElementById('purchaseSimulationModal').classList.add('open');
    requestAnimationFrame(()=>requestAnimationFrame(()=>drawComparisonChart(current,simulated)));
  }
  function closeSimulation(){document.getElementById('purchaseSimulationModal')?.classList.remove('open')}

  function install(){
    const form=document.getElementById('purchaseForm'),foot=form?.querySelector('.modal-foot');
    if(!form||!foot)return false;
    let btn=document.getElementById('purchaseSimulateBtn');
    const save=foot.querySelector('button[type="submit"]');if(!save)return false;
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='purchaseSimulateBtn';btn.textContent='Simular';foot.insertBefore(btn,save)}
    btn.onclick=e=>{e?.stopImmediatePropagation();openSimulation(true)};
    buildModal();
    return true;
  }

  function init(){let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();