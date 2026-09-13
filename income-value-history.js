(function(){
  // A edição versionada de receitas agora está integrada diretamente em incomes.js.
  // Este arquivo permanece por compatibilidade e inicializa integrações auxiliares da interface.

  if(!document.querySelector('script[data-chatgpt-finance-loader]')){
    const script=document.createElement('script');
    script.src='invoice-ai-client.js';
    script.async=false;
    script.dataset.chatgptFinanceLoader='1';
    document.head.appendChild(script);
  }

  function installInvoiceClear(){
    const form=document.getElementById('invoiceForm');
    if(!form)return false;
    const foot=form.querySelector('.modal-foot');
    if(!foot)return false;

    let btn=document.getElementById('clearInvoicePurchases');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='clearInvoicePurchases';
      btn.className='btn danger';
      btn.textContent='Limpar fatura';
      foot.insertBefore(btn,foot.firstChild);
    }

    btn.onclick=async()=>{
      const cardId=document.getElementById('invoiceCardId')?.value;
      const ym=document.getElementById('invoiceYm')?.value;
      if(!cardId||!ym){
        alert('Não foi possível identificar a fatura selecionada.');
        return;
      }

      const allocator=typeof purchaseAllocation==='function'?purchaseAllocation:null;
      if(!allocator){
        alert('Não foi possível calcular os itens desta fatura.');
        return;
      }

      const affected=(state.purchases||[]).filter(p=>p.cardId===cardId&&allocator(p,ym));
      const inv=typeof getInvoice==='function'?getInvoice(cardId,ym):null;
      const hasAdjustment=!!(inv&&Number(inv.adjustment));

      if(!affected.length&&!hasAdjustment){
        alert('Esta fatura já está vazia.');
        return;
      }

      const affectsFuture=affected.some(p=>p.mode==='recorrente'||p.openEnded===true||Number(p.installments)>1);
      let msg=`Limpar a fatura ${ym}?`;
      if(affected.length)msg+=`\n\nSerão removidas ${affected.length} compra(s) que aparecem nesta fatura.`;
      if(hasAdjustment)msg+=`\nO ajuste manual de R$ ${Number(inv.adjustment).toFixed(2).replace('.',',')} será zerado.`;
      if(affectsFuture)msg+='\n\nAtenção: compras parceladas ou recorrentes removidas também deixarão de aparecer nas faturas futuras.';
      if(!confirm(msg))return;

      const previousPurchases=state.purchases;
      const previousAdjustment=inv?.adjustment;

      try{
        if(affected.length){
          const ids=new Set(affected.map(p=>p.id));
          state.purchases=state.purchases.filter(p=>!ids.has(p.id));
        }
        if(inv)inv.adjustment=0;

        if(window.financeCloud&&typeof currentUser!=='undefined'&&currentUser?.id){
          setSyncStatus('Salvando…');
          await window.financeCloud.save(currentUser.id,state);
          setSyncStatus('Sincronizado com servidor');
        }else if(typeof save==='function'){
          save();
        }

        if(typeof closeModal==='function')closeModal('invoiceModal');
        if(typeof renderAll==='function')renderAll();
        alert('Fatura limpa com sucesso.');
      }catch(error){
        state.purchases=previousPurchases;
        if(inv)inv.adjustment=previousAdjustment;
        console.error('Falha ao limpar fatura:',error);
        setSyncStatus('Falha ao salvar no servidor',true);
        alert('Não foi possível limpar a fatura. Nenhuma alteração foi salva.');
      }
    };

    return true;
  }

  const KPI_DEFS=[
    {key:'opening',label:'Saldo inicial',selector:'#kpiOpening'},
    {key:'income',label:'Receitas de caixa',selector:'#kpiIncome'},
    {key:'expense',label:'Saídas de caixa',selector:'#kpiExpense'},
    {key:'invoices',label:'Faturas pagas',selector:'#kpiInvoices'},
    {key:'closing',label:'Saldo final',selector:'#kpiClosing'}
  ];
  const PANEL_DEFS=[
    {key:'projection',label:'Saldo projetado',selector:'#projectionChart'},
    {key:'categories',label:'Gastos por categoria',selector:'#categoryList'}
  ];

  function defaultUiLayout(){
    return {
      kpiOrder:KPI_DEFS.map(x=>x.key),
      panelOrder:PANEL_DEFS.map(x=>x.key),
      hidden:{}
    };
  }

  function ensureUiLayout(){
    if(!state?.settings)return defaultUiLayout();
    const current=state.settings.uiLayout&&typeof state.settings.uiLayout==='object'?state.settings.uiLayout:{};
    const defaults=defaultUiLayout();
    const validOrder=(value,defs)=>{
      const allowed=new Set(defs.map(x=>x.key));
      const clean=Array.isArray(value)?value.filter((x,i,a)=>allowed.has(x)&&a.indexOf(x)===i):[];
      defs.forEach(d=>{if(!clean.includes(d.key))clean.push(d.key)});
      return clean;
    };
    state.settings.uiLayout={
      kpiOrder:validOrder(current.kpiOrder,KPI_DEFS),
      panelOrder:validOrder(current.panelOrder,PANEL_DEFS),
      hidden:current.hidden&&typeof current.hidden==='object'?current.hidden:{}
    };
    return state.settings.uiLayout;
  }

  function cardFor(def){
    const target=document.querySelector(def.selector);
    return target?.closest('.card')||target?.closest('.kpi')||null;
  }

  function applyGroup(container,defs,order,hidden){
    if(!container)return;
    const byKey=new Map();
    defs.forEach(def=>{
      const card=cardFor(def);
      if(card){
        card.dataset.uiBlock=def.key;
        byKey.set(def.key,card);
      }
    });
    order.forEach(key=>{
      const card=byKey.get(key);
      if(card)container.appendChild(card);
    });
    defs.forEach(def=>{
      const card=byKey.get(def.key);
      if(card)card.style.display=hidden[def.key]?'none':'';
    });
  }

  function applyUiLayout(){
    if(!state?.settings)return;
    const layout=ensureUiLayout();
    applyGroup(document.querySelector('#page-dashboard .grid-kpi'),KPI_DEFS,layout.kpiOrder,layout.hidden);
    applyGroup(document.querySelector('#page-dashboard .dashboard-grid'),PANEL_DEFS,layout.panelOrder,layout.hidden);
  }

  function persistUiLayout(){
    if(typeof save==='function')save();
    applyUiLayout();
    renderUiCustomizer();
  }

  function moveItem(group,key,direction){
    const layout=ensureUiLayout();
    const field=group==='kpi'?'kpiOrder':'panelOrder';
    const order=[...layout[field]];
    const index=order.indexOf(key);
    const next=index+direction;
    if(index<0||next<0||next>=order.length)return;
    [order[index],order[next]]=[order[next],order[index]];
    layout[field]=order;
    persistUiLayout();
  }

  function toggleItem(key,visible){
    const layout=ensureUiLayout();
    layout.hidden[key]=!visible;
    persistUiLayout();
  }

  function itemRow(def,group,index,total){
    const hidden=!!ensureUiLayout().hidden[def.key];
    return `<div class="detail-line" data-ui-row="${def.key}"><label class="toggle" style="flex:1"><input type="checkbox" data-ui-visible="${def.key}" ${hidden?'':'checked'}> ${def.label}</label><div style="white-space:nowrap"><button type="button" class="btn small" data-ui-move="${group}:${def.key}:-1" ${index===0?'disabled':''}>↑</button> <button type="button" class="btn small" data-ui-move="${group}:${def.key}:1" ${index===total-1?'disabled':''}>↓</button></div></div>`;
  }

  function renderUiCustomizer(){
    const host=document.getElementById('uiCustomizerBody');
    if(!host||!state?.settings)return;
    const layout=ensureUiLayout();
    const kpiMap=new Map(KPI_DEFS.map(x=>[x.key,x]));
    const panelMap=new Map(PANEL_DEFS.map(x=>[x.key,x]));
    const kpis=layout.kpiOrder.map(k=>kpiMap.get(k)).filter(Boolean);
    const panels=layout.panelOrder.map(k=>panelMap.get(k)).filter(Boolean);
    host.innerHTML=`<div class="muted" style="margin-bottom:8px">Indicadores do Dashboard</div>${kpis.map((d,i)=>itemRow(d,'kpi',i,kpis.length)).join('')}<div class="divider"></div><div class="muted" style="margin-bottom:8px">Painéis do Dashboard</div>${panels.map((d,i)=>itemRow(d,'panel',i,panels.length)).join('')}`;
    host.querySelectorAll('[data-ui-visible]').forEach(input=>{
      input.onchange=()=>toggleItem(input.dataset.uiVisible,input.checked);
    });
    host.querySelectorAll('[data-ui-move]').forEach(button=>{
      button.onclick=()=>{
        const [group,key,dir]=button.dataset.uiMove.split(':');
        moveItem(group,key,Number(dir));
      };
    });
  }

  function installUiCustomizer(){
    const grid=document.querySelector('#page-settings .settings-grid');
    if(!grid)return false;
    let card=document.getElementById('uiCustomizerCard');
    if(!card){
      card=document.createElement('div');
      card.className='card';
      card.id='uiCustomizerCard';
      card.innerHTML='<h3>Personalizar interface</h3><p class="muted">Escolha quais blocos aparecem no Dashboard e altere a ordem usando as setas. A configuração é salva na sua conta.</p><div id="uiCustomizerBody"></div><div class="toolbar" style="margin-top:14px"><button type="button" class="btn" id="uiResetLayout">Restaurar layout padrão</button><button type="button" class="btn primary" id="uiGoDashboard">Ver Dashboard</button></div>';
      grid.appendChild(card);
      card.querySelector('#uiResetLayout').onclick=()=>{
        if(!confirm('Restaurar o layout padrão do Dashboard?'))return;
        state.settings.uiLayout=defaultUiLayout();
        persistUiLayout();
      };
      card.querySelector('#uiGoDashboard').onclick=()=>{
        if(typeof showPage==='function')showPage('dashboard');
      };
    }
    renderUiCustomizer();
    applyUiLayout();
    return true;
  }

  function wrapRenderAll(){
    const base=window.renderAll||((typeof renderAll==='function')?renderAll:null);
    if(typeof base!=='function'||base.__uiCustomizerWrapped)return false;
    const wrapped=function(){
      const result=base.apply(this,arguments);
      applyUiLayout();
      installUiCustomizer();
      return result;
    };
    wrapped.__uiCustomizerWrapped=true;
    window.renderAll=wrapped;
    try{renderAll=wrapped}catch(e){}
    return true;
  }

  if(!installInvoiceClear()){
    const timer=setInterval(()=>{if(installInvoiceClear())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),20000);
  }

  wrapRenderAll();
  installUiCustomizer();
  applyUiLayout();

  if(!document.getElementById('uiCustomizerCard')){
    const timer=setInterval(()=>{
      wrapRenderAll();
      if(installUiCustomizer())clearInterval(timer);
    },400);
    setTimeout(()=>clearInterval(timer),20000);
  }
})();
