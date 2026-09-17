(function(){
  if(window.__kpiCountupV1Loaded)return;
  window.__kpiCountupV1Loaded=true;

  const IDS=['kpiOpening','kpiIncome','kpiExpense','kpiInvoices','kpiClosing'];
  const START_DELAY=90;
  const STAGGER_MS=120;
  const DURATION_MS=550;
  let played=false;
  let pollTimer=0;
  let splashObserver=null;

  function reducedMotion(){
    try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}
  }

  function appVisible(){
    const app=document.getElementById('appRoot');
    return !!app&&!app.classList.contains('auth-hidden');
  }

  function parseMoney(text){
    let raw=String(text||'').trim();
    if(!raw||raw==='—')return null;
    const negative=/^-/.test(raw)||/^\(.*\)$/.test(raw);
    raw=raw.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
    const value=Number(raw);
    if(!Number.isFinite(value))return null;
    return negative?-Math.abs(value):value;
  }

  function formatMoney(value){
    try{
      if(typeof fmtMoney==='function')return fmtMoney(value);
    }catch(e){}
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  }

  function easeOutCubic(t){
    const p=Math.max(0,Math.min(1,t));
    return 1-Math.pow(1-p,3);
  }

  function animateValue(el,target,finalText,delay){
    setTimeout(()=>{
      const started=performance.now();
      const tick=now=>{
        const linear=Math.min(1,(now-started)/DURATION_MS);
        const eased=easeOutCubic(linear);
        const current=target*eased;
        el.textContent=linear>=1?finalText:formatMoney(current);
        if(linear<1)requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },delay);
  }

  function snapshot(){
    if(!appVisible())return null;
    const items=[];
    for(const id of IDS){
      const el=document.getElementById(id);
      if(!el)return null;
      const finalText=String(el.textContent||'').trim();
      const value=parseMoney(finalText);
      if(value===null)return null;
      items.push({el,value,finalText});
    }
    return items;
  }

  function run(){
    if(played||reducedMotion())return false;
    const items=snapshot();
    if(!items)return false;
    played=true;
    clearInterval(pollTimer);
    splashObserver?.disconnect();

    items.forEach(({el})=>{el.textContent=formatMoney(0)});
    items.forEach(({el,value,finalText},index)=>{
      animateValue(el,value,finalText,START_DELAY+index*STAGGER_MS);
    });
    return true;
  }

  function arm(){
    if(reducedMotion()||played)return;
    const body=document.body;
    if(!body)return;

    const tryRun=()=>{
      if(!body.classList.contains('caderno-splash-done'))return false;
      return run();
    };

    if(tryRun())return;

    splashObserver=new MutationObserver(()=>{
      if(body.classList.contains('caderno-splash-done')){
        setTimeout(()=>{
          if(run())splashObserver?.disconnect();
        },40);
      }
    });
    splashObserver.observe(body,{attributes:true,attributeFilter:['class']});

    pollTimer=setInterval(()=>{
      if(body.classList.contains('caderno-splash-done'))run();
    },80);
    setTimeout(()=>clearInterval(pollTimer),6000);
  }

  window.financeReplayKpiCountup=function(){
    played=false;
    arm();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm,{once:true});else arm();
})();
