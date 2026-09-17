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

  function geometry(canvas,data){
    const rect=canvas.getBoundingClientRect(),W=Math.max(300,rect.width||700),H=Math.max(210,rect.height||280),p={l:55,r:16,t:18,b:38};
    const vals=(data||[]).map(d=>Number(d.value)||0);
    let min=Math.min(0,...vals),max=Math.max(0,...vals);
    if(max===min){max+=1;min-=1}
    const pad=(max-min)*.08;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-((Number(v)||0)-min)/(max-min));
    return{W,H,p,min,max,x,y};
  }

  function pointsFor(canvas,data,series){
    const {x,y}=geometry(canvas,data);
    return data.map((d,i)=>({x:x(i),y:y(d.value),label:d.label,value:Number(d.value)||0,series}));
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

  function attach(id,data){
    const canvas=document.getElementById(id);
    if(!canvas||!Array.isArray(data)||!data.length)return;
    const series=id==='cardProjectionChart'?'Fatura projetada':id==='projectionChart'||id==='projectionChartLarge'?'Saldo projetado':'Valor';
    requestAnimationFrame(()=>{
      if(id==='projectionChart')alignEventMarkers(canvas,data);
      bind(canvas,pointsFor(canvas,data,series));
    });
  }

  const originalDraw=window.drawLineChart;
  if(typeof originalDraw==='function'&&!originalDraw.__cadernoTooltipOnly){
    const wrapped=function(id,data){
      const result=originalDraw.apply(this,arguments);
      const lineIntroActive=id==='projectionChart'&&window.__financeChartLineIntroActive===true;
      if(!lineIntroActive)attach(id,data);
      return result;
    };
    wrapped.__cadernoTooltipOnly=true;
    wrapped.__cadernoBaseRenderer=originalDraw;
    window.drawLineChart=wrapped;try{drawLineChart=wrapped}catch(e){}
  }

  window.financeRefreshChartTooltips=function(){
    try{
      const ym=state?.settings?.selectedMonth;
      if(!ym||typeof projectionFrom!=='function')return;
      const data=projectionFrom(ym).map(r=>({label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,value:r.closing}));
      attach('projectionChart',data);
    }catch(e){}
  };

  requestAnimationFrame(()=>{
    try{if(typeof window.redrawFilteredProjection==='function')window.redrawFilteredProjection();else if(typeof renderDashboard==='function')renderDashboard()}catch(e){console.error('chart refresh',e)}
  });
})();
