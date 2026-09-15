(function(){
  if(window.__bankBrandingLoaded)return;
  window.__bankBrandingLoaded=true;

  const INDEX_URL='https://cdn.jsdelivr.net/npm/logos-bancos-br@0/data/cdn-index.min.json';
  const LOGO_BASE='https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/';
  const CACHE_KEY='financeBankDirectory:v1';
  const CACHE_MAX_AGE=7*24*60*60*1000;
  const STYLE_ID='bank-branding-style';
  const COMMON_BANK_CODES={
    'bb':'001','banco do brasil':'001','banco do brasil sa':'001','bco do brasil sa':'001',
    'nubank':'260','nu pagamentos':'260','nu pagamentos sa':'260',
    'itau':'341','itau unibanco':'341','itau unibanco sa':'341',
    'santander':'033','banco santander':'033','banco santander brasil sa':'033',
    'caixa':'104','caixa economica federal':'104',
    'bradesco':'237','banco bradesco':'237','banco bradesco sa':'237',
    'inter':'077','banco inter':'077','banco inter sa':'077',
    'c6':'336','c6 bank':'336','banco c6':'336','banco c6 sa':'336',
    'btg':'208','btg pactual':'208','banco btg pactual':'208',
    'sicoob':'756','bancoob':'756','banco cooperativo sicoob':'756',
    'sicredi':'748','banco cooperativo sicredi':'748'
  };
  let institutions=[];
  let byIspb=new Map();
  let selectedBank=null;
  let pickerReady=false;
  let cardsObserver=null;
  let detailObserver=null;

  const normalize=value=>String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .bank-picker{position:relative}
      .bank-picker-control{display:flex;align-items:center;gap:9px;min-height:40px;padding:0 10px;border:1px solid #334155;border-radius:9px;background:#0f172a}
      .bank-picker-control:focus-within{border-color:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.12)}
      .bank-picker-control input{min-width:0;flex:1;border:0!important;background:transparent!important;padding:9px 0!important;outline:0!important;box-shadow:none!important}
      .bank-logo-shell{width:28px;height:28px;flex:0 0 28px;border-radius:8px;display:grid;place-items:center;background:#fff;border:1px solid rgba(148,163,184,.25);overflow:hidden;color:#172033;font-size:10px;font-weight:900;letter-spacing:-.02em}
      .bank-logo-shell img{width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box}
      .bank-picker-results{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:120;background:#101827;border:1px solid #334155;border-radius:11px;box-shadow:0 18px 40px rgba(0,0,0,.38);max-height:300px;overflow:auto;padding:5px}
      .bank-picker.open .bank-picker-results{display:block}
      .bank-picker-result{width:100%;display:flex;align-items:center;gap:10px;padding:8px;border:0;border-radius:8px;background:transparent;color:#e2e8f0;text-align:left;cursor:pointer}
      .bank-picker-result:hover,.bank-picker-result:focus{background:#1e293b;outline:0}
      .bank-picker-result-copy{min-width:0;flex:1}
      .bank-picker-result-name{font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bank-picker-result-code{margin-top:2px;font-size:10px;color:#64748b}
      .bank-picker-empty{padding:13px 10px;color:#64748b;font-size:11px;text-align:center}
      .bank-picker-help{display:block;margin-top:5px;color:#64748b;font-size:10px}
      .bank-card-account{display:flex!important;align-items:center;gap:8px!important}
      .bank-card-account .bank-logo-shell{width:24px;height:24px;flex-basis:24px;border-radius:7px}
      .bank-card-account-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .invoice-bank-brand{display:inline-flex;align-items:center;gap:7px;margin-left:10px;color:#94a3b8;font-size:11px;font-weight:650}
      .invoice-bank-brand .bank-logo-shell{width:25px;height:25px;flex-basis:25px;border-radius:7px}
      .invoice-title-bank-logo{display:inline-grid!important;vertical-align:middle;margin-right:8px;width:27px!important;height:27px!important;transform:translateY(4px)}
      @media(max-width:700px){.invoice-bank-brand .bank-name-text{display:none}}
    `;
    document.head.appendChild(style);
  }

  function initials(name){
    const parts=String(name||'Banco').replace(/[^A-Za-zÀ-ÿ0-9 ]+/g,' ').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return'B';
    return (parts.length===1?parts[0].slice(0,2):parts[0][0]+parts[1][0]).toUpperCase();
  }

  function parseDirectory(payload){
    const raw=payload&&payload.institutions&&typeof payload.institutions==='object'?payload.institutions:{};
    const list=[];
    for(const [ispb,value] of Object.entries(raw)){
      if(!Array.isArray(value)||!value[1])continue;
      const code=value[0]==null?'':String(value[0]).replace(/\D/g,'');
      const flags=Number(value[2])||0;
      list.push({
        ispb:String(ispb).padStart(8,'0'),
        code:code?code.padStart(3,'0'):'',
        name:String(value[1]),
        flags,
        logoIspb:String(value[3]||ispb).padStart(8,'0')
      });
    }
    list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    institutions=list;
    byIspb=new Map(list.map(item=>[item.ispb,item]));
  }

  function findByCode(code){
    const normalized=String(code||'').replace(/\D/g,'').padStart(3,'0');
    return institutions.find(inst=>inst.code===normalized)||null;
  }

  function aliasInstitution(value){
    const code=COMMON_BANK_CODES[normalize(value)];
    return code?findByCode(code):null;
  }

  function readCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(!cached||!cached.data||!cached.savedAt||Date.now()-cached.savedAt>CACHE_MAX_AGE)return false;
      parseDirectory(cached.data);
      return institutions.length>0;
    }catch(e){return false}
  }

  async function loadDirectory(){
    const hadCache=readCache();
    if(hadCache){scheduleEnhance();syncOpenCardModal();}
    try{
      const response=await fetch(INDEX_URL,{cache:'force-cache'});
      if(!response.ok)throw new Error(`bank_directory_${response.status}`);
      const data=await response.json();
      parseDirectory(data);
      try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(e){}
      migrateLegacyCards();
      scheduleEnhance();
      syncOpenCardModal();
    }catch(error){
      console.warn('Diretório de bancos indisponível; mantendo emissor manual.',error);
    }
  }

  function institutionLogoUrl(instOrCard){
    if(!instOrCard)return null;
    const raw=String(instOrCard.logoIspb||instOrCard.bankIspb||instOrCard.ispb||'').replace(/\D/g,'');
    if(!raw)return null;
    const ispb=raw.padStart(8,'0');
    if(!/^\d{8}$/.test(ispb))return null;
    if('flags' in instOrCard && !(Number(instOrCard.flags)&1))return null;
    return `${LOGO_BASE}${ispb}.png`;
  }

  function makeLogo(instOrCard,name,className=''){
    const shell=document.createElement('span');
    shell.className=`bank-logo-shell ${className}`.trim();
    shell.textContent=initials(name);
    const url=institutionLogoUrl(instOrCard);
    if(url){
      const img=document.createElement('img');
      img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=url;
      img.onload=()=>{shell.textContent='';shell.appendChild(img)};
      img.onerror=()=>{};
    }
    return shell;
  }

  function score(inst,q){
    if(!q)return 0;
    const name=normalize(inst.name),code=inst.code,ispb=inst.ispb;
    let s=0;
    if(code===q||ispb===q)s+=100;
    if(name===q)s+=90;
    if(name.startsWith(q))s+=60;
    if(name.includes(q))s+=35;
    const tokens=q.split(' ').filter(Boolean);
    if(tokens.length&&tokens.every(t=>name.includes(t)))s+=25;
    if(code&&code.includes(q))s+=20;
    if(ispb.includes(q))s+=15;
    return s;
  }

  function searchBanks(value){
    const q=normalize(value);
    if(!q)return [];
    const alias=aliasInstitution(q);
    const ranked=institutions.map(inst=>({inst,score:score(inst,q)})).filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||a.inst.name.localeCompare(b.inst.name,'pt-BR'))
      .map(x=>x.inst);
    if(alias){
      const without=ranked.filter(inst=>inst.ispb!==alias.ispb);
      without.unshift(alias);
      return without.slice(0,14);
    }
    return ranked.slice(0,14);
  }

  function resolveInstitution(card){
    if(!card)return null;
    const rawIspb=String(card.bankIspb||'').replace(/\D/g,'');
    const ispb=rawIspb?rawIspb.padStart(8,'0'):'';
    if(ispb&&byIspb.has(ispb))return byIspb.get(ispb);
    if(ispb&&/^\d{8}$/.test(ispb))return{ispb,logoIspb:ispb,code:String(card.bankCode||''),name:card.bankName||card.account||card.name,flags:1};
    const q=normalize(card.bankName||card.account||'');
    if(!q)return null;
    const alias=aliasInstitution(q);
    if(alias)return alias;
    let exact=institutions.find(inst=>normalize(inst.name)===q);
    if(exact)return exact;
    const common=institutions.filter(inst=>normalize(inst.name).includes(q)||q.includes(normalize(inst.name)));
    if(common.length===1)return common[0];
    const cardName=normalize(card.name||'');
    const nameAlias=aliasInstitution(cardName);
    if(nameAlias)return nameAlias;
    if(cardName){
      const candidates=institutions.map(inst=>({inst,score:score(inst,cardName)})).filter(x=>x.score>=60).sort((a,b)=>b.score-a.score);
      if(candidates.length&&(!candidates[1]||candidates[0].score>candidates[1].score))return candidates[0].inst;
    }
    return null;
  }

  function migrateLegacyCards(){
    if(typeof state==='undefined'||!Array.isArray(state?.cards)||!institutions.length)return;
    let changed=false;
    for(const card of state.cards){
      if(card.bankIspb)continue;
      const inst=aliasInstitution(card.account)||aliasInstitution(card.name);
      if(!inst)continue;
      card.bankIspb=inst.ispb;
      card.bankCode=inst.code||null;
      card.bankName=inst.name;
      changed=true;
    }
    if(changed&&typeof renderAll==='function')renderAll();
  }

  function bankDisplayName(card,inst){return card?.bankName||inst?.name||card?.account||'Banco / emissor'}

  function renderResults(value){
    const picker=document.getElementById('cardBankPicker');
    const results=document.getElementById('cardBankResults');
    if(!picker||!results)return;
    const q=String(value||'').trim();
    if(!q){results.innerHTML='<div class="bank-picker-empty">Digite o nome, código do banco ou ISPB.</div>';return}
    const matches=searchBanks(q);
    if(!matches.length){results.innerHTML='<div class="bank-picker-empty">Nenhuma instituição encontrada. Você pode manter o nome digitado como emissor.</div>';return}
    results.innerHTML='';
    matches.forEach(inst=>{
      const btn=document.createElement('button');btn.type='button';btn.className='bank-picker-result';
      btn.appendChild(makeLogo(inst,inst.name));
      const copy=document.createElement('span');copy.className='bank-picker-result-copy';
      copy.innerHTML=`<span class="bank-picker-result-name">${esc(inst.name)}</span><span class="bank-picker-result-code">${inst.code?`Banco ${esc(inst.code)} • `:''}ISPB ${esc(inst.ispb)}</span>`;
      btn.appendChild(copy);
      btn.addEventListener('click',()=>selectBank(inst));
      results.appendChild(btn);
    });
  }

  function updatePickerLogo(inst,name){
    const host=document.getElementById('cardBankLogo');
    if(!host)return;
    host.replaceChildren(makeLogo(inst,name));
  }

  function selectBank(inst){
    selectedBank=inst||null;
    const input=document.getElementById('cardBankSearch');
    const account=document.getElementById('cardAccount');
    const picker=document.getElementById('cardBankPicker');
    if(input)input.value=inst?.name||'';
    if(account)account.value=inst?.name||'';
    updatePickerLogo(inst,inst?.name||'Banco');
    picker?.classList.remove('open');
  }

  function ensurePicker(){
    if(pickerReady&&document.getElementById('cardBankPicker'))return true;
    const account=document.getElementById('cardAccount');
    const field=account?.closest('.field');
    if(!account||!field)return false;
    injectStyles();
    const label=field.querySelector('label');
    if(label)label.textContent='Banco / emissor';
    account.type='hidden';
    account.style.display='none';
    const picker=document.createElement('div');
    picker.id='cardBankPicker';picker.className='bank-picker';
    picker.innerHTML=`<div class="bank-picker-control"><span id="cardBankLogo"></span><input id="cardBankSearch" autocomplete="off" placeholder="Digite Banco do Brasil, Nubank, 341…" aria-label="Banco ou emissor"></div><div class="bank-picker-results" id="cardBankResults"></div><small class="bank-picker-help">Busca por nome, código bancário ou ISPB. Se não encontrar, o texto digitado será salvo como emissor.</small>`;
    field.insertBefore(picker,account);
    const input=picker.querySelector('#cardBankSearch');
    input.addEventListener('focus',()=>{picker.classList.add('open');renderResults(input.value)});
    input.addEventListener('input',()=>{
      selectedBank=null;
      account.value=input.value.trim();
      updatePickerLogo(null,input.value);
      picker.classList.add('open');renderResults(input.value);
    });
    input.addEventListener('keydown',event=>{if(event.key==='Escape')picker.classList.remove('open')});
    document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target))picker.classList.remove('open')});
    updatePickerLogo(null,'Banco');
    pickerReady=true;
    return true;
  }

  function syncPicker(card){
    if(!ensurePicker())return;
    const input=document.getElementById('cardBankSearch');
    const account=document.getElementById('cardAccount');
    if(!card){
      selectedBank=null;
      if(input)input.value='';
      if(account)account.value='';
      updatePickerLogo(null,'Banco');
      return;
    }
    const inst=resolveInstitution(card);
    selectedBank=inst;
    const display=card.bankName||inst?.name||card.account||'';
    if(input)input.value=display;
    if(account)account.value=card.account||display;
    updatePickerLogo(inst||card,display||card.name);
  }

  function syncOpenCardModal(){
    const modal=document.getElementById('cardModal');
    if(!modal?.classList.contains('open'))return;
    const id=document.getElementById('cardId')?.value||'';
    const card=id&&typeof state!=='undefined'?state.cards.find(c=>c.id===id):null;
    syncPicker(card);
  }

  function enhanceCardGrid(){
    const grid=document.getElementById('cardsGrid');
    if(!grid||typeof state==='undefined'||!Array.isArray(state?.cards))return;
    grid.querySelectorAll('.credit-card').forEach(el=>{
      const onclick=el.getAttribute('onclick')||'';
      const match=onclick.match(/selectCard\(['\"]([^'\"]+)['\"]\)/);
      const card=match?state.cards.find(c=>c.id===match[1]):null;
      if(!card)return;
      const inst=resolveInstitution(card);
      const key=`${card.bankIspb||inst?.ispb||''}|${card.bankName||card.account||''}`;
      if(el.dataset.bankBrandKey===key)return;
      el.dataset.bankBrandKey=key;
      const accountEl=el.querySelector('.account');
      if(!accountEl)return;
      accountEl.classList.add('bank-card-account');
      accountEl.replaceChildren();
      accountEl.appendChild(makeLogo(inst||card,bankDisplayName(card,inst)));
      const text=document.createElement('span');text.className='bank-card-account-text';text.textContent=bankDisplayName(card,inst);
      accountEl.appendChild(text);
    });
  }

  function enhanceCardDetail(){
    if(typeof state==='undefined'||!Array.isArray(state?.cards))return;
    let card=null;
    try{card=state.cards.find(c=>c.id===selectedCardId)||null}catch(e){}
    if(!card)return;
    const inst=resolveInstitution(card);
    const heading=[...document.querySelectorAll('#cardDetail .section-head h3')].find(h=>String(h.textContent||'').trim().startsWith('Fatura '));
    if(!heading)return;
    const key=card.bankIspb||inst?.ispb||card.account||'';
    if(heading.dataset.bankBrandKey===key)return;
    heading.dataset.bankBrandKey=key;
    heading.querySelector('.invoice-title-bank-logo')?.remove();
    heading.prepend(makeLogo(inst||card,bankDisplayName(card,inst),'invoice-title-bank-logo'));
  }

  function decorateInvoiceModal(card){
    const head=document.querySelector('#invoiceModal .modal-head');
    const title=head?.querySelector('h3');
    if(!head||!title||!card)return;
    head.querySelector('.invoice-bank-brand')?.remove();
    const inst=resolveInstitution(card);
    const brand=document.createElement('span');brand.className='invoice-bank-brand';
    brand.appendChild(makeLogo(inst||card,bankDisplayName(card,inst)));
    const name=document.createElement('span');name.className='bank-name-text';name.textContent=bankDisplayName(card,inst);brand.appendChild(name);
    title.insertAdjacentElement('afterend',brand);
  }

  function scheduleEnhance(){requestAnimationFrame(()=>{enhanceCardGrid();enhanceCardDetail()})}

  function installFormIntegration(){
    if(!ensurePicker())return false;
    const form=document.getElementById('cardForm');
    if(!form||form.dataset.bankBrandingWrapped==='1')return !!form;
    const baseSubmit=form.onsubmit;
    if(typeof baseSubmit!=='function')return false;
    form.dataset.bankBrandingWrapped='1';
    form.onsubmit=function(event){
      const idBefore=document.getElementById('cardId')?.value||'';
      const input=document.getElementById('cardBankSearch');
      const account=document.getElementById('cardAccount');
      const typed=String(input?.value||'').trim();
      if(account)account.value=selectedBank?.name||typed;
      baseSubmit.call(this,event);
      let id=idBefore;
      if(!id){try{id=selectedCardId||''}catch(e){}}
      const card=id&&typeof state!=='undefined'?state.cards.find(c=>c.id===id):null;
      if(card){
        if(selectedBank){
          card.bankIspb=selectedBank.ispb;
          card.bankCode=selectedBank.code||null;
          card.bankName=selectedBank.name;
          card.account=selectedBank.name;
        }else{
          delete card.bankIspb;delete card.bankCode;delete card.bankName;
          card.account=typed;
        }
        if(typeof renderAll==='function')renderAll();
      }
    };

    const add=document.getElementById('addCardBtn');
    add?.addEventListener('click',()=>setTimeout(()=>syncPicker(null),0));

    const baseEdit=window.editCard;
    if(typeof baseEdit==='function'&&!baseEdit.__bankBrandingWrapped){
      const wrapped=function(id){const result=baseEdit.apply(this,arguments);setTimeout(()=>{const card=typeof state!=='undefined'?state.cards.find(c=>c.id===id):null;syncPicker(card)},0);return result};
      wrapped.__bankBrandingWrapped=true;
      window.editCard=wrapped;
    }

    const baseInvoice=window.openInvoiceModal;
    if(typeof baseInvoice==='function'&&!baseInvoice.__bankBrandingWrapped){
      const wrapped=function(cardId,ym){const result=baseInvoice.apply(this,arguments);const card=typeof state!=='undefined'?state.cards.find(c=>c.id===cardId):null;decorateInvoiceModal(card);return result};
      wrapped.__bankBrandingWrapped=true;
      window.openInvoiceModal=wrapped;
    }
    return true;
  }

  function initObservers(){
    const grid=document.getElementById('cardsGrid');
    if(grid&&!cardsObserver){cardsObserver=new MutationObserver(enhanceCardGrid);cardsObserver.observe(grid,{childList:true,subtree:true})}
    const detail=document.getElementById('cardDetail');
    if(detail&&!detailObserver){detailObserver=new MutationObserver(enhanceCardDetail);detailObserver.observe(detail,{childList:true,subtree:true})}
  }

  function init(){
    injectStyles();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const ok=installFormIntegration();
      initObservers();scheduleEnhance();
      if(ok||tries>80)clearInterval(timer);
    },100);
    loadDirectory();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
