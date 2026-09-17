(function(){
  if(window.__chartFirstLoadV1Loaded)return;
  window.__chartFirstLoadV1Loaded=true;

  const TARGET_ID='projectionChart';
  const STEP_MS=120;
  const SPEED_KEYS=[
    [0,.22],[.10,1.05],[.22,1.55],[.38,1.50],[.52,1.12],
    [.68,.62],[.84,.28],[.94,.14],[1,.18]
  ];
  const EASE_SAMPLES=240;
  let played=false;
  let active=false;
  let raf=0;
  let latestData=[];

  function reducedMotion(){
    try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}
  }

  function splashActive(){
    return !!document.body&&!document.body.classList.contains('caderno-splash-done');
  }

  function smoothstep(t){return t*t*(3-2*t)}

  function speedAt(t){
    const p=Math.max(0,Math.min(1,t));
    for(let i=0;i<SPEED_KEYS.length-1;i++){
      const a=SPEED_KEYS[i],b=SPEED_KEYS[i+1];
      if(p<=b[0]){
        const span=Math.max(.0001,b[0]-a[0]);
        const local=smoothstep((p-a[0])/span);
        return a[1]+(b[1]-a[1])*local;
      }
    }
    return SPEED_KEYS[SPEED_KEYS.length-1][1];
  }

  const easeTable=(()=>{
    const table=new Float64Array(EASE_SAMPLES+1);
    let total=0,prev=speedAt(0);
    for(let i=1;i<=EASE_SAMPLES;i++){
      const now=speedAt(i/EASE_SAMPLES);
      total+=(prev+now)/(2*EASE_SAMPLES);
      table[i]=total;
      prev=now;
    }
    if(total>0)for(let i=1;i<=EASE_SAMPLES;i++)table[i]/=total;
    table[EASE_SAMPLES]=1;
    return table;
  })();

  function velocityProgress(t){
    const clamped=Math.max(0,Math.min(1,t));
    if(clamped===1)return 1;
    const pos=clamped*EASE_SAMPLES,index=Math.floor(pos),fraction=pos-index;
    const a=easeTable[index],b=easeTable[Math.min(EASE_SAMPLES,index+1)];
    return a+(b-a)*fraction;
  }

  function geometry(canvas,data){
    const rect=canvas.getBoundingClientRect();
    const W=Math.max(300,rect.width||700),H=Math.max(210,rect.height||280),p={l:55,r:16,t:18,b:38};
    const vals=(data||[]).map(d=>Number(d.value)||0);
    let min=Math.min(0,...vals),max=Math.max(0,...vals);
    if(max===min){max+=1;min-=1}
    const pad=(max-min)*.08;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-((Number(v)||0)-min)/(max-min));
    return{W,H,p,min,max,x,y};
  }

  function prepare(canvas,data){
    const dpr=window.devicePixelRatio||1;
    const g=geometry(canvas,data);
    canvas.width=Math.round(g.W*dpr);canvas.height=Math.round(g.H*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    return{ctx,...g};
  }

  function drawStatic(canvas,data){
    const {ctx,W,H,p,min,max,x,y}=prepare(canvas,data);
    ctx.clearRect(0,0,W,H);
    ctx.lineWidth=1;ctx.font="10px 'DM Mono', monospace";ctx.textBaseline='middle';
    for(let i=0;i<=3;i++){
      const val=min+(max-min)*i/3,yy=y(val);
      ctx.strokeStyle='#23344b';ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();
      ctx.fillStyle='#718197';ctx.textAlign='right';ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),p.l-8,yy);
    }
    if(min<0&&max>0){ctx.strokeStyle='#647790';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    data.forEach((d,i)=>{
      if(data.length<=12||i%2===0){
        ctx.save();ctx.translate(x(i),H-13);ctx.rotate(-.28);ctx.fillStyle='#718197';ctx.font="9px 'DM Mono', monospace";ctx.textAlign='center';ctx.fillText(d.label,0,0);ctx.restore();
      }
    });
    return{ctx,W,H,p,min,max,x,y};
  }

  function drawLineProgress(canvas,data,progress){
    const {ctx,x,y}=drawStatic(canvas,data);
    if(!data.length)return;
    const segments=Math.max(1,data.length-1);
    const position=Math.max(0,Math.min(segments,progress*segments));
    const complete=Math.min(data.length-1,Math.floor(position));
    const fraction=Math.min(1,position-complete);

    ctx.strokeStyle='#65aaff';ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(x(0),y(data[0].value));
    for(let i=1;i<=complete;i++)ctx.lineTo(x(i),y(data[i].value));
    if(complete<data.length-1&&fraction>0){
      const x1=x(complete),y1=y(data[complete].value),x2=x(complete+1),y2=y(data[complete+1].value);
      ctx.lineTo(x1+(x2-x1)*fraction,y1+(y2-y1)*fraction);
    }
    ctx.stroke();

    for(let i=0;i<=complete;i++){
      const value=Number(data[i].value)||0;
      ctx.fillStyle=value<0?'#ed7773':'#65aaff';ctx.beginPath();ctx.arc(x(i),y(value),3.5,0,Math.PI*2);ctx.fill();
    }
  }

  function finish(){
    drawLineProgress(document.getElementById(TARGET_ID),latestData,1);
    active=false;window.__financeChartLineIntroActive=false;
    const data=latestData.slice();
    const current=window.drawLineChart;
    if(typeof current==='function'&&current!==wrapped)current(TARGET_ID,data);
    else if(typeof originalDraw==='function')originalDraw(TARGET_ID,data);
    try{window.financeRefreshChartTooltips?.()}catch(e){}
  }

  function start(canvas,data){
    if(played||active||!canvas||!Array.isArray(data)||!data.length)return false;
    played=true;latestData=data.slice();
    if(reducedMotion())return false;
    active=true;window.__financeChartLineIntroActive=true;
    drawLineProgress(canvas,latestData,0);
    const duration=Math.max(STEP_MS,STEP_MS*Math.max(1,latestData.length-1));
    const started=performance.now();
    const tick=now=>{
      if(!active)return;
      const linear=Math.min(1,(now-started)/duration);
      const progress=velocityProgress(linear);
      drawLineProgress(canvas,latestData,progress);
      if(linear<1)raf=requestAnimationFrame(tick);
      else finish();
    };
    raf=requestAnimationFrame(tick);
    return true;
  }

  const originalDraw=window.drawLineChart;
  const wrapped=function(id,data){
    if(id!==TARGET_ID||!Array.isArray(data)||!data.length||reducedMotion())return originalDraw.apply(this,arguments);
    const canvas=document.getElementById(id);
    latestData=data.slice();
    if(active)return;
    if(!played&&splashActive())return originalDraw.apply(this,arguments);
    if(!played&&start(canvas,data))return;
    return originalDraw.apply(this,arguments);
  };
  wrapped.__lineOnlyFirstLoad=true;
  if(typeof originalDraw==='function'){
    window.drawLineChart=wrapped;
    try{drawLineChart=wrapped}catch(e){}
  }

  function currentData(){
    try{
      const ym=state?.settings?.selectedMonth;
      if(!ym)return[];
      let rows=[];
      if(typeof window.getDashboardProjectionRows==='function')rows=window.getDashboardProjectionRows(ym);
      else if(typeof projectionFrom==='function')rows=projectionFrom(ym);
      return (rows||[]).map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing}));
    }catch(e){return[]}
  }

  function triggerIntro(){
    if(reducedMotion()||played||active)return false;
    const canvas=document.getElementById(TARGET_ID),data=currentData();
    const app=document.getElementById('appRoot');
    if(canvas&&data.length&&!app?.classList.contains('auth-hidden')&&canvas.getBoundingClientRect().width>40)return start(canvas,data);
    return false;
  }

  function boot(){
    if(reducedMotion()||splashActive())return;
    triggerIntro();
  }

  window.financeStartFirstLoadChart=triggerIntro;
  window.addEventListener('caderno:chart-intro-start',triggerIntro);

  window.financeReplayFirstLoadChart=function(){
    if(raf)cancelAnimationFrame(raf);
    active=false;played=false;window.__financeChartLineIntroActive=false;
    return triggerIntro();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
