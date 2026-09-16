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
      .shared-month-context{padding:9px 12px;border:1px solid #243449;border-radius:11px;background:#0f172a;color:#94a3b8;font-size:11px;margin-bottom:10px}.shared-month-context strong{color:#e2e8f0}
      .shared-person-card{border:1px solid var(--line);border-radius:15px;background:#0b1424;overflow:hidden}
      .shared-person-card-head{display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--line)}
      .shared-person-avatar{width:46px;height:46px;border-radius:14px;flex:0 0 46px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,#1e3a5f,#172033);border:1px solid rgba(255,255,255,.12);font-size:13px;font-weight:800;color:#dbeafe}
      .shared-person-avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .shared-person-card-title{min-width:0;flex:1}.shared-person-card-name{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shared-person-card-sub{font-size:10px;color:var(--muted);margin-top:3px}
      .shared-entry-list{display:grid}
      .shared-entry-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 14px;border-bottom:1px solid rgba(148,163,184,.11)}
      .shared-entry-line:last-child{border-bottom:0}.shared-entry-title{font-size:12px;font-weight:720}.shared-entry-meta{font-size:10px;color:var(--muted);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .shared-entry-kind{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid #334155;color:#cbd5e1;font-size:9px;font-weight:750}
      .shared-entry-kind.receive{border-color:#245f37;background:#102a19;color:#bbf7d0}.shared-entry-kind.pay{border-color:#6b5318;background:#30230c;color:#fde68a}
      .shared-entry-status{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid #6b5318;background:#30230c;color:#fde68a;font-size:9px;font-weight:750}
      .shared-entry-status.paid{border-color:#245f37;background:#102a19;color:#bbf7d0}.shared-entry-status.waiting{border-color:#1d497b;background:#102845;color:#bfdbfe}
      .shared-entry-value{text-align:right;font-size:12px;font-weight:800;white-space:nowrap}
      .shared-person-card-foot{padding:12px 14px;background:rgba(15,23,42,.72);display:flex;justify-content:space-between;gap:14px;align-items:center}
      .shared-person-total-label{font-size:10px;color:var(--muted)}.shared-person-total{font-size:16px;font-weight:850;margin-top:2px}.shared-person-total.positive{color:#86efac}.shared-person-total.negative{color:#fca5a5}.shared-person-total.settled{color:#cbd5e1}
      @media(max-width:700px){.shared-entry-line{grid-template-columns:1fr}.shared-entry-value{text-align:left}.shared-person-card-foot{align-items:flex-end}}
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
    const receive=rows.reduce((s,b)=>s+(Number(b.toReceive)||0),0);
    const pay=rows.reduce((s,b)=>s+(Number(b.toPay)||0),0);
    const net=receive-pay;
    const rec=document.getElementById('sharedToReceive');if(rec)rec.textContent=money(receive);
    const payEl=document.getElementById('sharedToPay');if(payEl)payEl.textContent=money(pay);
    const netEl=document.getElementById('sharedNet');if(netEl){netEl.textContent=money(net);netEl.className=`value ${net>=0?'positive':'negative'}`}
  }

  function entryHtml(e){
    const dir=e.direction==='receive'?'receive':'pay';
    const status=String(e.status||'Pendente');
    return `<div class="shared-entry-line"><div><div class="shared-entry-title">${esc(e.description||'Despesa compartilhada')}</div><div class="shared-entry-meta"><span class="shared-entry-kind ${dir}">${esc(e.kind||(dir==='receive'?'Reembolso':'Despesa'))}</span><span class="shared-entry-status ${statusClass(status)}">${esc(status)}</span>${e.date?`<span>${esc(dateLabel(e.date))}</span>`:''}</div></div><div class="shared-entry-value">${money(e.amount)}</div></div>`;
  }

  function cardHtml(b){
    const net=Number(b.net)||0,toPay=Number(b.toPay)||0,toReceive=Number(b.toReceive)||0;
    let label='Tudo acertado',value=0,cls='settled';
    if(net<0){label='Valor a pagar';value=Math.abs(net);cls='negative'}
    else if(net>0){label='Valor a receber';value=net;cls='positive'}
    const entries=Array.isArray(b.entries)?b.entries:[];
    const avatar=b.avatarUrl?`<img src="${esc(b.avatarUrl)}" alt="Foto de ${esc(b.name||'participante')}">`:`<span>${esc(initials(b.name))}</span>`;
    return `<div class="shared-person-card"><div class="shared-person-card-head"><div class="shared-person-avatar">${avatar}</div><div class="shared-person-card-title"><div class="shared-person-card-name">${esc(b.name||'Participante')}</div><div class="shared-person-card-sub">${entries.length} lançamento${entries.length===1?'':'s'} nesta competência</div></div></div><div class="shared-entry-list">${entries.length?entries.map(entryHtml).join(''):'<div class="empty">Nenhuma despesa ou reembolso.</div>'}</div><div class="shared-person-card-foot"><div><div class="shared-person-total-label">${label}</div><div class="shared-person-total ${cls}">${money(value)}</div></div><div style="text-align:right"><div class="shared-person-total-label">A pagar ${money(toPay)} · A receber ${money(toReceive)}</div></div></div></div>`;
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
        const detailMarkup=html.includes('shared-month-context')||html.includes('shared-person-card')||html.includes('Nenhum acerto nesta competência.');
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
      const signature=JSON.stringify([selectedMonth,rows.map(b=>[b.userId,b.net,b.toPay,b.toReceive,b.avatarPath,(b.entries||[]).map(e=>[e.sharedId,e.date,e.status,e.amount,e.direction])])]);
      const alreadyDetailed=host.classList.contains('shared-balances-detailed')&&(rows.length===0||!!host.querySelector('.shared-person-card'));
      if(!force&&signature===lastSignature&&alreadyDetailed)return;
      lastSignature=signature;lastSelectedMonth=selectedMonth;
      internalRender=true;
      host.classList.add('shared-balances-detailed');
      host.innerHTML=`<div class="shared-month-context">Exibindo acertos de <strong>${esc(monthLabel(selectedMonth))}</strong></div>${rows.length?rows.map(cardHtml).join(''):'<div class="empty">Nenhum acerto nesta competência.</div>'}`;
      queueMicrotask(()=>{internalRender=false});
    }catch(e){console.warn('Falha ao detalhar acertos por pessoa.',e)}finally{loading=false}
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
