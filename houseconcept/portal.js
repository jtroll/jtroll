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
    const response = await fetch(url);
    if (!response.ok) throw Error('A house file could not be downloaded. Please try again.');
    return response;
  }
  async function decrypt(key, item, build) {
    const payload = await (await get(item.file)).arrayBuffer();
    if (payload.byteLength !== item.bytes) throw Error('The download was interrupted. Please try again.');
    return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(item.iv),additionalData:encoder.encode(`houseconcept:1:${build}:${item.id}`)},key,payload);
  }
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
      const material = await crypto.subtle.importKey('raw',encoder.encode(password.value),'PBKDF2',false,['deriveKey']);
      const key = await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(manifest.salt),iterations:manifest.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
      let viewer;
      try { viewer = await decrypt(key, manifest.viewer, manifest.build); }
      catch (error) { if (error.name === 'OperationError') throw Error('That password didn’t unlock the house. Please try again.'); throw error; }
      password.value = ''; form.hidden = true; progress.hidden = false;
      const html = await new Response(new Blob([viewer]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      viewer = null;
      let index = 0, downloaded = 0, downloadError;
      const total = manifest.model.reduce((sum, item) => sum + item.bytes, 0);
      $('size').textContent = Math.round((total + manifest.viewer.bytes) / 1000000);
      tell('Loading the house… 0%');
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            if (index === manifest.model.length) { controller.close(); return; }
            const item = manifest.model[index++];
            controller.enqueue(new Uint8Array(await decrypt(key, item, manifest.build)));
            downloaded += item.bytes;
            const percent = Math.round(downloaded / total * 100);
            progress.value = percent; tell(`Loading the house… ${percent}%`);
          } catch (error) { downloadError = error; controller.error(error); }
        }
      });
      let model;
      try { model = await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).blob(); }
      catch (error) { throw downloadError || error; }
      if (model.size !== manifest.modelBytes) throw Error('The house download is incomplete. Please try again.');
      tell('Preparing the rooms…');
      modelURL = URL.createObjectURL(model);
      window.__HOUSE_MODEL_URL = modelURL;
      window.addEventListener('pagehide', () => URL.revokeObjectURL(modelURL), {once:true});
      document.open(); document.write(html); document.close();
    } catch (error) {
      if (modelURL) URL.revokeObjectURL(modelURL);
      form.hidden = false; progress.hidden = true; password.disabled = false;
      button.disabled = false; busy = false;
      tell(error.name === 'OperationError' ? 'A house file could not be verified. Please refresh and try again.' : error.message === 'Failed to fetch' ? 'The download was interrupted. Please check your connection and try again.' : error.message || 'The house could not be loaded. Please try again.', true);
      password.focus();
    }
  });
})();
