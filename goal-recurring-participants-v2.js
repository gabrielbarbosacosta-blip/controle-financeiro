(function(){
  if(window.__goalRecurringParticipantsOwnerOnlyLoaded)return;
  window.__goalRecurringParticipantsOwnerOnlyLoaded=true;

  function cleanup(){
    document.querySelectorAll('[data-goal-recurring-shared]').forEach(btn=>btn.remove());
  }

  function boot(){
    cleanup();
    const grid=document.getElementById('goalGrid');
    if(grid){
      const observer=new MutationObserver(cleanup);
      observer.observe(grid,{childList:true,subtree:true});
    }
    document.addEventListener('click',cleanup,true);
    window.addEventListener('focus',cleanup);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();