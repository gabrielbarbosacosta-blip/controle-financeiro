(function(){
  if(window.__prumoChartStyleV1)return;
  window.__prumoChartStyleV1=true;

  const previous=window.drawLineChart;
  if(typeof previous!=='function')return;

  const money=v=>{
    if(typeof fmtMoney==='function')return fmtMoney(v);
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  };
  const compact=v=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(v)||0);

  function traceSmooth(ctx,pts){
    if(!pts.length)return;
    ctx.moveTo(pts[0].x,pts[0].y);
    if(pts.length===1)return;
    if(pts.length===2){ctx.lineTo(pts[1].x,pts[1].y);return}
    const tension=.18;
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i];
      const p1=pts[i];
      const p2=pts[i+1];
      const p3=pts[i+2]||p2;
      const cp1x=p1.x+(p2.x-p0.x)*tension;
      const cp1y=p1.y+(p2.y-p0.y)*tension;
      const cp2x=p2.x-(p3.x-p1.x)*tension;
      const cp2y=p2.y-(p3.y-p1.y)*tension;
      ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,p2.x,p2.y);
    }
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

  function render(id,data,hoverIndex=null){
    const canvas=document.getElementById(id);
    if(!canvas||!Array.isArray(data)||!data.length)return;

    const rect=canvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const W=Math.max(300,rect.width||700);
    const H=Math.max(220,rect.height||300);
    const p={l:62,r:22,t:22,b:44};

    canvas.width=Math.round(W*dpr);
    canvas.height=Math.round(H*dpr);
    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);

    const values=data.map(d=>Number(d?.value)||0);
    let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1}
    const rawRange=max-min||1;
    const pad=rawRange*.12;
    max+=pad;min-=pad;

    const plotW=W-p.l-p.r,plotH=H-p.t-p.b;
    const x=i=>p.l+plotW*(data.length<=1?.5:i/(data.length-1));
    const y=v=>p.t+plotH*(1-(v-min)/(max-min));
    const zeroY=y(0);
    const pts=data.map((d,i)=>({x:x(i),y:y(Number(d?.value)||0),value:Number(d?.value)||0,label:d?.label||''}));

    // grade discreta
    ctx.lineWidth=1;
    ctx.font='10px system-ui,-apple-system,sans-serif';
    ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){
      const val=min+(max-min)*i/4;
      const yy=y(val);
      ctx.strokeStyle='rgba(99,123,145,.14)';
      ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();
      ctx.fillStyle='rgba(160,177,194,.68)';
      ctx.fillText(compact(val),7,yy);
    }
    for(let i=0;i<pts.length;i++){
      if(data.length>12&&i%2!==0&&i!==pts.length-1)continue;
      ctx.strokeStyle='rgba(99,123,145,.075)';
      ctx.beginPath();ctx.moveTo(pts[i].x,p.t);ctx.lineTo(pts[i].x,H-p.b);ctx.stroke();
    }

    if(min<0&&max>0){
      ctx.save();
      ctx.setLineDash([4,5]);
      ctx.strokeStyle='rgba(166,184,200,.34)';
      ctx.beginPath();ctx.moveTo(p.l,zeroY);ctx.lineTo(W-p.r,zeroY);ctx.stroke();
      ctx.restore();
    }

    // preenchimento premium, separado por sinal
    const fillArea=(clipTop,clipBottom,topColor,bottomColor)=>{
      if(clipBottom<=clipTop)return;
      const gradient=ctx.createLinearGradient(0,clipTop,0,clipBottom);
      gradient.addColorStop(0,topColor);
      gradient.addColorStop(1,bottomColor);

      ctx.save();
      ctx.beginPath();
      ctx.rect(p.l,clipTop,plotW,clipBottom-clipTop);
      ctx.clip();

      ctx.beginPath();
      traceSmooth(ctx,pts);
      ctx.lineTo(pts[pts.length-1].x,zeroY);
      ctx.lineTo(pts[0].x,zeroY);
      ctx.closePath();
      ctx.fillStyle=gradient;
      ctx.fill();
      ctx.restore();
    };

    fillArea(p.t,Math.min(H-p.b,zeroY),'rgba(190,255,108,.28)','rgba(190,255,108,.025)');
    fillArea(Math.max(p.t,zeroY),H-p.b,'rgba(255,111,111,.02)','rgba(255,111,111,.24)');

    // glow e linha principal: verde positivo, vermelho negativo
    const strokeSegment=(clipTop,clipBottom,color,glow)=>{
      if(clipBottom<=clipTop)return;
      ctx.save();
      ctx.beginPath();ctx.rect(p.l-8,clipTop,plotW+16,clipBottom-clipTop);ctx.clip();

      ctx.beginPath();traceSmooth(ctx,pts);
      ctx.strokeStyle=glow;
      ctx.lineWidth=8;
      ctx.lineJoin='round';ctx.lineCap='round';
      ctx.shadowColor=color;ctx.shadowBlur=12;
      ctx.stroke();

      ctx.shadowBlur=0;
      ctx.beginPath();traceSmooth(ctx,pts);
      ctx.strokeStyle=color;
      ctx.lineWidth=3.2;
      ctx.stroke();
      ctx.restore();
    };

    strokeSegment(p.t,Math.min(H-p.b,zeroY),'#baff68','rgba(186,255,104,.12)');
    strokeSegment(Math.max(p.t,zeroY),H-p.b,'#ff7373','rgba(255,115,115,.10)');

    // labels do eixo X
    ctx.textBaseline='alphabetic';
    ctx.font='10px system-ui,-apple-system,sans-serif';
    ctx.fillStyle='rgba(188,203,217,.78)';
    pts.forEach((pt,i)=>{
      if(data.length>12&&i%2!==0&&i!==pts.length-1)return;
      ctx.save();
      ctx.translate(pt.x,H-14);
      ctx.rotate(-.28);
      ctx.fillText(String(pt.label),-16,0);
      ctx.restore();
    });

    // ponto final no estilo da referência
    const last=pts[pts.length-1];
    const lastColor=last.value<0?'#ff7373':'#baff68';
    ctx.save();
    ctx.shadowColor=lastColor;ctx.shadowBlur=16;
    ctx.fillStyle=lastColor;
    ctx.beginPath();ctx.arc(last.x,last.y,5.8,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#efffdc';ctx.lineWidth=1.8;ctx.stroke();
    ctx.restore();

    // hover + tooltip
    if(Number.isInteger(hoverIndex)&&hoverIndex>=0&&hoverIndex<pts.length){
      const pt=pts[hoverIndex];
      const color=pt.value<0?'#ff7373':'#baff68';

      ctx.save();
      ctx.strokeStyle='rgba(186,255,104,.32)';
      ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(pt.x,H-p.b);ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.shadowColor=color;ctx.shadowBlur=18;
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(pt.x,pt.y,6.5,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#07101d';ctx.beginPath();ctx.arc(pt.x,pt.y,3,0,Math.PI*2);ctx.fill();
      ctx.restore();

      const title=String(pt.label||'');
      const value=money(pt.value);
      ctx.font='11px system-ui,-apple-system,sans-serif';
      const tw=Math.max(ctx.measureText(title).width,ctx.measureText(value).width)+24;
      const th=48;
      let tx=pt.x-tw/2,ty=pt.y-th-18;
      tx=Math.max(p.l,Math.min(W-p.r-tw,tx));
      if(ty<p.t)ty=pt.y+16;

      ctx.save();
      ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=16;
      roundedRect(ctx,tx,ty,tw,th,10);
      ctx.fillStyle='rgba(8,18,31,.96)';ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(186,255,104,.26)';ctx.lineWidth=1;ctx.stroke();

      ctx.fillStyle='rgba(202,216,228,.78)';
      ctx.font='10px system-ui,-apple-system,sans-serif';
      ctx.fillText(title,tx+12,ty+18);
      ctx.fillStyle=color;
      ctx.font='700 12px system-ui,-apple-system,sans-serif';
      ctx.fillText(value,tx+12,ty+36);
      ctx.restore();
    }

    canvas.__prumoStyledChart={data,pts,p,W,H,render};
  }

  function bindPointer(canvas,id){
    if(canvas.__prumoStylePointerBound)return;
    canvas.__prumoStylePointerBound=true;
    canvas.style.cursor='crosshair';

    canvas.addEventListener('pointermove',event=>{
      const state=canvas.__prumoStyledChart;
      if(!state?.pts?.length)return;
      const rect=canvas.getBoundingClientRect();
      const px=event.clientX-rect.left;
      let best=0,dist=Infinity;
      state.pts.forEach((pt,i)=>{
        const d=Math.abs(pt.x-px);
        if(d<dist){dist=d;best=i}
      });
      render(id,state.data,best);
    });
    canvas.addEventListener('pointerleave',()=>{
      const state=canvas.__prumoStyledChart;
      if(state?.data)render(id,state.data,null);
    });
  }

  const styled=function(id,data){
    // preserva efeitos auxiliares de outros módulos (marcadores/overlays)
    try{previous.apply(this,arguments)}catch(_e){}
    render(id,data,null);
    const canvas=document.getElementById(id);
    if(canvas)bindPointer(canvas,id);
  };
  styled.__prumoPremiumChart=true;
  styled.__base=previous;

  window.drawLineChart=styled;
  try{drawLineChart=styled}catch(_e){}

  // redesenha gráficos visíveis já existentes
  requestAnimationFrame(()=>{
    try{
      if(typeof renderDashboard==='function')renderDashboard();
      if(document.getElementById('page-cards')?.classList.contains('active')&&typeof renderCards==='function')renderCards();
      if(document.getElementById('page-projection')?.classList.contains('active')&&typeof renderProjection==='function')renderProjection();
    }catch(error){console.error('prumo chart style refresh',error)}
  });
})();