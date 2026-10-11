(()=>{
const {$}=UI, prog=UI.progress($('bar'),$('status'));
let size='fit', margin=0;
UI.seg($('size'),v=>size=v);
UI.seg($('margin'),v=>margin=+v);
const SIZES={a4:[595.28,841.89],letter:[612,792]};
const L=PK.sortList($('list'),{
  onChange:items=>{ $('go').disabled=!items.length; prog.say(items.length?`${items.length} image${items.length>1?'s':''} · one per page, in this order.`:'Choose images to start.'); },
  render:it=>{ const u=URL.createObjectURL(it.file), img=new Image(); img.className='fthumb zoomable'; img.alt=''; img.title='Click to view larger'; img.src=u; it.url=u; img.onclick=()=>UI.lightbox([{label:'Image',src:u,note:it.file.name}]); it.el.querySelector('.fthumb').replaceWith(img); }
});
UI.dropzoneMulti($('drop'),$('file'),files=>{
  const ok=files.filter(f=>IK.typeOf(f).startsWith('image/'));
  ok.forEach(f=>L.add(f));
  $('err').hidden=ok.length===files.length; $('err').textContent='Some files were skipped because they aren’t images.';
});
async function embed(doc,file){
  const t=IK.typeOf(file), bytes=new Uint8Array(await file.arrayBuffer());
  if(t==='image/jpeg'){ const e=IK.readExif(bytes.buffer); if(!(e.orientation>1)) return doc.embedJpg(bytes); }
  if(t==='image/png') return doc.embedPng(bytes);
  const d=await IK.decode(file), alpha=IK.hasAlpha(t);
  const c=IK.canvasFrom(d,d.w,d.h,{bg:alpha?null:'#ffffff'}); d.close();
  const b=await IK.encode(c,alpha?'image/png':'image/jpeg',.92), by=new Uint8Array(await b.arrayBuffer());
  return alpha?doc.embedPng(by):doc.embedJpg(by);
}
$('go').onclick=async()=>{
  $('err').hidden=true; $('result').hidden=true; UI.lock([$('go'),$('size'),$('margin')],true);
  try{
    const doc=await PDFLib.PDFDocument.create();
    for(let i=0;i<L.items.length;i++){
      const f=L.items[i].file; prog.say(`Adding ${f.name}…`); prog.set(i/L.items.length);
      const img=await embed(doc,f);
      let pw,ph;
      if(size==='fit'){ pw=img.width*0.75+margin*2; ph=img.height*0.75+margin*2; } // 96 dpi → points
      else{ [pw,ph]=SIZES[size]; if(img.width>img.height) [pw,ph]=[ph,pw]; }
      const page=doc.addPage([pw,ph]);
      const s=Math.min((pw-margin*2)/img.width,(ph-margin*2)/img.height), w=img.width*s, h=img.height*s;
      page.drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
    }
    prog.say('Saving…');
    const blob=await PK.blobOf(doc); prog.set(1);
    UI.showResult($('result'),{blob,filename:'images.pdf',meta:`PDF · ${L.items.length} page${L.items.length>1?'s':''} · ${UI.bytes(blob.size)}`});
    prog.say('Done.');
  }catch(e){ $('err').textContent=e.message||'Couldn’t add one of the images.'; $('err').hidden=false; prog.say(''); }
  finally{ UI.lock([$('go'),$('size'),$('margin')],false); }
};
})();
