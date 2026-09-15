(function(){
  if(window.__bankBrandingLoaded)return;
  window.__bankBrandingLoaded=true;

  const INDEX_URL='https://cdn.jsdelivr.net/npm/logos-bancos-br@0/data/cdn-index.min.json';
  const LOGO_BASE='https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/';
  const DIRECTORY_CACHE_KEY='financeBankDirectory:v1';
  const COLOR_CACHE_PREFIX='financeBankDominantColor:v2:';
  const CACHE_MAX_AGE=7*24*60*60*1000;
  const STYLE_ID='bank-branding-style-v2';
  const DEFAULT_ACCENT='#64748B';
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
  const COMMON_FALLBACKS={
    '001':'#F4D000','033':'#EC0000','077':'#FF7A00','104':'#0067A0',
    '208':'#0A2440','237':'#CC092F','260':'#820AD1','336':'#384047',
    '341':'#EC7000','748':'#00A091','756':'#00AE9D'
  };

  let institutions=[];
  let byIspb=new Map();
  let selectedBank=null;
  let selectedColor=null;
  let pickerReady=false;
  let hydrating=false;
  let hydrationQueued=false;
  const pendingColors=new Map();
  const preloaded=new Set();

  const normalize=value=>String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    document.getElementById('bank-branding-style')?.remove();
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .bank-picker{position:relative}
      .bank-picker-control{display:flex;align-items:center;gap:11px;min-height:44px;padding:0 10px;border:1px solid #334155;border-radius:9px;background:#0f172a}
      .bank-picker-control:focus-within{border-color:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.12)}
      .bank-picker-control input{min-width:0;flex:1;border:0!important;background:transparent!important;padding:9px 0!important;outline:0!important;box-shadow:none!important}
      .bank-picker-results{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:120;background:#101827;border:1px solid #334155;border-radius:11px;box-shadow:0 18px 40px rgba(0,0,0,.38);max-height:300px;overflow:auto;padding:5px}
      .bank-picker.open .bank-picker-results{display:block}
      .bank-picker-result{width:100%;display:flex;align-items:center;gap:11px;padding:8px;border:0;border-radius:8px;background:transparent;color:#e2e8f0;text-align:left;cursor:pointer}
      .bank-picker-result:hover,.bank-picker-result:focus{background:#1e293b;outline:0}
      .bank-picker-result-copy{min-width:0;flex:1}
      .bank-picker-result-name{display:block;font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bank-picker-result-code{display:block;margin-top:2px;font-size:10px;color:#64748b}
      .bank-picker-empty{padding:13px 10px;color:#64748b;font-size:11px;text-align:center}
      .bank-picker-help{display:block;margin-top:5px;color:#64748b;font-size:10px}

      .bank-logo-shell{width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;background:transparent;border:0;border-radius:10px;overflow:hidden;color:#94a3b8;font-size:10px;font-weight:900;letter-spacing:-.02em}
      .bank-logo-shell .bank-logo-fallback,.bank-logo-shell img{grid-area:1/1;width:100%;height:100%;border-radius:inherit}
      .bank-logo-shell .bank-logo-fallback{display:grid;place-items:center;padding:0;box-sizing:border-box}
      .bank-logo-shell.has-logo .bank-logo-fallback{visibility:hidden}
      .bank-logo-shell img{object-fit:contain;padding:0;box-sizing:border-box;background:transparent;display:block}
      .bank-card-account{display:flex!important;align-items:center;gap:10px!important}
      .bank-card-account .bank-logo-shell{width:32px;height:32px;flex-basis:32px;border-radius:9px}
      .bank-card-account-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .invoice-heading{display:flex;align-items:center;gap:9px}
      .invoice-title-bank-logo{order:-1;width:36px!important;height:36px!important;flex:0 0 36px!important;border-radius:10px}
      .invoice-bank-brand{display:inline-flex;align-items:center;margin-left:10px}
      .invoice-bank-brand .bank-logo-shell{width:34px;height:34px;flex-basis:34px;border-radius:10px}

      .credit-card.bank-liquid-card{
        --bank-accent-rgb:100,116,139;
        position:relative;
        isolation:isolate;
        overflow:hidden;
        background:
          linear-gradient(145deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.07) 31%,rgba(255,255,255,.025) 62%),
          linear-gradient(135deg,rgba(var(--bank-accent-rgb),.34) 0%,rgba(var(--bank-accent-rgb),.14) 44%,rgba(8,15,29,.60) 100%)!important;
        border:1px solid rgba(var(--bank-accent-rgb),.46)!important;
        box-shadow:
          0 14px 32px rgba(0,0,0,.22),
          0 0 24px rgba(var(--bank-accent-rgb),.10),
          inset 0 1px 0 rgba(255,255,255,.22),
          inset 0 -1px 0 rgba(255,255,255,.045)!important;
        backdrop-filter:blur(14px) saturate(145%);
        -webkit-backdrop-filter:blur(14px) saturate(145%);
      }
      .credit-card.bank-liquid-card::before{
        content:'';
        position:absolute;
        z-index:0;
        inset:0;
        pointer-events:none;
        background:
          radial-gradient(circle at 14% 8%,rgba(255,255,255,.28) 0%,rgba(255,255,255,.10) 18%,rgba(255,255,255,0) 42%),
          radial-gradient(circle at 105% 125%,rgba(var(--bank-accent-rgb),.28) 0%,rgba(var(--bank-accent-rgb),.10) 36%,rgba(var(--bank-accent-rgb),0) 68%);
      }
      .credit-card.bank-liquid-card>*{position:relative;z-index:1}
      .credit-card.bank-liquid-card.active{
        border-color:rgba(var(--bank-accent-rgb),.76)!important;
        box-shadow:
          0 16px 36px rgba(0,0,0,.26),
          0 0 28px rgba(var(--bank-accent-rgb),.18),
          inset 0 1px 0 rgba(255,255,255,.27),
          inset 0 -1px 0 rgba(255,255,255,.05)!important;
      }
      .credit-card.bank-liquid-card .bank-logo-shell img{filter:drop-shadow(0 2px 7px rgba(var(--bank-accent-rgb),.22))}
      @media(max-width:700px){
        .bank-card-account .bank-logo-shell{width:30px;height:30px;flex-basis:30px}
        .invoice-title-bank-logo{width:34px!important;height:34px!important;flex-basis:34px!important}
      }
      @media(prefers-reduced-motion:no-preference){
        .credit-card.bank-liquid-card{transition:border-color .18s ease,box-shadow .18s ease}
      }
    `;
    document.head.appendChild(style);
  }

  function initials(name){
    const parts=String(name||'Banco').replace(/[^A-Za-zÀ-ÿ0-9 ]+/g,' ').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return'B';
    return(parts.length===1?parts[0].slice(0,2):parts[0][0]+parts[1][0]).toUpperCase();
  }

  function validHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))}
  function rgbToHex(r,g,b){
    const p=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return`#${p(r)}${p(g)}${p(b)}`.toUpperCase();
  }
  function hexToRgb(hex){
    if(!validHex(hex))return{r:100,g:116,b:139};
    const raw=hex.slice(1);
    return{r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16)};
  }
  function saturation(r,g,b){
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    return max===0?0:(max-min)/max;
  }
  function luminance(r,g,b){return(.2126*r+.7152*g+.0722*b)/255}

  function parseDirectory(payload){
    const raw=payload&&payload.institutions&&typeof payload.institutions==='object'?payload.institutions:{};
    const list=[];
    for(const [ispb,value] of Object.entries(raw)){
      if(!Array.isArray(value)||!value[1])continue;
      const code=value[0]==null?'':String(value[0]).replace(/\D/g,'');
      list.push({
        ispb:String(ispb).padStart(8,'0'),
        code:code?code.padStart(3,'0'):'',
        name:String(value[1]),
        flags:Number(value[2])||0,
        logoIspb:String(value[3]||ispb).padStart(8,'0')
      });
    }
    list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    institutions=list;
    byIspb=new Map(list.map(x=>[x.ispb,x]));
  }

  function findByCode(code){
    const normalized=String(code||'').replace(/\D/g,'').padStart(3,'0');
    return institutions.find(inst=>inst.code===normalized)||null;
  }
  function aliasInstitution(value){
    const code=COMMON_BANK_CODES[normalize(value)];
    return code?findByCode(code):null;
  }
  function resolveTypedInstitution(value){
    const q=normalize(value);
    if(!q)return null;
    const alias=aliasInstitution(q);
    if(alias)return alias;
    const exact=institutions.filter(inst=>normalize(inst.name)===q);
    return exact.length===1?exact[0]:null;
  }
  function resolveInstitution(card){
    if(!card)return null;
    const raw=String(card.bankIspb||'').replace(/\D/g,'');
    const ispb=raw?raw.padStart(8,'0'):'';
    if(ispb&&byIspb.has(ispb))return byIspb.get(ispb);
    if(ispb&&/^\d{8}$/.test(ispb))return{
      ispb,logoIspb:ispb,code:String(card.bankCode||''),name:card.bankName||card.account||card.name,flags:1
    };
    const q=normalize(card.bankName||card.account||'');
    if(q){
      const alias=aliasInstitution(q);
      if(alias)return alias;
      const exact=institutions.find(inst=>normalize(inst.name)===q);
      if(exact)return exact;
    }
    return aliasInstitution(card.name)||null;
  }

  function logoUrl(instOrCard){
    if(!instOrCard)return null;
    const raw=String(instOrCard.logoIspb||instOrCard.bankIspb||instOrCard.ispb||'').replace(/\D/g,'');
    if(!raw)return null;
    const ispb=raw.padStart(8,'0');
    if(!/^\d{8}$/.test(ispb))return null;
    if('flags' in instOrCard&&!(Number(instOrCard.flags)&1))return null;
    return`${LOGO_BASE}${ispb}.png`;
  }

  function logoHtml(instOrCard,name,className=''){
    const url=logoUrl(instOrCard);
    const cls=`bank-logo-shell ${url?'has-logo':''} ${className}`.trim();
    const fallback=`<span class="bank-logo-fallback">${esc(initials(name))}</span>`;
    const img=url?`<img src="${esc(url)}" alt="" decoding="async" onerror="this.parentElement.classList.remove('has-logo');this.remove()">`:'';
    return`<span class="${cls}" aria-hidden="true">${fallback}${img}</span>`;
  }

  function makeLogo(instOrCard,name,className=''){
    const host=document.createElement('span');
    const url=logoUrl(instOrCard);
    host.className=`bank-logo-shell ${url?'has-logo':''} ${className}`.trim();
    host.setAttribute('aria-hidden','true');
    const fallback=document.createElement('span');
    fallback.className='bank-logo-fallback';
    fallback.textContent=initials(name);
    host.appendChild(fallback);
    if(url){
      const img=document.createElement('img');
      img.alt='';img.decoding='async';img.src=url;
      img.onerror=()=>{host.classList.remove('has-logo');img.remove()};
      host.appendChild(img);
    }
    return host;
  }

  function bankDisplayName(card,inst){return card?.bankName||inst?.name||card?.account||'Banco / emissor'}
  function fallbackColor(card,inst){
    const code=String(card?.bankCode||inst?.code||'').replace(/\D/g,'').padStart(3,'0');
    return COMMON_FALLBACKS[code]||DEFAULT_ACCENT;
  }
  function accentFor(card,inst){
    return validHex(card?.bankColor)?String(card.bankColor).toUpperCase():fallbackColor(card,inst);
  }
  function accentStyle(card,inst){
    const color=accentFor(card,inst),rgb=hexToRgb(color);
    return`--bank-accent:${color};--bank-accent-rgb:${rgb.r},${rgb.g},${rgb.b}`;
  }

  function colorCacheKey(instOrCard){
    const raw=String(instOrCard?.logoIspb||instOrCard?.bankIspb||instOrCard?.ispb||'').replace(/\D/g,'');
    return raw?`${COLOR_CACHE_PREFIX}${raw.padStart(8,'0')}`:null;
  }
  function readColorCache(instOrCard){
    const key=colorCacheKey(instOrCard);if(!key)return null;
    try{const value=localStorage.getItem(key);return validHex(value)?value.toUpperCase():null}catch(e){return null}
  }
  function writeColorCache(instOrCard,color){
    const key=colorCacheKey(instOrCard);if(!key||!validHex(color))return;
    try{localStorage.setItem(key,color.toUpperCase())}catch(e){}
  }

  function extractDominantColor(url){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.crossOrigin='anonymous';
      img.referrerPolicy='no-referrer';
      img.decoding='async';
      img.onload=()=>{
        try{
          const size=56,canvas=document.createElement('canvas');
          canvas.width=size;canvas.height=size;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.clearRect(0,0,size,size);
          ctx.drawImage(img,0,0,size,size);
          const pixels=ctx.getImageData(0,0,size,size).data,buckets=new Map();
          for(let i=0;i<pixels.length;i+=4){
            const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3];
            if(a<115)continue;
            const lum=luminance(r,g,b),sat=saturation(r,g,b);
            if(lum>.94||lum<.055||sat<.15)continue;
            const step=24;
            const key=`${Math.min(255,Math.round(r/step)*step)},${Math.min(255,Math.round(g/step)*step)},${Math.min(255,Math.round(b/step)*step)}`;
            const weight=(a/255)*(.6+sat*1.9)*(.8+Math.min(lum,1-lum)*.45);
            const bucket=buckets.get(key)||{w:0,r:0,g:0,b:0};
            bucket.w+=weight;bucket.r+=r*weight;bucket.g+=g*weight;bucket.b+=b*weight;
            buckets.set(key,bucket);
          }
          if(!buckets.size){resolve(null);return}
          const best=[...buckets.values()].sort((a,b)=>b.w-a.w)[0];
          resolve(rgbToHex(best.r/best.w,best.g/best.w,best.b/best.w));
        }catch(error){reject(error)}
      };
      img.onerror=()=>reject(new Error('logo_load_failed'));
      img.src=url;
    });
  }

  async function getDominantColor(instOrCard){
    const cached=readColorCache(instOrCard);
    if(cached)return cached;
    const url=logoUrl(instOrCard);
    if(!url)return null;
    const key=colorCacheKey(instOrCard)||url;
    if(pendingColors.has(key))return pendingColors.get(key);
    const promise=extractDominantColor(url)
      .then(color=>{if(color)writeColorCache(instOrCard,color);return color})
      .catch(()=>null)
      .finally(()=>pendingColors.delete(key));
    pendingColors.set(key,promise);
    return promise;
  }

  function preloadLogos(){
    if(typeof state==='undefined'||!Array.isArray(state?.cards))return;
    for(const card of state.cards){
      const inst=resolveInstitution(card),url=logoUrl(inst||card);
      if(!url||preloaded.has(url))continue;
      preloaded.add(url);
      const img=new Image();img.decoding='async';img.src=url;
    }
  }

  function migrateLegacyCards(){
    if(typeof state==='undefined'||!Array.isArray(state?.cards)||!institutions.length)return false;
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
    return changed;
  }

  function searchBanks(value){
    const q=normalize(value);
    if(!q)return[];
    const alias=aliasInstitution(q);
    const ranked=institutions.map(inst=>{
      const name=normalize(inst.name);
      let score=0;
      if(inst.code===q||inst.ispb===q)score+=100;
      if(name===q)score+=90;
      if(name.startsWith(q))score+=60;
      if(name.includes(q))score+=35;
      if(q.split(' ').filter(Boolean).every(t=>name.includes(t)))score+=20;
      return{inst,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.inst.name.localeCompare(b.inst.name,'pt-BR')).map(x=>x.inst);
    if(alias){
      return[alias,...ranked.filter(x=>x.ispb!==alias.ispb)].slice(0,14);
    }
    return ranked.slice(0,14);
  }

  function renderResults(value){
    const results=document.getElementById('cardBankResults');
    if(!results)return;
    const q=String(value||'').trim();
    if(!q){results.innerHTML='<div class="bank-picker-empty">Digite o nome, código do banco ou ISPB.</div>';return}
    const matches=searchBanks(q);
    if(!matches.length){results.innerHTML='<div class="bank-picker-empty">Nenhuma instituição encontrada. O texto pode ser mantido como emissor manual.</div>';return}
    results.replaceChildren();
    matches.forEach(inst=>{
      const btn=document.createElement('button');
      btn.type='button';btn.className='bank-picker-result';
      btn.appendChild(makeLogo(inst,inst.name));
      const copy=document.createElement('span');
      copy.className='bank-picker-result-copy';
      copy.innerHTML=`<span class="bank-picker-result-name">${esc(inst.name)}</span><span class="bank-picker-result-code">${inst.code?`Banco ${esc(inst.code)} • `:''}ISPB ${esc(inst.ispb)}</span>`;
      btn.appendChild(copy);
      btn.onclick=()=>selectBank(inst);
      results.appendChild(btn);
    });
  }

  function updatePickerLogo(inst,name){
    const host=document.getElementById('cardBankLogo');
    if(host)host.replaceChildren(makeLogo(inst,name));
  }

  async function selectBank(inst){
    selectedBank=inst||null;
    selectedColor=readColorCache(inst);
    const input=document.getElementById('cardBankSearch');
    const account=document.getElementById('cardAccount');
    const picker=document.getElementById('cardBankPicker');
    if(input)input.value=inst?.name||'';
    if(account)account.value=inst?.name||'';
    updatePickerLogo(inst,inst?.name||'Banco');
    picker?.classList.remove('open');
    if(inst&&!selectedColor)selectedColor=await getDominantColor(inst);
  }

  function ensurePicker(){
    if(pickerReady&&document.getElementById('cardBankPicker'))return true;
    const account=document.getElementById('cardAccount');
    const field=account?.closest('.field');
    if(!account||!field)return false;
    const label=field.querySelector('label');
    if(label)label.textContent='Banco / emissor';
    account.type='hidden';account.style.display='none';

    const picker=document.createElement('div');
    picker.id='cardBankPicker';picker.className='bank-picker';
    picker.innerHTML=`<div class="bank-picker-control"><span id="cardBankLogo"></span><input id="cardBankSearch" autocomplete="off" placeholder="Digite Banco do Brasil, Nubank, 341…" aria-label="Banco ou emissor"></div><div class="bank-picker-results" id="cardBankResults"></div><small class="bank-picker-help">Busca por nome, código bancário ou ISPB. Se não encontrar, o texto será salvo como emissor.</small>`;
    field.insertBefore(picker,account);

    const input=picker.querySelector('#cardBankSearch');
    input.onfocus=()=>{picker.classList.add('open');renderResults(input.value)};
    input.oninput=()=>{
      selectedBank=null;selectedColor=null;
      account.value=input.value.trim();
      const exact=resolveTypedInstitution(input.value);
      updatePickerLogo(exact,input.value);
      picker.classList.add('open');
      renderResults(input.value);
    };
    input.onkeydown=e=>{if(e.key==='Escape')picker.classList.remove('open')};
    document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))picker.classList.remove('open')});
    updatePickerLogo(null,'Banco');
    pickerReady=true;
    return true;
  }

  function syncPicker(card){
    if(!ensurePicker())return;
    const input=document.getElementById('cardBankSearch'),account=document.getElementById('cardAccount');
    if(!card){
      selectedBank=null;selectedColor=null;
      if(input)input.value='';
      if(account)account.value='';
      updatePickerLogo(null,'Banco');
      return;
    }
    const inst=resolveInstitution(card);
    selectedBank=inst;
    selectedColor=validHex(card.bankColor)?card.bankColor:readColorCache(inst||card);
    const display=card.bankName||inst?.name||card.account||'';
    if(input)input.value=display;
    if(account)account.value=card.account||display;
    updatePickerLogo(inst||card,display||card.name);
  }

  function refreshCardGridValues(){
    const grid=document.getElementById('cardsGrid');
    if(!grid||typeof state==='undefined')return;
    const ym=selectedInvoiceYm||state.settings.selectedMonth;
    grid.querySelectorAll('.credit-card[data-card-id]').forEach(el=>{
      const card=state.cards.find(c=>c.id===el.dataset.cardId);
      if(!card)return;
      const f=cardForecast(card,ym),limit=Number(card.limit)||0,pct=limit?Math.min(999,f.total/limit*100):null;
      el.classList.toggle('active',card.id===selectedCardId);
      const amount=el.querySelector('.amount');
      if(amount)amount.textContent=fmtMoney(f.total);
      const meta=el.querySelector('.meta');
      if(meta)meta.innerHTML=`<span>${fmtMonth(ym)} • ${esc(f.status)}</span><span>${pct===null?'Limite não informado':pct.toFixed(1)+'% do limite'}</span>`;
      const inst=resolveInstitution(card),color=accentFor(card,inst),rgb=hexToRgb(color);
      el.style.setProperty('--bank-accent',color);
      el.style.setProperty('--bank-accent-rgb',`${rgb.r},${rgb.g},${rgb.b}`);
    });
  }

  function brandedRenderCardDetail(){
    const host=document.getElementById('cardDetail'),card=getCard(selectedCardId);
    if(!card){host.innerHTML='<div class="card empty">Cadastre um cartão para começar.</div>';return}
    const inst=resolveInstitution(card);
    const months=allMonthOptions(),ym=selectedInvoiceYm||state.settings.selectedMonth,inv=getInvoice(card.id,ym),items=invoiceItems(card.id,ym),known=invoiceKnownTotal(card.id,ym),adjust=Number(inv?.adjustment)||0,purchasesTotal=round2(items.reduce((s,x)=>s+x.alloc.amount,0)),limit=Number(card.limit)||0,pct=limit?known/limit*100:0;
    const itemHtml=items.length?items.map(x=>`<div class="detail-line"><div><div class="purchase-desc">${esc(x.purchase.description)}</div><div class="sub">${esc(x.purchase.category)} • ${fmtDate(x.purchase.date)} ${x.alloc.number?`• ${x.alloc.number}/${x.alloc.total}`:'• recorrente'}</div></div><div style="text-align:right"><strong>${fmtMoney(x.alloc.amount)}</strong><div style="margin-top:5px"><button class="btn small" onclick="editPurchase('${esc(x.purchase.id)}')">Editar</button></div></div></div>`).join(''):'<div class="empty">Nenhuma compra atribuída a esta fatura.</div>';
    const proj=[];for(let i=0;i<12;i++){const m=ymAdd(state.settings.selectedMonth,i),f=cardForecast(card,m);proj.push({ym:m,...f})}
    host.innerHTML=`<div class="invoice-layout"><div class="card"><div class="section-head"><div><h3 class="invoice-heading">Fatura ${esc(card.name)}${logoHtml(inst||card,bankDisplayName(card,inst),'invoice-title-bank-logo')}</h3><div class="muted">Compras internas geram um único valor no caixa</div></div><div class="invoice-tools"><select id="invoiceMonthLocal">${months.map(m=>`<option value="${m}" ${m===ym?'selected':''}>${fmtMonth(m)}</option>`).join('')}</select><button class="btn" onclick="openInvoiceModal('${esc(card.id)}','${ym}')">Configurar fatura</button><button class="btn primary" onclick="openPurchaseModal('${esc(card.id)}','${ym}')">+ Adicionar compra</button></div></div><div class="invoice-total">${fmtMoney(known)}</div><div><span class="badge ${(inv?.status||'Aberta').toLowerCase()}">${esc(inv?.status||'Aberta')}</span> <span class="muted">Vencimento: dia ${card.dueDay||'—'}</span></div><div class="split-kpis"><div class="mini"><div class="t">Compras/parcelas</div><div class="v">${fmtMoney(purchasesTotal)}</div></div><div class="mini"><div class="t">Ajustes</div><div class="v">${fmtMoney(adjust)}</div></div><div class="mini"><div class="t">Limite usado</div><div class="v">${limit?pct.toFixed(1)+'%':'—'}</div></div></div>${limit?`<div class="progress"><span style="width:${Math.min(100,pct)}%"></span></div>`:''}<div class="divider"></div><div class="section-head"><h3>Itens da fatura</h3><span class="muted">${items.length} item(ns)</span></div>${itemHtml}${inv?.notes?`<div class="notice" style="margin-top:14px">${esc(inv.notes)}</div>`:''}</div>
      <div class="card"><div class="section-head"><div><h3>Projeção do cartão</h3><div class="muted">Parcelas conhecidas + estimativa de novas compras</div></div><button class="btn" onclick="editCard('${esc(card.id)}')">Editar cartão</button></div><div class="chart-wrap small"><canvas id="cardProjectionChart"></canvas></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mês</th><th class="num">Compromissos</th><th class="num">Estimativa nova</th><th class="num">Fatura projetada</th></tr></thead><tbody>${proj.map(r=>`<tr><td>${fmtMonth(r.ym)}</td><td class="num">${fmtMoney(r.known)}</td><td class="num">${fmtMoney(r.estimate)}</td><td class="num"><strong>${fmtMoney(r.total)}</strong></td></tr>`).join('')}</tbody></table></div></div></div>`;
    const select=document.getElementById('invoiceMonthLocal');
    if(select)select.onchange=e=>{
      selectedInvoiceYm=e.target.value;
      refreshCardGridValues();
      window.renderCardDetail();
    };
    requestAnimationFrame(()=>drawLineChart('cardProjectionChart',proj.map(r=>({label:fmtMonth(r.ym),value:r.total}))));
  }

  function brandedRenderCards(){
    if(!selectedCardId||!getCard(selectedCardId))selectedCardId=state.cards[0]?.id||null;
    const ym=selectedInvoiceYm||state.settings.selectedMonth,grid=document.getElementById('cardsGrid');
    grid.innerHTML=state.cards.length?state.cards.map(card=>{
      const inst=resolveInstitution(card),f=cardForecast(card,ym),limit=Number(card.limit)||0,pct=limit?Math.min(999,f.total/limit*100):null;
      return`<div class="credit-card bank-liquid-card ${card.id===selectedCardId?'active':''}" data-card-id="${esc(card.id)}" style="${accentStyle(card,inst)}" onclick="selectCard('${esc(card.id)}')"><div class="name">${esc(card.name)}</div><div class="account bank-card-account">${logoHtml(inst||card,bankDisplayName(card,inst))}<span class="bank-card-account-text">${esc(bankDisplayName(card,inst))}</span></div><div class="amount">${fmtMoney(f.total)}</div><div class="meta"><span>${fmtMonth(ym)} • ${esc(f.status)}</span><span>${pct===null?'Limite não informado':pct.toFixed(1)+'% do limite'}</span></div></div>`;
    }).join(''):'<div class="empty">Nenhum cartão cadastrado.</div>';
    window.renderCardDetail();
    preloadLogos();
    queueHydration();
  }

  function decorateInvoiceModal(card){
    const head=document.querySelector('#invoiceModal .modal-head'),title=head?.querySelector('h3');
    if(!head||!title||!card)return;
    head.querySelector('.invoice-bank-brand')?.remove();
    const inst=resolveInstitution(card),brand=document.createElement('span');
    brand.className='invoice-bank-brand';
    brand.appendChild(makeLogo(inst||card,bankDisplayName(card,inst)));
    title.insertAdjacentElement('afterend',brand);
  }

  async function ensureColorForCard(card){
    if(!card||validHex(card.bankColor))return false;
    const inst=resolveInstitution(card),cached=readColorCache(inst||card);
    if(cached){card.bankColor=cached;return true}
    const color=await getDominantColor(inst||card);
    if(!color)return false;
    card.bankColor=color;
    return true;
  }

  function queueHydration(){
    if(hydrationQueued)return;
    hydrationQueued=true;
    setTimeout(()=>{hydrationQueued=false;hydrateMissingColors()},80);
  }

  async function hydrateMissingColors(){
    if(hydrating||typeof state==='undefined'||!Array.isArray(state?.cards))return;
    const targets=state.cards.filter(card=>card.bankIspb&&!validHex(card.bankColor));
    if(!targets.length)return;
    hydrating=true;
    let changed=false;
    try{
      for(const card of targets){
        if(await ensureColorForCard(card))changed=true;
      }
    }finally{
      hydrating=false;
    }
    if(changed){
      try{save()}catch(e){}
      refreshCardGridValues();
    }
  }

  function installRenderers(){
    window.renderCards=brandedRenderCards;
    window.renderCardDetail=brandedRenderCardDetail;
    window.selectCard=function(id){
      selectedCardId=id;
      refreshCardGridValues();
      window.renderCardDetail();
    };
  }

  function installFormIntegration(){
    if(!ensurePicker())return;
    const form=document.getElementById('cardForm');
    if(form&&form.dataset.bankBrandingWrapped!=='1'&&typeof form.onsubmit==='function'){
      const baseSubmit=form.onsubmit;
      form.dataset.bankBrandingWrapped='1';
      form.onsubmit=function(event){
        const idBefore=document.getElementById('cardId')?.value||'';
        const previous=idBefore&&typeof state!=='undefined'?state.cards.find(c=>c.id===idBefore):null;
        const input=document.getElementById('cardBankSearch'),account=document.getElementById('cardAccount');
        const typed=String(input?.value||'').trim(),resolved=selectedBank||resolveTypedInstitution(typed);
        const keepColor=previous&&resolved&&String(previous.bankIspb||'')===String(resolved.ispb||'')&&validHex(previous.bankColor)?previous.bankColor:null;
        if(account)account.value=resolved?.name||typed;
        baseSubmit.call(this,event);
        let id=idBefore;
        if(!id){try{id=selectedCardId||''}catch(e){}}
        const card=id&&typeof state!=='undefined'?state.cards.find(c=>c.id===id):null;
        if(!card)return;
        if(resolved){
          card.bankIspb=resolved.ispb;
          card.bankCode=resolved.code||null;
          card.bankName=resolved.name;
          card.account=resolved.name;
          if(validHex(selectedColor))card.bankColor=selectedColor.toUpperCase();
          else if(keepColor)card.bankColor=keepColor;
          else delete card.bankColor;
        }else{
          delete card.bankIspb;delete card.bankCode;delete card.bankName;delete card.bankColor;
          card.account=typed;
        }
        try{save()}catch(e){}
        window.renderCards();
        if(resolved&&!validHex(card.bankColor)){
          ensureColorForCard(card).then(changed=>{
            if(!changed)return;
            try{save()}catch(e){}
            refreshCardGridValues();
          });
        }
      };
    }

    document.getElementById('addCardBtn')?.addEventListener('click',()=>setTimeout(()=>syncPicker(null),0));

    const baseEdit=window.editCard;
    if(typeof baseEdit==='function'&&!baseEdit.__bankBrandingV2){
      const wrapped=function(id){
        const result=baseEdit.apply(this,arguments);
        setTimeout(()=>syncPicker(typeof state!=='undefined'?state.cards.find(c=>c.id===id):null),0);
        return result;
      };
      wrapped.__bankBrandingV2=true;
      window.editCard=wrapped;
    }

    const baseInvoice=window.openInvoiceModal;
    if(typeof baseInvoice==='function'&&!baseInvoice.__bankBrandingV2){
      const wrapped=function(cardId,ym){
        const result=baseInvoice.apply(this,arguments);
        const card=typeof state!=='undefined'?state.cards.find(c=>c.id===cardId):null;
        decorateInvoiceModal(card);
        return result;
      };
      wrapped.__bankBrandingV2=true;
      window.openInvoiceModal=wrapped;
    }
  }

  function readDirectoryCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(DIRECTORY_CACHE_KEY)||'null');
      if(!cached?.data||!cached.savedAt||Date.now()-cached.savedAt>CACHE_MAX_AGE)return false;
      parseDirectory(cached.data);
      return institutions.length>0;
    }catch(e){return false}
  }

  async function loadDirectory(){
    let changed=false;
    if(readDirectoryCache()){
      changed=migrateLegacyCards();
      preloadLogos();
      if(changed)try{save()}catch(e){}
      window.renderCards();
      queueHydration();
    }
    try{
      const response=await fetch(INDEX_URL,{cache:'force-cache'});
      if(!response.ok)throw new Error(`bank_directory_${response.status}`);
      const data=await response.json();
      parseDirectory(data);
      try{localStorage.setItem(DIRECTORY_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(e){}
      changed=migrateLegacyCards()||changed;
      preloadLogos();
      if(changed)try{save()}catch(e){}
      window.renderCards();
      queueHydration();
      const modal=document.getElementById('cardModal');
      if(modal?.classList.contains('open')){
        const id=document.getElementById('cardId')?.value||'';
        syncPicker(id?state.cards.find(c=>c.id===id):null);
      }
    }catch(error){
      console.warn('Diretório de bancos indisponível; usando identificação e cores já salvas.',error);
    }
  }

  function init(){
    injectStyles();
    installRenderers();
    installFormIntegration();
    try{window.renderCards()}catch(e){console.error('Falha ao ativar visual bancário.',e)}
    loadDirectory();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
