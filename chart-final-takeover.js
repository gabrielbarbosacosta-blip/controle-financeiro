(function(){
  if(window.__prumoFinalChartTakeover)return;
  window.__prumoFinalChartTakeover=true;

  function finalDrawLineChart(id,data){
    if(window.PrumoChartEngine?.drawSingle){
      return window.PrumoChartEngine.drawSingle(id,data,{showLastBadge:true});
    }
    return null;
  }
  finalDrawLineChart.__prumoFinalChart=true;

  window.drawLineChart=finalDrawLineChart;
  try{drawLineChart=finalDrawLineChart}catch(_e){}
  window.__prumoChartRendererVersion='finalchart1';

  function safeRedraw(){
    try{
      const ym=window.state?.settings?.selectedMonth;
      if(!ym)return;

      const dashboardCanvas=document.getElementById('projectionChart');
      if(dashboardCanvas){
        let rows=[];
        if(typeof window.getDashboardProjectionRows==='function'){
          rows=window.getDashboardProjectionRows(ym);
        }else if(typeof window.projectionFrom==='function'){
          rows=window.projectionFrom(ym);
        }else if(typeof projectionFrom==='function'){
          rows=projectionFrom(ym);
        }
        if(Array.isArray(rows)&&rows.length){
          finalDrawLineChart('projectionChart',rows.map(r=>({
            label:typeof window.fmtMonth==='function'?window.fmtMonth(r.ym):(typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym),
            value:Number(r.closing)||0
          })));
        }
      }

      const largeCanvas=document.getElementById('projectionChartLarge');
      if(largeCanvas){
        let rows=[];
        if(typeof window.projectionFrom==='function')rows=window.projectionFrom(ym);
        else if(typeof projectionFrom==='function')rows=projectionFrom(ym);
        if(Array.isArray(rows)&&rows.length){
          finalDrawLineChart('projectionChartLarge',rows.map(r=>({
            label:typeof window.fmtMonth==='function'?window.fmtMonth(r.ym):(typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym),
            value:Number(r.closing)||0
          })));
        }
      }

      const cardCanvas=document.getElementById('cardProjectionChart');
      if(cardCanvas){
        const cardId=window.selectedCardId||(typeof selectedCardId!=='undefined'?selectedCardId:null);
        if(cardId&&typeof cardForecast==='function'&&typeof ymAdd==='function'){
          const rows=[];
          for(let i=0;i<12;i++){
            const m=ymAdd(ym,i),f=cardForecast(cardId&&typeof getCard==='function'?getCard(cardId):null,m);
            if(f)rows.push({ym:m,...f});
          }
          if(rows.length){
            finalDrawLineChart('cardProjectionChart',rows.map(r=>({
              label:typeof fmtMonth==='function'?fmtMonth(r.ym):r.ym,
              value:Number(r.total)||0
            })));
          }
        }
      }
    }catch(error){
      console.error('final chart takeover redraw',error);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      requestAnimationFrame(()=>requestAnimationFrame(safeRedraw));
      setTimeout(safeRedraw,250);
    },{once:true});
  }else{
    requestAnimationFrame(()=>requestAnimationFrame(safeRedraw));
    setTimeout(safeRedraw,250);
  }

  window.addEventListener('resize',()=>{
    clearTimeout(window.__prumoFinalChartResizeTimer);
    window.__prumoFinalChartResizeTimer=setTimeout(safeRedraw,120);
  });
})();