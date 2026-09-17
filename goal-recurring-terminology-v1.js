(function(){
  if(window.__goalRecurringTerminologyV1Loaded)return;
  window.__goalRecurringTerminologyV1Loaded=true;

  const replacements=[
    ['Despesa recorrente do objetivo','Aporte recorrente do objetivo'],
    ['Despesa recorrente ·','Aporte recorrente ·'],
    ['Despesa recorrente','Aporte recorrente']
  ];

  function replaceText(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      let value=node.nodeValue||'';
      let next=value;
      replacements.forEach(([from,to])=>{next=next.split(from).join(to)});
      if(next!==value)node.nodeValue=next;
    });
  }

  function boot(){
    replaceText();
    const observer=new MutationObserver(mutations=>{
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE){
            let value=node.nodeValue||'';
            replacements.forEach(([from,to])=>{value=value.split(from).join(to)});
            node.nodeValue=value;
          }else if(node.nodeType===Node.ELEMENT_NODE){
            replaceText(node);
          }
        });
        if(m.type==='characterData'&&m.target?.nodeType===Node.TEXT_NODE){
          let value=m.target.nodeValue||'';
          replacements.forEach(([from,to])=>{value=value.split(from).join(to)});
          m.target.nodeValue=value;
        }
      });
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
