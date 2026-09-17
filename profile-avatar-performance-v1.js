(function(){
  if(window.__profileAvatarPerformanceV1Loaded)return;
  window.__profileAvatarPerformanceV1Loaded=true;

  const MAX_DIMENSION=512;
  const JPEG_QUALITY=.82;
  const WEBP_QUALITY=.80;
  const TARGET_BYTES=320*1024;
  const AUTO_KEY='prumo-profile-avatar-optimized-v1';
  let originalChangeHandler=null;
  let inputBound=null;
  let autoRunning=false;

  function supportedType(type){return ['image/jpeg','image/png','image/webp'].includes(String(type||'').toLowerCase())}

  async function bitmapFromBlob(blob){
    if('createImageBitmap' in window){
      try{return await createImageBitmap(blob,{imageOrientation:'from-image'})}catch(_e){
        try{return await createImageBitmap(blob)}catch(_e2){}
      }
    }
    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image_decode_failed'))};
      img.src=url;
    });
  }

  function canvasBlob(canvas,type,quality){
    return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  }

  async function optimizeImage(file){
    if(!file||!supportedType(file.type))return file;
    const image=await bitmapFromBlob(file);
    const width=Number(image.width||image.naturalWidth)||0;
    const height=Number(image.height||image.naturalHeight)||0;
    if(!width||!height){image.close?.();return file}

    const scale=Math.min(1,MAX_DIMENSION/Math.max(width,height));
    const outW=Math.max(1,Math.round(width*scale));
    const outH=Math.max(1,Math.round(height*scale));
    if(scale===1&&file.size<=TARGET_BYTES){image.close?.();return file}

    const canvas=document.createElement('canvas');
    canvas.width=outW;canvas.height=outH;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx){image.close?.();return file}
    ctx.drawImage(image,0,0,outW,outH);image.close?.();

    let type=file.type==='image/png'?'image/webp':file.type;
    let quality=type==='image/webp'?WEBP_QUALITY:JPEG_QUALITY;
    let blob=await canvasBlob(canvas,type,quality);
    if(!blob&&type==='image/webp'){
      type='image/jpeg';quality=JPEG_QUALITY;blob=await canvasBlob(canvas,type,quality);
    }
    if(!blob)return file;

    if(blob.size>=file.size&&scale===1)return file;
    const ext=type==='image/webp'?'webp':'jpg';
    const base=String(file.name||'avatar').replace(/\.[^.]+$/,'')||'avatar';
    return new File([blob],`${base}-optimized.${ext}`,{type,lastModified:Date.now()});
  }

  function replaceFiles(input,file){
    try{
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;return true;
    }catch(_e){return false}
  }

  function tuneImages(){
    document.querySelectorAll('#profileSidebarAvatar img,#profileAvatarLarge img').forEach(img=>{
      img.decoding='async';
      img.setAttribute('fetchpriority','high');
      img.loading='eager';
    });
  }

  function bindInput(){
    const input=document.getElementById('profilePhotoInput');
    if(!input||input===inputBound)return !!input;
    const handler=input.onchange;
    if(typeof handler!=='function')return false;
    inputBound=input;originalChangeHandler=handler;
    input.onchange=async function(event){
      const selected=this.files?.[0];
      if(!selected)return originalChangeHandler.call(this,event);
      try{
        const optimized=await optimizeImage(selected);
        if(optimized!==selected)replaceFiles(this,optimized);
      }catch(e){console.warn('Não foi possível otimizar a foto antes do upload.',e)}
      return originalChangeHandler.call(this,event);
    };
    return true;
  }

  async function optimizeCurrentAvatar(){
    if(autoRunning||sessionStorage.getItem(AUTO_KEY)==='1')return;
    const input=document.getElementById('profilePhotoInput');
    const img=document.querySelector('#profileSidebarAvatar img');
    if(!input||typeof originalChangeHandler!=='function'||!img?.src||img.src.startsWith('blob:')||img.src.startsWith('data:'))return;
    if(!img.complete||!img.naturalWidth)return;

    autoRunning=true;
    try{
      const response=await fetch(img.src,{cache:'force-cache'});
      if(!response.ok)throw new Error(`avatar_fetch_${response.status}`);
      const blob=await response.blob();
      if(blob.size<=TARGET_BYTES&&Math.max(img.naturalWidth,img.naturalHeight)<=MAX_DIMENSION){
        sessionStorage.setItem(AUTO_KEY,'1');return;
      }
      const type=supportedType(blob.type)?blob.type:'image/jpeg';
      const source=new File([blob],`avatar-current.${type==='image/webp'?'webp':type==='image/png'?'png':'jpg'}`,{type,lastModified:Date.now()});
      const optimized=await optimizeImage(source);
      if(!optimized||optimized.size>=blob.size){sessionStorage.setItem(AUTO_KEY,'1');return}
      if(!replaceFiles(input,optimized))return;
      await originalChangeHandler.call(input,{target:input,currentTarget:input,preventDefault(){},stopPropagation(){}});
      sessionStorage.setItem(AUTO_KEY,'1');
    }catch(e){
      console.warn('O avatar atual não pôde ser otimizado automaticamente.',e);
    }finally{autoRunning=false}
  }

  function schedule(){
    tuneImages();
    if(bindInput())setTimeout(optimizeCurrentAvatar,700);
  }

  function init(){
    schedule();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;schedule()});
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(schedule,300);setTimeout(schedule,1000);setTimeout(schedule,2200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
