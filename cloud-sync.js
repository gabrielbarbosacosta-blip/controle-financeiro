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
