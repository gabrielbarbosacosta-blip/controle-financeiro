(function(){
  if(window.__sharedBalancesDetailLoaded)return;
  window.__sharedBalancesDetailLoaded=true;

  const STYLE_ID='shared-balances-detail-style';
  const BUCKET='profile-photos';
  const AVATAR_TTL_MS=50*60*1000;
  const avatarCache=new Map();
  let loading=false;
  let lastSignature='';
  let internalRender=false;
  let refreshScheduled=false;
  let lastSelectedMonth='';
  let lastRows=[];
  let settling=false;

  function getSb(){try{return sb}catch(e){return window.sb||null}}
  function getUserId(){try{return currentUser?.id||''}catch(e){return window.currentUser?.id||''}}
  function getSelectedMonth(){
    try{
      const value=state?.settings?.selectedMonth||window.state?.settings?.selectedMonth||'';
      if(/^\d{4}-\d{2}$/.test(String(value)))return String(value);
    }catch(e){}
    const candidates=['#monthSelect','#selectedMonth','#projectionMonth','#historyMonth','input[type="month"]'];
    for(const selector of candidates){
      const el=document.querySelector(selector),value=el?.value||'';
      if(/^\d{4}-\d{2}$/.test(String(value)))return String(value);
    }
    const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  function dateLabel(v){try{return typeof fmtDate==='function'?fmtDate(v):String(v||'')}catch(e){return String(v||'')}}
  function monthLabel(ym){
    try{if(typeof fmtMonth==='function')return fmtMonth(ym)}catch(e){}
    if(!/^\d{4}-\d{2}$/.test(String(ym)))return String(ym||'');
    const [y,m]=String(ym).split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));
  }
  function initials(name){const p=String(name||'P').trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||'P')+(p[1]?.[0]||'')).toUpperCase()}

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #sharedBalances.shared-balances-detailed{display:grid;gap:12px}
      .shared-month-context{padding:10px 12px;border:1px solid #243449;border-radius:11px;background:#101d2e;color:#94a3b8;font-size:11px;margin-bottom:2px}.shared-month-context strong{color:#e2e8f0}
      .shared-balance-board{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
      .shared-balance-column{min-width:0;border:1px solid #23334a;border-radius:14px;background:#0b1424;overflow:hidden}
      .shared-balance-column-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:14px;border-bottom:1px solid #22344b;background:#0d1929}
      .shared-balance-column-kicker{font-size:9px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#71839a}
      .shared-balance-column-title{font-size:15px;font-weight:850;color:#edf3f9;margin-top:3px;letter-spacing:-.02em}
      .shared-balance-column-total{font-size:18px;font-weight:900;white-space:nowrap;letter-spacing:-.025em}
      .shared-balance-column.receive .shared-balance-column-total{color:#91d6b9}
      .shared-balance-column.pay .shared-balance-column-total{color:#ef8a81}
      .shared-balance-list{display:grid;gap:10px;padding:10px}
      .shared-balance-empty{padding:18px 14px;color:#7f90a5;font-size:11px;line-height:1.5;text-align:center;border:1px dashed #30445e;border-radius:11px;background:#101d2e}
      .shared-person-card{border:1px solid #23334a;border-radius:12px;background:#0d1929;overflow:hidden}
      .shared-person-card-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;padding:13px}
      .shared-person-avatar{width:42px;height:42px;border-radius:50%;flex:0 0 42px;display:grid;place-items:center;overflow:hidden;background:#101d2e;border:1px solid #30445e;font-size:12px;font-weight:800;color:#ddeaac}
      .shared-person-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .shared-person-card-title{min-width:0}
      .shared-person-relation{font-size:12px;font-weight:820;color:#eaf0f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .shared-person-card-sub{font-size:10px;color:#8293a8;margin-top:3px}
      .shared-person-balance{text-align:right;white-space:nowrap}
      .shared-person-balance strong{display:block;font-size:14px;font-weight:900;letter-spacing:-.02em}
      .shared-person-balance span{display:block;font-size:9px;color:#8293a8;margin-top:2px}
      .shared-person-card.receive .shared-person-balance strong{color:#91d6b9}
      .shared-person-card.pay .shared-person-balance strong{color:#ef8a81}
      .shared-person-actions{display:flex;justify-content:flex-end;padding:0 13px 12px}
      .shared-person-actions .btn{min-width:148px}
      .shared-person-details{border-top:1px solid #22344b}
      .shared-person-details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 13px;color:#91a2b7;font-size:10px;font-weight:750;background:#0a1524}
      .shared-person-details>summary::-webkit-details-marker{display:none}
      .shared-person-details>summary span{min-width:22px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:#132238;color:#b8c5d5;font-size:9px}
      .shared-person-details[open]>summary{color:#d8e1ec}
      .shared-entry-list{display:grid}
      .shared-entry-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 13px;border-top:1px solid #1f3047}
      .shared-entry-title{font-size:11px;font-weight:760;color:#dce6f2}
      .shared-entry-meta{font-size:9px;color:#8091a6;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .shared-entry-relation{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid #30445e;background:#111f31;color:#cbd6e3;font-size:9px;font-weight:750}
      .shared-entry-relation.receive{background:#102a20;border-color:#28513e;color:#a5e2c8}
      .shared-entry-relation.pay{background:#2a1d1d;border-color:#5b3431;color:#efaaa4}
      .shared-entry-status{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid #5a4824;background:#2a2213;color:#ead38f;font-size:9px;font-weight:750}
      .shared-entry-status.paid{border-color:#28513e;background:#102a20;color:#a5e2c8}.shared-entry-status.waiting{border-color:#275073;background:#10243a;color:#abd5f3}
      .shared-entry-value{text-align:right;font-size:11px;font-weight:850;white-space:nowrap;color:#eef3f8}
      .shared-settled-strip{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #23334a;border-radius:12px;background:#101d2e}
      .shared-settled-strip strong{display:block;color:#d9e3ee;font-size:11px}
      .shared-settled-strip span{display:block;color:#8293a8;font-size:10px;margin-top:2px}
      .shared-settled-count{flex:0 0 auto;min-width:28px;height:24px;padding:0 8px;border-radius:999px;display:grid!important;place-items:center;background:#102a20;color:#a5e2c8!important;font-weight:850!important;margin:0!important}
      @media(max-width:900px){.shared-balance-board{grid-template-columns:1fr}.shared-balance-column-head{align-items:center}}
      @media(max-width:620px){
        .shared-person-card-head{grid-template-columns:auto minmax(0,1fr)}
        .shared-person-balance{grid-column:2;text-align:left}
        .shared-person-actions{justify-content:stretch}.shared-person-actions .btn{width:100%}
        .shared-entry-line{grid-template-columns:1fr}.shared-entry-value{text-align:left}
        .shared-settled-strip{align-items:flex-start}
      }
    `;document.head.appendChild(s);
  }

  async function signedAvatar(path){
    if(!path)return'';
    const now=Date.now(),cached=avatarCache.get(path);
    if(cached&&cached.url&&cached.expiresAt>now)return cached.url;
    const client=getSb();if(!client)return cached?.url||'';
    try{
      const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,3600);
      if(error)throw error;
      const url=data?.signedUrl||'';
      if(url)avatarCache.set(path,{url,expiresAt:now+AVATAR_TTL_MS});
      return url||cached?.url||'';
    }catch(e){console.warn('Falha ao carregar foto do participante.',e);return cached?.url||''}
  }

  function statusClass(status){const s=String(status||'').toLowerCase();if(s==='pago'||s==='recebido')return'paid';if(s.includes('aguardando'))return'waiting';return''}
  function isSettled(status){const s=String(status||'').toLowerCase();return s==='pago'||s==='recebido'}
  function entryMonth(entry){return String(entry?.date||'').slice(0,7)}

  function contextualizeRows(rows,selectedMonth){
    return (rows||[]).map(b=>{
      const entries=(Array.isArray(b.entries)?b.entries:[]).filter(e=>entryMonth(e)===selectedMonth);
      let toReceive=0,toPay=0;
      entries.forEach(e=>{
        if(isSettled(e.status))return;
        const amount=Number(e.amount)||0;
        if(e.direction==='receive')toReceive+=amount;else if(e.direction==='pay')toPay+=amount;
      });
      return {...b,entries,toReceive,toPay,net:toReceive-toPay};
    }).filter(b=>b.entries.length>0);
  }

  function updateSummary(rows){
    const receive=rows.reduce((s,b)=>s+Math.max(0,Number(b.net)||0),0);
    const pay=rows.reduce((s,b)=>s+Math.max(0,-(Number(b.net)||0)),0);
    const net=receive-pay;
    const rec=document.getElementById('sharedToReceive');if(rec)rec.textContent=money(receive);
    const payEl=document.getElementById('sharedToPay');if(payEl)payEl.textContent=money(pay);
    const netEl=document.getElementById('sharedNet');if(netEl){netEl.textContent=money(net);netEl.className=`value ${net>=0?'positive':'negative'}`}
  }

  function avatarHtml(b){
    return b.avatarUrl?`<img src="${esc(b.avatarUrl)}" alt="Foto de ${esc(b.name||'participante')}">`:`<span>${esc(initials(b.name))}</span>`;
  }

  function entryHtml(e,personName){
    const dir=e.direction==='receive'?'receive':'pay';
    const status=String(e.status||'Pendente');
    const settled=isSettled(status);
    let relation='';
    if(settled)relation=dir==='receive'?'Você recebeu este valor':'Você pagou este valor';
    else relation=dir==='receive'?`${personName} te deve`:`Você deve para ${personName}`;
    return `<div class="shared-entry-line"><div><div class="shared-entry-title">${esc(e.description||'Despesa compartilhada')}</div><div class="shared-entry-meta"><span class="shared-entry-relation ${dir}">${esc(relation)}</span><span class="shared-entry-status ${statusClass(status)}">${esc(status)}</span>${e.date?`<span>${esc(dateLabel(e.date))}</span>`:''}</div></div><div class="shared-entry-value">${money(e.amount)}</div></div>`;
  }

  function actionableEntries(b,side){
    const entries=Array.isArray(b?.entries)?b.entries:[];
    return entries.filter(e=>{
      if(e.direction!==side||!e.transactionId)return false;
      const status=String(e.status||'').toLowerCase();
      if(side==='pay')return status==='pendente';
      return !isSettled(status);
    });
  }

  function cardHtml(b,side){
    const name=String(b.name||'Participante');
    const amount=Math.abs(Number(b.net)||0);
    const entries=Array.isArray(b.entries)?b.entries:[];
    const pending=entries.filter(e=>!isSettled(e.status)).length;
    const relation=side==='receive'?`${name} te deve`:`Você deve para ${name}`;
    const balanceLabel=side==='receive'?'a receber':'a pagar';
    const pendingLabel=`${pending} pendência${pending===1?'':'s'} · ${entries.length} lançamento${entries.length===1?'':'s'}`;
    const actionable=actionableEntries(b,side).length;
    const actionLabel=side==='receive'?'Informar recebimento':'Informar pagamento';
    const action=actionable?`<div class="shared-person-actions"><button type="button" class="btn small ${side==='receive'?'primary':''}" data-shared-settle="${side}" data-shared-user="${esc(b.userId)}">${actionLabel}</button></div>`:'';
    return `<article class="shared-person-card ${side}"><div class="shared-person-card-head"><div class="shared-person-avatar">${avatarHtml(b)}</div><div class="shared-person-card-title"><div class="shared-person-relation">${esc(relation)}</div><div class="shared-person-card-sub">${esc(pendingLabel)}</div></div><div class="shared-person-balance"><strong>${money(amount)}</strong><span>${balanceLabel}</span></div></div>${action}<details class="shared-person-details"><summary>Ver detalhes <span>${entries.length}</span></summary><div class="shared-entry-list">${entries.length?entries.map(e=>entryHtml(e,name)).join(''):'<div class="shared-balance-empty">Nenhum lançamento nesta competência.</div>'}</div></details></article>`;
  }

  function columnHtml(side,rows){
    const isReceive=side==='receive';
    const total=rows.reduce((s,b)=>s+Math.abs(Number(b.net)||0),0);
    const title=isReceive?'Te devem':'Você deve';
    const kicker=isReceive?'A RECEBER':'A PAGAR';
    const empty=isReceive?'Ninguém te deve nesta competência.':'Você não deve para ninguém nesta competência.';
    return `<section class="shared-balance-column ${side}"><div class="shared-balance-column-head"><div><div class="shared-balance-column-kicker">${kicker}</div><div class="shared-balance-column-title">${title}</div></div><div class="shared-balance-column-total">${money(total)}</div></div><div class="shared-balance-list">${rows.length?rows.map(b=>cardHtml(b,side)).join(''):`<div class="shared-balance-empty">${empty}</div>`}</div></section>`;
  }

  function settledHtml(rows){
    if(!rows.length)return'';
    const names=rows.map(b=>String(b.name||'Participante'));
    const shown=names.slice(0,3).join(', ');
    const extra=names.length>3?` e mais ${names.length-3}`:'';
    return `<div class="shared-settled-strip"><div><strong>Tudo acertado</strong><span>Sem valor líquido pendente com ${esc(shown+extra)} nesta competência.</span></div><span class="shared-settled-count">${rows.length}</span></div>`;
  }

  function installHostGuard(host){
    if(!host||host.dataset.detailGuard==='1')return;
    const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(!descriptor?.get||!descriptor?.set)return;
    Object.defineProperty(host,'innerHTML',{
      configurable:true,
      get(){return descriptor.get.call(this)},
      set(value){
        const html=String(value??'');
        const detailMarkup=html.includes('shared-month-context')||html.includes('shared-balance-board')||html.includes('shared-person-card')||html.includes('shared-settled-strip')||html.includes('Nenhum acerto nesta competência.');
        if(internalRender||detailMarkup)return descriptor.set.call(this,value);
        if(window.__sharedBalancesDetailLoaded)return;
        return descriptor.set.call(this,value);
      }
    });
    host.dataset.detailGuard='1';
  }

  async function refresh(force=false){
    const client=getSb(),uid=getUserId(),host=document.getElementById('sharedBalances'),selectedMonth=getSelectedMonth();
    if(loading||!client||!uid||!host)return;
    installHostGuard(host);
    loading=true;
    try{
      const {data,error}=await client.rpc('finance_shared_balances');if(error)throw error;
      const rows=contextualizeRows(data?.items||[],selectedMonth);
      await Promise.all(rows.map(async b=>{b.avatarUrl=await signedAvatar(b.avatarPath)}));
      updateSummary(rows);
      lastRows=rows;
      const signature=JSON.stringify([selectedMonth,rows.map(b=>[b.userId,b.net,b.toPay,b.toReceive,b.avatarPath,(b.entries||[]).map(e=>[e.sharedId,e.transactionId,e.date,e.status,e.amount,e.direction])])]);
      const alreadyDetailed=host.classList.contains('shared-balances-detailed')&&(rows.length===0||!!host.querySelector('.shared-balance-board'));
      if(!force&&signature===lastSignature&&alreadyDetailed)return;
      lastSignature=signature;lastSelectedMonth=selectedMonth;
      internalRender=true;
      host.classList.add('shared-balances-detailed');
      const receiveRows=rows.filter(b=>(Number(b.net)||0)>0.005);
      const payRows=rows.filter(b=>(Number(b.net)||0)<-0.005);
      const settledRows=rows.filter(b=>Math.abs(Number(b.net)||0)<=0.005);
      host.innerHTML=`<div class="shared-month-context">Acertos de <strong>${esc(monthLabel(selectedMonth))}</strong></div>${rows.length?`<div class="shared-balance-board">${columnHtml('receive',receiveRows)}${columnHtml('pay',payRows)}</div>${settledHtml(settledRows)}`:'<div class="shared-balance-empty">Nenhum acerto nesta competência.</div>'}`;
      queueMicrotask(()=>{internalRender=false});
    }catch(e){console.warn('Falha ao detalhar acertos por pessoa.',e)}finally{loading=false}
  }

  async function settlePerson(userId,side,button){
    if(settling)return;
    const row=lastRows.find(b=>String(b.userId)===String(userId));if(!row)return;
    const entries=actionableEntries(row,side);if(!entries.length)return;
    const name=String(row.name||'Participante');
    const count=entries.length;
    const question=side==='pay'
      ?`Informar o pagamento de ${count} despesa${count===1?'':'s'} para ${name}? Cada despesa ficará aguardando a confirmação da outra pessoa.`
      :`Confirmar o recebimento de ${count} despesa${count===1?'':'s'} de ${name}? O recebimento será baixado imediatamente, sem confirmação adicional.`;
    if(!confirm(question))return;
    const client=getSb();if(!client)return;
    settling=true;
    const original=button?.textContent||'';
    if(button){button.disabled=true;button.textContent='Processando…'}
    let completed=0;
    try{
      for(const entry of entries){
        const status=side==='pay'?'Pago':'Recebido';
        const {data,error}=await client.rpc('finance_set_shared_transaction_status',{p_transaction_id:String(entry.transactionId),p_status:status});
        if(error)throw error;
        if(!data?.ok)throw new Error(data?.detail||data?.error||'shared_settlement_failed');
        completed++;
      }
      try{if(window.financeCloud?.refresh)await window.financeCloud.refresh()}catch(e){}
      try{if(typeof renderAll==='function')renderAll()}catch(e){}
      try{window.financeSharedPaymentConfirmationsRefresh?.()}catch(e){}
      try{window.financeNotificationsRefresh?.()}catch(e){}
      await refresh(true);
      try{
        if(typeof setSyncStatus==='function')setSyncStatus(
          side==='pay'
            ?`Pagamento informado em ${completed} despesa${completed===1?'':'s'}; aguardando confirmação`
            :`Recebimento registrado em ${completed} despesa${completed===1?'':'s'}`
        );
      }catch(e){}
    }catch(err){
      console.error('Falha ao registrar acerto por pessoa.',err);
      alert(completed
        ?`${completed} despesa${completed===1?' foi processada':'s foram processadas'}, mas não foi possível concluir todas.`
        :'Não foi possível registrar este acerto agora.');
      try{await refresh(true)}catch(e){}
    }finally{
      settling=false;
      if(button){button.disabled=false;button.textContent=original}
    }
  }

  function scheduleRefresh(force=false){
    if(refreshScheduled)return;
    refreshScheduled=true;
    setTimeout(()=>{refreshScheduled=false;refresh(force)},60);
  }

  function isSharingOpen(){return document.getElementById('page-sharing')?.classList.contains('active')||document.querySelector('[data-page="sharing"].active')}

  function init(){
    injectStyles();
    document.addEventListener('click',e=>{
      const settle=e.target?.closest?.('[data-shared-settle]');
      if(settle){
        e.preventDefault();
        settlePerson(settle.dataset.sharedUser,settle.dataset.sharedSettle,settle);
        return;
      }
      if(e.target?.closest?.('[data-page="sharing"]'))setTimeout(()=>refresh(false),120);
    },true);
    const monthEvent=e=>{
      const value=e.target?.value||'';
      if(/^\d{4}-\d{2}$/.test(String(value))&&isSharingOpen())setTimeout(()=>{
        const selected=getSelectedMonth();
        if(selected!==lastSelectedMonth)refresh(true);
      },30);
    };
    document.addEventListener('change',monthEvent,true);
    document.addEventListener('input',monthEvent,true);
    window.addEventListener('focus',()=>{if(isSharingOpen())refresh(false)});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isSharingOpen())refresh(false)});
    setInterval(()=>{if(isSharingOpen())refresh(false)},30000);
    let tries=0;const t=setInterval(()=>{
      tries++;
      const host=document.getElementById('sharedBalances');
      if(host){clearInterval(t);installHostGuard(host);if(isSharingOpen())refresh(true)}
      else if(tries>300)clearInterval(t);
    },100);
    window.financeSharedBalancesDetailRefresh=()=>refresh(false);
    window.financeSharedBalancesDetailForceRefresh=()=>refresh(true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
