(function(){
  if(window.__financeObjectiveSyncV5Loaded)return;
  window.__financeObjectiveSyncV5Loaded=true;

  let busy=false;
  let lastRun=0;
  let retryTimer=null;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
  function validState(v){return !!(v&&v.settings&&Array.isArray(v.transactions)&&Array.isArray(v.cards)&&Array.isArray(v.purchases)&&Array.isArray(v.invoices))}

  async function waitIdle(timeoutMs=6000){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      if(!window.financeCloud?.hasPendingLocalWrite)return true;
      await new Promise(r=>setTimeout(r,75));
    }
    return !window.financeCloud?.hasPendingLocalWrite;
  }

  function applyState(financeState){
    if(!validState(financeState))return false;
    try{
      state=clone(financeState);
      if(!Array.isArray(state.incomePlans))state.incomePlans=[];
      if(!Array.isArray(state.debts))state.debts=[];
      try{
        if(typeof selectedCardId!=='undefined'&&selectedCardId&&!state.cards.some(c=>c.id===selectedCardId))selectedCardId=state.cards[0]?.id||null;
        if(typeof selectedCardId!=='undefined'&&!selectedCardId)selectedCardId=state.cards[0]?.id||null;
        if(typeof selectedInvoiceYm!=='undefined')selectedInvoiceYm=state.settings.selectedMonth;
      }catch(_e){}
      if(typeof renderAll==='function')renderAll();
      setTimeout(()=>window.financeObjectiveExpenseRefresh?.(),0);
      return true;
    }catch(e){console.warn('Falha ao aplicar estado após sincronizar objetivos.',e);return false}
  }

  async function forceReload(){
    const uid=getUserId();
    if(!uid||!window.financeCloud?.load)return false;
    const cloud=await window.financeCloud.load(uid);
    return applyState(cloud?.state);
  }

  function scheduleRetry(){
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>syncNow('retry',true),900);
  }

  async function syncNow(reason='manual',force=false){
    if(busy)return false;
    if(!force&&Date.now()-lastRun<1200)return false;
    const client=getSb(),uid=getUserId();
    if(!client||!uid||!window.financeCloud?.load)return false;
    busy=true;
    try{
      const idle=await waitIdle();
      if(!idle){scheduleRetry();return false}
      const {data,error}=await client.rpc('finance_sync_goal_plans');
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'goal_plan_sync_failed');
      await forceReload();
      try{await window.financeGoalsRefresh?.()}catch(_e){}
      setTimeout(()=>window.financeObjectiveExpenseRefresh?.(),20);
      try{if(typeof setSyncStatus==='function')setSyncStatus('Objetivos sincronizados com lançamentos')}catch(_e){}
      lastRun=Date.now();
      return true;
    }catch(e){
      console.warn('Falha ao sincronizar objetivos com Despesas/Lançamentos.',e);
      scheduleRetry();
      return false;
    }finally{busy=false}
  }

  function observeModal(id){
    const el=document.getElementById(id);if(!el||el.dataset.goalSyncObserved==='1')return false;
    el.dataset.goalSyncObserved='1';
    let wasOpen=el.classList.contains('open');
    new MutationObserver(()=>{
      const open=el.classList.contains('open');
      if(wasOpen&&!open)setTimeout(()=>syncNow(id,true),120);
      wasOpen=open;
    }).observe(el,{attributes:true,attributeFilter:['class']});
    return true;
  }

  function init(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('.nav [data-page="history"],.nav [data-page="debts"]'))setTimeout(()=>syncNow('nav'),80);
    },true);
    window.addEventListener('focus',()=>syncNow('focus'));

    let tries=0;
    const ready=setInterval(()=>{
      tries++;
      observeModal('goalModal');observeModal('goalContributionModal');
      if(getSb()&&getUserId()&&window.financeCloud?.load){
        clearInterval(ready);
        syncNow('startup',true);
      }else if(tries>300)clearInterval(ready);
    },100);

    window.financeSyncGoalPlans=()=>syncNow('manual',true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();