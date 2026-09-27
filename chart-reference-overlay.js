(function(){
  if(window.__prumoChartReferenceOverlay)return;
  window.__prumoChartReferenceOverlay=true;

  const base=window.drawLineChart;
  if(typeof base!=='function')return;

  function smoothPath(ctx,pts){
    if(!pts.length)return;
    ctx.moveTo(pts[0].x,pts[0].y);
    if(pts.length===1)return;
    if(pts.length===2){ctx.lineTo(pts[1].x,pts[1].y);return}
    const t=.18;
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      ctx.bezierCurveTo(
        p1.x+(p2.x-p0.x)*t,
        p1.y+(p2.y-p0.y)*t,
        p2.x-(p3.x-p1.x)*t,
        p2.y-(p3.y-p1.y)*t,
        p2.x,p2.y
      );
    }
  }

  function overlay(id,data){
    const canvas=document.getElementById(id);
    if(!canvas||!Array.isArray(data)||!data.length)return;

    const rect=canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const W=Math.max(300,rect.width||700),H=Math.max(220,rect.height||300);
    const p={l:62,r:18,t:20,b:42};
    const values=data.map(d=>Number(d?.value)||0);

    let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1}
    const pad=(max-min)*.1;max+=pad;min-=pad;

    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+(H-p.t-p.b)*(1-(v-min)/(max-min));
    const zeroY=y(0),bottom=H-p.b,right=W-p.r;
    const pts=data.map((d,i)=>({x:x(i),y:y(Number(d?.value)||0),value:Number(d?.value)||0}));

    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);

    function fillRegion(top,bottomClip,colorTop,colorBottom){
      if(bottomClip<=top)return;
      const gradient=ctx.createLinearGradient(0,top,0,bottomClip);
      gradient.addColorStop(0,colorTop);
      gradient.addColorStop(1,colorBottom);

      ctx.save();
      ctx.beginPath();ctx.rect(p.l,top,right-p.l,bottomClip-top);ctx.clip();
      ctx.beginPath();smoothPath(ctx,pts);
      ctx.lineTo(pts[pts.length-1].x,zeroY);
      ctx.lineTo(pts[0].x,zeroY);
      ctx.closePath();
      ctx.fillStyle=gradient;
      ctx.fill();
      ctx.restore();
    }

    fillRegion(p.t,Math.min(bottom,zeroY),'rgba(186,255,104,.30)','rgba(186,255,104,.025)');
    fillRegion(Math.max(p.t,zeroY),bottom,'rgba(255,115,115,.025)','rgba(255,115,115,.26)');

    function strokeRegion(top,bottomClip,color){
      if(bottomClip<=top)return;
      ctx.save();
      ctx.beginPath();ctx.rect(p.l-10,top,right-p.l+20,bottomClip-top);ctx.clip();

      ctx.beginPath();smoothPath(ctx,pts);
      ctx.strokeStyle=color;
      ctx.lineWidth=7;
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.globalAlpha=.16;
      ctx.shadowColor=color;ctx.shadowBlur=14;
      ctx.stroke();

      ctx.beginPath();smoothPath(ctx,pts);
      ctx.globalAlpha=1;
      ctx.shadowBlur=8;
      ctx.strokeStyle=color;
      ctx.lineWidth=3;
      ctx.stroke();
      ctx.restore();
    }

    strokeRegion(p.t,Math.min(bottom,zeroY),'#baff68');
    strokeRegion(Math.max(p.t,zeroY),bottom,'#ff7373');

    const last=pts[pts.length-1],lastColor=last.value<0?'#ff7373':'#baff68';
    ctx.save();
    ctx.shadowColor=lastColor;ctx.shadowBlur=14;
    ctx.fillStyle=lastColor;
    ctx.beginPath();ctx.arc(last.x,last.y,5.5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.6;ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  const wrapped=function(id,data){
    const result=base.apply(this,arguments);
    try{overlay(id,data)}catch(error){console.error('prumo chart reference overlay',error)}
    return result;
  };
  wrapped.__prumoReferenceOverlay=true;
  wrapped.__base=base;
  window.drawLineChart=wrapped;
  try{drawLineChart=wrapped}catch(_e){}

  requestAnimationFrame(()=>{
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-cards')?.classList.contains('active')&&typeof renderCards==='function')renderCards();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
    }catch(error){console.error('prumo chart overlay refresh',error)}
  });
})();