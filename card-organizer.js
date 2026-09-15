(function(){
  if(window.__cardOrganizerLoaded)return;
  window.__cardOrganizerLoaded=true;

  const STYLE_ID='card-organizer-style';
  let draggingId=null;
  let suppressClickUntil=0;
  let installed=false;
  let baseRenderCards=null;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #cardsGrid .credit-card[data-card-id]{cursor:grab;user-select:none;-webkit-user-select:none;touch-action:pan-y}
      #cardsGrid .credit-card[data-card-id]:active{cursor:grabbing}
      #cardsGrid .credit-card.card-is-dragging{opacity:.52;transform:scale(.985);cursor:grabbing!important}
      #cardsGrid .credit-card.card-drag-target{outline:1px solid rgba(var(--bank-accent-rgb,96,165,250),.50);outline-offset:3px}
      .card-delete-btn{
        position:absolute!important;
        z-index:8!important;
        top:8px;
        right:8px;
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid rgba(255,255,255,.16);
        border-radius:999px;
        background:rgba(3,7,18,.24);
        color:rgba(255,255,255,.72);
        font:500 20px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor:pointer;
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        opacity:.62;
        transition:opacity .16s ease,background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;
      }
      .credit-card:hover .card-delete-btn,.card-delete-btn:focus-visible{opacity:1}
      .card-delete-btn:hover,.card-delete-btn:focus-visible{
        background:rgba(127,29,29,.72);
        border-color:rgba(252,165,165,.50);
        color:#fff;
        outline:none;
        transform:scale(1.05);
      }
      @media(max-width:700px){
        .card-delete-btn{opacity:.82;width:28px;height:28px}
      }
      @media(prefers-reduced-motion:reduce){
        .card-delete-btn,#cardsGrid .credit-card.card-is-dragging{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  function stateReady(){
    try{return typeof state!=='undefined'&&Array.isArray(state.cards)}catch(e){return false}
  }

  function cardById(id){
    if(!stateReady())return null;
    return state.cards.find(card=>String(card.id)===String(id))||null;
  }

  function clearDragClasses(){
    document.querySelectorAll('#cardsGrid .credit-card').forEach(el=>{
      el.classList.remove('card-is-dragging','card-drag-target');
      el.setAttribute('aria-grabbed','false');
    });
  }

  function persistDomOrder(){
    if(!stateReady())return;
    const grid=document.getElementById('cardsGrid');
    if(!grid)return;
    const ids=[...grid.querySelectorAll('.credit-card[data-card-id]')].map(el=>el.dataset.cardId);
    if(ids.length!==state.cards.length)return;
    const map=new Map(state.cards.map(card=>[String(card.id),card]));
    const reordered=ids.map(id=>map.get(String(id))).filter(Boolean);
    if(reordered.length!==state.cards.length)return;
    const changed=reordered.some((card,index)=>card!==state.cards[index]);
    if(!changed)return;
    state.cards=reordered;
    try{if(typeof save==='function')save()}catch(error){console.warn('Não foi possível salvar a nova ordem dos cartões.',error)}
  }

  function deleteCard(id){
    if(!stateReady())return;
    const card=cardById(id);if(!card)return;
    const purchases=Array.isArray(state.purchases)?state.purchases.filter(p=>p.cardId===id).length:0;
    const invoices=Array.isArray(state.invoices)?state.invoices.filter(i=>i.cardId===id).length:0;
    const details=[];
    if(purchases)details.push(`${purchases} compra${purchases===1?'':'s'}`);
    if(invoices)details.push(`${invoices} fatura${invoices===1?'':'s'}`);
    const related=details.length?`\n\nTambém serão excluídas ${details.join(' e ')} vinculadas a este cartão.`:'';
    const ok=confirm(`Excluir o cartão “${card.name||'Cartão'}”?${related}\n\nEsta ação não pode ser desfeita.`);
    if(!ok)return;

    const oldIndex=state.cards.findIndex(c=>c.id===id);
    state.cards=state.cards.filter(c=>c.id!==id);
    if(Array.isArray(state.purchases))state.purchases=state.purchases.filter(p=>p.cardId!==id);
    if(Array.isArray(state.invoices))state.invoices=state.invoices.filter(i=>i.cardId!==id);

    try{
      if(typeof selectedCardId!=='undefined'&&selectedCardId===id){
        const next=state.cards[Math.min(Math.max(oldIndex,0),Math.max(state.cards.length-1,0))]||state.cards[0]||null;
        selectedCardId=next?.id||null;
      }
    }catch(e){}

    try{
      if(typeof renderAll==='function')renderAll();
      else{
        if(typeof window.renderCards==='function')window.renderCards();
        if(typeof save==='function')save();
      }
    }catch(error){
      console.error('Falha ao atualizar a tela após excluir cartão.',error);
      try{if(typeof save==='function')save()}catch(e){}
    }
  }

  window.deleteFinanceCard=deleteCard;

  function bindCard(el){
    if(el.dataset.cardOrganizerReady==='1')return;
    const id=el.dataset.cardId;if(!id)return;
    el.dataset.cardOrganizerReady='1';
    el.draggable=true;
    el.setAttribute('aria-grabbed','false');

    const del=document.createElement('button');
    del.type='button';
    del.className='card-delete-btn';
    del.setAttribute('aria-label',`Excluir ${cardById(id)?.name||'cartão'}`);
    del.title='Excluir cartão';
    del.textContent='×';
    del.addEventListener('pointerdown',event=>event.stopPropagation());
    del.addEventListener('mousedown',event=>event.stopPropagation());
    del.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      deleteCard(id);
    });
    el.appendChild(del);

    el.addEventListener('dragstart',event=>{
      if(event.target.closest?.('.card-delete-btn')){event.preventDefault();return}
      draggingId=id;
      suppressClickUntil=Date.now()+400;
      el.classList.add('card-is-dragging');
      el.setAttribute('aria-grabbed','true');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        try{event.dataTransfer.setData('text/plain',id)}catch(e){}
      }
    });

    el.addEventListener('dragenter',event=>{
      if(!draggingId||draggingId===id)return;
      event.preventDefault();
      el.classList.add('card-drag-target');
    });
    el.addEventListener('dragleave',()=>el.classList.remove('card-drag-target'));
    el.addEventListener('dragover',event=>{
      if(!draggingId||draggingId===id)return;
      event.preventDefault();
      if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      const grid=el.parentElement,dragged=grid?.querySelector(`.credit-card[data-card-id="${CSS.escape(String(draggingId))}"]`);
      if(!grid||!dragged||dragged===el)return;
      const rect=el.getBoundingClientRect();
      const centerY=rect.top+rect.height/2;
      const sameBand=Math.abs(event.clientY-centerY)<rect.height*.45;
      const before=event.clientY<rect.top+rect.height*.32||(sameBand&&event.clientX<rect.left+rect.width/2);
      grid.insertBefore(dragged,before?el:el.nextSibling);
    });
    el.addEventListener('drop',event=>{
      if(!draggingId)return;
      event.preventDefault();
      el.classList.remove('card-drag-target');
      persistDomOrder();
    });
    el.addEventListener('dragend',()=>{
      suppressClickUntil=Date.now()+300;
      persistDomOrder();
      draggingId=null;
      clearDragClasses();
    });
  }

  function decorateCards(){
    const grid=document.getElementById('cardsGrid');if(!grid)return;
    grid.querySelectorAll('.credit-card[data-card-id]').forEach(bindCard);
    if(grid.dataset.cardOrganizerCapture!=='1'){
      grid.dataset.cardOrganizerCapture='1';
      grid.addEventListener('click',event=>{
        if(Date.now()<suppressClickUntil&&!event.target.closest('.card-delete-btn')){
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      },true);
    }
  }

  function install(){
    if(installed)return true;
    if(!window.__bankBrandingLoaded||!document.getElementById('bank-branding-style-v2')||typeof window.renderCards!=='function')return false;
    injectStyles();
    baseRenderCards=window.renderCards;
    const wrapped=function(){
      const result=baseRenderCards.apply(this,arguments);
      decorateCards();
      return result;
    };
    wrapped.__cardOrganizerWrapped=true;
    window.renderCards=wrapped;
    installed=true;
    decorateCards();
    return true;
  }

  function init(){
    injectStyles();
    if(install())return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>100)clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
