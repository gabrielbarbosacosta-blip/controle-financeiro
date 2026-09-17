(function(){
  if(window.__goalRecurringTerminologyV2Loaded)return;
  window.__goalRecurringTerminologyV2Loaded=true;

  function replaceText(value){
    return String(value||'')
      .replaceAll('Despesa recorrente do objetivo','Aporte recorrente do objetivo')
      .replaceAll('Despesa recorrente ·','Aporte recorrente ·')
      .replaceAll('Despesa recorrente','Aporte recorrente');
  }

  function apply(){
    document.querySelectorAll('[data-goal-recurring]').forEach(btn=>{
      const next=replaceText(btn.textContent);
      if(next!==btn.textContent)btn.textContent=next;
    });

    const title=document.getElementById('goalRecurringTitle');
    if(title){
      const next=replaceText(title.textContent);
      if(next!==title.textContent)title.textContent=next;
    }
  }

  function retry(){
    let tries=0;
    const timer=setInterval(()=>{
      apply();
      tries++;
      if(tries>=12)clearInterval(timer);
    },200);
  }

  function boot(){
    apply();
    retry();
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-page="goals"],[data-goal-recurring]')){
        setTimeout(apply,0);
        setTimeout(apply,80);
        setTimeout(apply,300);
      }
    },true);
    window.addEventListener('focus',()=>{
      if(document.getElementById('page-goals')?.classList.contains('active'))apply();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
