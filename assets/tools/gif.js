(()=>{
const {$}=UI;
const vid=$('vid'), prog=UI.progress($('bar'),$('status'));
let file=null, info=null, w=480, fps=15, loop=true, busy=false, cancelled=false;

const range=UI.range({start:$('start'),end:$('end'),setStart:$('setStart'),setEnd:$('setEnd'),video:vid,onChange:()=>estimate()});
UI.seg($('w'),v=>{w=+v;estimate();});
UI.seg($('fps'),v=>{fps=+v;estimate();});
UI.seg($('loop'),v=>{loop=v==='1';});

function estimate(){
  if(!info) return;
  const [s,e]=range.get(), len=e-s, ww=Math.min(w,info.width), hh=Math.round(ww*info.height/info.width);
  const frames=Math.round(len*fps), mb=frames*ww*hh*0.45/1e6;
  $('rangeNote').textContent=`Clip: ${len.toFixed(1)}s · ${frames} frames`;
  $('estimate').textContent=`${ww}×${hh} GIF, roughly ${mb<1?(mb*1000).toFixed(0)+' KB':mb.toFixed(1)+' MB'}.`+(len>15?' That’s a long GIF; consider trimming it.':'');
}

UI.dropzone($('drop'),$('file'),async f=>{
  if(busy) return;
  $('err').hidden=true; $('result').hidden=true; prog.reset(); prog.say('Loading…');
  try{
    info=await TP.loadVideo(vid,f); file=f;
    $('empty').hidden=true; vid.hidden=false;
    $('fileinfo').textContent=`${f.name} · ${info.width}×${info.height} · ${UI.time(info.duration)} · ${UI.bytes(f.size)}`;
    range.reset(info.duration, Math.min(info.duration,5));
    $('go').disabled=false; prog.say('Ready.');
  }catch(e){ fail(e.message); }
});

$('cancel').onclick=()=>{cancelled=true;};
$('go').onclick=async()=>{
  if(busy||!file) return;
  busy=true; cancelled=false; vid.pause(); vid.controls=false;
  $('err').hidden=true; $('result').hidden=true; $('cancel').hidden=false;
  const ctl=[$('go'),$('w'),$('fps'),$('loop'),$('start'),$('end'),$('setStart'),$('setEnd')];
  UI.lock(ctl,true);
  const job=UI.job(), [s,e]=range.get();
  try{
    const r=await TP.renderGif({video:vid,start:s,end:e,fps,width:Math.min(w,info.width),loop,
      onProgress:(p,t)=>{prog.set(p);prog.say(t);job.title(Math.round(p*100)+'%');}, cancelled:()=>cancelled});
    UI.showResult($('result'),{blob:r.blob,filename:UI.baseName(file.name)+'.gif',previewType:'image',
      meta:`GIF · ${UI.bytes(r.blob.size)} · ${r.width}×${r.height} · ${fps} fps · ${r.frames} frames`});
    prog.say('Done.');
  }catch(x){ if(x.name==='AbortError'){prog.reset();prog.say('Cancelled.');} else fail(x.message||String(x)); }
  finally{ job.end(); busy=false; vid.controls=true; $('cancel').hidden=true; UI.lock(ctl,false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
