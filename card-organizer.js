(function(){
  if(window.__cardOrganizerLoaded)return;
  window.__cardOrganizerLoaded=true;

  const STYLE_ID='card-organizer-style';
  const ACTION_SELECTOR='.card-delete-btn,.card-edit-btn,button,input,select,textarea,a';
  const FLIP_DURATION=220;
  const FLIP_EASING='cubic-bezier(.22,.78,.22,1)';
  let draggingId=null;
  let suppressClickUntil=0;
  let installed=false;
  let baseRenderCards=null;
  let dragGhost=null;
  let lastPlacementKey='';
  const flipAnimations=new WeakMap();

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #cardsGrid .credit-card[data-card-id]{cursor:grab;user-select:none;-webkit-user-select:none;touch-action:pan-y;will-change:transform}
      #cardsGrid .credit-card[data-card-id]:active{cursor:grabbing}
      #cardsGrid.cards-dragging{cursor:grabbing}
      #cardsGrid .credit-card.card-is-dragging{
        opacity:.16;
        transform:scale(.965);
        filter:saturate(.72);
        cursor:grabbing!important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.13)!important;
      }
      #cardsGrid .credit-card.card-drag-target{
        outline:1px solid rgba(var(--bank-accent-rgb,96,165,250),.30);
        outline-offset:3px;
      }
      #cardsGrid .credit-card.card-is-deleting{opacity:.38;pointer-events:none;transform:scale(.985)}
      .card-drag-ghost{
        position:fixed!important;
        left:-10000px!important;
        top:-10000px!important;
        z-index:99999!important;
        margin:0!important;
        pointer-events:none!important;
        opacity:.96!important;
        transform:rotate(.65deg) scale(1.015)!important;
        box-shadow:0 22px 52px rgba(0,0,0,.36),0 0 28px rgba(var(--bank-accent-rgb,96,165,250),.13)!important;
      }
      .card-drag-ghost .card-delete-btn,.card-drag-ghost .card-edit-btn{display:none!important}
      .card-delete-btn{
        position:absolute!important;
        z-index:8!important;
        top:8px;
        right:8px;
        width:27px;
        height:27px;
        box-sizing:border-box;
        display:block;
        padding:0;
        border:1px solid rgba(255,255,255,.16);
        border-radius:999px;
        background:rgba(3,7,18,.24);
        color:rgba(255,255,255,.78);
        font-size:0;
        line-height:0;
        cursor:pointer;
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        opacity:.66;
        transition:opacity .16s ease,background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;
      }
      .card-delete-btn::before,.card-delete-btn::after{
        content:'';
        position:absolute;
        left:50%;
        top:50%;
        width:11px;
        height:1.5px;
        border-radius:999px;
        background:currentColor;
        transform-origin:center;
      }
      .card-delete-btn::before{transform:translate(-50%,-50%) rotate(45deg)}
      .card-delete-btn::after{transform:translate(-50%,-50%) rotate(-45deg)}
      .credit-card:hover .card-delete-btn,.card-delete-btn:focus-visible{opacity:1}
      .card-delete-btn:hover,.card-delete-btn:focus-visible{
        background:rgba(127,29,29,.72);
        border-color:rgba(252,165,165,.50);
        color:#fff;
        outline:none;
        transform:scale(1.05);
      }
      @media(max-width:700px){
        .card-delete-btn{opacity:.84;width:29px;height:29px}
        .card-delete-btn::before,.card-delete-btn::after{width:12px}
      }
      @media(prefers-reduced-motion:reduce){
        .card-delete-btn,#cardsGrid .credit-card.card-is-dragging,#cardsGrid .credit-card.card-is-deleting{transition:none}
      }
    `;
    document.head.appendChild(style);
  }

  function stateReady(){
    try{return typeof state!=='undefined'&&Array.isArray(state.cards)}catch(e){return false}
  }

  function cardById(id){
    if(!stateReady())return null;
    const key=String(id);
    return state.cards.find(card=>String(card.id)===key)||null;
  }

  function cardElements(grid){
    return [...grid.querySelectorAll('.credit-card[data-card-id]')];
  }

  function stopFlipAnimations(grid){
    if(!grid)return;
    cardElements(grid).forEach(el=>{
      const animation=flipAnimations.get(el);
      if(animation){
        try{animation.cancel()}catch(e){}
        flipAnimations.delete(el);
      }
    });
  }

  function captureRects(grid,except){
    stopFlipAnimations(grid);
    const rects=new Map();
    cardElements(grid).forEach(el=>{
      if(el!==except)rects.set(el,el.getBoundingClientRect());
    });
    return rects;
  }

  function animateReflow(grid,beforeRects,except){
    if(!grid||!beforeRects)return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(reduce)return;
    cardElements(grid).forEach(el=>{
      if(el===except)return;
      const before=beforeRects.get(el);
      if(!before)return;
      const after=el.getBoundingClientRect();
      const dx=before.left-after.left,dy=before.top-after.top;
      if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return;
      try{
        const animation=el.animate(
          [{transform:`translate3d(${dx}px,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],
          {duration:FLIP_DURATION,easing:FLIP_EASING,fill:'both'}
        );
        flipAnimations.set(el,animation);
        animation.onfinish=animation.oncancel=()=>{
          if(flipAnimations.get(el)===animation)flipAnimations.delete(el);
        };
      }catch(e){}
    });
  }

  function removeDragGhost(){
    if(dragGhost){
      try{dragGhost.remove()}catch(e){}
      dragGhost=null;
    }
  }

  function setSmoothDragImage(event,el){
    removeDragGhost();
    if(!event.dataTransfer||!el)return;
    const rect=el.getBoundingClientRect();
    const ghost=el.cloneNode(true);
    ghost.classList.remove('card-is-dragging','card-drag-target');
    ghost.classList.add('card-drag-ghost');
    ghost.removeAttribute('draggable');
    ghost.style.width=`${rect.width}px`;
    ghost.style.height=`${rect.height}px`;
    ghost.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    document.body.appendChild(ghost);
    dragGhost=ghost;
    const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
    try{event.dataTransfer.setDragImage(ghost,x,y)}catch(e){}
  }

  function clearDragClasses(){
    const grid=document.getElementById('cardsGrid');
    if(grid){
      grid.classList.remove('cards-dragging');
      stopFlipAnimations(grid);
    }
    document.querySelectorAll('#cardsGrid .credit-card').forEach(el=>{
      el.classList.remove('card-is-dragging','card-drag-target');
      el.setAttribute('aria-grabbed','false');
    });
    lastPlacementKey='';
    removeDragGhost();
  }

  function refreshDependentViews(){
    let cardsRendered=false;
    try{
      if(typeof window.renderCards==='function'){
        window.renderCards();
        cardsRendered=true;
      }
    }catch(error){console.error('Falha ao redesenhar cartões.',error)}

    try{if(typeof populateGlobalSelects==='function')populateGlobalSelects()}catch(e){}
    try{if(typeof renderDashboard==='function')renderDashboard()}catch(e){}
    try{if(typeof renderHistory==='function')renderHistory()}catch(e){}
    try{if(typeof renderProjection==='function')renderProjection()}catch(e){}
    try{if(typeof renderSettings==='function')renderSettings()}catch(e){}

    if(!cardsRendered){
      try{if(typeof renderAll==='function')renderAll()}catch(error){console.error('Falha ao atualizar interface após alteração de cartão.',error)}
    }
  }

  function persistDomOrder(){
    if(!stateReady())return false;
    const grid=document.getElementById('cardsGrid');
    if(!grid)return false;
    const ids=cardElements(grid).map(el=>String(el.dataset.cardId));
    if(ids.length!==state.cards.length)return false;
    const map=new Map(state.cards.map(card=>[String(card.id),card]));
    const reordered=ids.map(id=>map.get(id)).filter(Boolean);
    if(reordered.length!==state.cards.length)return false;
    const changed=reordered.some((card,index)=>card!==state.cards[index]);
    if(!changed)return false;
    state.cards=reordered;
    try{if(typeof save==='function')save()}catch(error){console.warn('Não foi possível salvar a nova ordem dos cartões.',error)}
    return true;
  }

  function desiredPlacement(el,event){
    const rect=el.getBoundingClientRect();
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const verticalDistance=Math.abs(event.clientY-centerY);
    const inSameRow=verticalDistance<=rect.height*.40;
    return inSameRow?event.clientX<centerX:event.clientY<centerY;
  }

  function moveDraggedAround(target,event){
    if(!draggingId||!target||String(target.dataset.cardId)===String(draggingId))return;
    const grid=target.parentElement;
    if(!grid)return;
    const dragged=grid.querySelector(`.credit-card[data-card-id="${CSS.escape(String(draggingId))}"]`);
    if(!dragged||dragged===target)return;

    const before=desiredPlacement(target,event);
    const placementKey=`${target.dataset.cardId}:${before?'before':'after'}`;
    if(placementKey===lastPlacementKey)return;

    if(before&&target.previousElementSibling===dragged){lastPlacementKey=placementKey;return}
    if(!before&&target.nextElementSibling===dragged){lastPlacementKey=placementKey;return}

    const rects=captureRects(grid,dragged);
    if(before)grid.insertBefore(dragged,target);
    else grid.insertBefore(dragged,target.nextSibling);
    lastPlacementKey=placementKey;
    animateReflow(grid,rects,dragged);
  }

  async function deleteCard(id){
    if(!stateReady())return;
    const key=String(id),card=cardById(key);if(!card)return;
    const purchases=Array.isArray(state.purchases)?state.purchases.filter(p=>String(p.cardId)===key).length:0;
    const invoices=Array.isArray(state.invoices)?state.invoices.filter(i=>String(i.cardId)===key).length:0;
    const details=[];
    if(purchases)details.push(`${purchases} compra${purchases===1?'':'s'}`);
    if(invoices)details.push(`${invoices} fatura${invoices===1?'':'s'}`);
    const related=details.length?`\n\nTambém serão excluídas ${details.join(' e ')} vinculadas a este cartão.`:'';
    const ok=confirm(`Excluir o cartão “${card.name||'Cartão'}”?${related}\n\nEsta ação não pode ser desfeita.`);
    if(!ok)return;

    const oldIndex=state.cards.findIndex(c=>String(c.id)===key);
    const previous={
      cards:state.cards.slice(),
      purchases:Array.isArray(state.purchases)?state.purchases.slice():[],
      invoices:Array.isArray(state.invoices)?state.invoices.slice():[],
      selectedCardId:typeof selectedCardId!=='undefined'?selectedCardId:null
    };

    const cardEl=document.querySelector(`#cardsGrid .credit-card[data-card-id="${CSS.escape(key)}"]`);
    cardEl?.classList.add('card-is-deleting');

    state.cards=state.cards.filter(c=>String(c.id)!==key);
    if(Array.isArray(state.purchases))state.purchases=state.purchases.filter(p=>String(p.cardId)!==key);
    if(Array.isArray(state.invoices))state.invoices=state.invoices.filter(i=>String(i.cardId)!==key);

    try{
      if(typeof selectedCardId!=='undefined'&&String(selectedCardId)===key){
        const safeIndex=Math.min(Math.max(oldIndex,0),Math.max(state.cards.length-1,0));
        const next=state.cards[safeIndex]||state.cards[0]||null;
        selectedCardId=next?.id||null;
      }
    }catch(e){}

    if(cardEl)cardEl.remove();
    try{if(typeof setSyncStatus==='function')setSyncStatus('Excluindo cartão…')}catch(e){}

    try{
      if(window.financeCloud?.deleteCard){
        await window.financeCloud.deleteCard(key);
      }else{
        if(typeof save==='function')save();
        throw new Error('atomic_card_delete_unavailable');
      }
      refreshDependentViews();
    }catch(error){
      console.error('Falha ao excluir cartão no servidor.',error);
      state.cards=previous.cards;
      state.purchases=previous.purchases;
      state.invoices=previous.invoices;
      try{selectedCardId=previous.selectedCardId}catch(e){}
      refreshDependentViews();
      try{if(typeof setSyncStatus==='function')setSyncStatus('Falha ao excluir cartão',true)}catch(e){}
      alert('Não foi possível excluir o cartão no servidor. Nenhum dado foi removido.');
    }
  }

  window.deleteFinanceCard=deleteCard;

  function bindCard(el){
    if(el.dataset.cardOrganizerReady==='1')return;
    const id=String(el.dataset.cardId||'');if(!id)return;
    el.dataset.cardOrganizerReady='1';
    el.draggable=true;
    el.setAttribute('aria-grabbed','false');

    const del=document.createElement('button');
    del.type='button';
    del.className='card-delete-btn';
    del.setAttribute('aria-label',`Excluir ${cardById(id)?.name||'cartão'}`);
    del.title='Excluir cartão';
    del.addEventListener('pointerdown',event=>event.stopPropagation());
    del.addEventListener('mousedown',event=>event.stopPropagation());
    del.addEventListener('dragstart',event=>{event.preventDefault();event.stopPropagation()});
    del.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      deleteCard(id);
    });
    el.appendChild(del);

    el.addEventListener('dragstart',event=>{
      if(event.target.closest?.(ACTION_SELECTOR)){event.preventDefault();return}
      const grid=el.parentElement;
      draggingId=id;
      lastPlacementKey='';
      suppressClickUntil=Date.now()+450;
      grid?.classList.add('cards-dragging');
      el.classList.add('card-is-dragging');
      el.setAttribute('aria-grabbed','true');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        try{event.dataTransfer.setData('text/plain',id)}catch(e){}
        setSmoothDragImage(event,el);
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
      moveDraggedAround(el,event);
    });
    el.addEventListener('drop',event=>{
      if(!draggingId)return;
      event.preventDefault();
      el.classList.remove('card-drag-target');
    });
    el.addEventListener('dragend',()=>{
      suppressClickUntil=Date.now()+350;
      const changed=persistDomOrder();
      draggingId=null;
      clearDragClasses();
      if(changed){
        try{if(typeof setSyncStatus==='function')setSyncStatus('Salvando nova ordem…')}catch(e){}
      }
    });
  }

  function decorateCards(){
    const grid=document.getElementById('cardsGrid');if(!grid)return;
    grid.querySelectorAll('.credit-card[data-card-id]').forEach(bindCard);
    if(grid.dataset.cardOrganizerCapture!=='1'){
      grid.dataset.cardOrganizerCapture='1';
      grid.addEventListener('click',event=>{
        if(Date.now()<suppressClickUntil&&!event.target.closest(ACTION_SELECTOR)){
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
