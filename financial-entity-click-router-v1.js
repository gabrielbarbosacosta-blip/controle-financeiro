(function(){
  if(window.__prumoFinancialEntityClickRouterV1)return;
  window.__prumoFinancialEntityClickRouterV1=true;

  const PANEL_ID='page-financial-entity';
  const BACKDROP_ID='financialEntityBackdrop';

  function parseInline(button,fn){
    const code=button?.getAttribute('onclick')||'';
    const match=code.match(new RegExp(`${fn}\\(['\"]([^'\"]+)['\"]\\)`));
    return match?.[1]||null;
  }

  function activeSource(){
    const page=[...document.querySelectorAll('.page.active')].find(p=>p.id!==PANEL_ID);
    if(page)return page.id.replace(/^page-/,'');
    return document.querySelector('.nav button.active[data-page]')?.dataset.page||'dashboard';
  }

  function isSharedReceivable(t){
    if(!t||String(t.type||'').toLowerCase()!=='receita')return false;
    const id=String(t.id||''),desc=String(t.description||''),notes=String(t.notes||'');
    return id.startsWith('shared-')&&(desc.toLowerCase().startsWith('reembolso')||notes.includes('Valor a receber referente à despesa compartilhada'));
  }

  function routeFor(trigger){
    if(trigger.matches('[data-entity-link-open]')){
      const id=trigger.dataset.entityLinkOpen;
      return id?{kind:'transaction',id,returnPage:activeSource()}:null;
    }

    const debtRow=trigger.closest('#debtTableBody tr');
    if(debtRow){
      const id=parseInline(debtRow.querySelector('button[onclick*="editDebtPlan("]'),'editDebtPlan');
      if(id)return{kind:'expense',id,returnPage:'debts'};
    }

    const incomeRow=trigger.closest('#incomeTableBody tr');
    if(incomeRow){
      const id=parseInline(incomeRow.querySelector('button[onclick*="editIncomePlan("]'),'editIncomePlan');
      if(id)return{kind:'income',id,returnPage:'incomes'};
    }

    const historyRow=trigger.closest('#historyBody tr');
    if(historyRow){
      const id=parseInline(historyRow.querySelector('button[onclick*="editTx("]'),'editTx');
      if(id)return{kind:'transaction',id,returnPage:'history'};
    }

    const sharedRow=trigger.closest('#sharedIncomeBody tr');
    if(sharedRow){
      const name=sharedRow.querySelector('td strong')?.textContent?.trim();
      const month=String(window.state?.settings?.selectedMonth||'');
      const tx=(window.state?.transactions||[]).find(t=>isSharedReceivable(t)&&String(t.description||'').trim()===name&&(!month||String(t.date||'').slice(0,7)===month));
      if(tx)return{kind:'transaction',id:String(tx.id),returnPage:'incomes'};
    }
    return null;
  }

  function ensureFloating(route){
    const panel=document.getElementById(PANEL_ID);
    if(!panel)return;
    panel.classList.add('active');
    const source=document.getElementById(`page-${route.returnPage}`);
    if(source)source.classList.add('active');
    document.body.classList.add('entity-floating-open');

    let backdrop=document.getElementById(BACKDROP_ID);
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id=BACKDROP_ID;
      backdrop.setAttribute('aria-hidden','false');
      backdrop.addEventListener('click',()=>{
        if(typeof window.closeFloatingFinancialEntityPanel==='function')window.closeFloatingFinancialEntityPanel();
        else if(typeof window.closeFinancialEntityPanel==='function')window.closeFinancialEntityPanel();
      });
      document.body.appendChild(backdrop);
    }else backdrop.setAttribute('aria-hidden','false');
  }

  document.addEventListener('click',e=>{
    const trigger=e.target?.closest?.('.entity-panel-btn,[data-entity-link-open]');
    if(!trigger)return;
    const route=routeFor(trigger);
    if(!route||typeof window.openFinancialEntityPanel!=='function')return;

    e.preventDefault();
    e.stopImmediatePropagation();
    try{
      window.openFinancialEntityPanel(route.kind,route.id,route.returnPage);
      requestAnimationFrame(()=>requestAnimationFrame(()=>ensureFloating(route)));
    }catch(err){
      console.error('Falha ao abrir painel financeiro:',err);
    }
  },true);
})();
