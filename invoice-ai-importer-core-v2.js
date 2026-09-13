(function(){
  window.__invoiceAiUiLoaded=true;
  if(window.__invoiceAiImporterCoreV2)return;
  window.__invoiceAiImporterCoreV2=true;
  const AUTO=.82;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const cents=v=>Math.round((Number(v)||0)*100);
  const sig=(r,c,m)=>[c,m,r.date||'',norm(r.description),cents(r.amount)].join('|');
  function marker(signature){let h=2166136261;for(let i=0;i<signature.length;i++){h^=signature.charCodeAt(i);h=Math.imul(h,16777619)}return`[AI:${(h>>>0).toString(36)}]`}
  function similar(a,b){
    const x=norm(a),y=norm(b);if(!x||!y)return false;if(x===y)return true;
    const A=new Set(x.split(' ').filter(t=>t.length>1)),B=new Set(y.split(' ').filter(t=>t.length>1));let n=0;A.forEach(t=>{if(B.has(t))n++});
    return n/Math.max(A.size||1,B.size||1)>=.72;
  }
  function existing(cardId,ym){try{return invoiceItems(cardId,ym).map(x=>({p:x.purchase,a:Number(x.alloc?.amount)||0}))}catch{return[]}}
  function classify(rows,cardId,ym){
    const ex=existing(cardId,ym),used=new Set();
    return (rows||[]).map((r,i)=>{
      const signature=sig(r,cardId,ym),tag=marker(signature);
      let k=ex.findIndex((e,j)=>!used.has(j)&&cents(e.a)===cents(r.amount)&&(String(e.p?.notes||'').includes(tag)||e.p?.aiInvoiceImport?.signature===signature));
      if(k<0&&r.date)k=ex.findIndex((e,j)=>!used.has(j)&&cents(e.a)===cents(r.amount)&&e.p?.date===r.date&&similar(e.p?.description,r.description));
      if(k>=0){used.add(k);return{row:r,index:i,status:'duplicate',signature,marker:tag}}
      return{row:r,index:i,status:Number(r.confidence)>=AUTO&&r.date?'automatic':'review',signature,marker:tag};
    });
  }
  window.invoiceAiImporterCore={classify,marker};
})();
