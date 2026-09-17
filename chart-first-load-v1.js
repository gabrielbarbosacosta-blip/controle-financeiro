(function(){
  if(window.__chartFirstLoadV1Loaded)return;
  window.__chartFirstLoadV1Loaded=true;

  const TARGET_ID='projectionChart';
  const MONTHS=12;
  const STEP_MS=120;
  const MAX_WAIT_MS=12000;
  let played=false;
  let timer=null;

  function reducedMotion(){
    try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}
  }

  function showImmediately(canvas){
    if(!canvas)return;
    canvas.style.clipPath='';
    canvas.style.webkitClipPath='';
    canvas.style.transition='';
    canvas.classList.remove('chart-first-load-drawing');
    canvas.dataset.firstLoadChartDone='1';
  }

  function boundaryFor(canvas,index){
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(300,rect.width||300);
    const left=62;
    const right=18;
    const plot=Math.max(1,width-left-right);
    const x=left+plot*(MONTHS<=1?.5:index/(MONTHS-1));
    return Math.min(width,Math.max(left,x+7));
  }

  function reveal(canvas,index){
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(300,rect.width||300);
    const boundary=boundaryFor(canvas,index);
    const hiddenRight=Math.max(0,width-boundary);
    const clip=`inset(0 ${hiddenRight}px 0 0)`;
    canvas.style.clipPath=clip;
    canvas.style.webkitClipPath=clip;
  }

  function animate(canvas){
    if(played||!canvas)return;
    played=true;
    if(reducedMotion()){
      showImmediately(canvas);
      return;
    }

    canvas.classList.add('chart-first-load-drawing');
    canvas.style.transition=`clip-path ${Math.max(70,STEP_MS-30)}ms linear`;
    reveal(canvas,0);

    let month=0;
    const next=()=>{
      month+=1;
      if(month>=MONTHS){
        reveal(canvas,MONTHS-1);
        setTimeout(()=>showImmediately(canvas),STEP_MS+20);
        return;
      }
      reveal(canvas,month);
      timer=setTimeout(next,STEP_MS);
    };
    timer=setTimeout(next,STEP_MS);
  }

  function chartReady(canvas){
    if(!canvas)return false;
    const app=document.getElementById('appRoot');
    if(app?.classList.contains('auth-hidden'))return false;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<40||rect.height<40)return false;
    // O canvas padrão nasce em 300x150. O gráfico real redefine a altura para >=220px.
    return Number(canvas.height)>160;
  }

  function waitForFirstChart(startedAt){
    const canvas=document.getElementById(TARGET_ID);
    if(chartReady(canvas)){
      requestAnimationFrame(()=>animate(canvas));
      return;
    }
    if(Date.now()-startedAt>=MAX_WAIT_MS){
      showImmediately(canvas);
      return;
    }
    setTimeout(()=>waitForFirstChart(startedAt),45);
  }

  function boot(){
    const canvas=document.getElementById(TARGET_ID);
    if(canvas&&!reducedMotion()){
      // Evita que um gráfico já desenhado pisque inteiro antes do início da revelação.
      canvas.style.clipPath='inset(0 100% 0 0)';
      canvas.style.webkitClipPath='inset(0 100% 0 0)';
    }
    waitForFirstChart(Date.now());
  }

  window.financeReplayFirstLoadChart=function(){
    const canvas=document.getElementById(TARGET_ID);
    if(timer)clearTimeout(timer);
    played=false;
    if(canvas){
      delete canvas.dataset.firstLoadChartDone;
      requestAnimationFrame(()=>animate(canvas));
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
