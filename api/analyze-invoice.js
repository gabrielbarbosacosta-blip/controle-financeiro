const SUPABASE_URL='https://eqolnqnsyomgybyrtrzt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_koTIgLL07Qe1Wf-ZY81LCA_0UO310ks';
const OPENAI_BASE='https://api.openai.com/v1';
const MAX_FILE_BYTES=3*1024*1024;
const ALLOWED_MIME=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const CATEGORIES=['Moradia','Educação','Alimentação','Transporte','Saúde','Lazer','Assinaturas','Eletrônicos','Compras','Serviços','Investimentos','Dívidas','Salário','Extra','Outros'];

function sendJson(res,status,body){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  return res.json(body);
}

async function authenticatedUser(authorization){
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:authorization}
  });
  if(!response.ok)return null;
  const user=await response.json();
  return user?.id?user:null;
}

function safeName(value){
  return String(value||'fatura').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,100)||'fatura';
}

function outputText(payload){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text;
  for(const item of payload?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==='output_text'&&typeof content.text==='string')return content.text;
    }
  }
  return '';
}

function sanitizeAnalysis(value){
  const purchases=Array.isArray(value?.purchases)?value.purchases:[];
  return {
    statement:{
      issuer:String(value?.statement?.issuer||'').trim().slice(0,120),
      cardLabel:String(value?.statement?.cardLabel||'').trim().slice(0,120),
      dueDate:/^\d{4}-\d{2}-\d{2}$/.test(String(value?.statement?.dueDate||''))?value.statement.dueDate:null,
      total:Number.isFinite(Number(value?.statement?.total))?Math.abs(Number(value.statement.total)):null,
      currency:'BRL'
    },
    purchases:purchases.slice(0,500).map(row=>({
      date:/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date||''))?row.date:null,
      description:String(row?.description||'').trim().replace(/\s+/g,' ').slice(0,180),
      amount:Math.round(Math.abs(Number(row?.amount)||0)*100)/100,
      category:CATEGORIES.includes(row?.category)?row.category:'Compras',
      installmentCurrent:Number.isInteger(row?.installmentCurrent)&&row.installmentCurrent>0?row.installmentCurrent:null,
      installmentTotal:Number.isInteger(row?.installmentTotal)&&row.installmentTotal>0?row.installmentTotal:null,
      confidence:Math.max(0,Math.min(1,Number(row?.confidence)||0)),
      note:String(row?.note||'').trim().replace(/\s+/g,' ').slice(0,200)
    })).filter(row=>row.description&&row.amount>0)
  };
}

async function uploadOpenAIFile(apiKey,buffer,fileName,mimeType){
  const form=new FormData();
  form.append('purpose','user_data');
  form.append('file',new Blob([buffer],{type:mimeType}),fileName);
  const response=await fetch(`${OPENAI_BASE}/files`,{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`},
    body:form,
    signal:AbortSignal.timeout(30000)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.id)throw new Error(payload?.error?.message||'Falha ao enviar a fatura para análise.');
  return payload.id;
}

async function deleteOpenAIFile(apiKey,fileId){
  if(!fileId)return;
  try{
    await fetch(`${OPENAI_BASE}/files/${encodeURIComponent(fileId)}`,{
      method:'DELETE',
      headers:{Authorization:`Bearer ${apiKey}`},
      signal:AbortSignal.timeout(10000)
    });
  }catch{}
}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return sendJson(res,405,{error:'method_not_allowed'});
  }

  const authorization=req.headers.authorization;
  if(!authorization||!/^Bearer\s+\S+$/i.test(authorization))return sendJson(res,401,{error:'authentication_required'});

  let user;
  try{user=await authenticatedUser(authorization);}catch{return sendJson(res,503,{error:'authentication_service_unavailable'});}
  if(!user)return sendJson(res,401,{error:'invalid_or_expired_session'});

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return sendJson(res,503,{error:'ai_not_configured'});

  const body=req.body||{};
  const fileName=safeName(body.fileName);
  const mimeType=String(body.mimeType||'').toLowerCase();
  const base64=String(body.base64||'').replace(/^data:[^;]+;base64,/, '');
  const invoiceYm=String(body.invoiceYm||'');
  const cardName=String(body.cardName||'').trim().slice(0,120);

  if(!/^\d{4}-\d{2}$/.test(invoiceYm))return sendJson(res,400,{error:'invalid_invoice_month'});
  if(!ALLOWED_MIME.has(mimeType))return sendJson(res,400,{error:'unsupported_file_type'});
  if(!base64||!/^[A-Za-z0-9+/=\r\n]+$/.test(base64))return sendJson(res,400,{error:'invalid_file'});

  let buffer;
  try{buffer=Buffer.from(base64,'base64');}catch{return sendJson(res,400,{error:'invalid_file'});}
  if(!buffer.length||buffer.length>MAX_FILE_BYTES)return sendJson(res,413,{error:'file_too_large',maxBytes:MAX_FILE_BYTES});

  let fileId=null;
  try{
    fileId=await uploadOpenAIFile(apiKey,buffer,fileName,mimeType);
    const model=process.env.OPENAI_INVOICE_MODEL||'gpt-5.6-luna';
    const schema={
      type:'object',
      additionalProperties:false,
      required:['statement','purchases'],
      properties:{
        statement:{
          type:'object',additionalProperties:false,
          required:['issuer','cardLabel','dueDate','total','currency'],
          properties:{
            issuer:{type:'string'},
            cardLabel:{type:'string'},
            dueDate:{type:['string','null']},
            total:{type:['number','null']},
            currency:{type:'string'}
          }
        },
        purchases:{
          type:'array',
          items:{
            type:'object',additionalProperties:false,
            required:['date','description','amount','category','installmentCurrent','installmentTotal','confidence','note'],
            properties:{
              date:{type:['string','null']},
              description:{type:'string'},
              amount:{type:'number'},
              category:{type:'string',enum:CATEGORIES},
              installmentCurrent:{type:['integer','null']},
              installmentTotal:{type:['integer','null']},
              confidence:{type:'number',minimum:0,maximum:1},
              note:{type:'string'}
            }
          }
        }
      }
    };

    const response=await fetch(`${OPENAI_BASE}/responses`,{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model,
        store:false,
        instructions:[
          'Você extrai lançamentos de faturas de cartão de crédito brasileiras.',
          'Retorne somente compras e cobranças efetivamente lançadas nesta fatura.',
          'Não retorne pagamento da fatura, saldo anterior, subtotal, total da fatura, limite, crédito disponível, juros informativos, parcelamentos futuros que ainda não foram cobrados, estornos, créditos ou cashback.',
          'Se uma linha for parcela já cobrada, amount deve ser apenas o valor da parcela desta fatura e informe installmentCurrent/installmentTotal quando visíveis.',
          'Não invente datas, descrições ou valores. Quando a data não estiver legível, use null.',
          `A fatura será importada somente no mês ${invoiceYm} do cartão ${cardName||'selecionado'}.`,
          'Classifique cada compra em uma das categorias fornecidas pelo schema.',
          'Use confidence baixo quando a leitura estiver ambígua.'
        ].join(' '),
        input:[{
          role:'user',
          content:[
            {type:'input_text',text:'Analise esta fatura e extraia todas as compras/cobranças efetivamente lançadas, uma linha por lançamento.'},
            {type:'input_file',file_id:fileId}
          ]
        }],
        text:{format:{type:'json_schema',name:'credit_card_invoice_analysis',strict:true,schema}},
        max_output_tokens:12000
      }),
      signal:AbortSignal.timeout(90000)
    });

    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error?.message||'A análise da fatura falhou.');
    const text=outputText(payload);
    if(!text)throw new Error('A IA não retornou dados estruturados.');

    let parsed;
    try{parsed=JSON.parse(text);}catch{throw new Error('A resposta da IA não pôde ser interpretada.');}
    const analysis=sanitizeAnalysis(parsed);
    return sendJson(res,200,{analysis,model});
  }catch(error){
    console.error('Falha na análise de fatura:',error?.message||error);
    return sendJson(res,502,{error:'invoice_analysis_failed',message:error?.message||'Falha ao analisar a fatura.'});
  }finally{
    await deleteOpenAIFile(apiKey,fileId);
  }
};
