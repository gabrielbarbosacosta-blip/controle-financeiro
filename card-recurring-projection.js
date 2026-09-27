(function(){
  if(window.__cardRecurringProjectionFixLoaded)return;
  window.__cardRecurringProjectionFixLoaded=true;

  function normalizeMode(value){
    return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function isRecurring(p){return normalizeMode(p?.mode)==='recorrente'}
  function isExcluded(p,ym){return Array.isArray(p?.excludedInvoiceMonths)&&p.excludedInvoiceMonths.includes(ym)}
  function recurringAmount(p){
    const total=Number(p?.totalAmount);
    if(Number.isFinite(total)&&total>0)return typeof round2==='function'?round2(total):Math.round(total*100)/100;
    const installment=Number(p?.installmentValue);
    return Number.isFinite(installment)&&installment>0?(typeof round2==='function'?round2(installment):Math.round(installment*100)/100):0;
  }

  function installAllocationGuard(){
    const base=window.purchaseAllocation||(typeof purchaseAllocation==='function'?purchaseAllocation:null);
    if(typeof base!=='function')return false;
    if(base.__recurringProjectionGuard)return true;

    const wrapped=function(p,ym){
      if(isExcluded(p,ym))return null;
      if(isRecurring(p)){
        if(!p?.firstInvoiceYm||ym<p.firstInvoiceYm)return null;
        if(p.recurringEnd&&ym>p.recurringEnd)return null;
        return{amount:recurringAmount(p),number:null,total:null};
      }
      return base(p,ym);
    };
    wrapped.__recurringProjectionGuard=true;
    wrapped.__base=base;
    window.purchaseAllocation=wrapped;
    try{purchaseAllocation=wrapped}catch(_e){}
    return true;
  }

  function breakdown(cardId,ym){
    let recurring=0,other=0;
    for(const p of state?.purchases||[]){
      if(p.cardId!==cardId)continue;
      const alloc=typeof purchaseAllocation==='function'?purchaseAllocation(p,ym):null;
      if(!alloc)continue;
      if(isRecurring(p))recurring+=Number(alloc.amount)||0;
      else other+=Number(alloc.amount)||0;
    }
    const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
    const adjustment=Number(inv?.adjustment)||0;
    const round=v=>typeof round2==='function'?round2(v):Math.round((Number(v)||0)*100)/100;
    return{recurring:round(recurring),other:round(other),adjustment:round(adjustment),known:round(recurring+other+adjustment)};
  }

  function enhanceProjectionBreakdown(){
    const card=typeof getCard==='function'?getCard(selectedCardId):null;
    const chart=document.getElementById('cardProjectionChart');
    const panel=chart?.closest('.card');
    const tbody=panel?.querySelector('table tbody');
    if(!card||!tbody)return;

    [...tbody.querySelectorAll('tr')].forEach((row,index)=>{
      const cells=row.querySelectorAll('td');
      if(cells.length<4)return;
      const ym=typeof ymAdd==='function'?ymAdd(state.settings.selectedMonth,index):null;
      if(!ym)return;
      const parts=breakdown(card.id,ym);
      let detail=cells[1].querySelector('.recurring-projection-breakdown');
      if(!detail){
        detail=document.createElement('div');
        detail.className='muted recurring-projection-breakdown';
        detail.style.cssText='font-size:9px;margin-top:3px;white-space:nowrap';
        cells[1].appendChild(detail);
      }
      const label=typeof fmtMoney==='function'?fmtMoney(parts.recurring):String(parts.recurring);
      detail.textContent='Recorrentes: '+label;
      detail.title='Valor mensal das compras recorrentes incluído nos compromissos conhecidos desta fatura.';
    });

    let note=panel.querySelector('#cardRecurringProjectionNote');
    const current=breakdown(card.id,state.settings.selectedMonth);
    if(!note){
      note=document.createElement('div');
      note.id='cardRecurringProjectionNote';
      note.className='notice';
      note.style.marginTop='12px';
      const table=panel.querySelector('.table-scroll');
      table?.insertAdjacentElement('beforebegin',note);
    }
    if(note){
      const amount=typeof fmtMoney==='function'?fmtMoney(current.recurring):String(current.recurring);
      note.innerHTML='<strong>Compras recorrentes incluídas na projeção:</strong> '+amount+' por mês na competência selecionada, respeitando início e término de cada recorrência.';
    }
  }

  function wrapRender(){
    const base=window.renderCardDetail||(typeof renderCardDetail==='function'?renderCardDetail:null);
    if(typeof base!=='function')return false;
    if(base.__recurringProjectionBreakdown)return true;
    const wrapped=function(){
      const result=base.apply(this,arguments);
      try{enhanceProjectionBreakdown()}catch(error){console.error('card recurring projection breakdown',error)}
      return result;
    };
    wrapped.__recurringProjectionBreakdown=true;
    wrapped.__base=base;
    window.renderCardDetail=wrapped;
    try{renderCardDetail=wrapped}catch(_e){}
    return true;
  }

  function refresh(){
    const allocationReady=installAllocationGuard();
    const renderReady=wrapRender();
    if(allocationReady&&renderReady){
      try{
        if(typeof renderCards==='function'&&document.getElementById('page-cards')?.classList.contains('active'))renderCards();
        if(typeof renderProjection==='function'&&document.getElementById('page-projection')?.classList.contains('active'))renderProjection();
        if(document.body?.classList.contains('caderno-splash-done')&&typeof renderDashboard==='function'&&document.getElementById('page-dashboard')?.classList.contains('active'))renderDashboard();
      }catch(error){console.error('recurring projection refresh',error)}
      return true;
    }
    return false;
  }

  if(!refresh()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(refresh()||tries>80)clearInterval(timer)},100);
  }
})();