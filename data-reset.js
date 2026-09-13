(function(){
  function mount(){
    const grid=document.querySelector('#page-settings .settings-grid');
    if(!grid||document.getElementById('wipeDataBtn'))return;
    const card=document.createElement('div');
    card.className='card danger-zone';
    card.innerHTML='<h3>Apagar todos os dados</h3><p class="muted">Zera os dados financeiros desta conta e mantém o login.</p><button class="btn danger" id="wipeDataBtn">Apagar todos os dados</button>';
    grid.appendChild(card);
    card.querySelector('button').onclick=async()=>{
      if(!currentUser?.id||!confirm('Apagar todos os dados financeiros desta conta?'))return;
      const d=new Date(),ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      state={settings:{baseBalance:0,baseDate:ym+'-01',selectedMonth:ym},transactions:[],cards:[],purchases:[],invoices:[]};
      selectedCardId=null;selectedInvoiceYm=ym;
      if(window.financeCloud)await window.financeCloud.save(currentUser.id,state);
      renderAll();
      alert('Dados financeiros apagados.');
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
