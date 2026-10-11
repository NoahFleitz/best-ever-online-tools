(()=>{
const {$}=UI;
let q=.75, fmt='keep', max=0;
$('qual').oninput=()=>{ q=$('qual').value/100; $('qualV').textContent=$('qual').value; };
$('qualV').textContent=$('qual').value;
UI.seg($('fmt'),v=>fmt=v);
$('max').oninput=()=>max=+$('max').value;
IK.canEncode('image/webp').then(ok=>{ if(!ok){ const b=$('fmt').querySelector('[data-v="image/webp"]'); b.disabled=true; b.title='Your browser can’t save WebP'; } });

IK.batch({
  accept:f=>IK.typeOf(f).startsWith('image/'),
  zipName:'compressed-images.zip',
  controls:[$('qual'),$('fmt'),$('max')],
  async process(r){
    const f=r.file, t=IK.typeOf(f);
    let out = fmt==='keep' ? (t==='image/png'?'image/png':t==='image/webp'?'image/webp':'image/jpeg') : fmt;
    if(out==='image/webp' && !(await IK.canEncode('image/webp'))) out='image/jpeg';
    const d=await IK.decode(f);
    let w=d.w, h=d.h;
    if(max && Math.max(w,h)>max){ const s=max/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); }
    const c=IK.canvasFrom(d,w,h,{bg:out==='image/jpeg'?'#ffffff':null}); d.close();
    const blob=await IK.encode(c,out,q);
    if(blob.size>=f.size && out===t && w===d.w) return {blob:f,name:f.name,text:'Already small, kept original'};
    return {blob,name:UI.baseName(f.name)+'.'+IK.EXT[out],text:`${UI.bytes(blob.size)} (${IK.pct(f.size,blob.size)})`+(w!==d.w?` · ${w}×${h}`:'')};
  }
});
})();
