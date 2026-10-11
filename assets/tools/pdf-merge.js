(()=>{
const {$}=UI, prog=UI.progress($('bar'),$('status'));
const L=PK.sortList($('list'),{
  onChange:items=>{ $('go').disabled=items.length<2; prog.say(items.length?`${items.length} PDF${items.length>1?'s':''} · drag or use the arrows to set the order.`:'Choose PDFs to start.'); },
  render:async it=>{
    try{
      it.buf=await it.file.arrayBuffer();
      const doc=await PK.openView(it.buf);
      it.sub(`${doc.numPages} page${doc.numPages>1?'s':''} · ${UI.bytes(it.file.size)}`);
      const c=await PK.renderPage(doc,1,0.25); c.className='fthumb'; it.el.querySelector('.fthumb').replaceWith(c);
      doc.destroy();
    }catch(e){ it.sub(e.message); it.bad=true; }
  }
});
UI.dropzoneMulti($('drop'),$('file'),files=>{
  const ok=files.filter(PK.isPdf);
  ok.forEach(f=>L.add(f));
  $('err').hidden=ok.length===files.length; $('err').textContent='Only PDF files can be merged.';
});
$('go').onclick=async()=>{
  $('err').hidden=true; $('result').hidden=true; UI.lock([$('go')],true);
  try{
    const out=await PDFLib.PDFDocument.create();
    for(let i=0;i<L.items.length;i++){
      const it=L.items[i];
      prog.say(`Adding ${it.file.name}…`); prog.set(i/L.items.length);
      const src=await PK.openEdit(it.buf||await it.file.arrayBuffer());
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
    prog.say('Saving…');
    const blob=await PK.blobOf(out); prog.set(1);
    UI.showResult($('result'),{blob,filename:'merged.pdf',meta:`PDF · ${out.getPageCount()} pages · ${UI.bytes(blob.size)}`});
    prog.say('Done.');
  }catch(e){ $('err').textContent=e.message; $('err').hidden=false; prog.say(''); }
  finally{ UI.lock([$('go')],false); }
};
})();
