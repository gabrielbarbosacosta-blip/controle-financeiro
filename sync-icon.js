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

  function expectedIncomeForMonth(ym){
    if(typeof state==='undefined'||!state?.transactions)return 0;
    return round2(state.transactions
      .filter(t=>
        String(t.type||'').trim().toLowerCase()==='receita'&&
        String(t.status||'').trim().toLowerCase()==='pendente'&&
        String(t.date||'').slice(0,7)===ym
      )
      .reduce((sum,t)=>sum+(Number(t.amount)||0),0));
  }

  function mountIncomeForecast(){
    const income=document.getElementById('kpiIncome');
    if(!income)return;
    const card=income.closest('.kpi');
    if(!card)return;
    let box=document.getElementById('kpiIncomeForecastBox');
    if(!box){
      box=document.createElement('div');
      box.id='kpiIncomeForecastBox';
      box.style.cssText='margin-top:8px;padding:6px 8px;border:1px solid #273449;border-radius:8px;background:#0b1424;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.2';
      box.innerHTML='<span style="color:#94a3b8">Valores previstos</span><strong id="kpiIncomeForecast" style="font-size:12px;color:#bbf7d0;font-variant-numeric:tabular-nums">—</strong>';
      card.appendChild(box);
    }
    const ym=state?.settings?.selectedMonth;
    const value=ym?expectedIncomeForMonth(ym):0;
    const target=document.getElementById('kpiIncomeForecast');
    if(target)target.textContent=fmtMoney(value);
  }

  const originalDashboard=window.renderDashboard;
  if(typeof originalDashboard==='function'){
    window.renderDashboard=function(){
      originalDashboard.apply(this,arguments);
      mountIncomeForecast();
    };
  }

  function init(){
    const el=document.getElementById('syncStatus');
    if(el){const initial=String(el.textContent||'');paint(statusFromText(initial,false));}
    mountIncomeForecast();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
