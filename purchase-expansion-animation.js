(function(){
  if(window.__purchaseExpansionAnimationLoaded)return;
  window.__purchaseExpansionAnimationLoaded=true;

  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STYLE_ID='purchase-expansion-animation-style';

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .purchase-expand-shell,.purchase-name-expand-shell{
        display:grid;
        grid-template-rows:1fr;
        opacity:1;
        transition:grid-template-rows .38s cubic-bezier(.22,1,.36,1),opacity .24s ease-out;
        will-change:grid-template-rows,opacity;
      }
      .purchase-expand-inner,.purchase-name-expand-inner{
        min-height:0;
        overflow:hidden;
      }
      .invoice-purchase-group.collapsed > .purchase-expand-shell{
        grid-template-rows:0fr;
        opacity:0;
        pointer-events:none;
      }
      .purchase-name-group.collapsed > .purchase-name-expand-shell{
        grid-template-rows:0fr;
        opacity:0;
        pointer-events:none;
      }

      /* O componente original usa display:none; o shell passa a controlar a altura para permitir transição. */
      .invoice-purchase-group.collapsed > .purchase-expand-shell .detail-line{display:flex!important;}
      .invoice-purchase-group.collapsed > .purchase-expand-shell .purchase-name-group{display:block!important;}
      .purchase-name-group.collapsed > .purchase-name-expand-shell .detail-line{display:flex!important;}

      .purchase-section-chevron,.purchase-name-chevron{
        transition:transform .34s cubic-bezier(.22,1,.36,1)!important;
      }

      @media (prefers-reduced-motion: reduce){
        .purchase-expand-shell,.purchase-name-expand-shell,.purchase-section-chevron,.purchase-name-chevron{
          transition:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function wrapNameGroup(group){
    if(!group||group.querySelector(':scope > .purchase-name-expand-shell'))return;
    const toggle=group.querySelector(':scope > .purchase-name-toggle');
    if(!toggle)return;
    const children=[...group.children].filter(el=>el!==toggle);
    if(!children.length)return;
    const shell=document.createElement('div');
    shell.className='purchase-name-expand-shell';
    const inner=document.createElement('div');
    inner.className='purchase-name-expand-inner';
    children.forEach(el=>inner.appendChild(el));
    shell.appendChild(inner);
    group.appendChild(shell);
  }

  function wrapSection(group){
    if(!group||group.querySelector(':scope > .purchase-expand-shell'))return;
    const head=group.querySelector(':scope > .invoice-purchase-group-head');
    if(!head)return;
    const children=[...group.children].filter(el=>el!==head);
    if(!children.length)return;
    children.filter(el=>el.classList?.contains('purchase-name-group')).forEach(wrapNameGroup);
    const shell=document.createElement('div');
    shell.className='purchase-expand-shell';
    const inner=document.createElement('div');
    inner.className='purchase-expand-inner';
    children.forEach(el=>inner.appendChild(el));
    shell.appendChild(inner);
    group.appendChild(shell);
  }

  function enhance(root=document){
    root.querySelectorAll?.('.invoice-purchase-group').forEach(wrapSection);
    root.querySelectorAll?.('.purchase-name-group').forEach(wrapNameGroup);
  }

  function animateManagerRows(records){
    if(reduced())return;
    for(const record of records){
      if(record.type!=='attributes'||record.attributeName!=='class')continue;
      const row=record.target;
      if(!(row instanceof HTMLElement)||row.tagName!=='TR')continue;
      const old=record.oldValue||'';
      const openedSection=old.includes('purchase-section-item-collapsed')&&!row.classList.contains('purchase-section-item-collapsed');
      const openedName=old.includes('purchase-name-item-hidden')&&!row.classList.contains('purchase-name-item-hidden');
      if(!openedSection&&!openedName)continue;
      row.animate([
        {opacity:0,transform:'translateY(-5px)'},
        {opacity:1,transform:'translateY(0)'}
      ],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }

  function init(){
    injectStyles();
    enhance(document);

    const domObserver=new MutationObserver(records=>{
      for(const record of records){
        record.addedNodes.forEach(node=>{
          if(!(node instanceof HTMLElement))return;
          if(node.matches?.('.invoice-purchase-group'))wrapSection(node);
          if(node.matches?.('.purchase-name-group'))wrapNameGroup(node);
          enhance(node);
        });
      }
    });
    domObserver.observe(document.body,{childList:true,subtree:true});

    const manager=document.getElementById('purchaseManagerBody');
    if(manager){
      const managerObserver=new MutationObserver(animateManagerRows);
      managerObserver.observe(manager,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
    }

    const managerFinder=new MutationObserver(()=>{
      const body=document.getElementById('purchaseManagerBody');
      if(!body||body.dataset.expansionAnimationObserved)return;
      body.dataset.expansionAnimationObserved='1';
      const observer=new MutationObserver(animateManagerRows);
      observer.observe(body,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
    });
    managerFinder.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
