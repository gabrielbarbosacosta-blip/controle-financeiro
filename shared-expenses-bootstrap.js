(function(){
  if(window.__sharedExpensesBootstrapLoaded)return;
  window.__sharedExpensesBootstrapLoaded=true;

  function augmentSharedExpenseRpc(){
    if(typeof sb==='undefined'||!sb||sb.__sharedExpenseSeriesRpcPatched)return false;
    const originalRpc=sb.rpc.bind(sb);
    sb.rpc=function(name,args,options){
      if(name==='finance_create_shared_expense'&&args?.p_expense){
        const nature=document.getElementById('txNature')?.value||args.p_expense.nature||'';
        const recurring=!!document.getElementById('txRecurring')?.checked;
        args={...args,p_expense:{
          ...args.p_expense,
          installmentCurrent:nature==='Parcelamento'?(Number(document.getElementById('txInstallmentCurrent')?.value)||null):null,
          installmentTotal:nature==='Parcelamento'?(Number(document.getElementById('txInstallmentTotal')?.value)||null):null,
          recurring,
          recurringEnd:recurring?(document.getElementById('txRecurringEnd')?.value||null):null
        }};
      }
      return originalRpc(name,args,options);
    };
    sb.__sharedExpenseSeriesRpcPatched=true;
    return true;
  }

  function loadSharedModule(){
    if(window.__sharedExpensesLoaded)return true;
    if(document.querySelector('script[data-shared-expenses-v2="1"]'))return false;
    const script=document.createElement('script');
    script.src='shared-expenses.js?v=20260919-planobligation1';
    script.dataset.sharedExpensesV2='1';
    document.body.appendChild(script);
    return false;
  }

  function revealWhenReady(){
    const box=document.getElementById('sharedExpenseBox');
    if(!box)return false;
    const type=document.getElementById('txType')?.value;
    const editing=!!document.getElementById('txId')?.value;
    box.style.display=type==='Despesa'&&!editing?'block':'none';
    return true;
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      let ready=false;
      try{ready=!!(typeof sb!=='undefined'&&currentUser?.id&&document.getElementById('txForm'))}catch(e){}
      if(ready){
        augmentSharedExpenseRpc();
        loadSharedModule();
        revealWhenReady();
        const modal=document.getElementById('txModal');
        if(modal&&modal.dataset.sharedBootstrapObserved!=='1'){
          modal.dataset.sharedBootstrapObserved='1';
          new MutationObserver(()=>{
            if(modal.classList.contains('open')){
              augmentSharedExpenseRpc();
              loadSharedModule();
              setTimeout(revealWhenReady,0);
              setTimeout(revealWhenReady,120);
            }
          }).observe(modal,{attributes:true,attributeFilter:['class']});
        }
        if(window.__sharedExpensesLoaded&&document.getElementById('sharedExpenseBox'))clearInterval(timer);
      }
      if(tries>1200)clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
