/* Best Ever Online Tools PDF kit — pdf.js for rendering, pdf-lib for editing. Everything stays in the browser. */
window.PK = (()=>{
  const here = document.currentScript && document.currentScript.src;
  if(window.pdfjsLib && here) pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', here).href;

  const isPdf = f => f.type==='application/pdf' || UI.ext(f.name)==='pdf';

  // pdf.js (rendering). isEvalSupported:false closes the font-eval hole in older pdf.js builds.
  async function openView(buf){
    try{ return await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0)),isEvalSupported:false}).promise; }
    catch(e){ throw new Error(e && e.name==='PasswordException' ? 'This PDF is password-protected. Remove the password first.' : 'Couldn’t read this PDF. It may be damaged.'); }
  }
  // pdf-lib (editing)
  async function openEdit(buf){
    try{ return await PDFLib.PDFDocument.load(buf,{ignoreEncryption:true}); }
    catch(e){ throw new Error(/encrypt/i.test(e.message)?'This PDF is password-protected. Remove the password first.':'Couldn’t read this PDF. It may be damaged.'); }
  }
  async function renderPage(doc, n, scale, canvas){
    const page=await doc.getPage(n), vp=page.getViewport({scale});
    canvas=canvas||document.createElement('canvas');
    canvas.width=Math.ceil(vp.width); canvas.height=Math.ceil(vp.height);
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    page.cleanup();
    return canvas;
  }
  // thumbnail grid; returns array of <button class="pg"> elements (index 0 = page 1)
  async function thumbs(doc, grid, {width=150, onClick}={}){
    grid.innerHTML='';
    const els=[], tok=grid._tok={};
    for(let n=1;n<=doc.numPages;n++){
      const b=document.createElement('button'); b.type='button'; b.className='pg'; b.dataset.n=n;
      b.innerHTML=`<span class="pg-img"></span><span class="pg-n">${n}</span>`;
      if(onClick) b.onclick=()=>onClick(n,b);
      grid.appendChild(b); els.push(b);
    }
    (async()=>{
      for(let n=1;n<=doc.numPages;n++){
        if(grid._tok!==tok) return;
        try{
          const page=await doc.getPage(n), vp=page.getViewport({scale:1});
          const c=await renderPage(doc,n,Math.min(2,width*1.5/vp.width));
          c.className='pg-c'; els[n-1].querySelector('.pg-img').appendChild(c);
        }catch{}
      }
    })();
    return els;
  }
  // "1-3, 5, 8-" → [[1,3],[5,5],[8,n]]
  function parseRanges(str, n){
    const out=[];
    for(const part of str.split(/[,;\s]+/).filter(Boolean)){
      const m=/^(\d*)\s*-\s*(\d*)$/.exec(part), one=/^\d+$/.test(part);
      let a,b;
      if(one){ a=b=+part; }
      else if(m){ a=m[1]?+m[1]:1; b=m[2]?+m[2]:n; }
      else throw new Error(`“${part}” isn’t a page or range. Use numbers like 1-3, 5, 8-10.`);
      if(a<1||b>n||a>b) throw new Error(`Pages “${part}” are outside 1–${n}.`);
      out.push([a,b]);
    }
    if(!out.length) throw new Error('Enter at least one page or range.');
    return out;
  }
  async function pick(src, indices){ // indices 0-based → new PDFDocument
    const out=await PDFLib.PDFDocument.create();
    const pages=await out.copyPages(src, indices);
    pages.forEach(p=>out.addPage(p));
    return out;
  }
  const blobOf = async doc => new Blob([await doc.save()],{type:'application/pdf'});

  // reorderable list (buttons + drag) used by Merge and Images-to-PDF
  function sortList(ol, {onChange, render}={}){
    const items=[];
    let dragEl=null;
    function sync(){ items.sort((a,b)=>[...ol.children].indexOf(a.el)-[...ol.children].indexOf(b.el)); items.forEach((it,i)=>it.el.querySelector('.ord').textContent=i+1); onChange&&onChange(items); }
    function add(file){
      const it={file,el:document.createElement('li')};
      it.el.className='frow'; it.el.draggable=true;
      it.el.innerHTML=`<span class="ord"></span><span class="fthumb ph"></span><div class="fmeta"><b></b><span class="fsub"></span></div><div class="mv"><button class="mini" type="button" data-m="-1" aria-label="Move up">↑</button><button class="mini" type="button" data-m="1" aria-label="Move down">↓</button></div><button class="fx" type="button" aria-label="Remove">×</button>`;
      it.el.querySelector('b').textContent=file.name;
      it.el.querySelector('.fsub').textContent=UI.bytes(file.size);
      it.sub=t=>it.el.querySelector('.fsub').textContent=t;
      it.el.querySelector('.fx').onclick=()=>{ items.splice(items.indexOf(it),1); it.el.remove(); sync(); };
      it.el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
        const sib=b.dataset.m==='-1'?it.el.previousElementSibling:it.el.nextElementSibling; if(!sib) return;
        b.dataset.m==='-1'?ol.insertBefore(it.el,sib):ol.insertBefore(sib,it.el); sync();
      });
      it.el.addEventListener('dragstart',e=>{ dragEl=it.el; it.el.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
      it.el.addEventListener('dragend',()=>{ it.el.classList.remove('dragging'); dragEl=null; sync(); });
      it.el.addEventListener('dragover',e=>{ if(!dragEl||dragEl===it.el) return; e.preventDefault(); e.stopPropagation(); const r=it.el.getBoundingClientRect(); ol.insertBefore(dragEl, e.clientY<r.top+r.height/2?it.el:it.el.nextSibling); });
      items.push(it); ol.appendChild(it.el); render&&render(it); sync();
      return it;
    }
    return {items, add, clear(){ items.splice(0).forEach(i=>i.el.remove()); sync(); }};
  }
  return {isPdf, openView, openEdit, renderPage, thumbs, parseRanges, pick, blobOf, sortList};
})();
