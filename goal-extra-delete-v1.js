(function(){
  if(window.__goalExtraDeleteV1Loaded)return;
  window.__goalExtraDeleteV1Loaded=true;

  let deleting=false;
  let expenseObserver=null;
  let historyObserver=null;
  let observedExpense=null;
  let observedHistory=null;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function selectedMonth(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||'').slice(0,7)}catch(e){return''}}
  function isExtraId(id){return /^goal-contrib-[0-9a-f]{32}$/i.test(String(id||''))}
  function contributionId(txId){
    const hex=String(txId||'').replace(/^goal-contrib-/i,'');
    if(!/^[0-9a-f]{32}$/i.test(hex))return'';
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function isGoalTx(tx){return !!tx&&(String(tx.id||'').startsWith('goal-plan-')||String(tx.id||'').startsWith('goal-contrib-')||(String(tx.nature||'').toLowerCase()==='objetivo'&&String(tx.category||'').toLowerCase()==='objetivos'))}

  async function waitCloudIdle(){
    for(let i=0;i<40;i++){
      if(!window.financeCloud?.hasPendingLocalWrite)return;
      await new Promise(r=>setTimeout(r,50));
    }
  }

  async function refreshAll(){
    try{await waitCloudIdle();await window.financeCloud?.refresh?.()}catch(e){console.warn('Falha ao atualizar o caixa após excluir aporte extra.',e)}
    try{await window.financeGoalsRefresh?.()}catch(e){console.warn('Falha ao atualizar objetivos após excluir aporte extra.',e)}
    try{if(typeof renderAll==='function')renderAll()}catch(e){}
    try{window.financeObjectiveExpenseRefresh?.()}catch(e){}
    setTimeout(()=>{enhanceExpense();enhanceHistory()},80);
  }

  async function removeExtra(txId,button){
    if(deleting||!isExtraId(txId))return;
    const id=contributionId(txId);if(!id)return;
    if(!confirm('Excluir este aporte extra? O lançamento será removido e o valor reservado do objetivo será recalculado.'))return;
    deleting=true;if(button)button.disabled=true;
    try{
      const client=getSb();if(!client)throw new Error('client_unavailable');
      const {data,error}=await client.rpc('finance_delete_goal_contribution',{p_contribution_id:id});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'delete_failed');
      await refreshAll();
      try{if(typeof setSyncStatus==='function')setSyncStatus('Aporte extra excluído')}catch(e){}
    }catch(err){
      console.error('Falha ao excluir aporte extra.',err);
      alert('Não foi possível excluir o aporte extra agora.');
      await refreshAll();
    }finally{
      deleting=false;if(button&&document.contains(button))button.disabled=false;
    }
  }

  function deleteButton(txId){
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn small danger goal-extra-delete-btn';btn.textContent='Excluir';
    btn.dataset.goalExtraDelete=txId;btn.style.marginLeft='6px';
    btn.title='Excluir aporte extra';
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();removeExtra(txId,btn)});
    return btn;
  }

  function expenseTransactions(){
    try{
      let txs=(Array.isArray(state?.transactions)?state.transactions:[]).filter(isGoalTx);
      const ym=selectedMonth();if(ym)txs=txs.filter(t=>String(t.date||'').slice(0,7)===ym);
      txs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')));
      return txs;
    }catch(e){return[]}
  }

  function enhanceExpense(){
    const body=document.getElementById('goalExpenseBody');if(!body)return;
    const txs=expenseTransactions(),rows=[...body.querySelectorAll('tr')];
    rows.forEach((row,index)=>{
      const tx=txs[index];if(!tx||!isExtraId(tx.id))return;
      row.dataset.goalTransactionId=tx.id;
      const cell=row.querySelectorAll('td')[5];if(!cell||cell.querySelector('.goal-extra-delete-btn'))return;
      cell.style.whiteSpace='nowrap';cell.appendChild(deleteButton(tx.id));
    });
  }

  function enhanceHistory(){
    const body=document.getElementById('historyBody');if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const txId=String(row.dataset.goalTransactionId||'');if(!isExtraId(txId))return;
      const cell=row.querySelectorAll('td')[7];if(!cell||cell.querySelector('.goal-extra-delete-btn'))return;
      cell.style.whiteSpace='nowrap';cell.appendChild(deleteButton(txId));
    });
  }

  function observe(){
    const expense=document.getElementById('goalExpenseBody');
    if(expense&&expense!==observedExpense){
      expenseObserver?.disconnect();observedExpense=expense;
      expenseObserver=new MutationObserver(()=>queueMicrotask(enhanceExpense));
      expenseObserver.observe(expense,{childList:true,subtree:true});
    }
    const history=document.getElementById('historyBody');
    if(history&&history!==observedHistory){
      historyObserver?.disconnect();observedHistory=history;
      historyObserver=new MutationObserver(()=>queueMicrotask(enhanceHistory));
      historyObserver.observe(history,{childList:true,subtree:true});
    }
  }

  function boot(){
    observe();enhanceExpense();setTimeout(enhanceHistory,0);
    document.addEventListener('click',e=>{
      if(e.target.closest('.nav [data-page="history"],.nav [data-page="debts"],[data-page="goals"]'))setTimeout(()=>{observe();enhanceExpense();enhanceHistory()},100);
    },true);
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(()=>{enhanceExpense();enhanceHistory()},80));
    let tries=0;const ready=setInterval(()=>{
      tries++;observe();enhanceExpense();enhanceHistory();
      if(tries>120)clearInterval(ready);
    },250);
    window.financeGoalExtraDeleteRefresh=()=>{observe();enhanceExpense();enhanceHistory()};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
