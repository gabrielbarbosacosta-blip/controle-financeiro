(function(){
  if(typeof sb==='undefined'||!sb?.auth?.updateUser||sb.auth.__financeStateRedirected)return;
  const originalUpdateUser=sb.auth.updateUser.bind(sb.auth);
  sb.auth.updateUser=async function(attributes={}){
    const data=attributes?.data;
    if(data&&Object.prototype.hasOwnProperty.call(data,'finance_state')){
      const userId=typeof currentUser!=='undefined'?currentUser?.id:null;
      if(!userId){
        return {data:{user:null},error:new Error('Usuário não autenticado para sincronização financeira.')};
      }
      const updatedAt=data.finance_updated_at||new Date().toISOString();
      const {error}=await sb.from('finance_states').upsert({
        user_id:userId,
        state:data.finance_state,
        updated_at:updatedAt
      },{onConflict:'user_id'});
      if(error)return {data:{user:currentUser},error};
      return {data:{user:currentUser},error:null};
    }
    return originalUpdateUser(attributes);
  };
  sb.auth.__financeStateRedirected=true;
})();

(function(){
  const COLORS={synced:'#22c55e',saving:'#f59e0b',error:'#ef4444',idle:'#64748b'};
  const LABELS={synced:'Sincronizado',saving:'Salvando',error:'Falha ao sincronizar',idle:'Status de sincronização'};

  function statusFromText(text,bad){
    const t=String(text||'').toLowerCase();
    if(bad||t.includes('falha')||t.includes('erro')||t.includes('não sincron'))return'error';
    if(t.includes('salvando')||t.includes('sincronizando'))return'saving';
    if(t.includes('sincronizado'))return'synced';
    return'idle';
  }

  function paint(status){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    const label=LABELS[status]||LABELS.idle;
    el.textContent='';
    el.setAttribute('aria-label',label);
    el.title=label;
    el.style.width='12px';
    el.style.height='12px';
    el.style.minWidth='12px';
    el.style.padding='0';
    el.style.margin='0 2px';
    el.style.border='0';
    el.style.borderRadius='50%';
    el.style.display='inline-flex';
    el.style.alignSelf='center';
    el.style.flex='0 0 12px';
    el.style.background=COLORS[status]||COLORS.idle;
    el.style.boxShadow=`0 0 0 3px ${COLORS[status]||COLORS.idle}22`;
    el.style.transition='background .18s ease, box-shadow .18s ease';
    el.dataset.syncState=status;
  }

  const originalSync=window.setSyncStatus;
  window.setSyncStatus=function(text,bad=false){
    if(typeof originalSync==='function')originalSync(text,bad);
    paint(statusFromText(text,bad));
  };

  function pendingAmountForMonth(type,ym){
    if(typeof state==='undefined'||!state?.transactions)return 0;
    const normalizedType=String(type||'').trim().toLowerCase();
    let total=state.transactions
      .filter(t=>
        String(t.type||'').trim().toLowerCase()===normalizedType&&
        String(t.status||'').trim().toLowerCase()==='pendente'&&
        String(t.date||'').slice(0,7)===ym
      )
      .reduce((sum,t)=>sum+(Number(t.amount)||0),0);

    if(normalizedType==='despesa'&&Array.isArray(state.cards)&&typeof cardForecast==='function'){
      total+=state.cards
        .filter(card=>card.active!==false)
        .filter(card=>getInvoice(card.id,ym)?.status!=='Paga')
        .reduce((sum,card)=>sum+(Number(cardForecast(card,ym).total)||0),0);
    }

    return round2(total);
  }

  function mountPendingBox({valueId,boxId,labelId,type,color,label}){
    const valueEl=document.getElementById(valueId);
    if(!valueEl)return;
    const card=valueEl.closest('.kpi');
    if(!card)return;
    let box=document.getElementById(boxId);
    if(!box){
      box=document.createElement('div');
      box.id=boxId;
      box.style.cssText='margin-top:8px;padding:6px 8px;border:1px solid #273449;border-radius:8px;background:#0b1424;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.2';
      box.innerHTML=`<span class="pending-label" style="color:#94a3b8">${label}</span><strong id="${labelId}" style="font-size:12px;color:${color};font-variant-numeric:tabular-nums">—</strong>`;
      card.appendChild(box);
    }else{
      const labelEl=box.querySelector('.pending-label');
      if(labelEl)labelEl.textContent=label;
    }
    const ym=state?.settings?.selectedMonth;
    const value=ym?pendingAmountForMonth(type,ym):0;
    const target=document.getElementById(labelId);
    if(target)target.textContent=fmtMoney(value);
  }

  function mountPendingValues(){
    mountPendingBox({
      valueId:'kpiIncome',
      boxId:'kpiIncomeForecastBox',
      labelId:'kpiIncomeForecast',
      type:'Receita',
      color:'#bbf7d0',
      label:'Receitas pendentes'
    });
    mountPendingBox({
      valueId:'kpiExpense',
      boxId:'kpiExpensePendingBox',
      labelId:'kpiExpensePending',
      type:'Despesa',
      color:'#fecaca',
      label:'Despesas pendentes'
    });
  }

  function anchorMainToTop(){
    const main=document.querySelector('.main');
    if(!main)return;
    main.style.margin='0 auto';
    main.style.alignSelf='start';
  }

  const originalDashboard=window.renderDashboard;
  if(typeof originalDashboard==='function'){
    window.renderDashboard=function(){
      originalDashboard.apply(this,arguments);
      mountPendingValues();
    };
  }

  function init(){
    anchorMainToTop();
    const el=document.getElementById('syncStatus');
    if(el){const initial=String(el.textContent||'');paint(statusFromText(initial,false));}
    mountPendingValues();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

(function(){
  if(document.querySelector('script[src="cloud-sync.js"]'))return;
  const script=document.createElement('script');
  script.src='cloud-sync.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="invoice-materializer.js"]'))return;
  const script=document.createElement('script');
  script.src='invoice-materializer.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="admin-dashboard.js"]'))return;
  const script=document.createElement('script');
  script.src='admin-dashboard.js';
  document.body.appendChild(script);
})();

(function(){
  if(document.querySelector('script[src="data-reset.js"]'))return;
  const script=document.createElement('script');
  script.src='data-reset.js';
  document.body.appendChild(script);
})();