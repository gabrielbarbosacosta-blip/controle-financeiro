const crypto=require('crypto');

const SUPABASE_URL='https://eqolnqnsyomgybyrtrzt.supabase.co';
const SUPABASE_KEY='sb_publishable_koTIgLL07Qe1Wf-ZY81LCA_0UO310ks';
const CATEGORIES=new Set(['Moradia','Educação','Alimentação','Transporte','Saúde','Lazer','Assinaturas','Eletrônicos','Compras','Serviços','Investimentos','Dívidas','Salário','Extra','Outros']);

function send(res,status,body){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  return res.json(body);
}

function bearer(req){
  const value=String(req.headers.authorization||'');
  const match=value.match(/^Bearer\s+(.+)$/i);
  return match?match[1].trim():'';
}

async function rpc(name,args){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify(args),
    signal:AbortSignal.timeout(15000)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload?.message||payload?.error||`Supabase RPC ${name} failed`);
  return payload;
}

const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const cents=v=>Math.round((Number(v)||0)*100);
const monthDiff=(a,b)=>{const[ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)};
function installmentAmount(p,index){const n=Math.max(1,Number(p.installments)||1),total=cents(p.totalAmount),base=Math.floor(total/n),rem=total-base*n;return(base+(index<rem?1:0))/100}
function allocation(p,ym){
  if(p.mode==='recorrente'){if(ym<p.firstInvoiceYm)return null;if(p.recurringEnd&&ym>p.recurringEnd)return null;return Number(p.totalAmount)||0}
  const d=monthDiff(p.firstInvoiceYm,ym),n=Math.max(1,Number(p.installments)||1);if(!Number.isFinite(d)||d<0||d>=n)return null;return installmentAmount(p,d)
}
function similarity(a,b){
  const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;
  const A=new Set(x.split(' ').filter(t=>t.length>1)),B=new Set(y.split(' ').filter(t=>t.length>1));let common=0;A.forEach(t=>{if(B.has(t))common++});
  return common/Math.max(A.size||1,B.size||1);
}
function daysApart(a,b){
  const x=Date.parse(`${a}T12:00:00Z`),y=Date.parse(`${b}T12:00:00Z`);return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/86400000:999;
}
function fingerprint(cardId,ym,row){
  return crypto.createHash('sha256').update([cardId,ym,row.date,norm(row.description),cents(row.amount)].join('|')).digest('hex');
}
function sanitizeRow(row){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date||''))?String(row.date):null;
  const description=String(row?.description||'').trim().replace(/\s+/g,' ').slice(0,180);
  const amount=Math.round(Math.abs(Number(row?.amount)||0)*100)/100;
  const category=CATEGORIES.has(row?.category)?row.category:'Compras';
  const installmentCurrent=Number.isInteger(Number(row?.installmentCurrent))&&Number(row.installmentCurrent)>0?Number(row.installmentCurrent):null;
  const installmentTotal=Number.isInteger(Number(row?.installmentTotal))&&Number(row.installmentTotal)>0?Number(row.installmentTotal):null;
  const note=String(row?.note||'').trim().replace(/\s+/g,' ').slice(0,240);
  if(!date||description.length<2||amount<=0||amount>10000000)return null;
  return{date,description,amount,category,installmentCurrent,installmentTotal,note};
}
function resolveCard(state,cardId,cardName){
  if(cardId){const exact=state.cards.find(c=>c.id===cardId);if(exact)return{card:exact};}
  const q=norm(cardName);if(!q)return{error:'card_required'};
  const matches=state.cards.filter(c=>norm(c.name)===q||norm(c.account)===q||norm(c.name).includes(q)||q.includes(norm(c.name)));
  if(matches.length===1)return{card:matches[0]};
  if(matches.length>1)return{error:'card_ambiguous',matches:matches.map(c=>({id:c.id,name:c.name,account:c.account||''}))};
  return{error:'card_not_found',matches:state.cards.map(c=>({id:c.id,name:c.name,account:c.account||''}))};
}
function evaluate(state,card,invoiceYm,rows,forcePossibleDuplicates=false){
  const existing=state.purchases.filter(p=>p.cardId===card.id).map(p=>({p,amount:allocation(p,invoiceYm)})).filter(x=>x.amount!=null);
  const added=[],duplicates=[],possibleDuplicates=[],rejected=[];
  for(const raw of rows.slice(0,500)){
    const row=sanitizeRow(raw);if(!row){rejected.push({description:String(raw?.description||''),reason:'invalid_purchase'});continue}
    const fp=fingerprint(card.id,invoiceYm,row);
    const exact=existing.find(x=>x.p?.chatgptImport?.fingerprint===fp||(cents(x.amount)===cents(row.amount)&&x.p.date===row.date&&similarity(x.p.description,row.description)>=.72));
    if(exact){duplicates.push({date:row.date,description:row.description,amount:row.amount});continue}
    const possible=existing.find(x=>cents(x.amount)===cents(row.amount)&&similarity(x.p.description,row.description)>=.72&&daysApart(x.p.date,row.date)<=3);
    if(possible&&!forcePossibleDuplicates){possibleDuplicates.push({date:row.date,description:row.description,amount:row.amount,existing:{date:possible.p.date,description:possible.p.description,amount:possible.amount}});continue}
    const parcel=row.installmentCurrent&&row.installmentTotal?`Parcela ${row.installmentCurrent}/${row.installmentTotal}.`:'';
    const importedAt=new Date().toISOString();
    const purchase={
      id:`cgpt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      cardId:card.id,
      date:row.date,
      description:row.description,
      category:row.category,
      mode:'parcelada',
      totalAmount:row.amount,
      installments:1,
      firstInvoiceYm:invoiceYm,
      recurringEnd:null,
      notes:[row.note,parcel,`Importado pelo ChatGPT para a fatura ${invoiceYm}.`].filter(Boolean).join(' '),
      chatgptImport:{source:'chatgpt_action',fingerprint:fp,invoiceYm,importedAt,installmentCurrent:row.installmentCurrent,installmentTotal:row.installmentTotal}
    };
    added.push(purchase);existing.push({p:purchase,amount:row.amount});
  }
  return{added,duplicates,possibleDuplicates,rejected};
}
function invoiceTotal(state,cardId,ym){
  const purchases=state.purchases.filter(p=>p.cardId===cardId).reduce((sum,p)=>sum+(allocation(p,ym)||0),0);
  const inv=state.invoices.find(i=>i.cardId===cardId&&i.ym===ym);
  return Math.round((purchases+(Number(inv?.adjustment)||0))*100)/100;
}

module.exports=async function handler(req,res){
  const token=bearer(req);if(!token)return send(res,401,{error:'authentication_required'});
  try{
    if(req.method==='GET'){
      const cloud=await rpc('chatgpt_get_finance_state',{p_token:token});
      if(!cloud?.ok)return send(res,401,{error:cloud?.error||'unauthorized'});
      const state=cloud.state;
      return send(res,200,{selectedMonth:state?.settings?.selectedMonth||null,cards:(state?.cards||[]).map(c=>({id:c.id,name:c.name,account:c.account||'',dueDay:c.dueDay||null,closingDay:c.closingDay||null,active:c.active!==false}))});
    }
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(res,405,{error:'method_not_allowed'});}
    const body=req.body||{},invoiceYm=String(body.invoiceYm||'');
    if(!/^\d{4}-\d{2}$/.test(invoiceYm))return send(res,400,{error:'invalid_invoice_month'});
    if(!Array.isArray(body.purchases)||!body.purchases.length)return send(res,400,{error:'purchases_required'});
    const dryRun=body.dryRun===true;
    for(let attempt=0;attempt<3;attempt++){
      const cloud=await rpc('chatgpt_get_finance_state',{p_token:token});
      if(!cloud?.ok)return send(res,401,{error:cloud?.error||'unauthorized'});
      const state=cloud.state;
      const resolved=resolveCard(state,String(body.cardId||''),String(body.cardName||''));
      if(resolved.error)return send(res,resolved.error==='card_ambiguous'?409:404,resolved);
      const card=resolved.card;
      const result=evaluate(state,card,invoiceYm,body.purchases,body.forcePossibleDuplicates===true);
      const preview={card:{id:card.id,name:card.name,account:card.account||''},invoiceYm,newPurchases:result.added.map(p=>({date:p.date,description:p.description,amount:p.totalAmount,category:p.category})),added:result.added.length,duplicates:result.duplicates,possibleDuplicates:result.possibleDuplicates,rejected:result.rejected,currentInvoiceTotal:invoiceTotal(state,card.id,invoiceYm),statementTotal:Number.isFinite(Number(body.statementTotal))?Number(body.statementTotal):null};
      if(dryRun||!result.added.length)return send(res,200,{ok:true,dryRun,...preview});
      const next={...state,purchases:[...(state.purchases||[]),...result.added]};
      const write=await rpc('chatgpt_put_finance_state',{p_token:token,p_state:next,p_expected_updated_at:cloud.updatedAt});
      if(write?.ok)return send(res,200,{ok:true,dryRun:false,...preview,currentInvoiceTotal:invoiceTotal(next,card.id,invoiceYm),updatedAt:write.updatedAt});
      if(write?.error!=='conflict')return send(res,500,{error:write?.error||'save_failed'});
    }
    return send(res,409,{error:'concurrent_update_retry'});
  }catch(error){
    console.error('ChatGPT finance bridge error:',error?.message||error);
    return send(res,500,{error:'server_error',message:error?.message||'Falha ao processar a fatura.'});
  }
};
