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
      #dashboardCalendarCard{margin-top:14px;padding:16px}
      .prumo-cal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      .prumo-cal-head h3{margin:0 0 4px;font-size:14px}
      .prumo-cal-total{font-size:11px;color:#8fa0b5;text-align:right;white-space:nowrap}
      .prumo-cal-week,.prumo-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
      .prumo-cal-week{margin-bottom:6px}
      .prumo-cal-week span{text-align:center;color:#6f8197;font-size:9px;font-weight:800;padding:4px 0}
      .prumo-cal-day{
        position:relative;min-height:68px;padding:8px;border:1px solid #203149;border-radius:12px;
        background:#0a1524;color:#dce6f2;text-align:left;cursor:pointer;overflow:hidden;
        transition:background .16s ease,border-color .16s ease,transform .16s ease
      }
      .prumo-cal-day:hover{background:#101f32;border-color:#36506f}
      .prumo-cal-day.empty{visibility:hidden;pointer-events:none}
      .prumo-cal-day.selected{border-color:#ddeaac;box-shadow:0 0 0 1px rgba(221,234,172,.18) inset}
      .prumo-cal-day.today .prumo-cal-num{background:#ddeaac;color:#0b1a27}
      .prumo-cal-num{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:800}
      .prumo-cal-dots{display:flex;gap:4px;align-items:center;margin-top:8px;min-height:5px}
      .prumo-cal-dot{width:5px;height:5px;border-radius:50%;background:#718299}
      .prumo-cal-dot.in{background:#91d6b9}.prumo-cal-dot.out{background:#ef8a81}.prumo-cal-dot.pending{background:#ead38f}
      .prumo-cal-amount{margin-top:7px;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .prumo-cal-amount.negative{color:#ef8a81}.prumo-cal-amount.positive{color:#91d6b9}
      .prumo-cal-detail{margin-top:14px;padding-top:14px;border-top:1px solid #203149}
      .prumo-cal-detail-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}
      .prumo-cal-detail-title strong{font-size:11px}
      .prumo-cal-items{display:grid;gap:7px}
      .prumo-cal-item{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 10px;border-radius:10px;background:#101d2e;border:1px solid #22344b}
      .prumo-cal-item-name{font-size:10px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .prumo-cal-item-meta{font-size:8.5px;color:#8294aa;margin-top:3px}
      .prumo-cal-item-value{font-size:10px;font-weight:800;white-space:nowrap}
      @media(max-width:620px){
        #dashboardCalendarCard{padding:13px}
        .prumo-cal-week,.prumo-cal-grid{gap:4px}
        .prumo-cal-day{min-height:57px;padding:6px;border-radius:10px}
        .prumo-cal-num{width:21px;height:21px;font-size:9px}
        .prumo-cal-amount{font-size:8px}
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
  }

  function eventsForMonth(month){
    const out=[];
    (state.transactions||[]).filter(t=>String(t.date||'').slice(0,7)===month).forEach(t=>out.push({
      kind:'tx',date:t.date,type:t.type,status:t.status,description:t.description||'Lançamento',
      amount:Number(t.amount)||0,category:t.category||'',id:t.id
    }));
    (state.invoices||[]).filter(i=>i.ym===month).forEach(i=>{
      const c=typeof getCard==='function'?getCard(i.cardId):null;
      const total=typeof invoiceKnownTotal==='function'?invoiceKnownTotal(i.cardId,month):Number(i.adjustment)||0;
      const date=typeof invoiceDueDate==='function'?invoiceDueDate(c,month):month+'-01';
      out.push({kind:'invoice',date,type:'Fatura',status:i.status,description:'Fatura '+(c?.name||'Cartão'),amount:total,category:'Cartões',id:i.id});
    });
    return out;
  }

  function renderDetail(day,events){
    const host=document.getElementById('dashboardCalendarDetail');if(!host)return;
    const list=events.filter(e=>Number(String(e.date).slice(8,10))===day);
    if(!list.length){
      host.innerHTML='<div class="muted">Nenhuma movimentação neste dia.</div>';
      return;
    }
    const date=list[0].date;
    host.innerHTML=`
      <div class="prumo-cal-detail-title"><strong>${typeof fmtDate==='function'?fmtDate(date):date}</strong><span class="muted">${list.length} item(ns)</span></div>
      <div class="prumo-cal-items">${list.map(e=>{
        const incoming=e.type==='Receita';
        return '<div class="prumo-cal-item"><div><div class="prumo-cal-item-name">'+esc(e.description)+'</div><div class="prumo-cal-item-meta">'+esc(e.type)+' · '+esc(e.status||'')+(e.category?' · '+esc(e.category):'')+'</div></div><div class="prumo-cal-item-value '+(incoming?'positive':'negative')+'">'+(typeof fmtMoney==='function'?fmtMoney(e.amount):e.amount)+'</div></div>'
      }).join('')}</div>
    `;
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
      const dots=[incoming?'<span class="prumo-cal-dot in"></span>':'',outgoing?'<span class="prumo-cal-dot out"></span>':'',pending?'<span class="prumo-cal-dot pending"></span>':''].join('');
      const amount=list.length?'<div class="prumo-cal-amount '+(net<0?'negative':net>0?'positive':'')+'">'+(typeof fmtMoney==='function'?fmtMoney(Math.abs(net)):'')+'</div>':'';
      cells.push('<button type="button" class="prumo-cal-day '+(key===todayKey?'today ':'')+'" data-cal-day="'+d+'"><span class="prumo-cal-num">'+d+'</span><div class="prumo-cal-dots">'+dots+'</div>'+amount+'</button>');
    }
    grid.innerHTML=cells.join('');
    grid.querySelectorAll('[data-cal-day]').forEach(btn=>btn.onclick=()=>{
      grid.querySelectorAll('.prumo-cal-day').forEach(x=>x.classList.remove('selected'));
      btn.classList.add('selected');renderDetail(Number(btn.dataset.calDay),events);
    });
    const incoming=events.filter(e=>e.type==='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
    const outgoing=events.filter(e=>e.type!=='Receita'&&isSettled(e.status)).reduce((s,e)=>s+e.amount,0);
    const summary=document.getElementById('dashboardCalendarSummary');
    if(summary)summary.textContent=(events.length?events.length+' movimentos':'Sem movimentos')+' · '+(typeof fmtMoney==='function'?fmtMoney(incoming-outgoing):'');
    const dayToOpen=(todayKey.startsWith(month)?today.getDate():Math.min(days,1));
    const initial=grid.querySelector('[data-cal-day="'+dayToOpen+'"]');
    if(initial){initial.classList.add('selected');renderDetail(dayToOpen,events)}
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