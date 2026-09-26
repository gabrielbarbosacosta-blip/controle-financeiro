const SUPABASE_URL='https://eqolnqnsyomgybyrtrzt.supabase.co';
const SUPABASE_KEY='sb_publishable_koTIgLL07Qe1Wf-ZY81LCA_0UO310ks';

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

const pad=n=>String(n).padStart(2,'0');
const normDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;
const monthDiff=(a,b)=>{const[ya,ma]=String(a).split('-').map(Number),[yb,mb]=String(b).split('-').map(Number);return(yb-ya)*12+(mb-ma)};
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const escapeText=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const fold=line=>{
  const out=[];let s=String(line);
  while(Buffer.byteLength(s,'utf8')>72){
    let cut=Math.min(60,s.length);
    while(cut>1&&Buffer.byteLength(s.slice(0,cut),'utf8')>72)cut--;
    out.push(s.slice(0,cut));s=' '+s.slice(cut);
  }
  out.push(s);return out.join('\r\n');
};
const toIcsDate=date=>String(date).replace(/-/g,'');
const addDays=(date,days=1)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const statusSettled=s=>!/pendente|aberta|fechada|não paga|nao paga/i.test(String(s||''));
function installmentAmount(p,index){
  const n=Math.max(1,Number(p.installments)||1),total=Math.round((Number(p.totalAmount)||0)*100),base=Math.floor(total/n),rem=total-base*n;
  return(base+(index<rem?1:0))/100;
}
function purchaseAllocation(p,ym){
  if(p.mode==='recorrente'){
    if(ym<p.firstInvoiceYm)return null;
    if(p.recurringEnd&&ym>p.recurringEnd)return null;
    return Number(p.totalAmount)||0;
  }
  const d=monthDiff(p.firstInvoiceYm,ym),n=Math.max(1,Number(p.installments)||1);
  if(!Number.isFinite(d)||d<0||d>=n)return null;
  return installmentAmount(p,d);
}
function invoiceTotal(state,cardId,ym){
  const purchases=(state.purchases||[]).filter(p=>p.cardId===cardId).reduce((sum,p)=>sum+(purchaseAllocation(p,ym)||0),0);
  const inv=(state.invoices||[]).find(i=>i.cardId===cardId&&i.ym===ym);
  return Math.round((purchases+(Number(inv?.adjustment)||0))*100)/100;
}
function invoiceDueDate(card,ym){
  const [y,m]=String(ym).split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate(),day=Math.min(last,Math.max(1,Number(card?.dueDay)||1));
  return `${y}-${pad(m)}-${pad(day)}`;
}
function eventBlock({uid,date,title,description,status,categories}){
  const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  return [
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}@prumo.finance`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${toIcsDate(date)}`,
    `DTEND;VALUE=DATE:${toIcsDate(addDays(date,1))}`,
    fold(`SUMMARY:${escapeText(title)}`),
    fold(`DESCRIPTION:${escapeText(description)}`),
    `STATUS:${statusSettled(status)?'CONFIRMED':'TENTATIVE'}`,
    categories?`CATEGORIES:${escapeText(categories)}`:'',
    'TRANSP:TRANSPARENT',
    'END:VEVENT'
  ].filter(Boolean).join('\r\n');
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).send('Method Not Allowed');}
  const token=String(req.query?.token||'').trim();
  const scope=['all','income','expense'].includes(String(req.query?.scope||''))?String(req.query.scope):'all';
  if(token.length<32)return res.status(401).send('Invalid calendar subscription');

  try{
    const feed=await rpc('finance_calendar_feed',{p_token:token});
    if(!feed?.ok)return res.status(401).send('Invalid or inactive calendar subscription');
    const state=feed.state||{},opt=feed.options||{};
    const items=[];

    if(opt.includeIncome!==false&&scope!=='expense'){
      for(const t of state.transactions||[]){
        if(t.type!=='Receita')continue;
        const date=normDate(t.date);if(!date)continue;
        if(opt.pendingOnly===true&&statusSettled(t.status))continue;
        const amount=opt.showAmount!==false?` — ${money(t.amount)}`:'';
        items.push(eventBlock({
          uid:`tx-${t.id}`,date,
          title:`↓ ${t.description||'Receita'}${amount}`,
          description:['Receita no Prumo',t.category?`Categoria: ${t.category}`:'',t.account?`Conta: ${t.account}`:'',t.status?`Status: ${t.status}`:''].filter(Boolean).join('\n'),
          status:t.status,categories:'Prumo,Receita'
        }));
      }
    }

    if(opt.includeExpenses!==false&&scope!=='income'){
      for(const t of state.transactions||[]){
        if(t.type!=='Despesa')continue;
        const date=normDate(t.date);if(!date)continue;
        if(opt.pendingOnly===true&&statusSettled(t.status))continue;
        const amount=opt.showAmount!==false?` — ${money(t.amount)}`:'';
        items.push(eventBlock({
          uid:`tx-${t.id}`,date,
          title:`↑ ${t.description||'Despesa'}${amount}`,
          description:['Despesa no Prumo',t.category?`Categoria: ${t.category}`:'',t.account?`Conta: ${t.account}`:'',t.status?`Status: ${t.status}`:''].filter(Boolean).join('\n'),
          status:t.status,categories:'Prumo,Despesa'
        }));
      }
    }

    if(opt.includeInvoices!==false&&scope!=='income'){
      for(const inv of state.invoices||[]){
        const card=(state.cards||[]).find(c=>c.id===inv.cardId);
        if(!card||card.active===false)continue;
        if(opt.pendingOnly===true&&statusSettled(inv.status))continue;
        const ym=String(inv.ym||'');if(!/^\d{4}-\d{2}$/.test(ym))continue;
        const date=invoiceDueDate(card,ym),total=invoiceTotal(state,inv.cardId,ym);
        const amount=opt.showAmount!==false?` — ${money(total)}`:'';
        items.push(eventBlock({
          uid:`invoice-${inv.id||inv.cardId+'-'+ym}`,date,
          title:`↑ Fatura ${card.name||'Cartão'}${amount}`,
          description:['Fatura no Prumo',card.account?`Conta: ${card.account}`:'',inv.status?`Status: ${inv.status}`:''].filter(Boolean).join('\n'),
          status:inv.status,categories:'Prumo,Fatura'
        }));
      }
    }

    const name=scope==='income'?'Prumo — Receitas':scope==='expense'?'Prumo — Despesas':'Prumo — Financeiro';
    const ics=[
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Prumo//Calendário Financeiro//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${name}`,
      'X-WR-TIMEZONE:America/Cuiaba',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...items,
      'END:VCALENDAR',
      ''
    ].join('\r\n');

    res.status(200);
    res.setHeader('Content-Type','text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="prumo-${scope}.ics"`);
    res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=300');
    return res.send(ics);
  }catch(error){
    console.error('Prumo calendar feed error:',error?.message||error);
    return res.status(500).send('Calendar temporarily unavailable');
  }
};
