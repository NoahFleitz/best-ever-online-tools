(()=>{
const {$}=UI, prog=UI.progress($('bar'),$('status'));
let file=null, view=null, fmt='image/png', scale=2, outs=[];
UI.seg($('fmt'),v=>fmt=v);
UI.seg($('scale'),v=>scale=+v);
UI.dropzone($('drop'),$('file'),async f=>{
  if(!PK.isPdf(f)) return fail('Choose a PDF file.');
  $('err').hidden=true; $('grid').innerHTML=''; $('zipAll').hidden=true; prog.say('Reading PDF…');
  try{
    view&&view.destroy(); view=await PK.openView(await f.arrayBuffer()); file=f;
    $('fileinfo').textContent=`${f.name} · ${view.numPages} page${view.numPages>1?'s':''} · ${UI.bytes(f.size)}`;
    $('pagesIn').placeholder=`All pages (1-${view.numPages})`;
    $('go').disabled=false; prog.say('Ready.');
  }catch(e){ fail(e.message); }
});
$('zipAll').onclick=async()=>UI.download(await UI.zip(outs),UI.baseName(file.name)+'_images.zip');
$('go').onclick=async()=>{
  $('err').hidden=true; UI.lock([$('go'),$('fmt'),$('scale'),$('pagesIn')],true);
  const grid=$('grid'); grid.querySelectorAll('a').forEach(a=>URL.revokeObjectURL(a.href)); grid.innerHTML=''; outs=[]; $('zipAll').hidden=true;
  try{
    const n=view.numPages, v=$('pagesIn').value.trim();
    const list=v?PK.parseRanges(v,n).flatMap(([a,b])=>[...Array(b-a+1)].map((_,i)=>a+i)):[...Array(n)].map((_,i)=>i+1);
    const ext=fmt==='image/png'?'png':'jpg', base=UI.baseName(file.name), job=UI.job();
    for(let i=0;i<list.length;i++){
      const p=list[i]; prog.say(`Rendering page ${p} (${i+1} of ${list.length})…`);
      const c=await PK.renderPage(view,p,scale);
      const blob=await IK.encode(c,fmt,.92), name=`${base}_page-${p}.${ext}`;
      const url=URL.createObjectURL(blob); outs.push({name,blob,url});
      const cell=document.createElement('div'); cell.className='pcell';
      cell.innerHTML=`<img alt="Page ${p}" src="${url}"><div class="pcap"><span>Page ${p} · ${c.width}×${c.height} · ${UI.bytes(blob.size)}</span><a class="mini dl" href="${url}" download="${name}">Download</a></div>`;
      const im=cell.querySelector('img'); im.classList.add('zoomable'); im.title='Click to view larger';
      im.onclick=()=>{ const views=outs.map(o=>({label:o.name.match(/page-(\d+)/)[1],src:o.url,note:o.name})); UI.lightbox(views,outs.findIndex(o=>o.name===name)); };
      grid.appendChild(cell); prog.set((i+1)/list.length);
    }
    job.end();
    $('zipAll').hidden=outs.length<2; if(outs.length) BM.success();
    prog.say(`Done: ${outs.length} image${outs.length>1?'s':''}.`);
  }catch(e){ fail(e.message); }
  finally{ UI.lock([$('go'),$('fmt'),$('scale'),$('pagesIn')],false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
