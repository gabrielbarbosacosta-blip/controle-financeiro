(function(){
  if(window.__cardEditControlLoaded)return;
  window.__cardEditControlLoaded=true;

  const STYLE_ID='card-edit-control-style';
  let installed=false;
  let baseRenderCards=null;
  let baseRenderCardDetail=null;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #cardDetail .section-head button[onclick^="editCard("]{display:none!important}
      .card-edit-btn{
        position:absolute!important;
        z-index:8!important;
        top:8px;
        right:43px;
        width:27px;
        height:27px;
        box-sizing:border-box;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid rgba(255,255,255,.16);
        border-radius:999px;
        background:rgba(3,7,18,.24);
        color:rgba(255,255,255,.76);
        cursor:pointer;
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        opacity:.66;
        transition:opacity .16s ease,background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;
      }
      .card-edit-btn svg{
        width:14px;
        height:14px;
        display:block;
        fill:none;
        stroke:currentColor;
        stroke-width:1.9;
        stroke-linecap:round;
        stroke-linejoin:round;
        pointer-events:none;
      }
      .credit-card:hover .card-edit-btn,.card-edit-btn:focus-visible{opacity:1}
      .card-edit-btn:hover,.card-edit-btn:focus-visible{
        background:rgba(30,41,59,.76);
        border-color:rgba(191,219,254,.44);
        color:#fff;
        outline:none;
        transform:scale(1.05);
      }
      @media(max-width:700px){
        .card-edit-btn{right:45px;opacity:.84;width:29px;height:29px}
        .card-edit-btn svg{width:15px;height:15px}
      }
      @media(prefers-reduced-motion:reduce){.card-edit-btn{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function cardById(id){
    try{return Array.isArray(state?.cards)?state.cards.find(card=>String(card.id)===String(id))||null:null}catch(e){return null}
  }

  function gearSvg(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  function bindEditButton(el){
    if(el.querySelector('.card-edit-btn'))return;
    const id=String(el.dataset.cardId||'');
    if(!id)return;
    const card=cardById(id);
    const button=document.createElement('button');
    button.type='button';
    button.className='card-edit-btn';
    button.setAttribute('aria-label',`Editar ${card?.name||'cartão'}`);
    button.title='Editar cartão';
    button.innerHTML=gearSvg();
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('mousedown',event=>event.stopPropagation());
    button.addEventListener('dragstart',event=>{event.preventDefault();event.stopPropagation()});
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      if(typeof window.editCard==='function')window.editCard(id);
    });
    el.appendChild(button);
  }

  function decorateCards(){
    const grid=document.getElementById('cardsGrid');
    if(!grid)return;
    grid.querySelectorAll('.credit-card[data-card-id]').forEach(bindEditButton);
  }

  function removeProjectionEdit(){
    document.querySelectorAll('#cardDetail .section-head button[onclick^="editCard("]').forEach(button=>button.remove());
  }

  function install(){
    if(installed)return true;
    if(!window.__bankBrandingLoaded||!document.getElementById('bank-branding-style-v2'))return false;
    if(typeof window.renderCards!=='function'||typeof window.renderCardDetail!=='function')return false;

    injectStyles();
    baseRenderCards=window.renderCards;
    baseRenderCardDetail=window.renderCardDetail;

    window.renderCards=function(){
      const result=baseRenderCards.apply(this,arguments);
      decorateCards();
      removeProjectionEdit();
      return result;
    };

    window.renderCardDetail=function(){
      const result=baseRenderCardDetail.apply(this,arguments);
      removeProjectionEdit();
      return result;
    };

    installed=true;
    decorateCards();
    removeProjectionEdit();
    return true;
  }

  function init(){
    injectStyles();
    if(install())return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>120)clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
