window.financeCloud={
  async load(userId){
    const {data,error}=await sb.from('finance_states').select('state,updated_at').eq('user_id',userId).maybeSingle();
    if(error)throw error;
    return data||null;
  },
  async save(userId,financeState){
    const updatedAt=new Date().toISOString();
    const {error}=await sb.from('finance_states').upsert({user_id:userId,state:financeState,updated_at:updatedAt},{onConflict:'user_id'});
    if(error)throw error;
    return updatedAt;
  }
};

pushStateToCloud=async function(){
  if(!currentUser||remoteWriteInFlight)return;
  remoteWriteInFlight=true;
  try{
    const updatedAt=await window.financeCloud.save(currentUser.id,state);
    currentUser.user_metadata={...(currentUser.user_metadata||{}),finance_updated_at:updatedAt};
    setSyncStatus('Sincronizado');
  }catch(e){
    console.error(e);
    setSyncStatus('Falha ao sincronizar',true);
  }finally{
    remoteWriteInFlight=false;
  }
};

handleSession=async function(session){
  currentUser=session?.user||null;
  if(!currentUser){
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appRoot').classList.add('auth-hidden');
    return;
  }

  try{
    const cloud=await window.financeCloud.load(currentUser.id);
    if(cloud?.state?.settings&&Array.isArray(cloud.state.transactions)){
      state=cloud.state;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    }else{
      const legacy=currentUser.user_metadata?.finance_state;
      if(legacy?.settings&&Array.isArray(legacy.transactions))state=legacy;
      await window.financeCloud.save(currentUser.id,state);
    }
  }catch(e){
    console.error(e);
    const legacy=currentUser.user_metadata?.finance_state;
    if(legacy?.settings&&Array.isArray(legacy.transactions))state=legacy;
  }

  selectedCardId=state.cards[0]?.id||null;
  selectedInvoiceYm=state.settings.selectedMonth;
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('auth-hidden');
  renderAll();
  setSyncStatus('Sincronizado');
};

(async function bootstrapFinanceCloud(){
  if(!currentUser?.id)return;
  try{
    const cloud=await window.financeCloud.load(currentUser.id);
    const cloudTime=cloud?.updated_at?Date.parse(cloud.updated_at):0;
    const legacyTime=currentUser.user_metadata?.finance_updated_at?Date.parse(currentUser.user_metadata.finance_updated_at):0;
    if(cloud?.state?.settings&&Array.isArray(cloud.state.transactions)&&cloudTime>legacyTime){
      state=cloud.state;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      selectedCardId=state.cards[0]?.id||null;
      selectedInvoiceYm=state.settings.selectedMonth;
      renderAll();
    }else{
      await window.financeCloud.save(currentUser.id,state);
    }
    setSyncStatus('Sincronizado');
  }catch(e){
    console.error(e);
    setSyncStatus('Falha ao sincronizar',true);
  }
})();
