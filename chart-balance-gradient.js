(function(){
  if(window.__chartBalanceGradientRuntime)return;
  window.__chartBalanceGradientRuntime=true;

  const base=window.drawLineChart;
  if(typeof base!=='function')return;

  function paintBalanceGradient(id,data){
    const canvas=document.getElementById(id);
    if(!canvas||!Array.isArray(data)||!data.length)return;

    const rect=canvas.getBoundingClientRect();
    const W=Math.max(300,rect.width||700);
    const H=Math.max(220,rect.height||300);
    const p={l:62,r:18,t:20,b:42};
    const values=data.map(d=>Number(d?.value)||0);

    let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1}
    const pad=(max-min)*.1;
    max+=pad;min-=pad;

    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    const zeroY=y(0);
    const plotBottom=H-p.b;
    const plotRight=W-p.r;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;

    const fillSide=(clipTop,clipBottom,gradient)=>{
      if(clipBottom<=clipTop)return;
      ctx.save();
      ctx.globalCompositeOperation='destination-over';
      ctx.beginPath();
      ctx.rect(p.l,clipTop,plotRight-p.l,clipBottom-clipTop);
      ctx.clip();

      ctx.beginPath();
      data.forEach((d,i)=>{
        const xx=x(i),yy=y(Number(d?.value)||0);
        if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      });
      ctx.lineTo(x(data.length-1),zeroY);
      ctx.lineTo(x(0),zeroY);
      ctx.closePath();
      ctx.fillStyle=gradient;
      ctx.fill();
      ctx.restore();
    };

    const positive=ctx.createLinearGradient(0,p.t,0,Math.max(p.t,zeroY));
    positive.addColorStop(0,'rgba(72,187,120,0.46)');
    positive.addColorStop(.55,'rgba(72,187,120,0.24)');
    positive.addColorStop(1,'rgba(72,187,120,0.055)');

    const negative=ctx.createLinearGradient(0,Math.min(plotBottom,zeroY),0,plotBottom);
    negative.addColorStop(0,'rgba(239,68,68,0.055)');
    negative.addColorStop(.45,'rgba(239,68,68,0.24)');
    negative.addColorStop(1,'rgba(239,68,68,0.46)');

    fillSide(p.t,Math.min(plotBottom,zeroY),positive);
    fillSide(Math.max(p.t,zeroY),plotBottom,negative);
  }

  const wrapped=function(id,data){
    const result=base.apply(this,arguments);
    try{paintBalanceGradient(id,data)}catch(error){console.error('chart balance gradient',error)}
    return result;
  };
  wrapped.__balanceGradientRuntime=true;
  wrapped.__base=base;

  window.drawLineChart=wrapped;
  try{drawLineChart=wrapped}catch(_e){}
})();