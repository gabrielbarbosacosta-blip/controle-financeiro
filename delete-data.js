(function(){
  const USER_KEY_PREFIX='controleFinanceiroWebV2:user:';
  const USER_UPDATED_PREFIX='controleFinanceiroWebV2UpdatedAt:user:';

  function emptyFinanceState(){
    const now=new Date();
    const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const date=`${ym}-01`;
    return {
      settings:{baseBalance:0,baseDate:date,selectedMonth:ym},
      transactions:[],
      cards:[],
      purchases:[],
      invoices:[]
    };
  }

  async function eraseAllFinancialData(event){
    event.preventDefault();
    event.stopImmediatePropagation();

    if(!currentUser?.id){
      alert('Nenhum usuário autenticado.');
      return;
    }

    const confirmed=confirm('Apagar todos os dados financeiros desta conta?\n\nEsta ação remove lançamentos, cartões, compras, faturas, dívidas, receitas e configurações financeiras. Ela não pode ser desfeita.');
    if(!confirmed)return;

    const finalConfirmation=prompt('Para confirmar, digite APAGAR:');
    if(finalConfirmation!=='APAGAR'){
      alert('Operação cancelada.');
      return;
    }

    const button=document.getElementById('resetBtn');
    const oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent='Apagando…';}
    setSyncStatus('Apagando…');

    try{
      const userId=currentUser.id;
      const {error}=await sb.from('finance_states').delete().eq('user_id',userId);
      if(error)throw error;

      localStorage.removeItem(`${USER_KEY_PREFIX}${userId}`);
      localStorage.removeItem(`${USER_UPDATED_PREFIX}${userId}`);
      localStorage.removeItem('controleFinanceiroWebV2');
      localStorage.removeItem('controleFinanceiroWebV2UpdatedAt');
      localStorage.removeItem('controleFinanceiroWebV1');

      state=emptyFinanceState();
      selectedCardId=null;
      selectedInvoiceYm=state.settings.selectedMonth;
      renderAll();
      setSyncStatus('Dados apagados');
      alert('Todos os dados financeiros desta conta foram apagados.');
    }catch(error){
      console.error('Falha ao apagar os dados financeiros:',error);
      setSyncStatus('Falha ao apagar',true);
      alert('Não foi possível apagar os dados. Tente novamente.');
    }finally{
      if(button){button.disabled=false;button.textContent=oldText||'Apagar todos os dados';}
    }
  }

  function init(){
    const button=document.getElementById('resetBtn');
    if(!button)return;

    const card=button.closest('.danger-zone')||button.closest('.card');
    const title=card?.querySelector('h3');
    const text=card?.querySelector('p');

    if(title)title.textContent='Apagar todos os dados';
    if(text)text.textContent='Exclui permanentemente todos os dados financeiros desta conta, sem apagar o usuário.';
    button.textContent='Apagar todos os dados';
    button.addEventListener('click',eraseAllFinancialData,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
