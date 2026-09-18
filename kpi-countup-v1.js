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
  let valueObserver=null;
  let prepared=false;
  const targets=new Map();

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

  function elementsReady(){
    if(!appVisible())return null;
    const list=IDS.map(id=>document.getElementById(id));
    return list.every(Boolean)?list:null;
  }

  function captureAndZero(){
    if(reducedMotion()||played)return false;
    const elements=elementsReady();
    if(!elements)return false;

    let captured=0;
    for(const el of elements){
      const text=String(el.textContent||'').trim();
      const value=parseMoney(text);
      if(value===null)continue;

      const existing=targets.get(el.id);
      const zeroText=formatMoney(0);
      const looksLikeOurZero=prepared&&value===0&&text===zeroText;
      if(!looksLikeOurZero){
        targets.set(el.id,{value,finalText:text});
        captured++;
      }else if(!existing){
        targets.set(el.id,{value:0,finalText:text});
      }
    }

    if(targets.size!==IDS.length)return captured>0;

    prepared=true;
    for(const el of elements){
      const zeroText=formatMoney(0);
      if(el.textContent!==zeroText)el.textContent=zeroText;
    }
    return true;
  }

  function keepPreparedDuringSplash(){
    const body=document.body;
    if(!body||body.classList.contains('caderno-splash-done')||played||reducedMotion())return;
    captureAndZero();
  }

  function run(){
    if(played||reducedMotion())return false;
    const elements=elementsReady();
    if(!elements)return false;

    if(targets.size!==IDS.length)captureAndZero();
    if(targets.size!==IDS.length)return false;

    played=true;
    clearInterval(pollTimer);
    splashObserver?.disconnect();
    valueObserver?.disconnect();

    elements.forEach(el=>{el.textContent=formatMoney(0)});
    elements.forEach((el,index)=>{
      const target=targets.get(el.id);
      animateValue(el,target.value,target.finalText,START_DELAY+index*STAGGER_MS);
    });
    return true;
  }

  function arm(){
    if(reducedMotion()||played)return;
    const body=document.body;
    if(!body)return;

    const grid=document.querySelector('#page-dashboard .grid-kpi');
    if(grid&&!valueObserver){
      valueObserver=new MutationObserver(()=>{
        if(!body.classList.contains('caderno-splash-done'))keepPreparedDuringSplash();
      });
      valueObserver.observe(grid,{childList:true,subtree:true,characterData:true});
    }

    keepPreparedDuringSplash();

    const tryRun=()=>{
      if(!body.classList.contains('caderno-splash-done'))return false;
      return run();
    };

    if(tryRun())return;

    splashObserver=new MutationObserver(()=>{
      if(body.classList.contains('caderno-splash-done')){
        if(run())splashObserver?.disconnect();
      }else keepPreparedDuringSplash();
    });
    splashObserver.observe(body,{attributes:true,attributeFilter:['class']});

    pollTimer=setInterval(()=>{
      if(body.classList.contains('caderno-splash-done'))run();
      else keepPreparedDuringSplash();
    },50);
    setTimeout(()=>clearInterval(pollTimer),6000);
  }

  const GOAL_IDS=['goalKpiSaved','goalKpiTarget','goalKpiRemaining','goalKpiMonthly'];
  let goalAnimationTimer=0;
  let goalAnimating=false;
  let goalLastSignature='';

  function goalElementsReady(){
    const page=document.getElementById('page-goals');
    if(!page||!page.classList.contains('active'))return null;
    const list=GOAL_IDS.map(id=>document.getElementById(id));
    return list.every(Boolean)?list:null;
  }

  function animateGoalKpis(){
    if(reducedMotion()||goalAnimating)return false;
    const elements=goalElementsReady();
    if(!elements)return false;

    const values=elements.map(el=>{
      const text=String(el.textContent||'').trim();
      return{text,value:parseMoney(text)};
    });
    if(values.some(item=>item.value===null))return false;

    const signature=values.map(item=>item.text).join('|');
    if(signature===goalLastSignature)return false;

    goalAnimating=true;
    goalLastSignature=signature;
    elements.forEach(el=>{el.textContent=formatMoney(0)});
    elements.forEach((el,index)=>{
      const target=values[index];
      animateValue(el,target.value,target.text,START_DELAY+index*STAGGER_MS);
    });

    clearTimeout(goalAnimationTimer);
    goalAnimationTimer=setTimeout(()=>{goalAnimating=false},START_DELAY+(elements.length-1)*STAGGER_MS+DURATION_MS+80);
    return true;
  }

  function scheduleGoalKpis(){
    clearTimeout(goalAnimationTimer);
    goalAnimationTimer=setTimeout(()=>{
      goalAnimating=false;
      animateGoalKpis();
    },0);
  }

  window.financeAnimateGoalKpis=scheduleGoalKpis;
  window.addEventListener('finance:goals-kpis-rendered',scheduleGoalKpis);
  document.addEventListener('click',e=>{
    if(!e.target?.closest?.('[data-page="goals"]'))return;
    setTimeout(scheduleGoalKpis,120);
  },true);

  window.financeReplayKpiCountup=function(){
    played=false;
    prepared=false;
    targets.clear();
    valueObserver?.disconnect();valueObserver=null;
    arm();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm,{once:true});else arm();
})();
