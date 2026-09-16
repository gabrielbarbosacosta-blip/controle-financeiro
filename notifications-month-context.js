(function(){
  if(window.__financeNotificationsMonthContextLoaded)return;
  window.__financeNotificationsMonthContextLoaded=true;

  let running=false;
  let lastMonth='';
  let seenKeys=new Set();
  const sessionVisibleKeys=new Set();

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function selectedMonth(){
    try{return String(state?.settings?.selectedMonth||'').slice(0,7)}catch(e){return String(window.state?.settings?.selectedMonth||'').slice(0,7)}
  }
  function monthOf(entry){return String(entry?.date||'').slice(0,7)}
  function isPending(entry){const s=String(entry?.status||'').trim().toLowerCase();return !['pago','recebido'].includes(s)}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}
  function cents(v){return Math.round((Number(v)||0)*100)}

  function monthReceive(balance,month){
    if(!month)return Number(balance?.toReceive)||0;
    return (Array.isArray(balance?.entries)?balance.entries:[])
      .filter(e=>e?.direction==='receive'&&monthOf(e)===month&&isPending(e))
      .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  }

  function monthLabel(month){
    if(!month)return'';
    try{return typeof fmtMonth==='function'?fmtMonth(month):month}catch(e){return month}
  }

  function chargeKey(balance,month,amount){
    const counterpart=String(balance?.userId||balance?.participantUserId||balance?.name||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
    return `shared-charge:${month||'all'}:${counterpart}:${cents(amount)}`;
  }

  async function loadSeenKeys(client){
    const {data,error}=await client.rpc('finance_list_notification_views',{p_prefix:'shared-charge:'});
    if(error)throw error;
    seenKeys=new Set(Array.isArray(data?.keys)?data.keys:[]);
  }

  async function applyContext(){
    const client=getSb(),host=document.getElementById('notificationsList'),month=selectedMonth();
    if(running||!client||!host)return;
    running=true;
    try{
      const [balanceRes]=await Promise.all([client.rpc('finance_shared_balances'),loadSeenKeys(client)]);
      if(balanceRes.error)throw balanceRes.error;
      const balances=balanceRes.data?.items||[];
      const aggregateCharges=balances.filter(b=>(Number(b.toReceive)||0)>0);
      const cards=[...host.querySelectorAll('.notification-card.charge')];
      cards.forEach((card,index)=>{
        const balance=aggregateCharges[index];
        if(!balance){card.style.display='none';card.removeAttribute('data-notification-key');return}
        const amount=monthReceive(balance,month);
        if(amount<=0){card.style.display='none';card.removeAttribute('data-notification-key');return}
        const key=chargeKey(balance,month,amount);
        card.dataset.notificationKey=key;
        card.dataset.notificationMode='once';
        card.dataset.notificationKind='charge';
        if(seenKeys.has(key)&&!sessionVisibleKeys.has(key)){
          card.style.display='none';
          return;
        }
        card.style.display='';
        const value=card.querySelector('.notification-value');if(value)value.textContent=money(amount);
        const meta=card.querySelector('.notification-meta');
        if(meta)meta.textContent=month?`Saldo pendente em ${monthLabel(month)}. Esta notificação sai da fila depois de visualizada.`:'Há um saldo a receber ainda não quitado nos compartilhamentos.';
      });
      lastMonth=month;
      try{window.financeNotificationQueueRefresh?.()}catch(e){}
    }catch(e){console.warn('Falha ao contextualizar notificações por mês.',e)}finally{running=false}
  }

  async function markVisibleChargesViewed(){
    const client=getSb(),host=document.getElementById('notificationsList');
    if(!client||!host)return;
    const cards=[...host.querySelectorAll('.notification-card.charge[data-notification-key]')]
      .filter(card=>card.dataset.queueActive==='1'&&card.style.display!=='none');
    const keys=[...new Set(cards.map(card=>card.dataset.notificationKey).filter(Boolean))];
    if(!keys.length)return;
    keys.forEach(key=>sessionVisibleKeys.add(key));
    await Promise.all(keys.map(async key=>{
      try{
        const {data,error}=await client.rpc('finance_mark_notification_viewed',{p_notification_key:key});
        if(error||data?.ok===false)throw error||new Error(data?.error||'mark_view_failed');
        seenKeys.add(key);
      }catch(e){console.warn('Falha ao marcar notificação como visualizada.',e)}
    }));
  }

  function schedule(){setTimeout(applyContext,120)}

  function wrapRefresh(){
    if(window.financeNotificationsRefresh?.__monthContextWrapped)return true;
    const original=window.financeNotificationsRefresh;
    if(typeof original!=='function')return false;
    const wrapped=async function(){const result=await original.apply(this,arguments);await applyContext();return result};
    wrapped.__monthContextWrapped=true;
    window.financeNotificationsRefresh=wrapped;
    return true;
  }

  function init(){
    let tries=0;
    const ready=setInterval(()=>{tries++;if(wrapRefresh()){clearInterval(ready);schedule()}else if(tries>300)clearInterval(ready)},100);
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#profileNotificationBtn')){sessionVisibleKeys.clear();setTimeout(applyContext,120);return}
      const value=e.target?.value||'';
      if(/^\d{4}-\d{2}$/.test(String(value))&&selectedMonth()!==lastMonth)schedule();
    },true);
    document.addEventListener('change',e=>{
      const value=e.target?.value||'';
      if(/^\d{4}-\d{2}$/.test(String(value))&&selectedMonth()!==lastMonth)schedule();
    },true);
    window.financeNotificationsMonthContextRefresh=applyContext;
    window.financeMarkVisibleChargeNotificationsViewed=markVisibleChargesViewed;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();