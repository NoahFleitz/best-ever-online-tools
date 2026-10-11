(()=>{
const {$}=UI, prog=UI.progress($('bar'),$('status'));
let file=null, buf=null, view=null, n=0, mode='each', sel=new Set(), els=[];
UI.seg($('mode'),v=>{ mode=v; $('rangesWrap').hidden=v!=='ranges'; $('pages').classList.toggle('selecting',v==='select'); note(); });
$('ranges').addEventListener('input',note);
function note(){
  if(!n) return;
  $('modeNote').textContent = mode==='each' ? `You’ll get ${n} separate PDFs in a ZIP.` :
    mode==='select' ? (sel.size?`${sel.size} page${sel.size>1?'s':''} selected → one new PDF.`:'Click pages below to select them.') :
    'Each range becomes its own PDF, e.g. 1-3, 5, 8-10.';
}
UI.dropzone($('drop'),$('file'),async f=>{
  if(!PK.isPdf(f)) return fail('Choose a PDF file.');
  $('err').hidden=true; $('result').hidden=true; prog.say('Reading PDF…');
  try{
    buf=await f.arrayBuffer(); view&&view.destroy(); view=await PK.openView(buf); file=f; n=view.numPages; sel.clear();
    $('fileinfo').textContent=`${f.name} · ${n} page${n>1?'s':''} · ${UI.bytes(f.size)}`;
    els=await PK.thumbs(view,$('pages'),{onClick:(p,b)=>{ if(mode!=='select') return; sel.has(p)?sel.delete(p):sel.add(p); b.classList.toggle('on',sel.has(p)); note(); }});
    $('go').disabled=false; prog.say('Ready.'); note();
  }catch(e){ fail(e.message); }
});
$('go').onclick=async()=>{
  $('err').hidden=true; $('result').hidden=true; UI.lock([$('go'),$('mode')],true);
  try{
    const src=await PK.openEdit(buf), base=UI.baseName(file.name);
    let groups;
    if(mode==='each') groups=[...Array(n)].map((_,i)=>[i]);
    else if(mode==='select'){ if(!sel.size) throw new Error('Select at least one page.'); groups=[[...sel].sort((a,b)=>a-b).map(p=>p-1)]; }
    else groups=PK.parseRanges($('ranges').value,n).map(([a,b])=>[...Array(b-a+1)].map((_,i)=>a-1+i));
    const outs=[];
    for(let i=0;i<groups.length;i++){
      prog.say(`Making file ${i+1} of ${groups.length}…`); prog.set(i/groups.length);
      const g=groups[i], doc=await PK.pick(src,g);
      const label=g.length===1?`page-${g[0]+1}`:`pages-${g[0]+1}-${g[g.length-1]+1}`;
      outs.push({name:`${base}_${mode==='select'?'selected':label}.pdf`,blob:await PK.blobOf(doc)});
    }
    prog.set(1);
    if(outs.length===1) UI.showResult($('result'),{blob:outs[0].blob,filename:outs[0].name,meta:`PDF · ${groups[0].length} page${groups[0].length>1?'s':''} · ${UI.bytes(outs[0].blob.size)}`});
    else{ const z=await UI.zip(outs); UI.showResult($('result'),{blob:z,filename:`${base}_split.zip`,meta:`${outs.length} PDFs in a ZIP · ${UI.bytes(z.size)}`}); }
    prog.say('Done.');
  }catch(e){ fail(e.message); }
  finally{ UI.lock([$('go'),$('mode')],false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
