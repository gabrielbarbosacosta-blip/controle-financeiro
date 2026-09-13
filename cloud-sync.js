(function(){
  const USER_KEY_PREFIX='controleFinanceiroWebV2:user:';
  const USER_UPDATED_PREFIX='controleFinanceiroWebV2UpdatedAt:user:';

  function validFinanceState(value){
    return !!(value&&value.settings&&Array.isArray(value.transactions)&&Array.isArray(value.cards));
  }

  function parseTime(value){
    const n=value?Date.parse(value):0;
    return Number.isFinite(n)?n:0;
  }

  function blankFinanceState(){
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

  function userStateKey(userId){return `${USER_KEY_PREFIX}${userId}`;}
  function userUpdatedKey(userId){return `${USER_UPDATED_PREFIX}${userId}`;}

  function readUserLocal(userId){
    try{
      const raw=localStorage.getItem(userStateKey(userId));
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      return validFinanceState(parsed)?parsed:null;
    }catch(e){return null;}
  }

  function writeUserLocal(userId,financeState,updatedAt){
    if(!userId||!validFinanceState(financeState))return;
    localStorage.setItem(userStateKey(userId),JSON.stringify(financeState));
    localStorage.setItem(userUpdatedKey(userId),updatedAt||new Date().toISOString());
  }

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
      writeUserLocal(userId,financeState,updatedAt);
      return updatedAt;
    }
  };

  save=function(){
    if(currentUser?.id){
      writeUserLocal(currentUser.id,state,new Date().toISOString());
    }
    scheduleCloudSave();
  };

  pushStateToCloud=async function(){
    if(!currentUser||remoteWriteInFlight)return;
    remoteWriteInFlight=true;
    try{
      await window.financeCloud.save(currentUser.id,state);
      setSyncStatus('Sincronizado');
    }catch(e){
      console.error('Falha ao salvar estado financeiro no Supabase:',e);
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

    setSyncStatus('Sincronizando…');
    try{
      const userId=currentUser.id;
      const cloud=await window.financeCloud.load(userId);
      const cloudState=validFinanceState(cloud?.state)?cloud.state:null;
      const localState=readUserLocal(userId);
      const cloudTime=parseTime(cloud?.updated_at);
      const localTime=parseTime(localStorage.getItem(userUpdatedKey(userId)));

      if(cloudState&&(!localState||cloudTime>=localTime)){
        state=cloudState;
        writeUserLocal(userId,state,cloud?.updated_at||new Date().toISOString());
      }else if(localState){
        state=localState;
        await window.financeCloud.save(userId,state);
      }else{
        state=blankFinanceState();
        await window.financeCloud.save(userId,state);
      }

      selectedCardId=state.cards[0]?.id||null;
      selectedInvoiceYm=state.settings.selectedMonth;
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('auth-hidden');
      renderAll();
      setSyncStatus('Sincronizado');
    }catch(e){
      console.error('Falha ao carregar/sincronizar estado financeiro:',e);
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('auth-hidden');
      renderAll();
      setSyncStatus('Falha ao sincronizar',true);
    }
  };

  async function bootstrap(){
    try{
      const {data,error}=await sb.auth.getSession();
      if(error)throw error;
      if(data?.session)await handleSession(data.session);
    }catch(e){
      console.error('Falha ao inicializar sincronização:',e);
      setSyncStatus('Falha ao sincronizar',true);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
