/* Best Ever Online Tools — site config, ads, ad-block notice, shared UI helpers */

/* Ad settings are generated into assets/config.js by scripts/build.py
   (set ADSENSE_CLIENT / ADSENSE_SLOTS there, not here). */
window.SITE = Object.assign({
  name: 'Best Ever Online Tools',
  ads: false,                                   // false in the no-ads build
  adsense: { client: '', slots: { top: '', side: '', content: '' } },
  showPlaceholders: true,                       // grey boxes while no AdSense id is set
  adblockSnoozeDays: 3
}, window.SITE_CONFIG || {});

(function(){
  const S = window.SITE;
  const year=()=>document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
  if(!S.ads){ document.readyState==='loading'?document.addEventListener('DOMContentLoaded',year):year(); return; }
  const hasClient = !!S.adsense.client;

  // ---- ad slots ----
  function fillSlots(){
    document.querySelectorAll('.ad[data-slot]').forEach(el=>{
      const slot = S.adsense.slots[el.dataset.slot];
      if(hasClient && slot){
        el.innerHTML = '';
        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.setAttribute('data-ad-client', S.adsense.client);
        ins.setAttribute('data-ad-slot', slot);
        ins.setAttribute('data-ad-format', el.dataset.slot === 'side' ? 'vertical' : 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
        el.appendChild(ins);
        try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
      } else if(hasClient){
        el.classList.add('empty');          // no slot id: leave placement to AdSense Auto ads
      } else if(S.showPlaceholders){
        el.classList.add('placeholder');
        el.textContent = 'Advertisement';
      } else {
        el.classList.add('empty');
      }
    });
  }

  // ---- ad-block detection (bait element + ad script load) ----
  function detectAdblock(){
    return new Promise(res=>{
      const bait = document.createElement('div');
      bait.className = 'adsbox ad-banner ad-unit pub_300x250 textads banner-ads';
      bait.setAttribute('aria-hidden','true');
      bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;';
      bait.innerHTML = '&nbsp;';
      document.body.appendChild(bait);
      setTimeout(()=>{
        const cs = getComputedStyle(bait);
        const blocked = !bait.isConnected || bait.offsetHeight === 0 || cs.display === 'none' || cs.visibility === 'hidden';
        bait.remove();
        res(blocked || !!window.__adsFailed);
      }, 600);
    });
  }
  function snoozed(){
    try{ const t = +localStorage.getItem('tp_abb_snooze'); return t && Date.now() < t; }catch{ return false; }
  }
  function showAdblockNotice(){
    if(snoozed()) return;
    const box = document.createElement('div');
    box.className = 'abb'; box.setAttribute('role','status');
    box.innerHTML = '<p><strong>Looks like you’re using an ad blocker.</strong>' +
      S.name + ' is free with no limits, and ads are how it stays that way. If you find it useful, please allow ads on this site. Every tool still works either way.</p>' +
      '<button type="button">Got it</button>';
    box.querySelector('button').onclick = ()=>{
      try{ localStorage.setItem('tp_abb_snooze', Date.now() + S.adblockSnoozeDays*864e5); }catch{}
      box.remove();
    };
    document.body.appendChild(box);
  }

  function init(){
    fillSlots();
    document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
    detectAdblock().then(b=>{ if(b) showAdblockNotice(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ---------- bookmark / install nudge ----------
   Browsers don't let pages add bookmarks themselves, so we show the right shortcut for the
   visitor's device, offer "Install app" where the browser supports it, and gently remind
   people after a tool has just worked for them. */
window.BM = (()=>{
  const KEY='beot_bm';
  const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch{ return {}; } };
  const save=st=>{ try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch{} };
  const ua=navigator.userAgent, isMac=/Mac|iPhone|iPad/.test(navigator.platform||ua);
  const isIOS=/iPhone|iPad|iPod/.test(ua)||(isMac&&navigator.maxTouchPoints>1), isAndroid=/Android/.test(ua);
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  let installEvt=null, shownThisPage=false, box=null;
  const markDone=()=>document.documentElement.classList.add('bm-done');
  if(load().done||standalone) markDone();
  addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; });
  addEventListener('appinstalled',()=>{ const st=load(); st.done=true; save(st); markDone(); close(); });
  // pressing Ctrl/⌘+D on our page means they bookmarked it: stop reminding
  addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='d'){ const st=load(); st.done=true; save(st); markDone(); setTimeout(close,400); } });

  function how(){
    if(isIOS) return 'Tap the <b>Share</b> button <span aria-hidden="true">(□↑)</span>, then <b>Add Bookmark</b> or <b>Add to Home Screen</b>.';
    if(isAndroid) return 'Open the browser menu <b>⋮</b> and tap the <b>☆ star</b>, or <b>Add to Home screen</b>.';
    return `Press <kbd>${isMac?'⌘':'Ctrl'}</kbd> + <kbd>D</kbd> to bookmark this site.`;
  }
  function close(){ if(box){ box.remove(); box=null; } }
  function open(reason){
    close();
    const name=(window.SITE&&SITE.name)||'this site';
    box=document.createElement('div'); box.className='bm-pop'; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Bookmark '+name);
    box.innerHTML=`<button type="button" class="bm-x" aria-label="Close">×</button>
      <strong>${reason==='success'?'Glad that worked! ':''}Keep ${name} handy</strong>
      <p>${reason==='success'?'Bookmark it so it’s one click away next time. ':''}${how()}</p>
      <div class="bm-acts">${installEvt?'<button type="button" class="btn primary" data-act="install">Install as an app</button>':''}<button type="button" class="btn${installEvt?'':' primary'}" data-act="done">I bookmarked it</button><button type="button" class="btn" data-act="later">Not now</button></div>`;
    box.addEventListener('click',async e=>{
      const a=e.target.closest('[data-act]')?.dataset.act || (e.target.closest('.bm-x')?'later':null); if(!a) return;
      const st=load();
      if(a==='install'&&installEvt){ installEvt.prompt(); const r=await installEvt.userChoice.catch(()=>null); installEvt=null; if(r&&r.outcome==='accepted'){ st.done=true; save(st); markDone(); } close(); return; }
      if(a==='done'){ st.done=true; markDone(); }
      if(a==='later'){ st.snoozedAt=Date.now(); st.usesAtSnooze=st.uses||0; }
      save(st); close();
    });
    document.body.appendChild(box);
    box.querySelector('.btn').focus({preventScroll:true});
  }
  // called by tools after something useful happened (a download, a copy, a finished job)
  function success(){
    const st=load(); st.uses=(st.uses||0)+1; save(st);
    if(st.done||standalone||shownThisPage||document.querySelector('.abb')) return;
    const snoozed=st.snoozedAt && (Date.now()-st.snoozedAt<10*864e5 || (st.uses-(st.usesAtSnooze||0))<3);
    if(snoozed) return;
    shownThisPage=true;
    setTimeout(()=>open('success'),900);
  }
  document.addEventListener('click',e=>{ if(e.target.closest('#bmBtn,[data-bookmark]')){ e.preventDefault(); open('button'); } });
  return {open,success,close};
})();

/* ---------- shared UI helpers used by tool pages ---------- */
window.UI = {
  $: id => document.getElementById(id),
  dropzone(el, input, onFile){
    el.addEventListener('click', ()=>input.click());
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); } });
    ['dragover','dragenter'].forEach(t=>el.addEventListener(t, e=>{ e.preventDefault(); el.classList.add('over'); }));
    ['dragleave','drop'].forEach(t=>el.addEventListener(t, e=>{ e.preventDefault(); el.classList.remove('over'); }));
    el.addEventListener('drop', e=>{ const f = e.dataTransfer.files[0]; if(f) onFile(f); });
    input.addEventListener('change', ()=>{ if(input.files[0]) onFile(input.files[0]); input.value=''; });
  },
  // multi-file version: calls onFiles(arrayOfFiles)
  dropzoneMulti(el, input, onFiles){
    el.addEventListener('click', ()=>input.click());
    el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); } });
    ['dragover','dragenter'].forEach(t=>el.addEventListener(t, e=>{ e.preventDefault(); el.classList.add('over'); }));
    ['dragleave','drop'].forEach(t=>el.addEventListener(t, e=>{ e.preventDefault(); el.classList.remove('over'); }));
    el.addEventListener('drop', e=>{ const f=[...e.dataTransfer.files]; if(f.length) onFiles(f); });
    input.addEventListener('change', ()=>{ const f=[...input.files]; if(f.length) onFiles(f); input.value=''; });
  },
  // copy text with a fallback when the clipboard API is refused
  async copy(text, btn){
    let ok=false;
    try{ await navigator.clipboard.writeText(text); ok=true; }catch{
      const t=document.createElement('textarea'); t.value=text; t.style.cssText='position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      try{ ok=document.execCommand('copy'); }catch{} t.remove();
    }
    if(btn){ const o=btn.textContent; btn.textContent=ok?'Copied':'Copy failed'; setTimeout(()=>btn.textContent=o,1200); }
    if(ok) BM.success();
    return ok;
  },
  // bundle [{name, blob}] into a .zip Blob (needs vendor/fflate.min.js)
  async zip(items){
    const files={}, used=new Set();
    for(const it of items){
      let n=it.name, k=1; while(used.has(n)){ n=it.name.replace(/(\.[^.]+)?$/,`_${k++}$1`); } used.add(n);
      files[n]=[new Uint8Array(await it.blob.arrayBuffer()),{level:0}];
    }
    return new Blob([fflate.zipSync(files)],{type:'application/zip'});
  },
  download(blob, name){ BM.success(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000); },
  ext(name){ const m=/\.([^.]+)$/.exec(name||''); return m?m[1].toLowerCase():''; },
  seg(el, onChange){
    el.addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b || b.disabled || el.dataset.locked) return;
      [...el.children].forEach(x=>x.setAttribute('aria-pressed', x===b));
      onChange(b.dataset.v);
    });
    const cur = [...el.children].find(x=>x.getAttribute('aria-pressed')==='true');
    return cur ? cur.dataset.v : null;
  },
  lock(els, on){ els.forEach(el=>{ if(!el) return; if(el.matches('.seg')){ on ? el.dataset.locked='1' : delete el.dataset.locked; } else el.disabled = on; }); },
  progress(barEl, statusEl){
    return {
      set(p){ barEl.style.width = (Math.max(0,Math.min(1,p))*100) + '%'; },
      say(t){ statusEl.textContent = t; },
      reset(){ this.set(0); }
    };
  },
  bytes(n){ if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(0)+' KB'; if(n<1073741824) return (n/1048576).toFixed(1)+' MB'; return (n/1073741824).toFixed(2)+' GB'; },
  time(s){ s=Math.max(0,s); const m=Math.floor(s/60), r=(s%60); return m+':' + (r<10?'0':'') + r.toFixed(1); },
  baseName(name){ return (name||'file').replace(/\.[^.]+$/,'').replace(/[^\w\-. ]+/g,'_').slice(0,80); },
  showResult(box, {blob, filename, meta, previewType}){
    if(box._url) URL.revokeObjectURL(box._url);
    const url = box._url = URL.createObjectURL(blob);
    box.innerHTML = '';
    if(previewType === 'video'){ const v=document.createElement('video'); v.src=url; v.controls=true; v.playsInline=true; v.style.cssText='width:100%;max-height:360px;border-radius:10px;background:#000'; box.appendChild(v); }
    if(previewType === 'image'){ const i=document.createElement('img'); i.src=url; i.alt='Result preview'; i.style.maxHeight='360px'; i.className='zoomable'; i.title='Click to view larger'; i.onclick=()=>UI.lightbox([{label:'Result',src:url,note:`${filename} · ${UI.bytes(blob.size)}`}]); box.appendChild(i); }
    if(previewType === 'audio'){ const a=document.createElement('audio'); a.src=url; a.controls=true; a.style.width='100%'; box.appendChild(a); }
    const a = document.createElement('a');
    a.className='btn primary'; a.href=url; a.download=filename; a.textContent='Download ' + filename.split('.').pop().toUpperCase();
    const m = document.createElement('div'); m.className='meta'; m.textContent = meta;
    box.append(a, m);
    box.hidden = false;
    BM.success();
  },
  // start/end inputs with "use current time" buttons
  range({start,end,setStart,setEnd,video,onChange}){
    let dur=0;
    const get=()=>{
      let s=Math.max(0,Math.min(dur,+start.value||0)), e=Math.max(0,Math.min(dur,+end.value||dur));
      if(e<=s+0.05) e=dur;
      return [s,e];
    };
    const ch=()=>onChange&&onChange(get());
    start.addEventListener('input',ch); end.addEventListener('input',ch);
    setStart&&setStart.addEventListener('click',()=>{ start.value=(video.currentTime).toFixed(2); ch(); });
    setEnd&&setEnd.addEventListener('click',()=>{ end.value=(video.currentTime).toFixed(2); ch(); });
    return {
      get,
      reset(d,defEnd){ dur=d; start.max=end.max=d.toFixed(2); start.value=0; end.value=(defEnd??d).toFixed(2); ch(); }
    };
  },
  /* Zoom + pan viewer.
     vp: viewport element; content: element sized to the image (canvas/img/stage).
     opts: {width,height (natural px), onPoint(x,y,e) for clicks, onHover(x,y,e), maxZoom}
     Wheel or the buttons zoom, drag pans, pinch zooms on touch. Elements marked data-nopan keep their own drag. */
  viewer(vp, content, o={}){
    vp.classList.add('zv'); content.classList.add('zv-content');
    let W=o.width, H=o.height, s=1, tx=0, ty=0, fitS=1, atFit=true;
    const bar=document.createElement('div'); bar.className='zv-bar';
    bar.innerHTML='<button type="button" data-z="out" aria-label="Zoom out">−</button><output class="zv-pct">100%</output><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="fit">Fit</button><button type="button" data-z="1">1:1</button>'+(o.noFull?'':'<button type="button" data-z="full" aria-label="Full screen" title="Full screen">⤢</button>');
    vp.appendChild(bar);
    const escFull=e=>{ if(e.key==='Escape') setFull(false); };
    function setFull(on){
      vp.classList.toggle('zv-full',on); document.body.style.overflow=on?'hidden':'';
      const b=bar.querySelector('[data-z=full]'); if(b){ b.textContent=on?'✕':'⤢'; b.setAttribute('aria-label',on?'Exit full screen':'Full screen'); }
      on?document.addEventListener('keydown',escFull):document.removeEventListener('keydown',escFull);
      requestAnimationFrame(fit);
    }
    const maxZ=()=>Math.min(o.maxZoom||32, 60000/Math.max(W,H));
    function apply(){
      content.style.width=W*s+'px'; content.style.height=H*s+'px';
      content.style.transform=`translate(${tx}px,${ty}px)`;
      content.classList.toggle('px',s>=3);
      content.style.setProperty('--zs',s);
      bar.querySelector('.zv-pct').textContent=Math.round(s*100)+'%';
      o.onZoom&&o.onZoom(s);
    }
    function clampPan(){
      const vw=vp.clientWidth, vh=vp.clientHeight, cw=W*s, ch=H*s;
      tx = cw<=vw ? (vw-cw)/2 : Math.min(0,Math.max(vw-cw,tx));
      ty = ch<=vh ? (vh-ch)/2 : Math.min(0,Math.max(vh-ch,ty));
    }
    function fit(){ const vw=vp.clientWidth, vh=vp.clientHeight; fitS=Math.min((vw-16)/W, (vh-60)/H, 1)||1; s=fitS; atFit=true; clampPan(); apply(); }
    function zoomAt(ns, cx, cy){
      ns=Math.max(Math.min(fitS,0.05), Math.min(maxZ(), ns));
      const r=vp.getBoundingClientRect(); cx??=r.width/2; cy??=r.height/2;
      const ix=(cx-tx)/s, iy=(cy-ty)/s;
      s=ns; tx=cx-ix*s; ty=cy-iy*s; atFit=false; clampPan(); apply();
    }
    bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const z=b.dataset.z;
      if(z==='in') zoomAt(s*1.5); else if(z==='out') zoomAt(s/1.5); else if(z==='fit') fit(); else if(z==='full') setFull(!vp.classList.contains('zv-full')); else zoomAt(1); });
    vp.addEventListener('wheel',e=>{ e.preventDefault(); const r=vp.getBoundingClientRect(); zoomAt(s*Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0018)), e.clientX-r.left, e.clientY-r.top); },{passive:false});
    vp.tabIndex=vp.tabIndex>=0?vp.tabIndex:0;
    vp.addEventListener('keydown',e=>{ if(e.target!==vp) return; if(e.key==='+'||e.key==='=') zoomAt(s*1.5); else if(e.key==='-') zoomAt(s/1.5); else if(e.key==='0') fit(); });
    const pts=new Map(); let start=null, moved=false, pinch=null;
    vp.addEventListener('pointerdown',e=>{
      if(e.target.closest('.zv-bar')||e.target.closest('[data-nopan]')) return;
      vp.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===1){ start={x:e.clientX,y:e.clientY,tx,ty}; moved=false; }
      if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s}; moved=true; }
    });
    vp.addEventListener('pointermove',e=>{
      const r=vp.getBoundingClientRect();
      if(o.onHover&&!pts.size){ const cr=content.getBoundingClientRect(); if(e.clientX>=cr.left&&e.clientX<cr.right&&e.clientY>=cr.top&&e.clientY<cr.bottom) o.onHover((e.clientX-cr.left)/s,(e.clientY-cr.top)/s,e); else o.onHover(null,null,e); }
      if(!pts.has(e.pointerId)) return;
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===2&&pinch){ const [a,b]=[...pts.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); zoomAt(pinch.s*d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); return; }
      if(!start) return;
      const dx=e.clientX-start.x, dy=e.clientY-start.y;
      if(Math.abs(dx)+Math.abs(dy)>4) moved=true;
      if(moved){ tx=start.tx+dx; ty=start.ty+dy; atFit=false; clampPan(); apply(); vp.classList.add('panning'); }
    });
    const end=e=>{
      if(!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if(pts.size<2) pinch=null;
      if(!pts.size){
        vp.classList.remove('panning');
        if(!moved&&o.onPoint&&e.type==='pointerup'){ const cr=content.getBoundingClientRect(); const x=(e.clientX-cr.left)/s, y=(e.clientY-cr.top)/s; if(x>=0&&y>=0&&x<W&&y<H) o.onPoint(x,y,e); }
        start=null;
      }
    };
    vp.addEventListener('pointerup',end); vp.addEventListener('pointercancel',end);
    vp.addEventListener('pointerleave',e=>{ if(o.onHover&&!pts.size) o.onHover(null,null,e); });
    new ResizeObserver(()=>{ if(atFit) fit(); else { clampPan(); apply(); } }).observe(vp);
    return { fit, zoomAt, get scale(){ return s; }, setSize(w,h){ W=w; H=h; fit(); }, destroy(){ bar.remove(); } };
  },
  /* full-screen zoomable preview. views: [{label, src (url), w, h, note}] */
  lightbox(views, start=0){
    const box=document.createElement('div'); box.className='lb'; box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.innerHTML='<div class="lb-top"><div class="lb-tabs"></div><span class="lb-note"></span><button type="button" class="lb-x" aria-label="Close">×</button></div><div class="lb-vp"><img class="lb-img" alt=""></div><p class="lb-hint">Scroll or pinch to zoom · drag to move · Esc to close</p>';
    document.body.appendChild(box); document.body.style.overflow='hidden';
    const img=box.querySelector('.lb-img'), vp=box.querySelector('.lb-vp'), tabs=box.querySelector('.lb-tabs');
    let v=null;
    function show(i){
      const it=views[i]; tabs.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',i===j));
      box.querySelector('.lb-note').textContent=it.note||'';
      const prev=v&&{s:v.scale};
      img.onload=()=>{ const w=it.w||img.naturalWidth, h=it.h||img.naturalHeight; if(!v) v=UI.viewer(vp,img,{width:w,height:h,noFull:true}); else v.setSize(w,h); };
      img.src=it.src;
    }
    if(views.length>1) views.forEach((it,i)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=it.label; b.onclick=()=>show(i); tabs.appendChild(b); });
    const close=()=>{ box.remove(); document.body.style.overflow=''; document.removeEventListener('keydown',key); };
    const key=e=>{ if(e.key==='Escape') close(); if(views.length>1&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){ const cur=[...tabs.children].findIndex(b=>b.getAttribute('aria-pressed')==='true'); show((cur+(e.key==='ArrowRight'?1:views.length-1))%views.length); } };
    document.addEventListener('keydown',key);
    box.querySelector('.lb-x').onclick=close;
    box.addEventListener('click',e=>{ if(e.target===box) close(); });
    show(start); vp.focus();
    return {close};
  },
  // keep the screen awake + warn about tab switching while a job runs
  job(){
    let lock=null, lost=false;
    const onVis=()=>{ if(document.hidden) lost=true; };
    document.addEventListener('visibilitychange', onVis);
    try{ navigator.wakeLock?.request('screen').then(l=>lock=l).catch(()=>{}); }catch{}
    const title=document.title;
    return {
      title(t){ document.title = t + ' – ' + title; },
      get lostFocus(){ return lost; },
      end(){ document.removeEventListener('visibilitychange', onVis); try{ lock&&lock.release(); }catch{} document.title=title; }
    };
  }
};
