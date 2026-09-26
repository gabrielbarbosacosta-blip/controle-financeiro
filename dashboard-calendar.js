(function(){
  if(window.__prumoDashboardCalendar)return;
  window.__prumoDashboardCalendar=true;

  const WEEK=['D','S','T','Q','Q','S','S'];

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function ym(){return state?.settings?.selectedMonth||new Date().toISOString().slice(0,7)}
  function dateKey(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
  function isSettled(s){return String(s||'').toLowerCase()!=='pendente'}

  function inject(){
    if(document.getElementById('dashboardCalendarCard'))return;
    const dash=document.getElementById('page-dashboard');if(!dash)return;

    const style=document.createElement('style');
    style.textContent=`
      #dashboardCalendarCard{margin-top:14px;padding:14px}
      .prumo-cal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .prumo-cal-head h3{margin:0 0 4px;font-size:14px}
      .prumo-cal-total{font-size:11px;color:#8fa0b5;text-align:right;white-space:nowrap}
      .prumo-cal-week,.prumo-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
      .prumo-cal-week{margin-bottom:3px}
      .prumo-cal-week span{text-align:center;color:#6f8197;font-size:9px;font-weight:800;padding:4px 0}
      .prumo-cal-day{
        position:relative;min-height:48px;padding:5px 6px;border:1px solid #203149;border-radius:10px;
        background:#0a1524;color:#dce6f2;text-align:left;cursor:pointer;overflow:hidden;
        transition:background .16s ease,border-color .16s ease,transform .16s ease
      }
      .prumo-cal-day:hover{background:#101f32;border-color:#36506f}
      .prumo-cal-day.empty{visibility:hidden;pointer-events:none}
      .prumo-cal-day.selected{border-color:#ddeaac;box-shadow:0 0 0 1px rgba(221,234,172,.18) inset}
      .prumo-cal-day.today{
        background:linear-gradient(145deg,rgba(234,211,143,.22),rgba(234,211,143,.10))!important;
        border-color:rgba(234,211,143,.48)!important;
        box-shadow:0 10px 26px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.14)!important;
        -webkit-backdrop-filter:blur(18px) saturate(1.2);
        backdrop-filter:blur(18px) saturate(1.2);
      }
      .prumo-cal-day.today .prumo-cal-num{
        background:rgba(234,211,143,.92);
        color:#17202b;
        box-shadow:0 4px 12px rgba(234,211,143,.15);
      }
      .prumo-cal-day.today:hover{
        background:linear-gradient(145deg,rgba(234,211,143,.28),rgba(234,211,143,.13))!important;
        border-color:rgba(234,211,143,.62)!important;
      }
      .prumo-cal-num{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:15px;line-height:1;font-weight:850;letter-spacing:-.02em}
      .prumo-cal-dots{position:absolute;right:6px;bottom:5px;display:flex;gap:3px;align-items:center;min-height:10px}
      .prumo-cal-flow{
        display:inline-grid;place-items:center;
        min-width:13px;height:13px;
        font-size:12px;line-height:1;font-weight:900;
      }
      .prumo-cal-flow.in{
        color:#91d6b9;
        text-shadow:0 0 10px rgba(145,214,185,.22)
      }
      .prumo-cal-flow.out{
        color:#ef8a81;
        text-shadow:0 0 10px rgba(239,138,129,.22)
      }
      .prumo-cal-flow.pending{
        width:5px;min-width:5px;height:5px;border-radius:50%;
        background:#ead38f;color:transparent;
        box-shadow:0 0 8px rgba(234,211,143,.18)
      }
      .prumo-cal-amount{display:none}
      .prumo-cal-amount.negative{color:#ef8a81}.prumo-cal-amount.positive{color:#91d6b9}
      .prumo-cal-detail{display:none!important}
      .prumo-cal-detail-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}
      .prumo-cal-detail-title strong{font-size:11px}
      .prumo-cal-items{display:grid;gap:7px}
      .prumo-cal-item{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 10px;border-radius:10px;background:#101d2e;border:1px solid #22344b}
      .prumo-cal-item-name{font-size:10px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .prumo-cal-item-meta{font-size:8.5px;color:#8294aa;margin-top:3px}
      .prumo-cal-item-value{font-size:10px;font-weight:800;white-space:nowrap}
      #dashboardCalendarDayModal .modal{width:min(680px,calc(100vw - 24px))}
      .prumo-cal-modal-list{display:grid;gap:8px}
      .prumo-cal-modal-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #22344b;border-radius:12px;background:#0a1524}
      .prumo-cal-modal-main{min-width:0}
      .prumo-cal-modal-name{font-size:11px;font-weight:800;color:#eef3f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .prumo-cal-modal-meta{font-size:9px;color:#8193a9;margin-top:4px;line-height:1.35}
      .prumo-cal-modal-side{display:flex;align-items:center;gap:9px}
      .prumo-cal-modal-value{font-size:11px;font-weight:850;white-space:nowrap}
      .prumo-cal-modal-empty{padding:18px 8px;text-align:center;color:#8193a9;font-size:10px}
      @media(max-width:620px){
        #dashboardCalendarCard{padding:12px}
        .prumo-cal-week,.prumo-cal-grid{gap:3px}
        .prumo-cal-day{min-height:43px;padding:4px;border-radius:9px}
        .prumo-cal-num{width:27px;height:27px;font-size:14px}
        .prumo-cal-dots{right:4px;bottom:5px}
        .prumo-cal-modal-item{grid-template-columns:1fr}
        .prumo-cal-modal-side{justify-content:space-between}
      }
    `;
    document.head.appendChild(style);

    const card=document.createElement('div');
    card.id='dashboardCalendarCard';card.className='card';
    card.innerHTML=`
      <div class="prumo-cal-head">
        <div><h3>Calendário financeiro</h3><div class="muted">Vencimentos, recebimentos e movimentações do mês</div></div>
        <div class="prumo-cal-total" id="dashboardCalendarSummary"></div>
      </div>
      <div class="prumo-cal-week">${WEEK.map(x=>'<span>'+x+'</span>').join('')}</div>
      <div class="prumo-cal-grid" id="dashboardCalendarGrid"></div>
      <div class="prumo-cal-detail" id="dashboardCalendarDetail"></div>
    `;
    dash.appendChild(card);

    if(!document.getElementById('dashboardCalendarDayModal')){
      const wrap=document.createElement('div');
      wrap.innerHTML=`
        <div class="modal-backdrop" id="dashboardCalendarDayModal">
          <div class="modal">
            <div class="modal-head">
              <div><h3 id="dashboardCalendarDayTitle">Movimentações do dia</h3><div class="muted" id="dashboardCalendarDaySub"></div></div>
              <button type="button" class="btn ghost" id="dashboardCalendarDayClose">✕</button>
            </div>
            <div class="modal-body"><div class="prumo-cal-modal-list" id="dashboardCalendarDayList"></div></div>
            <div class="modal-foot"><button type="button" class="btn" id="dashboardCalendarDayDone">Fechar</button></div>
          </div>
        </div>`;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('dashboardCalendarDayClose').onclick=closeDayModal;
      document.getElementById('dashboardCalendarDayDone').onclick=closeDayModal;
      document.getElementById('dashboardCalendarDayModal').addEventListener('click',e=>{if(e.target.id==='dashboardCalendarDayModal')closeDayModal()});
    }
  }

  function eventsForMonth(month){
    const out=[];
    (state.transactions||[]).filter(t=>String(t.date||'').slice(0,7)===month).forEach(t=>out.push({
      kind:'tx',date:t.date,type:t.type,status:t.status,description:t.description||'Lançamento',
      amount:Number(t.amount)||0,category:t.category||'',id:t.id,
      debtId:t.debtId||null,incomePlanId:t.incomePlanId||null,
      debtManaged:t.debtManaged===true,incomeManaged:t.incomeManaged===true
    }));
    (state.invoices||[]).filter(i=>i.ym===month).forEach(i=>{
      const c=typeof getCard==='function'?getCard(i.cardId):null;
      const total=typeof invoiceKnownTotal==='function'?invoiceKnownTotal(i.cardId,month):Number(i.adjustment)||0;
      const date=typeof invoiceDueDate==='function'?invoiceDueDate(c,month):month+'-01';
      out.push({kind:'invoice',date,type:'Fatura',status:i.status,description:'Fatura '+(c?.name||'Cartão'),amount:total,category:'Cartões',id:i.id,cardId:i.cardId,ym:i.ym});
    });
    return out;
  }

  function closeDayModal(){document.getElementById('dashboardCalendarDayModal')?.classList.remove('open')}

  function openEventPanel(event){
    closeDayModal();
    if(event.kind==='invoice'){
      if(typeof window.openInvoiceModal==='function')window.openInvoiceModal(event.cardId,event.ym);
      return;
    }
    if(typeof window.openPrumoFinancialPanel==='function'){
      if(event.debtManaged&&event.debtId){window.openPrumoFinancialPanel('expense',event.debtId);return}
      if(event.incomeManaged&&event.incomePlanId){window.openPrumoFinancialPanel('income',event.incomePlanId);return}
      window.openPrumoFinancialPanel('transaction',event.id);return;
    }
    if(event.debtManaged&&event.debtId&&typeof window.editDebtPlan==='function'){window.editDebtPlan(event.debtId);return}
    if(event.incomeManaged&&event.incomePlanId&&typeof window.editIncomePlan==='function'){window.editIncomePlan(event.incomePlanId);return}
    if(typeof window.editTx==='function')window.editTx(event.id);
  }

  function openDayModal(day,events){
    const list=events.filter(e=>Number(String(e.date).slice(8,10))===day);
    const modal=document.getElementById('dashboardCalendarDayModal'),host=document.getElementById('dashboardCalendarDayList');
    if(!modal||!host)return;
    const date=list[0]?.date||ym()+'-'+String(day).padStart(2,'0');
    document.getElementById('dashboardCalendarDayTitle').textContent='Movimentações do dia '+day;
    document.getElementById('dashboardCalendarDaySub').textContent=typeof fmtDate==='function'?fmtDate(date):date;

    host.innerHTML=list.length?list.map((e,i)=>{
      const incoming=e.type==='Receita';
      const buttonLabel=e.kind==='invoice'?'Abrir fatura':incoming?'Abrir receita':'Abrir despesa';
      return '<div class="prumo-cal-modal-item"><div class="prumo-cal-modal-main"><div class="prumo-cal-modal-name">'+esc(e.description)+'</div><div class="prumo-cal-modal-meta">'+esc(e.type)+' · '+esc(e.status||'')+(e.category?' · '+esc(e.category):'')+'</div></div><div class="prumo-cal-modal-side"><div class="prumo-cal-modal-value '+(incoming?'positive':'negative')+'">'+(typeof fmtMoney==='function'?fmtMoney(e.amount):e.amount)+'</div><button type="button" class="btn small" data-cal-event="'+i+'">'+buttonLabel+'</button></div></div>'
    }).join(''):'<div class="prumo-cal-modal-empty">Nenhuma despesa ou receita neste dia.</div>';

    host.querySelectorAll('[data-cal-event]').forEach(btn=>btn.onclick=()=>{
      const item=list[Number(btn.dataset.calEvent)];
      if(item)openEventPanel(item);
    });
    modal.classList.add('open');
  }

  function render(){
    inject();
    const month=ym(),parts=month.split('-').map(Number),year=parts[0],m=parts[1];
    if(!year||!m)return;
    const events=eventsForMonth(month),days=new Date(year,m,0).getDate(),start=new Date(year,m-1,1).getDay();
    const grid=document.getElementById('dashboardCalendarGrid');if(!grid)return;
    const today=new Date(),todayKey=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    const cells=[];
    for(let i=0;i<start;i++)cells.push('<div class="prumo-cal-day empty"></div>');
    for(let d=1;d<=days;d++){
      const key=dateKey(year,m,d),list=events.filter(e=>String(e.date).slice(0,10)===key);
      const incoming=list.filter(e=>e.type==='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
      const outgoing=list.filter(e=>e.type!=='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
      const pending=list.some(e=>!isSettled(e.status));
      const net=incoming-outgoing;
      const dots=[
        incoming?'<span class="prumo-cal-flow in" aria-label="Receita">↓</span>':'',
        outgoing?'<span class="prumo-cal-flow out" aria-label="Despesa">↑</span>':'',
        pending?'<span class="prumo-cal-flow pending" aria-label="Pendente"></span>':''
      ].join('');
      const amount=list.length?'<div class="prumo-cal-amount '+(net<0?'negative':net>0?'positive':'')+'">'+(typeof fmtMoney==='function'?fmtMoney(Math.abs(net)):'')+'</div>':'';
      cells.push('<button type="button" class="prumo-cal-day '+(key===todayKey?'today ':'')+'" data-cal-day="'+d+'"><span class="prumo-cal-num">'+d+'</span><div class="prumo-cal-dots">'+dots+'</div>'+amount+'</button>');
    }
    grid.innerHTML=cells.join('');
    grid.querySelectorAll('[data-cal-day]').forEach(btn=>btn.onclick=()=>{
      grid.querySelectorAll('.prumo-cal-day').forEach(x=>x.classList.remove('selected'));
      btn.classList.add('selected');openDayModal(Number(btn.dataset.calDay),events);
    });
    const incoming=events.filter(e=>e.type==='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
    const outgoing=events.filter(e=>e.type!=='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
    const summary=document.getElementById('dashboardCalendarSummary');
    if(summary)summary.textContent=(events.length?events.length+' movimentos':'Sem movimentos')+' · '+(typeof fmtMoney==='function'?fmtMoney(incoming-outgoing):'');
  }

  function hook(){
    inject();
    const original=window.renderDashboard;
    if(typeof original==='function'&&!original.__calendarWrapped){
      const wrapped=function(){const r=original.apply(this,arguments);requestAnimationFrame(render);return r};
      wrapped.__calendarWrapped=true;window.renderDashboard=wrapped;try{renderDashboard=wrapped}catch(_e){}
    }
    render();
    window.addEventListener('finance:cloud-ready',()=>setTimeout(render,80));
    window.addEventListener('prumo:pull-refresh',()=>setTimeout(render,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook,{once:true});else hook();
})();