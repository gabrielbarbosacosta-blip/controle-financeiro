(function(){
  if(window.__goalRecurringParticipantsV2Loaded)return;
  window.__goalRecurringParticipantsV2Loaded=true;

  let goals=[];
  let loading=false;
  let timer=null;
  let observedGrid=null;
  let gridObserver=null;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function ym(){try{return String(state?.settings?.selectedMonth||document.getElementById('monthSelect')?.value||new Date().toISOString().slice(0,7)).slice(0,7)}catch(e){return new Date().toISOString().slice(0,7)}}

  async function loadGoals(force=false){
    const client=getSb();if(!client||loading)return;
    loading=true;
    try{
      const {data,error}=await client.rpc('finance_list_goals');
      if(error)throw error;
      if(data?.ok===false)throw new Error(data.error||'load_failed');
      goals=Array.isArray(data?.items)?data.items:[];
      enhanceCards();
    }catch(e){console.warn('Falha ao carregar aportes recorrentes compartilhados.',e)}
    finally{loading=false}
  }

  function goalById(id){return goals.find(g=>String(g.id)===String(id))||null}

  function openRecurringForContributor(id){
    const g=goalById(id);if(!g||!g.canContribute||g.isOwner)return;
    const modal=document.getElementById('goalRecurringModal');if(!modal)return;
    const hidden=document.getElementById('goalRecurringGoalId');
    const title=document.getElementById('goalRecurringTitle');
    const amount=document.getElementById('goalRecurringAmount');
    const start=document.getElementById('goalRecurringStart');
    const end=document.getElementById('goalRecurringEnd');
    const account=document.getElementById('goalRecurringAccount');
    const disable=document.getElementById('goalRecurringDisable');
    if(hidden)hidden.value=id;
    if(title)title.textContent=`Aporte recorrente · ${g.name||'Objetivo'}`;
    if(amount)amount.value=Number(g.recurringAmount||g.plannedMonthly)||'';
    if(start)start.value=g.recurringStartMonth||ym();
    if(end)end.value=g.recurringEndMonth||g.targetMonth||'';
    if(account)account.value=g.recurringAccount||'';
    if(disable)disable.style.display=g.recurringEnabled?'inline-flex':'none';
    modal.classList.add('open');
    setTimeout(()=>amount?.focus(),60);
  }

  function enhanceCards(){
    const grid=document.getElementById('goalGrid');if(!grid)return;
    grid.querySelectorAll('.goal-card[data-goal-id]').forEach(card=>{
      const g=goalById(card.dataset.goalId);if(!g)return;
      const actions=card.querySelector('.goal-actions');if(!actions)return;
      const existing=actions.querySelector('[data-goal-recurring-shared]');
      if(g.isOwner||!g.canContribute||g.shareStatus!=='accepted'){
        existing?.remove();return;
      }
      if(existing){
        existing.textContent=g.recurringEnabled?'↻ Editar aporte recorrente':'↻ Aporte recorrente';
        return;
      }
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn small';
      btn.dataset.goalRecurringShared=String(g.id);
      btn.textContent=g.recurringEnabled?'↻ Editar aporte recorrente':'↻ Aporte recorrente';
      btn.addEventListener('click',()=>openRecurringForContributor(g.id));
      const contribute=actions.querySelector('[data-goal-contribute]');
      if(contribute?.nextSibling)actions.insertBefore(btn,contribute.nextSibling);else actions.appendChild(btn);
    });
  }

  function schedule(delay=100,force=false){
    clearTimeout(timer);timer=setTimeout(()=>loadGoals(force),delay);
  }

  function observeGrid(){
    const grid=document.getElementById('goalGrid');if(!grid||grid===observedGrid)return;
    gridObserver?.disconnect();observedGrid=grid;
    gridObserver=new MutationObserver(()=>schedule(120,true));
    gridObserver.observe(grid,{childList:true,subtree:true});
  }

  function hookRefresh(){
    if(window.__goalRecurringParticipantsRefreshHooked)return;
    const original=window.financeGoalCollabRefresh;
    if(typeof original!=='function')return;
    window.__goalRecurringParticipantsRefreshHooked=true;
    window.financeGoalCollabRefresh=async function(){
      const result=await original.apply(this,arguments);
      await loadGoals(true);
      return result;
    };
  }

  function normalizeCopy(){
    const summary=document.querySelector('#goalRecurringModal .goal-recurring-summary');
    if(summary)summary.innerHTML='O sistema criará <strong>um aporte pendente por mês</strong> em <strong>Despesa → Objetivos</strong>. Cada competência pertence ao seu próprio fluxo financeiro; ao marcar como paga, o valor passa a compor o total reservado do objetivo compartilhado.';
    const disable=document.getElementById('goalRecurringDisable');
    if(disable)disable.textContent='Desativar aporte recorrente';
  }

  function boot(){
    observeGrid();hookRefresh();normalizeCopy();schedule(100,true);
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-page="goals"],[data-goal-share-respond],[data-goal-share-remove],[data-goal-share-leave],#goalShareForm .btn.primary'))setTimeout(()=>schedule(120,true),300);
      if(e.target.closest('[data-goal-recurring],[data-goal-recurring-shared]'))setTimeout(normalizeCopy,0);
    },true);
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))schedule(80,true)});
    let tries=0;const ready=setInterval(()=>{
      tries++;observeGrid();hookRefresh();normalizeCopy();
      if(getSb()&&document.getElementById('goalGrid')){clearInterval(ready);schedule(40,true)}
      else if(tries>300)clearInterval(ready);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
