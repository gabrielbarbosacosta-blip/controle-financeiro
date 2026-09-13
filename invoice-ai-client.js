(function(){
  window.invoiceAiRequest=async function(payload){
    const sessionResult=await sb.auth.getSession();
    if(sessionResult.error)throw sessionResult.error;
    const token=sessionResult.data?.session?.access_token;
    if(!token)throw new Error('Sessão expirada. Entre novamente.');
    const response=await fetch('/api/analyze-invoice',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if(data.error==='ai_not_configured')throw new Error('Configure OPENAI_API_KEY na Vercel para ativar a análise.');
      throw new Error(data.message||'Falha ao analisar a fatura.');
    }
    return data;
  };
})();
