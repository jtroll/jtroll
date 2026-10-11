/* Reserve one small graphics context before expanding the encrypted model.
   Reuse it in Three.js, and explicitly release GPU resources on departure. */
(()=>{
 if(window.__HOUSE_GRAPHICS){window.__HOUSE_GRAPHICS.bindDeparture();return;}
 let pending=null,reservation=null,renderer=null,recovery=null;
 const api=window.__HOUSE_GRAPHICS={revision:301,attempts:0,reused:false,lost:false,stopped:false,disposals:0,restores:0};
 api.ensure=light=>{
  if(reservation&&!reservation.context.isContextLost()){api.reused=true;return Promise.resolve(reservation)}
  if(pending)return pending;
  pending=(async()=>{
   for(const delay of [0,300,1200]){
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
    const options={alpha:false,depth:true,stencil:false,antialias:!light,preserveDrawingBuffer:!light,powerPreference:light?'low-power':'high-performance',failIfMajorPerformanceCaveat:false};
    api.attempts++;let context;
    try{context=canvas.getContext('webgl2',options)}catch(_){context=null}
    if(context){reservation={canvas,context};api.lost=false;api.stopped=false;return reservation}
   }
   const e=new Error('Graphics are unavailable in this browser session. Close this view and open the link directly in Safari or Chrome, then try again.');e.code='HOUSE_GRAPHICS_UNAVAILABLE';throw e;
  })().finally(()=>{pending=null});return pending;
 };
 api.attach=r=>{
  renderer=r;recovery=r.getContext().getExtension('WEBGL_lose_context');api.stopped=false;api.lost=r.getContext().isContextLost();api.bindDeparture();
  r.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();api.lost=true;window.__WALK?.state.keys.clear()});
  r.domElement.addEventListener('webglcontextrestored',()=>{api.lost=false;api.restores++;window.__VIEWER?.invalidate()});
 };
 api.restore=()=>{if(renderer&&!api.stopped&&api.lost)recovery?.restoreContext()};
 api.dispose=()=>{
  if(api.stopped)return;api.stopped=true;api.disposals++;
  // End the context first: restored renderers can retain disposal listeners
  // for pre-loss objects, which WebKit must not try to delete in the new context.
  if(renderer)recovery?.loseContext();else reservation?.context.getExtension('WEBGL_lose_context')?.loseContext();
  const v=window.__VIEWER,geometries=new Set(),materials=new Set(),textures=new Set(),targets=new Set();
  window.__WALK?.state.keys.clear();
  v?.scene.traverse(o=>{
   if(o.geometry)geometries.add(o.geometry);
   for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const x of Object.values(m))if(x?.isTexture)textures.add(x)}
   if(o.getRenderTarget)targets.add(o.getRenderTarget());
   if(o.shadow?.map)targets.add(o.shadow.map);
  });
  if(v?.scene.environment)textures.add(v.scene.environment);
  for(const t of targets)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  const images=new Set();for(const t of textures){if(t.image?.close)images.add(t.image);t.dispose()}for(const image of images)image.close();
  v?.controls.dispose();
  if(renderer)renderer.dispose();
  reservation=null;renderer=null;recovery=null;window.__HOUSE_MODEL_BUFFER=null;
  if(window.__HOUSE_MODEL_URL){URL.revokeObjectURL(window.__HOUSE_MODEL_URL);window.__HOUSE_MODEL_URL=null}
 };
 // Keep back-forward cached pages resumable; discard only on a real departure.
 const departure=e=>{if(!e.persisted)api.dispose()},lock=e=>{if(e.target.closest?.('#portal-lock'))api.dispose()};
 api.bindDeparture=()=>{removeEventListener('pagehide',departure);addEventListener('pagehide',departure);document.removeEventListener('click',lock,true);document.addEventListener('click',lock,true)};
 api.bindDeparture();
})();

/* Public loader only. The viewer, physics and geometry are authenticated ciphertext. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('login'), password = $('password'), button = $('unlock');
  const message = $('message'), progress = $('progress');
  const base = new URL('.', document.currentScript.src);
  const encoder = new TextEncoder();
  const bytes = str => Uint8Array.from(atob(str), char => char.charCodeAt(0));
  let busy = false;
  const quality=$('quality');
  const selected=new URL(location.href).searchParams.get('quality');
  if(quality&&['auto','mobile','full'].includes(selected))quality.value=selected;
  const isPhone=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent))||navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches;
  const chooseProfile=()=>quality?.value==='full'?'full':quality?.value==='mobile'||isPhone()?'mobile':'full';
  let sizeManifest;
  const updateSize=()=>{if(!sizeManifest)return;const profile=chooseProfile()==='mobile'&&sizeManifest.mobile?sizeManifest.mobile:sizeManifest;$('size').textContent=Math.round((profile.model.reduce((s,p)=>s+p.bytes,0)+sizeManifest.viewer.bytes)/1000000)};
  quality?.addEventListener('change',updateSize);
  $('show').addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    $('show').textContent = show ? 'Hide' : 'Show';
    $('show').setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`);
    $('show').setAttribute('aria-pressed', String(show));
  });
  const tell = (text, error = false) => { message.textContent = text; message.classList.toggle('error', error); };
  async function get(path) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw Error('Invalid house file.');
    // Only encrypted payloads are cached by the browser. Keys remain in memory.
    const response = await fetch(url, path === 'manifest.json' ? {cache:'no-cache'} : {});
    if (!response.ok) throw Error('A house file could not be downloaded. Please try again.');
    return response;
  }
  async function decrypt(key, item, build) {
    const payload = await (await get(item.file)).arrayBuffer();
    if (payload.byteLength !== item.bytes) throw Error('The download was interrupted. Please try again.');
    return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(item.iv),additionalData:encoder.encode(`houseconcept:1:${item.aadBuild || build}:${item.id}`)},key,payload);
  }
  get('manifest.json').then(r=>r.json()).then(m=>{sizeManifest=m;updateSize()}).catch(()=>{});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!window.isSecureContext || !crypto.subtle || !window.DecompressionStream) {
      tell('Please open this page in a current version of Chrome, Edge, Firefox or Safari over HTTPS.', true); return;
    }
    busy = true; button.disabled = true; password.disabled = true;
    tell('Unlocking…');
    let modelURL;
    try {
      const manifest = await (await get('manifest.json')).json();
      if (manifest.format !== 1 || manifest.iterations !== 600000) throw Error('Please refresh to load the latest house viewer.');
      const profileName=chooseProfile()==='mobile'&&manifest.mobile?'mobile':'full';
      const profile=profileName==='mobile'?manifest.mobile:manifest;
      const material = await crypto.subtle.importKey('raw',encoder.encode(password.value),'PBKDF2',false,['deriveKey']);
      const key = await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(manifest.salt),iterations:manifest.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
      let viewer;
      try { viewer = await decrypt(key, manifest.viewer, manifest.build); }
      catch (error) { if (error.name === 'OperationError') throw Error('That password didn’t unlock the house. Please try again.'); throw error; }
      password.value = ''; form.hidden = true; progress.hidden = false;
      const html = await new Response(new Blob([viewer]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      viewer = null;
      tell('Starting graphics…');
      await window.__HOUSE_GRAPHICS.ensure(profileName === 'mobile');
      let index = 0, downloaded = 0, downloadError;
      const total = profile.model.reduce((sum, item) => sum + item.bytes, 0);
      $('size').textContent = Math.round((total + manifest.viewer.bytes) / 1000000);
      tell('Loading the house… 0%');
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            if (index === profile.model.length) { controller.close(); return; }
            const item = profile.model[index++];
            controller.enqueue(new Uint8Array(await decrypt(key, item, manifest.build)));
            downloaded += item.bytes;
            const percent = Math.round(downloaded / total * 100);
            progress.value = percent; tell(`Loading the house… ${percent}%`);
          } catch (error) { downloadError = error; controller.error(error); }
        }
      });
      let model;
      try { const decoded = new Response(stream.pipeThrough(new DecompressionStream('gzip'))); model = profileName === 'mobile' ? await decoded.arrayBuffer() : await decoded.blob(); }
      catch (error) { throw downloadError || error; }
      if ((profileName === 'mobile' ? model.byteLength : model.size) !== profile.modelBytes) throw Error('The house download is incomplete. Please try again.');
      tell('Preparing the rooms…');
      if (profileName === 'mobile') { window.__HOUSE_MODEL_BUFFER = model; model = null; }
      else { modelURL = URL.createObjectURL(model); window.__HOUSE_MODEL_URL = modelURL; }
      window.__HOUSE_PROFILE = profileName;
      window.addEventListener('pagehide', () => URL.revokeObjectURL(modelURL), {once:true});
      document.open(); document.write(html); document.close();
    } catch (error) {
      window.__HOUSE_GRAPHICS.dispose();
      if (modelURL) URL.revokeObjectURL(modelURL);
      form.hidden = false; progress.hidden = true; password.disabled = false;
      button.disabled = false; busy = false;
      tell(error.name === 'OperationError' ? 'A house file could not be verified. Please refresh and try again.' : error.message === 'Failed to fetch' ? 'The download was interrupted. Please check your connection and try again.' : error.message || 'The house could not be loaded. Please try again.', true);
      password.focus();
    }
  });
})();
