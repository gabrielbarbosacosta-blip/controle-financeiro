(function(){
  if(window.__financeNotificationsMonthContextLoaded)return;
  window.__financeNotificationsMonthContextLoaded=true;

  let running=false;
  let lastMonth='';

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function selectedMonth(){
    try{return String(state?.settings?.selectedMonth||'').slice(0,7)}catch(e){return String(window.state?.settings?.selectedMonth||'').slice(0,7)}
  }
  function monthOf(entry){return String(entry?.date||'').slice(0,7)}
  function isPending(entry){const s=String(entry?.status||'').trim().toLowerCase();return !['pago','recebido'].includes(s)}
  function money(v){return typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)}

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

  function recomputeCounter(){
    const host=document.getElementById('notificationsList');
    if(!host)return;
    const cards=[...host.querySelectorAll('.notification-card')].filter(el=>el.style.display!=='none');
    const total=cards.length;
    const count=document.getElementById('notificationsCount');
    if(count)count.textContent=`${total} pendência${total===1?'':'s'}`;
    const bell=document.getElementById('profileNotificationBtn');
    if(bell){
      bell.classList.toggle('has-notifications',total>0);
      const badge=bell.querySelector('.notification-badge');
      if(badge)badge.textContent=total>9?'9+':String(total);
    }
  }

  async function applyContext(){
    const client=getSb(),host=document.getElementById('notificationsList'),month=selectedMonth();
    if(running||!client||!host)return;
    running=true;
    try{
      const {data,error}=await client.rpc('finance_shared_balances');
      if(error)throw error;
      const balances=data?.items||[];
      const aggregateCharges=balances.filter(b=>(Number(b.toReceive)||0)>0);
      const cards=[...host.querySelectorAll('.notification-card.charge')];
      cards.forEach((card,index)=>{
        const balance=aggregateCharges[index];
        if(!balance){card.style.display='none';return}
        const amount=monthReceive(balance,month);
        if(amount<=0){card.style.display='none';return}
        card.style.display='';
        const value=card.querySelector('.notification-value');
        if(value)value.textContent=money(amount);
        const meta=card.querySelector('.notification-meta');
        if(meta)meta.textContent=month?`Saldo pendente em ${monthLabel(month)}.`:'Há um saldo a receber ainda não quitado nos compartilhamentos.';
      });
      lastMonth=month;
      recomputeCounter();
    }catch(e){console.warn('Falha ao contextualizar notificações por mês.',e)}finally{running=false}
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
    document.addEventListener('click',e=>{if(e.target?.closest?.('#profileNotificationBtn'))schedule()},true);
    document.addEventListener('change',()=>{const month=selectedMonth();if(month!==lastMonth)schedule()},true);
    setInterval(()=>{const month=selectedMonth();if(month!==lastMonth)applyContext()},1000);
    window.financeNotificationsMonthContextRefresh=applyContext;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();