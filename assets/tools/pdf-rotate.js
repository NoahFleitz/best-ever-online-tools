(()=>{
const {$}=UI, prog=UI.progress($('bar'),$('status'));
let file=null, buf=null, view=null, rot=[], els=[];
function show(i){ const c=els[i].querySelector('.pg-img'); c.style.transform=`rotate(${rot[i]}deg)`; els[i].classList.toggle('on',rot[i]%360!==0); }
function changed(){ const k=rot.filter(r=>r%360).length; prog.say(k?`${k} page${k>1?'s':''} will be rotated.`:'Click a page to rotate it 90°.'); }
UI.dropzone($('drop'),$('file'),async f=>{
  if(!PK.isPdf(f)) return fail('Choose a PDF file.');
  $('err').hidden=true; $('result').hidden=true; prog.say('Reading PDF…');
  try{
    buf=await f.arrayBuffer(); view&&view.destroy(); view=await PK.openView(buf); file=f;
    rot=new Array(view.numPages).fill(0);
    $('fileinfo').textContent=`${f.name} · ${view.numPages} page${view.numPages>1?'s':''} · ${UI.bytes(f.size)}`;
    els=await PK.thumbs(view,$('pages'),{onClick:n=>{ rot[n-1]=(rot[n-1]+90)%360; show(n-1); changed(); }});
    ['all-l','all-r','reset','go'].forEach(id=>$(id).disabled=false); changed();
  }catch(e){ fail(e.message); }
});
$('all-l').onclick=()=>{ rot=rot.map(r=>(r+270)%360); rot.forEach((_,i)=>show(i)); changed(); };
$('all-r').onclick=()=>{ rot=rot.map(r=>(r+90)%360); rot.forEach((_,i)=>show(i)); changed(); };
$('reset').onclick=()=>{ rot=rot.map(()=>0); rot.forEach((_,i)=>show(i)); changed(); };
$('go').onclick=async()=>{
  $('err').hidden=true; UI.lock([$('go')],true);
  try{
    const doc=await PK.openEdit(buf);
    doc.getPages().forEach((p,i)=>{ if(rot[i]) p.setRotation(PDFLib.degrees((p.getRotation().angle+rot[i])%360)); });
    const blob=await PK.blobOf(doc);
    UI.showResult($('result'),{blob,filename:UI.baseName(file.name)+'_rotated.pdf',meta:`PDF · ${rot.filter(r=>r).length} page(s) rotated · ${UI.bytes(blob.size)}`});
    prog.say('Done.');
  }catch(e){ fail(e.message); }
  finally{ UI.lock([$('go')],false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
