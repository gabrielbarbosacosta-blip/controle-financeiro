(function(){
  if(window.__cadernoDarkV2Loaded)return;
  window.__cadernoDarkV2Loaded=true;
  const VERSION='20260916-dark3';

  function inject(){
    if(!document.getElementById('caderno-figma-dark-v2')){
      const link=document.createElement('link');
      link.id='caderno-figma-dark-v2';
      link.rel='stylesheet';
      link.href=`figma-caderno-dark-v2.css?v=${VERSION}`;
      document.head.appendChild(link);
    }
    if(!document.getElementById('caderno-remove-duplicate-profile')){
      const style=document.createElement('style');
      style.id='caderno-remove-duplicate-profile';
      style.textContent='.caderno-profile{display:none!important}';
      document.head.appendChild(style);
    }
    document.documentElement.classList.add('caderno-dark');
  }

  function drawDarkChart(id,data){
    const canvas=document.getElementById(id);if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,cssW=Math.max(300,rect.width||700),cssH=Math.max(210,rect.height||280);
    canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const W=cssW,H=cssH,p={l:55,r:16,t:18,b:38},vals=data.map(d=>Number(d.value)||0);
    let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min){max+=1;min-=1}const pad=(max-min)*.08;max+=pad;min-=pad;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1)),y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    ctx.clearRect(0,0,W,H);ctx.lineWidth=1;ctx.font="10px 'DM Mono', monospace";ctx.textBaseline='middle';
    for(let i=0;i<=3;i++){
      const val=min+(max-min)*i/3,yy=y(val);ctx.strokeStyle='#23344b';ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillStyle='#718197';ctx.textAlign='right';ctx.fillText(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val),p.l-8,yy);
    }
    if(min<0&&max>0){ctx.strokeStyle='#647790';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.l,y(0));ctx.lineTo(W-p.r,y(0));ctx.stroke()}
    ctx.strokeStyle='#65aaff';ctx.lineWidth=2.3;ctx.beginPath();data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
    data.forEach((d,i)=>{const xx=x(i),yy=y(d.value);ctx.fillStyle=Number(d.value)<0?'#ed7773':'#65aaff';ctx.beginPath();ctx.arc(xx,yy,3.5,0,Math.PI*2);ctx.fill();if(data.length<=12||i%2===0){ctx.save();ctx.translate(xx,H-13);ctx.rotate(-.28);ctx.fillStyle='#718197';ctx.font="9px 'DM Mono', monospace";ctx.textAlign='center';ctx.fillText(d.label,0,0);ctx.restore()}});
  }

  function patchCharts(){
    try{window.drawLineChart=drawDarkChart;drawLineChart=drawDarkChart}catch(e){window.drawLineChart=drawDarkChart}
    try{if(typeof renderDashboard==='function')renderDashboard();if(typeof renderProjection==='function')renderProjection()}catch(e){}
  }

  function restyleStatusSelects(){
    document.querySelectorAll('.history-status-select').forEach(select=>{
      const v=String(select.value||'').toLowerCase();
      let c={bg:'#111f31',border:'#2c4058',text:'#dbe5f1'};
      if(['pago','recebido','paga'].includes(v))c={bg:'#102a20',border:'#28513e',text:'#a5e2c8'};
      else if(v==='pendente')c={bg:'#2a2213',border:'#5a4824',text:'#ead38f'};
      else if(v.includes('aguardando'))c={bg:'#10243a',border:'#275073',text:'#abd5f3'};
      else if(v.includes('não paga')||v.includes('nao paga'))c={bg:'#2b171b',border:'#623039',text:'#f2a29c'};
      select.style.background=c.bg;select.style.border=`1px solid ${c.border}`;select.style.color=c.text;
    });
  }

  function boot(){
    inject();
    setTimeout(patchCharts,120);setTimeout(patchCharts,900);
    restyleStatusSelects();
    new MutationObserver(()=>restyleStatusSelects()).observe(document.body,{childList:true,subtree:true});
    document.getElementById('monthSelect')?.addEventListener('change',()=>setTimeout(patchCharts,20));
    window.addEventListener('resize',()=>setTimeout(patchCharts,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
