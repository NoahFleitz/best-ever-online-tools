(()=>{
const {$}=UI;
let to='image/jpeg', q=.9;
UI.seg($('to'),v=>{ to=v; $('qualWrap').hidden=v==='image/png'; });
$('qual').oninput=()=>{ q=$('qual').value/100; $('qualV').textContent=$('qual').value; };
$('qualV').textContent=$('qual').value;
IK.canEncode('image/webp').then(ok=>{ if(!ok){ const b=$('to').querySelector('[data-v="image/webp"]'); b.disabled=true; b.title='Your browser can’t save WebP'; } });

IK.batch({
  accept:f=>IK.typeOf(f).startsWith('image/'),
  zipName:'converted-images.zip',
  controls:[$('to'),$('qual')],
  async process(r){
    const f=r.file, d=await IK.decode(f);
    const c=IK.canvasFrom(d,d.w,d.h,{bg:to==='image/jpeg'?'#ffffff':null}); d.close();
    const blob=await IK.encode(c,to,q);
    return {blob,name:UI.baseName(f.name)+'.'+IK.EXT[to],text:`${IK.EXT[to].toUpperCase()} · ${UI.bytes(blob.size)}`};
  }
});
})();
