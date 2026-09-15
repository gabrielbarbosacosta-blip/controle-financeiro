(function(){
  if(window.__bankLiquidGlassLoaded)return;
  window.__bankLiquidGlassLoaded=true;

  const LOGO_BASE='https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/png/';
  const STYLE_ID='bank-liquid-glass-style';
  const COLOR_CACHE_PREFIX='financeBankDominantColor:v1:';
  const FALLBACK='#64748B';
  const COMMON_FALLBACKS={
    '001':'#FDDC00',
    '033':'#EC0000',
    '077':'#FF7A00',
    '104':'#0067A0',
    '208':'#0A2440',
    '237':'#CC092F',
    '260':'#820AD1',
    '336':'#202124',
    '341':'#EC7000',
    '748':'#00A091',
    '756':'#00AE9D'
  };
  const pending=new Set();
  let persistTimer=null;
  let observer=null;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .credit-card.bank-liquid-card{
        --bank-accent-rgb:100,116,139;
        position:relative;
        isolation:isolate;
        overflow:hidden;
        background:
          linear-gradient(145deg,rgba(255,255,255,.17) 0%,rgba(255,255,255,.075) 31%,rgba(255,255,255,.025) 62%),
          linear-gradient(135deg,rgba(var(--bank-accent-rgb),.36) 0%,rgba(var(--bank-accent-rgb),.16) 44%,rgba(8,15,29,.58) 100%)!important;
        border:1px solid rgba(var(--bank-accent-rgb),.48)!important;
        box-shadow:
          0 16px 38px rgba(0,0,0,.24),
          0 0 30px rgba(var(--bank-accent-rgb),.12),
          inset 0 1px 0 rgba(255,255,255,.23),
          inset 0 -1px 0 rgba(255,255,255,.045)!important;
        backdrop-filter:blur(20px) saturate(165%);
        -webkit-backdrop-filter:blur(20px) saturate(165%);
      }
      .credit-card.bank-liquid-card::before{
        content:'';
        position:absolute;
        z-index:0;
        inset:-1px;
        pointer-events:none;
        background:
          radial-gradient(circle at 14% 5%,rgba(255,255,255,.34) 0%,rgba(255,255,255,.13) 16%,rgba(255,255,255,0) 40%),
          linear-gradient(112deg,rgba(255,255,255,.11) 0%,rgba(255,255,255,0) 33%,rgba(255,255,255,.06) 59%,rgba(255,255,255,0) 78%);
        mix-blend-mode:screen;
      }
      .credit-card.bank-liquid-card::after{
        content:'';
        position:absolute;
        z-index:0;
        right:-64px;
        bottom:-92px;
        width:220px;
        height:220px;
        border-radius:50%;
        pointer-events:none;
        background:radial-gradient(circle,rgba(var(--bank-accent-rgb),.34) 0%,rgba(var(--bank-accent-rgb),.13) 43%,rgba(var(--bank-accent-rgb),0) 72%);
        filter:blur(7px);
      }
      .credit-card.bank-liquid-card>*{position:relative;z-index:1}
      .credit-card.bank-liquid-card.active{
        border-color:rgba(var(--bank-accent-rgb),.78)!important;
        box-shadow:
          0 18px 42px rgba(0,0,0,.29),
          0 0 34px rgba(var(--bank-accent-rgb),.21),
          inset 0 1px 0 rgba(255,255,255,.28),
          inset 0 -1px 0 rgba(255,255,255,.055)!important;
      }
      .credit-card.bank-liquid-card .bank-logo-shell img{
        filter:drop-shadow(0 2px 9px rgba(var(--bank-accent-rgb),.24));
      }
      @media(prefers-reduced-motion:no-preference){
        .credit-card.bank-liquid-card{transition:border-color .22s ease,box-shadow .22s ease,background .22s ease}
      }
    `;
    document.head.appendChild(style);
  }

  function validHex(value){return /^#[0-9A-Fa-f]{6}$/.test(String(value||''))}

  function hexToRgb(hex){
    if(!validHex(hex))return null;
    const raw=hex.slice(1);
    return{r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16)};
  }

  function rgbToHex(r,g,b){
    const part=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return`#${part(r)}${part(g)}${part(b)}`.toUpperCase();
  }

  function saturation(r,g,b){
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    return max===0?0:(max-min)/max;
  }

  function luminance(r,g,b){return(.2126*r+.7152*g+.0722*b)/255}

  function logoUrl(card){
    const raw=String(card?.bankIspb||'').replace(/\D/g,'');
    if(!raw)return null;
    const ispb=raw.padStart(8,'0');
    return /^\d{8}$/.test(ispb)?`${LOGO_BASE}${ispb}.png`:null;
  }

  function cacheKey(card){
    const ispb=String(card?.bankIspb||'').replace(/\D/g,'').padStart(8,'0');
    return ispb?`${COLOR_CACHE_PREFIX}${ispb}`:null;
  }

  function readCachedColor(card){
    const key=cacheKey(card);if(!key)return null;
    try{const value=localStorage.getItem(key);return validHex(value)?value.toUpperCase():null}catch(e){return null}
  }

  function cacheColor(card,color){
    const key=cacheKey(card);if(!key||!validHex(color))return;
    try{localStorage.setItem(key,color.toUpperCase())}catch(e){}
  }

  function fallbackColor(card){
    const code=String(card?.bankCode||'').replace(/\D/g,'').padStart(3,'0');
    return COMMON_FALLBACKS[code]||FALLBACK;
  }

  function extractDominantColor(url){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.crossOrigin='anonymous';
      img.referrerPolicy='no-referrer';
      img.decoding='async';
      img.onload=()=>{
        try{
          const size=64;
          const canvas=document.createElement('canvas');
          canvas.width=size;canvas.height=size;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.clearRect(0,0,size,size);
          ctx.drawImage(img,0,0,size,size);
          const pixels=ctx.getImageData(0,0,size,size).data;
          const buckets=new Map();
          for(let i=0;i<pixels.length;i+=4){
            const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3];
            if(a<110)continue;
            const lum=luminance(r,g,b),sat=saturation(r,g,b);
            if(lum>.94||lum<.055||sat<.16)continue;
            const step=24;
            const qr=Math.min(255,Math.round(r/step)*step);
            const qg=Math.min(255,Math.round(g/step)*step);
            const qb=Math.min(255,Math.round(b/step)*step);
            const key=`${qr},${qg},${qb}`;
            const alpha=a/255;
            const vivid=.55+sat*1.9;
            const midtone=.78+Math.min(lum,1-lum)*.5;
            const weight=alpha*vivid*midtone;
            let bucket=buckets.get(key);
            if(!bucket){bucket={weight:0,r:0,g:0,b:0,count:0};buckets.set(key,bucket)}
            bucket.weight+=weight;bucket.r+=r*weight;bucket.g+=g*weight;bucket.b+=b*weight;bucket.count+=weight;
          }
          if(!buckets.size){resolve(null);return}
          const best=[...buckets.values()].sort((a,b)=>b.weight-a.weight)[0];
          resolve(rgbToHex(best.r/best.count,best.g/best.count,best.b/best.count));
        }catch(error){reject(error)}
      };
      img.onerror=()=>reject(new Error('logo_load_failed'));
      img.src=url;
    });
  }

  function cardFromElement(el){
    if(typeof state==='undefined'||!Array.isArray(state?.cards))return null;
    const onclick=el.getAttribute('onclick')||'';
    const match=onclick.match(/selectCard\(['\"]([^'\"]+)['\"]\)/);
    return match?state.cards.find(card=>card.id===match[1])||null:null;
  }

  function applyGlass(el,card){
    const color=validHex(card?.bankColor)?card.bankColor:fallbackColor(card);
    const rgb=hexToRgb(color)||hexToRgb(FALLBACK);
    el.classList.add('bank-liquid-card');
    el.style.setProperty('--bank-accent',color);
    el.style.setProperty('--bank-accent-rgb',`${rgb.r},${rgb.g},${rgb.b}`);
    el.dataset.bankLiquidColor=color;
  }

  function applyAll(){
    const grid=document.getElementById('cardsGrid');
    if(!grid||typeof state==='undefined'||!Array.isArray(state?.cards))return;
    grid.querySelectorAll('.credit-card').forEach(el=>{
      const card=cardFromElement(el);if(!card)return;
      applyGlass(el,card);
      ensureColor(card,el);
    });
  }

  function schedulePersist(){
    clearTimeout(persistTimer);
    persistTimer=setTimeout(()=>{
      try{if(typeof save==='function')save()}catch(error){console.warn('Não foi possível persistir a cor do banco.',error)}
    },350);
  }

  async function ensureColor(card,el){
    if(!card||validHex(card.bankColor))return;
    const cached=readCachedColor(card);
    if(cached){card.bankColor=cached;applyGlass(el,card);schedulePersist();return}
    const url=logoUrl(card);
    if(!url)return;
    const key=card.id||url;
    if(pending.has(key))return;
    pending.add(key);
    try{
      const color=await extractDominantColor(url);
      if(!color)return;
      card.bankColor=color;
      cacheColor(card,color);
      document.querySelectorAll('#cardsGrid .credit-card').forEach(node=>{
        const target=cardFromElement(node);if(target?.id===card.id)applyGlass(node,card);
      });
      schedulePersist();
    }catch(error){
      console.warn('Falha ao extrair a cor predominante do logo.',error);
    }finally{pending.delete(key)}
  }

  function init(){
    injectStyles();
    applyAll();
    const grid=document.getElementById('cardsGrid');
    if(grid&&!observer){observer=new MutationObserver(()=>applyAll());observer.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      applyAll();
      if(tries>=40)clearInterval(timer);
    },500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
