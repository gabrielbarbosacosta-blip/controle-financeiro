(function(){
  const COLORS={synced:'#22c55e',saving:'#f59e0b',error:'#ef4444',idle:'#64748b'};
  const LABELS={synced:'Sincronizado',saving:'Salvando',error:'Falha ao sincronizar',idle:'Status de sincronização'};

  function statusFromText(text,bad){
    const t=String(text||'').toLowerCase();
    if(bad||t.includes('falha')||t.includes('erro')||t.includes('não sincron'))return'error';
    if(t.includes('salvando')||t.includes('sincronizando'))return'saving';
    if(t.includes('sincronizado'))return'synced';
    return'idle';
  }

  function paint(status){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    const label=LABELS[status]||LABELS.idle;
    el.textContent='';
    el.setAttribute('aria-label',label);
    el.title=label;
    el.style.width='12px';
    el.style.height='12px';
    el.style.minWidth='12px';
    el.style.padding='0';
    el.style.border='0';
    el.style.borderRadius='50%';
    el.style.display='inline-block';
    el.style.background=COLORS[status]||COLORS.idle;
    el.style.boxShadow=`0 0 0 3px ${COLORS[status]||COLORS.idle}22`;
    el.style.transition='background .18s ease, box-shadow .18s ease';
    el.dataset.syncState=status;
  }

  const original=window.setSyncStatus;
  window.setSyncStatus=function(text,bad=false){
    if(typeof original==='function')original(text,bad);
    paint(statusFromText(text,bad));
  };

  function init(){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    const initial=String(el.textContent||'');
    paint(statusFromText(initial,false));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
