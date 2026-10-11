(()=>{
const {$}=UI;
let mode='pct';
UI.seg($('mode'),v=>{ mode=v; $('pctWrap').hidden=v!=='pct'; $('pxWrap').hidden=v!=='px'; });
$('pxWrap').hidden=true;

function target(w,h){
  if(mode==='pct'){ const p=Math.max(1,+$('pct').value||100)/100; return [Math.round(w*p),Math.round(h*p)]; }
  const W=+$('w').value||0, H=+$('h').value||0, keep=$('keep').checked;
  if(!W&&!H) return [w,h];
  if(!keep) return [W||w, H||h];
  if(W&&H){ const s=Math.min(W/w,H/h); return [Math.round(w*s),Math.round(h*s)]; }
  if(W) return [W,Math.round(h*W/w)];
  return [Math.round(w*H/h),H];
}
IK.batch({
  accept:f=>IK.typeOf(f).startsWith('image/'),
  zipName:'resized-images.zip',
  controls:[$('mode'),$('pct'),$('w'),$('h'),$('keep')],
  async onAdd(r){ try{ const d=await IK.decode(r.file); r.sub(`${d.w}×${d.h} · ${UI.bytes(r.file.size)}`); d.close(); }catch{} },
  async process(r){
    const f=r.file, t=IK.typeOf(f);
    const out=(t==='image/png'||t==='image/gif'||t==='image/svg+xml')?'image/png':(t==='image/webp'&&await IK.canEncode('image/webp'))?'image/webp':'image/jpeg';
    const d=await IK.decode(f);
    const [w,h]=target(d.w,d.h);
    if(w>16384||h>16384) throw new Error('Too large (max 16384 px per side).');
    const c=IK.canvasFrom(d,w,h,{bg:out==='image/jpeg'?'#ffffff':null}); d.close();
    const blob=await IK.encode(c,out,.92);
    return {blob,name:`${UI.baseName(f.name)}_${w}x${h}.${IK.EXT[out]}`,text:`${w}×${h} · ${UI.bytes(blob.size)}`};
  }
});
})();
