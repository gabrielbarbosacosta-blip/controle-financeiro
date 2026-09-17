(function(){
  if(window.__goalEffectiveMetricsV1Loaded)return;
  window.__goalEffectiveMetricsV1Loaded=true;

  const STYLE_ID='goal-effective-metrics-v1-style';
  let goals=new Map();
  let participants=new Map();
  let loading=false;
  let timer=null;
  let observedGrid=null;
  let observer=null;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function currentYm(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function addMonth(ym,n){const[y,m]=String(ym).split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function money(v){try{return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}catch(e){return String(v||0)}}
  function monthLabel(ym){if(!ym)return'—';try{return typeof fmtMonth==='function'?fmtMonth(ym):new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric'}).format(new Date(`${ym}-01T12:00:00`))}catch(e){return ym}}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #page-goals .goal-effective-metrics{margin-top:8px}
      #page-goals .goal-effective-metrics .goal-metric:first-child{border-color:#30445e}
      #page-goals .goal-effective-metrics .goal-metric:first-child .v{color:#ddeaac}
    `;document.head.appendChild(s);
  }

  function effectiveMonthly(goalId){
    const list=participants.get(String(goalId))||[];
    return list.reduce((sum,p)=>sum+(p?.recurringEnabled?Number(p.recurringAmount)||0:0),0);
  }

  function valuesFor(g){
    const target=Number(g?.targetAmount)||0;
    const saved=Number(g?.savedAmount)||0;
    const remaining=Math.max(0,target-saved);
    const effective=effectiveMonthly(g?.id);
    if(remaining<=0)return{effective,deadline:'0 meses',forecast:'Atingida'};
    if(effective<=0)return{effective,deadline:'—',forecast:'—'};
    const months=Math.max(1,Math.ceil(remaining/effective));
    const forecast=addMonth(currentYm(),Math.max(0,months-1));
    return{effective,deadline:`${months} ${months===1?'mês':'meses'}`,forecast:monthLabel(forecast)};
  }

  function renderCard(card){
    const id=String(card?.dataset?.goalId||'');
    const g=goals.get(id);if(!card||!g)return;
    const planned=card.querySelector('.goal-metrics:not(.goal-effective-metrics)');if(!planned)return;
    const v=valuesFor(g);
    const signature=[g.savedAmount,g.targetAmount,v.effective,v.deadline,v.forecast].join('|');
    let row=card.querySelector('.goal-effective-metrics');
    if(row?.dataset.signature===signature)return;
    if(!row){
      row=document.createElement('div');
      row.className='goal-metrics goal-effective-metrics';
      planned.insertAdjacentElement('afterend',row);
    }
    row.dataset.signature=signature;
    row.innerHTML=`<div class="goal-metric"><div class="k">Aporte efetivo</div><div class="v">${money(v.effective)}/mês</div></div><div class="goal-metric"><div class="k">Prazo</div><div class="v">${v.deadline}</div></div><div class="goal-metric"><div class="k">Previsão</div><div class="v">${v.forecast}</div></div>`;
  }

  function renderAll(){document.querySelectorAll('#goalGrid .goal-card[data-goal-id]').forEach(renderCard)}

  async function load(){
    const client=getSb();if(!client||loading)return;
    loading=true;
    try{
      const [goalRes,participantRes]=await Promise.all([
        client.rpc('finance_list_goals'),
        client.rpc('finance_list_goal_participants')
      ]);
      if(goalRes.error)throw goalRes.error;
      if(participantRes.error)throw participantRes.error;
      const goalItems=Array.isArray(goalRes.data?.items)?goalRes.data.items:[];
      const participantItems=Array.isArray(participantRes.data?.items)?participantRes.data.items:[];
      goals=new Map(goalItems.map(g=>[String(g.id),g]));
      participants=new Map(participantItems.map(x=>[String(x.goalId),Array.isArray(x.participants)?x.participants:[]]));
      renderAll();
    }catch(e){console.warn('Falha ao calcular aporte efetivo dos objetivos.',e)}
    finally{loading=false}
  }

  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(load,delay)}

  function observeGrid(){
    const grid=document.getElementById('goalGrid');if(!grid||grid===observedGrid)return;
    observer?.disconnect();observedGrid=grid;
    observer=new MutationObserver(()=>schedule(140));
    observer.observe(grid,{childList:true,subtree:true});
  }

  function boot(){
    injectStyles();observeGrid();schedule(120);
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-page="goals"],[data-goal-contribute],[data-goal-recurring],[data-goal-recurring-shared],[data-goal-share-respond],[data-goal-share-remove],[data-goal-share-leave],#goalShareForm .btn.primary'))setTimeout(()=>schedule(80),300);
    },true);
    window.addEventListener('focus',()=>{if(document.getElementById('page-goals')?.classList.contains('active'))schedule(80)});
    let tries=0;const ready=setInterval(()=>{
      tries++;observeGrid();
      if(getSb()&&document.getElementById('goalGrid')){clearInterval(ready);schedule(40)}
      else if(tries>300)clearInterval(ready);
    },100);
    window.financeGoalEffectiveMetricsRefresh=()=>load();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
