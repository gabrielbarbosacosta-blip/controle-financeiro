(function(){
  if(window.PrunoChartEngine||window.PrumoChartEngine)return;

  const fmtCompact=v=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(v)||0);
  const fmtMoney=v=>{
    if(typeof window.fmtMoney==='function')return window.fmtMoney(v);
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  };

  function canvasFor(target){
    return typeof target==='string'?document.getElementById(target):target;
  }

  function roundedRect(ctx,x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function smoothPath(ctx,points){
    if(!points.length)return;
    ctx.moveTo(points[0].x,points[0].y);
    if(points.length===1)return;
    if(points.length===2){ctx.lineTo(points[1].x,points[1].y);return}
    for(let i=1;i<points.length-1;i++){
      const cur=points[i],next=points[i+1];
      const mx=(cur.x+next.x)/2,my=(cur.y+next.y)/2;
      ctx.quadraticCurveTo(cur.x,cur.y,mx,my);
    }
    ctx.lineTo(points[points.length-1].x,points[points.length-1].y);
  }

  function frame(canvas,values,opts={}){
    if(!canvas)return null;
    const rect=canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const W=Math.max(opts.minWidth||300,Math.round(rect.width||opts.fallbackWidth||700));
    const H=Math.max(opts.minHeight||220,Math.round(rect.height||opts.fallbackHeight||300));
    canvas.width=Math.round(W*dpr);
    canvas.height=Math.round(H*dpr);
    canvas.style.borderRadius=(opts.radius||18)+'px';
    canvas.dataset.prumoChartRenderer='unified3';
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);

    const p=opts.padding||{l:62,r:20,t:22,b:44};
    const yStep=Number(opts.yStep)||5000;
    const rawMin=Math.min(0,...values),rawMax=Math.max(0,...values);
    let min=Math.floor(rawMin/yStep)*yStep,max=Math.ceil(rawMax/yStep)*yStep;
    if(rawMin<0&&rawMin===min)min-=yStep;
    if(rawMax>0&&rawMax===max)max+=yStep;
    if(min===max){
      if(max===0)max=yStep;
      else{min-=yStep;max+=yStep}
    }

    const plotW=W-p.l-p.r,plotH=H-p.t-p.b;
    const y=v=>p.t+plotH*(1-(Number(v)-min)/(max-min));
    const zeroY=y(0),right=W-p.r,bottom=H-p.b;

    ctx.font='10px system-ui,-apple-system,sans-serif';
    ctx.textBaseline='middle';
    for(let val=min;val<=max+0.001;val+=yStep){
      const yy=y(val);
      ctx.strokeStyle='rgba(145,166,184,.12)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(right,yy);ctx.stroke();
      ctx.fillStyle='rgba(184,199,211,.72)';
      ctx.fillText(fmtCompact(val),8,yy);
    }
    if(min<0&&max>0){
      ctx.save();
      ctx.setLineDash([4,5]);
      ctx.strokeStyle='rgba(172,189,204,.35)';
      ctx.beginPath();ctx.moveTo(p.l,zeroY);ctx.lineTo(right,zeroY);ctx.stroke();
      ctx.restore();
    }
    return {ctx,W,H,p,min,max,y,zeroY,right,bottom};
  }

  function addXGrid(f,points,total){
    const {ctx,p,bottom}=f;
    points.forEach((pt,i)=>{
      if(i%3!==0)return;
      ctx.strokeStyle='rgba(145,166,184,.055)';
      ctx.beginPath();ctx.moveTo(pt.x,p.t);ctx.lineTo(pt.x,bottom);ctx.stroke();
    });
  }

  function drawLabels(f,points,total){
    const {ctx,H}=f;
    ctx.textBaseline='alphabetic';
    ctx.font='10px system-ui,-apple-system,sans-serif';
    ctx.fillStyle='rgba(191,205,216,.80)';
    points.forEach((pt,i)=>{
      if(i%3!==0)return;
      ctx.save();
      ctx.translate(pt.x,H-14);
      ctx.rotate(-.28);
      ctx.fillText(String(pt.label||''),-16,0);
      ctx.restore();
    });
  }

  function strokeSeries(ctx,points,color,width=4.5){
    if(!points.length)return;
    ctx.save();
    ctx.beginPath();smoothPath(ctx,points);
    ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    ctx.restore();
  }

  function drawSingle(target,data,opts={}){
    const canvas=canvasFor(target);
    if(!canvas||!Array.isArray(data)||!data.length)return null;
    const values=data.map(d=>Number(d?.value)||0);
    const f=frame(canvas,values,opts);
    if(!f)return null;
    const {ctx,W,H,p,y,zeroY,right,bottom}=f;
    const x=i=>p.l+(W-p.l-p.r)*(data.length<=1?.5:i/(data.length-1));
    const points=data.map((d,i)=>({x:x(i),y:y(Number(d?.value)||0),value:Number(d?.value)||0,label:String(d?.label||'')}));

    addXGrid(f,points,data.length);

    const fillRegion=(top,clipBottom,colorTop,colorBottom)=>{
      if(clipBottom<=top)return;
      const grad=ctx.createLinearGradient(0,top,0,clipBottom);
      grad.addColorStop(0,colorTop);grad.addColorStop(1,colorBottom);
      ctx.save();
      ctx.beginPath();ctx.rect(p.l,top,right-p.l,clipBottom-top);ctx.clip();
      ctx.beginPath();smoothPath(ctx,points);
      ctx.lineTo(points[points.length-1].x,zeroY);
      ctx.lineTo(points[0].x,zeroY);
      ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.restore();
    };

    fillRegion(p.t,Math.min(bottom,zeroY),'rgba(145,214,185,.30)','rgba(145,214,185,.025)');
    fillRegion(Math.max(p.t,zeroY),bottom,'rgba(239,138,129,.025)','rgba(239,138,129,.26)');

    const clipStroke=(top,clipBottom,color)=>{
      if(clipBottom<=top)return;
      ctx.save();ctx.beginPath();ctx.rect(p.l-10,top,right-p.l+20,clipBottom-top);ctx.clip();
      strokeSeries(ctx,points,color,4.5);
      ctx.restore();
    };
    clipStroke(p.t,Math.min(bottom,zeroY),opts.positiveColor||'#91d6b9');
    clipStroke(Math.max(p.t,zeroY),bottom,opts.negativeColor||'#ef8a81');

    // Visual point markers are hidden; point coordinates remain available for hover tooltips.

    drawLabels(f,points,data.length);

    if(opts.showLastBadge!==false){
      const last=points[points.length-1];
      const color=last.value<0?(opts.negativeColor||'#ef8a81'):(opts.positiveColor||'#91d6b9');
      const boxW=Math.max(94,Math.min(150,36+String(last.label||'').length*5.4)),boxH=42;
      let bx=last.x-boxW/2,by=last.y-boxH-18;
      bx=Math.max(p.l,Math.min(W-p.r-boxW,bx));if(by<p.t)by=last.y+16;
      ctx.save();ctx.shadowColor='rgba(0,0,0,.42)';ctx.shadowBlur=14;
      roundedRect(ctx,bx,by,boxW,boxH,9);ctx.fillStyle='rgba(7,17,29,.94)';ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle='rgba(145,214,185,.24)';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='rgba(184,199,211,.72)';ctx.font='9px system-ui,-apple-system,sans-serif';ctx.fillText(last.label,bx+10,by+16);
      ctx.fillStyle=color;ctx.font='700 11px system-ui,-apple-system,sans-serif';ctx.fillText(fmtMoney(last.value),bx+10,by+32);
      ctx.restore();
    }

    return {canvas,points,frame:f};
  }

  function drawComparison(target,series,opts={}){
    const canvas=canvasFor(target);
    const valid=(Array.isArray(series)?series:[]).filter(s=>Array.isArray(s?.data)&&s.data.length);
    if(!canvas||!valid.length)return null;
    const values=valid.flatMap(s=>s.data.map(d=>Number(d?.value)||0));
    const f=frame(canvas,values,{...opts,padding:opts.padding||{l:68,r:22,t:24,b:48}});
    if(!f)return null;
    const {ctx,W,H,p,y,zeroY,right,bottom}=f;
    const count=Math.max(...valid.map(s=>s.data.length));
    const x=i=>p.l+(W-p.l-p.r)*(count<=1?.5:i/(count-1));
    const rendered=valid.map((s,si)=>{
      const points=s.data.map((d,i)=>({x:x(i),y:y(Number(d?.value)||0),value:Number(d?.value)||0,label:String(d?.label||''),series:s.name||''}));
      return {...s,points,color:s.color||(si===valid.length-1?'#91d6b9':'#7f90a4')};
    });

    addXGrid(f,rendered[0].points,count);

    const focus=rendered[rendered.length-1];
    if(focus?.fill!==false){
      const positive=ctx.createLinearGradient(0,p.t,0,Math.max(p.t,zeroY));
      positive.addColorStop(0,'rgba(145,214,185,.20)');positive.addColorStop(1,'rgba(145,214,185,.015)');
      ctx.save();ctx.beginPath();ctx.rect(p.l,p.t,right-p.l,Math.max(0,Math.min(bottom,zeroY)-p.t));ctx.clip();
      ctx.beginPath();smoothPath(ctx,focus.points);ctx.lineTo(focus.points.at(-1).x,zeroY);ctx.lineTo(focus.points[0].x,zeroY);ctx.closePath();ctx.fillStyle=positive;ctx.fill();ctx.restore();
    }

    rendered.forEach((s,si)=>{
      strokeSeries(ctx,s.points,s.color,si===rendered.length-1?4.5:2.8);
      // Visual point markers are hidden; point coordinates remain available for hover tooltips.
    });

    drawLabels(f,rendered[0].points,count);
    return {canvas,series:rendered,points:rendered.flatMap(s=>s.points),frame:f};
  }

  window.PrumoChartEngine={version:'20260926-unified9',drawSingle,drawComparison};
})();