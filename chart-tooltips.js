(function(){
  if(window.__financialChartTooltipsLoaded)return;
  window.__financialChartTooltipsLoaded=true;

  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

  function tooltipFor(canvas){
    const host=canvas?.parentElement;if(!host)return null;
    host.style.position='relative';
    let tip=host.querySelector(':scope > .financial-chart-tooltip');
    if(!tip){
      tip=document.createElement('div');
      tip.className='financial-chart-tooltip';
      tip.style.cssText='display:none;position:absolute;z-index:30;pointer-events:none;min-width:120px;padding:7px 9px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.28);white-space:nowrap;transform:translate(-50%,-100%)';
      host.appendChild(tip);
    }
    return tip;
  }

  function bind(canvas,points){
    if(!canvas||!Array.isArray(points)||!points.length)return;
    canvas.__financialTooltipPoints=points;
    const tip=tooltipFor(canvas);if(!tip)return;
    if(canvas.__financialTooltipBound)return;
    canvas.__financialTooltipBound=true;
    canvas.addEventListener('mousemove',e=>{
      const list=canvas.__financialTooltipPoints||[],rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
      let nearest=null,best=Infinity;
      for(const pt of list){const dist=Math.hypot(mx-pt.x,my-pt.y);if(dist<best){best=dist;nearest=pt}}
      if(!nearest||best>14){tip.style.display='none';canvas.style.cursor='default';return}
      tip.innerHTML=`<strong>${nearest.series||'Valor'}</strong><br><span style="color:#94a3b8">${nearest.label||''}</span><br>${money(nearest.value)}`;
      tip.style.left=`${canvas.offsetLeft+nearest.x}px`;tip.style.top=`${canvas.offsetTop+nearest.y-8}px`;tip.style.display='block';canvas.style.cursor='pointer';
    });
    canvas.addEventListener('mouseleave',()=>{tip.style.display='none';canvas.style.cursor='default'});
  }
  window.bindFinancialChartTooltip=bind;

  function bounds(data,zeroAnchored){
    const vals=(data||[]).map(d=>Number(d.value)||0);
    if(!vals.length)return{min:0,max:1};
    const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
    let min,max;
    if(zeroAnchored&&rawMin>=0){
      min=0;max=rawMax||1;max+=Math.max(1,(max-min)*.1);
    }else if(zeroAnchored&&rawMax<=0){
      max=0;min=rawMin||-1;min-=Math.max(1,(max-min)*.1);
    }else{
      min=Math.min(0,...vals);max=Math.max(0,...vals);
      if(max===min){max+=1;min-=1}
      const pad=(max-min)*.1;max+=pad;min-=pad;
    }
    return{min,max};
  }

  function geometry(canvas,data){
    const rect=canvas.getBoundingClientRect(),W=Math.max(300,rect.width||700),H=Math.max(220,rect.height||300),p={l:62,r:18,t:20,b:42};
    const {min,max}=bounds(data,canvas.id==='projectionChart');
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-((Number(v)||0)-min)/(max-min));
    return{W,H,p,min,max,x,y};
  }

  function pointsFor(canvas,data,series){
    const {x,y}=geometry(canvas,data);
    return data.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:Number(d.value)||0,series}));
  }

  function redrawDashboard(canvas,data){
    if(!canvas||!data?.length)return;
    const dpr=window.devicePixelRatio||1,{W,H,p,min,max,x,y}=geometry(canvas,data);
    canvas.width=W*dpr;canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='#273449';ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const val=min+(max-min)*i/4,yy=y(val);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),5,yy+4);
    }
    if(min<0&&max>0){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    ctx.strokeStyle='#60a5fa';ctx.lineWidth=3;ctx.beginPath();
    data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
    data.forEach((d,i)=>{
      const xx=x(i),yy=y(d.value);ctx.fillStyle=(Number(d.value)||0)<0?'#ef4444':'#3b82f6';ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill();
      if(data.length<=12||i%2===0){ctx.save();ctx.translate(xx,H-13);ctx.rotate(-.35);ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';ctx.fillText(d.label,-16,0);ctx.restore()}
    });
  }

  function alignEventMarkers(canvas,data){
    const layer=canvas?.parentElement?.querySelector(':scope > .projection-vertex-event-layer');if(!layer||!data?.length)return;
    const {x,y}=geometry(canvas,data);
    [...layer.children].forEach(marker=>{
      const left=parseFloat(marker.style.left);if(!Number.isFinite(left))return;
      let idx=0,best=Infinity;data.forEach((_,i)=>{const d=Math.abs(x(i)-left);if(d<best){best=d;idx=i}});
      marker.style.top=`${y(data[idx].value)-16}px`;
    });
  }

  const originalDraw=window.drawLineChart;
  if(typeof originalDraw==='function'&&!originalDraw.__zeroAnchoredDashboard){
    const wrapped=function(id,data){
      const result=originalDraw.apply(this,arguments),canvas=document.getElementById(id);
      const lineIntroActive=id==='projectionChart'&&window.__financeChartLineIntroActive===true;
      if(canvas&&id==='projectionChart'&&Array.isArray(data)&&data.length&&!lineIntroActive){redrawDashboard(canvas,data);alignEventMarkers(canvas,data)}
      if(canvas&&Array.isArray(data)&&data.length&&!lineIntroActive){
        const series=id==='cardProjectionChart'?'Fatura projetada':id==='projectionChart'||id==='projectionChartLarge'?'Saldo projetado':'Valor';
        requestAnimationFrame(()=>{if(id==='projectionChart'){alignEventMarkers(canvas,data)}bind(canvas,pointsFor(canvas,data,series))});
      }
      return result;
    };
    wrapped.__zeroAnchoredDashboard=true;
    window.drawLineChart=wrapped;try{drawLineChart=wrapped}catch(e){}
  }

  requestAnimationFrame(()=>{
    try{if(typeof window.redrawFilteredProjection==='function')window.redrawFilteredProjection();else if(typeof renderDashboard==='function')renderDashboard()}catch(e){console.error('chart refresh',e)}
  });
})();
