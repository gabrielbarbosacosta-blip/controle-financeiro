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
