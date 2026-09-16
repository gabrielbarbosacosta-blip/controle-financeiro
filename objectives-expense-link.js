(function(){
  if(window.__financeObjectiveExpenseLinkLoaded)return;
  window.__financeObjectiveExpenseLinkLoaded=true;

  const STYLE_ID='finance-objective-expense-link-style';
  let initialized=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #historyBody tr.goal-contribution-history-row td{background:rgba(124,58,237,.075)!important;border-top-color:rgba(167,139,250,.2)!important;border-bottom-color:rgba(167,139,250,.14)!important}
      #historyBody tr.goal-contribution-history-row td:first-child{box-shadow:inset 3px 0 0 #8b5cf6}
      #historyBody tr.goal-contribution-history-row .num{color:#c4b5fd!important;font-weight:800}
      .goal-history-badge{display:inline-flex;align-items:center;margin-left:6px;padding:2px 6px;border-radius:999px;background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe;font-size:9px;font-weight:800;vertical-align:middle}
      .goal-history-status{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#2e1065;border:1px solid #6d28d9;color:#ddd6fe;font-size:10px;font-weight:800;white-space:nowrap}
      .goal-contrib-value{color:#c4b5fd!important}
      .goal-contrib-row{border-color:rgba(167,139,250,.2)!important;background:rgba(76,29,149,.08)!important}
    `;document.head.appendChild(s);
  }

  function ensureCategory(){
    try{if(typeof categories!=='undefined'&&Array.isArray(categories)&&!categories.includes('Objetivos'))categories.push('Objetivos')}catch(e){}
    const tx=document.getElementById('txCategory');
    if(tx&&![...tx.options].some(o=>o.value==='Objetivos'||o.textContent==='Objetivos'))tx.insertAdjacentHTML('beforeend','<option>Objetivos</option>');
    const filter=document.getElementById('categoryFilter');
    if(filter&&![...filter.options].some(o=>o.value==='Objetivos'||o.textContent==='Objetivos'))filter.insertAdjacentHTML('beforeend','<option>Objetivos</option>');
  }

  function updateObjectiveCopy(){
    const intro=document.querySelector('#page-goals .goals-intro');
    if(intro)intro.innerHTML='<strong>Aportes são saídas de caixa.</strong> Cada aporte registrado em um objetivo também é criado como <strong>Despesa → Objetivos</strong> em Lançamentos. A cor violeta diferencia esse dinheiro reservado das despesas de consumo.';
    const modal=document.getElementById('goalContributionModal');
    const note=modal?.querySelector('.goal-modal-note');
    if(note)note.innerHTML='O aporte aumenta o capital reservado do objetivo e, ao mesmo tempo, cria uma <strong>despesa paga</strong> em Lançamentos. Assim o saldo de caixa diminui sem confundir o aporte com consumo comum.';
  }

  function ensureAccountField(){
    const form=document.getElementById('goalContributionForm');if(!form)return false;
    const grid=form.querySelector('.form-grid');if(!grid)return false;
    if(!document.getElementById('goalContributionAccount')){
      const field=document.createElement('div');field.className='field';
      field.innerHTML='<label>Conta de origem</label><input id="goalContributionAccount" placeholder="Ex.: Banco do Brasil"><small class="muted">Opcional. Identifica de onde saiu o dinheiro.</small>';
      const notes=document.getElementById('goalContributionNotes')?.closest('.field');
      grid.insertBefore(field,notes||null);
    }
    return true;
  }

  async function refreshFinancialState(){
    try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){console.warn('Falha ao atualizar lançamentos após aporte.',e)}
    try{await window.financeGoalsRefresh?.()}catch(e){}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
  }

  async function submitContribution(e){
    e.preventDefault();e.stopPropagation();
    const form=e.currentTarget,button=e.submitter;if(button)button.disabled=true;
    const id=document.getElementById('goalContributionGoalId')?.value||'';
    const amount=Number(document.getElementById('goalContributionAmount')?.value)||0;
    const date=document.getElementById('goalContributionDate')?.value||'';
    const account=document.getElementById('goalContributionAccount')?.value?.trim()||'';
    const notes=document.getElementById('goalContributionNotes')?.value?.trim()||'';
    try{
      const client=getSb();if(!client)throw new Error('supabase_unavailable');
      const {data,error}=await client.rpc('finance_add_goal_contribution',{p_goal_id:id,p_amount:amount,p_date:date||null,p_notes:notes,p_account:account});
      if(error)throw error;if(!data?.ok)throw new Error(data?.error||'contribution_failed');
      document.getElementById('goalContributionModal')?.classList.remove('open');
      await refreshFinancialState();
      try{if(typeof setSyncStatus==='function')setSyncStatus(`Aporte ${money(amount)} registrado como despesa`)}catch(_e){}
    }catch(err){console.error('Falha ao registrar aporte como despesa.',err);alert('Não foi possível registrar o aporte agora.')}
    finally{if(button)button.disabled=false}
  }

  function bindContributionForm(){
    if(!ensureAccountField())return false;
    const form=document.getElementById('goalContributionForm');
    if(form.dataset.expenseLinked==='1')return true;
    form.dataset.expenseLinked='1';
    form.onsubmit=submitContribution;
    return true;
  }

  function contributionTxIdFromRow(row){
    const edit=row.querySelector('button[onclick*="editTx("]');if(!edit)return'';
    const code=edit.getAttribute('onclick')||'';
    const m=code.match(/editTx\(['\"]([^'\"]+)['\"]\)/);const id=m?.[1]||'';
    return id.startsWith('goal-contrib-')?id:'';
  }

  function enhanceHistory(){
    const body=document.getElementById('historyBody');if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const id=contributionTxIdFromRow(row);if(!id)return;
      row.classList.add('goal-contribution-history-row');row.dataset.goalContributionTx=id;
      const cells=row.querySelectorAll('td');
      if(cells[1]&&!cells[1].querySelector('.goal-history-badge'))cells[1].insertAdjacentHTML('beforeend','<span class="goal-history-badge">Aporte</span>');
      if(cells[5])cells[5].innerHTML='<span class="goal-history-status">Pago · Objetivo</span>';
      if(cells[7]){
        cells[7].innerHTML='<button type="button" class="btn small" data-open-goals-from-history="1">Gerenciar objetivo</button>';
        cells[7].querySelector('[data-open-goals-from-history]')?.addEventListener('click',()=>window.openFinanceGoals?.());
      }
    });
  }

  function wrapHistory(){
    if(window.renderHistory?.__goalExpenseWrapped)return;
    const original=window.renderHistory;if(typeof original!=='function')return;
    const wrapped=function(){const result=original.apply(this,arguments);enhanceHistory();return result};
    wrapped.__goalExpenseWrapped=true;window.renderHistory=wrapped;enhanceHistory();
  }

  async function deleteContributionManaged(id){
    const client=getSb();if(!client)return;
    const {data,error}=await client.rpc('finance_delete_goal_contribution',{p_contribution_id:id});
    if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_contribution_failed');
    await refreshFinancialState();
  }

  async function deleteGoalManaged(id){
    const client=getSb();if(!client)return;
    const {data,error}=await client.rpc('finance_delete_goal',{p_goal_id:id});
    if(error)throw error;if(!data?.ok)throw new Error(data?.error||'delete_goal_failed');
    await refreshFinancialState();
  }

  function bindManagedDeletes(){
    document.addEventListener('click',async e=>{
      const c=e.target?.closest?.('[data-goal-contrib-delete]');
      if(c){
        e.preventDefault();e.stopImmediatePropagation();
        if(!confirm('Excluir este aporte? A despesa vinculada também será removida de Lançamentos.'))return;
        c.disabled=true;try{await deleteContributionManaged(c.dataset.goalContribDelete)}catch(err){console.error(err);alert('Não foi possível excluir o aporte agora.')}finally{c.disabled=false}return;
      }
      const g=e.target?.closest?.('[data-goal-delete]');
      if(g){
        e.preventDefault();e.stopImmediatePropagation();
        const card=g.closest('[data-goal-id]');const title=card?.querySelector('.goal-title')?.textContent||'este objetivo';
        if(!confirm(`Excluir "${title}"? Os aportes e as despesas vinculadas em Lançamentos também serão removidos.`))return;
        g.disabled=true;try{await deleteGoalManaged(g.dataset.goalDelete)}catch(err){console.error(err);alert('Não foi possível excluir o objetivo agora.')}finally{g.disabled=false}
      }
    },true);
  }

  function patchContributionModalOpen(){
    document.addEventListener('click',e=>{
      if(!e.target?.closest?.('[data-goal-contribute]'))return;
      setTimeout(()=>{ensureAccountField();const a=document.getElementById('goalContributionAccount');if(a)a.value='';updateObjectiveCopy()},0);
    },true);
  }

  function init(){
    if(initialized)return;initialized=true;
    injectStyles();ensureCategory();updateObjectiveCopy();bindManagedDeletes();patchContributionModalOpen();wrapHistory();
    let tries=0;const ready=setInterval(()=>{
      tries++;ensureCategory();updateObjectiveCopy();wrapHistory();
      if(bindContributionForm()&&document.getElementById('page-goals'))clearInterval(ready);
      else if(tries>300)clearInterval(ready);
    },100);
    window.financeObjectiveExpenseEnhanceHistory=enhanceHistory;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();