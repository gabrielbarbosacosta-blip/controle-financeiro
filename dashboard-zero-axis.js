(function(){
  if(window.__dashboardZeroAxisRequested)return;
  window.__dashboardZeroAxisRequested=true;

  function bounds(data){
    const vals=(data||[]).map(d=>Number(d.value)||0);
    if(!vals.length)return{min:0,max:1};
    const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
    let min,max;
    if(rawMin>=0){
      min=0;max=rawMax;
      if(max===0)max=1;
      max+=Math.max(1,(max-min)*0.10);
    }else if(rawMax<=0){
      max=0;min=rawMin;
      if(min===0)min=-1;
      min-=Math.max(1,(max-min)*0.10);
    }else{
      min=rawMin;max=rawMax;
      const pad=Math.max(1,(max-min)*0.10);
      min-=pad;max+=pad;
    }
    return{min,max};
  }

  function geometry(canvas,data){
    const rect=canvas.getBoundingClientRect();
    const W=Math.max(300,rect.width||700),H=Math.max(220,rect.height||300),p={l:62,r:18,t:20,b:42};
    const {min,max}=bounds(data);
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-((Number(v)||0)-min)/(max-min));
    return{W,H,p,min,max,x,y};
  }

  function redraw(canvas,data){
    if(!canvas||!Array.isArray(data)||!data.length)return;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const {W,H,p,min,max,x,y}=geometry(canvas,data);
    canvas.width=W*dpr;canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const val=min+(max-min)*i/4,yy=y(val);
      ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();
      ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4);
    }
    if(min<0&&max>0){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    ctx.strokeStyle='#60a5fa';ctx.lineWidth=3;ctx.beginPath();
    data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
    data.forEach((d,i)=>{
      const xx=x(i),yy=y(d.value);ctx.fillStyle=(Number(d.value)||0)<0?'#ef4444':'#3b82f6';ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill();
      if(data.length<=12||i%2===0){ctx.save();ctx.translate(xx,H-13);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore()}
    });
  }

  function repositionEventMarkers(canvas,data){
    const host=canvas?.parentElement,layer=host?.querySelector(':scope > .projection-vertex-event-layer');
    if(!layer||!data?.length)return;
    const {x,y}=geometry(canvas,data);
    [...layer.children].forEach(marker=>{
      const left=parseFloat(marker.style.left);
      if(!Number.isFinite(left))return;
      let idx=0,best=Infinity;
      data.forEach((_,i)=>{const dist=Math.abs(x(i)-left);if(dist<best){best=dist;idx=i}});
      marker.style.top=`${y(data[idx].value)-16}px`;
    });
  }

  function refreshTooltip(canvas,data){
    if(typeof window.bindFinancialChartTooltip!=='function')return;
    const {x,y}=geometry(canvas,data);
    const points=data.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:Number(d.value)||0,series:'Saldo projetado'}));
    window.bindFinancialChartTooltip(canvas,points);
  }

  function install(){
    if(!window.__financialChartTooltipsLoaded||typeof window.drawLineChart!=='function')return false;
    const base=window.drawLineChart;
    if(base.__dashboardZeroAxis)return true;
    const wrapped=function(id,data){
      const result=base.apply(this,arguments);
      if(id==='projectionChart'&&Array.isArray(data)&&data.length){
        const canvas=document.getElementById(id);
        if(canvas){
          redraw(canvas,data);
          repositionEventMarkers(canvas,data);
          requestAnimationFrame(()=>{
            repositionEventMarkers(canvas,data);
            refreshTooltip(canvas,data);
          });
        }
      }
      return result;
    };
    wrapped.__dashboardZeroAxis=true;
    window.drawLineChart=wrapped;
    try{drawLineChart=wrapped}catch(e){}
    setTimeout(()=>{try{if(typeof window.redrawFilteredProjection==='function')window.redrawFilteredProjection();else if(typeof renderDashboard==='function')renderDashboard()}catch(e){console.error('dashboard zero axis refresh',e)}},0);
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>200)clearInterval(timer)},100);
  }
})();
