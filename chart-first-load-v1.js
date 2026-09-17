(function(){
  if(window.__chartFirstLoadV1Loaded)return;
  window.__chartFirstLoadV1Loaded=true;

  const TARGET_ID='projectionChart';
  const STEP_MS=78;
  const SPEED_KEYS=[[0,.22],[.10,1.05],[.22,1.55],[.38,1.50],[.52,1.12],[.68,.62],[.84,.28],[.94,.14],[1,.18]];
  const EASE_SAMPLES=240;
  let played=false,active=false,raf=0,latestData=[],frame=null;

  function reducedMotion(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
  function splashActive(){return !!document.body&&!document.body.classList.contains('caderno-splash-done')}
  function smoothstep(t){return t*t*(3-2*t)}
  function speedAt(t){
    const p=Math.max(0,Math.min(1,t));
    for(let i=0;i<SPEED_KEYS.length-1;i++){
      const a=SPEED_KEYS[i],b=SPEED_KEYS[i+1];
      if(p<=b[0]){const span=Math.max(.0001,b[0]-a[0]),local=smoothstep((p-a[0])/span);return a[1]+(b[1]-a[1])*local}
    }
    return SPEED_KEYS[SPEED_KEYS.length-1][1];
  }
  const easeTable=(()=>{
    const table=new Float64Array(EASE_SAMPLES+1);let total=0,prev=speedAt(0);
    for(let i=1;i<=EASE_SAMPLES;i++){const now=speedAt(i/EASE_SAMPLES);total+=(prev+now)/(2*EASE_SAMPLES);table[i]=total;prev=now}
    if(total>0)for(let i=1;i<=EASE_SAMPLES;i++)table[i]/=total;
    table[EASE_SAMPLES]=1;return table;
  })();
  function velocityProgress(t){
    const clamped=Math.max(0,Math.min(1,t));if(clamped===1)return 1;
    const pos=clamped*EASE_SAMPLES,index=Math.floor(pos),fraction=pos-index,a=easeTable[index],b=easeTable[Math.min(EASE_SAMPLES,index+1)];
    return a+(b-a)*fraction;
  }

  function geometry(canvas,data){
    const rect=canvas.getBoundingClientRect(),W=Math.max(300,rect.width||700),H=Math.max(210,rect.height||280),p={l:55,r:16,t:18,b:38};
    const vals=(data||[]).map(d=>Number(d.value)||0);let min=Math.min(0,...vals),max=Math.max(0,...vals);
    if(max===min){max+=1;min-=1}const pad=(max-min)*.08;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-((Number(v)||0)-min)/(max-min));
    return{W,H,p,min,max,x,y};
  }

  function buildFrame(canvas,data){
    const dpr=window.devicePixelRatio||1,g=geometry(canvas,data);
    canvas.width=Math.round(g.W*dpr);canvas.height=Math.round(g.H*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
    const bg=layer.getContext('2d');bg.setTransform(dpr,0,0,dpr,0,0);
    bg.clearRect(0,0,g.W,g.H);bg.lineWidth=1;bg.font="10px 'DM Mono', monospace";bg.textBaseline='middle';
    for(let i=0;i<=3;i++){
      const val=g.min+(g.max-g.min)*i/3,yy=g.y(val);
      bg.strokeStyle='#23344b';bg.beginPath();bg.moveTo(g.p.l,yy);bg.lineTo(g.W-g.p.r,yy);bg.stroke();
      bg.fillStyle='#718197';bg.textAlign='right';bg.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),g.p.l-8,yy);
    }
    if(g.min<0&&g.max>0){bg.strokeStyle='#647790';bg.lineWidth=1.2;bg.beginPath();bg.moveTo(g.p.l,g.y(0));bg.lineTo(g.W-g.p.r,g.y(0));bg.stroke()}
    data.forEach((d,i)=>{
      if(data.length<=12||i%2===0){bg.save();bg.translate(g.x(i),g.H-13);bg.rotate(-.28);bg.fillStyle='#718197';bg.font="9px 'DM Mono', monospace";bg.textAlign='center';bg.fillText(d.label,0,0);bg.restore()}
    });
    return{canvas,ctx,layer,dpr,...g};
  }

  function restoreStatic(f){
    const ctx=f.ctx;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,f.canvas.width,f.canvas.height);ctx.drawImage(f.layer,0,0);ctx.restore();
  }

  function drawLineProgress(f,data,progress){
    if(!f||!data.length)return;restoreStatic(f);
    const {ctx,x,y}=f,segments=Math.max(1,data.length-1),position=Math.max(0,Math.min(segments,progress*segments));
    const complete=Math.min(data.length-1,Math.floor(position)),fraction=Math.min(1,position-complete);
    ctx.strokeStyle='#65aaff';ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x(0),y(data[0].value));
    for(let i=1;i<=complete;i++)ctx.lineTo(x(i),y(data[i].value));
    if(complete<data.length-1&&fraction>0){const x1=x(complete),y1=y(data[complete].value),x2=x(complete+1),y2=y(data[complete+1].value);ctx.lineTo(x1+(x2-x1)*fraction,y1+(y2-y1)*fraction)}
    ctx.stroke();
    for(let i=0;i<=complete;i++){const value=Number(data[i].value)||0;ctx.fillStyle=value<0?'#ed7773':'#65aaff';ctx.beginPath();ctx.arc(x(i),y(value),3.5,0,Math.PI*2);ctx.fill()}
  }

  function finish(){
    drawLineProgress(frame,latestData,1);active=false;window.__financeChartLineIntroActive=false;
    try{window.financeRefreshChartTooltips?.()}catch(e){}
    frame=null;
  }

  function start(canvas,data){
    if(played||active||!canvas||!Array.isArray(data)||!data.length)return false;
    played=true;latestData=data.slice();if(reducedMotion())return false;
    active=true;window.__financeChartLineIntroActive=true;frame=buildFrame(canvas,latestData);drawLineProgress(frame,latestData,0);
    const duration=Math.max(STEP_MS,STEP_MS*Math.max(1,latestData.length-1)),started=performance.now();
    const tick=now=>{
      if(!active)return;
      const linear=Math.min(1,(now-started)/duration),progress=velocityProgress(linear);drawLineProgress(frame,latestData,progress);
      if(linear<1)raf=requestAnimationFrame(tick);else finish();
    };
    raf=requestAnimationFrame(tick);return true;
  }

  const originalDraw=window.drawLineChart;
  const wrapped=function(id,data){
    if(id!==TARGET_ID||!Array.isArray(data)||!data.length||reducedMotion())return originalDraw.apply(this,arguments);
    const canvas=document.getElementById(id);latestData=data.slice();if(active)return;
    if(!played&&splashActive())return originalDraw.apply(this,arguments);
    if(!played&&start(canvas,data))return;
    return originalDraw.apply(this,arguments);
  };
  wrapped.__lineOnlyFirstLoad=true;
  if(typeof originalDraw==='function'){window.drawLineChart=wrapped;try{drawLineChart=wrapped}catch(e){}}

  function currentData(){
    try{
      const ym=state?.settings?.selectedMonth;if(!ym)return[];let rows=[];
      if(typeof window.getDashboardProjectionRows==='function')rows=window.getDashboardProjectionRows(ym);else if(typeof projectionFrom==='function')rows=projectionFrom(ym);
      return(rows||[]).map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing}));
    }catch(e){return[]}
  }
  function triggerIntro(){
    if(reducedMotion()||played||active)return false;
    const canvas=document.getElementById(TARGET_ID),data=currentData(),app=document.getElementById('appRoot');
    if(canvas&&data.length&&!app?.classList.contains('auth-hidden')&&canvas.getBoundingClientRect().width>40)return start(canvas,data);
    return false;
  }
  function boot(){if(reducedMotion()||splashActive())return;triggerIntro()}

  window.financeStartFirstLoadChart=triggerIntro;
  window.addEventListener('caderno:chart-intro-start',triggerIntro);
  window.financeReplayFirstLoadChart=function(){if(raf)cancelAnimationFrame(raf);active=false;played=false;frame=null;window.__financeChartLineIntroActive=false;return triggerIntro()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
