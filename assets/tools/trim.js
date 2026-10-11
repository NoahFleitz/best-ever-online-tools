(()=>{
const {$}=UI;
const vid=$('vid'), prog=UI.progress($('bar'),$('status'));
let file=null, info=null, srcFps=30, q='same', busy=false, cancelled=false;

const range=UI.range({start:$('start'),end:$('end'),setStart:$('setStart'),setEnd:$('setEnd'),video:vid,onChange:([s,e])=>{
  if(info) $('rangeNote').textContent=`Clip: ${UI.time(s)} → ${UI.time(e)} (${(e-s).toFixed(2)}s)`;
  bar();
}});

// ---- preview without processing: plays only the selected part of the original ----
let previewing=false;
function bar(){
  if(!info) return;
  const [s,e]=range.get(), d=info.duration;
  $('tbSel').style.left=s/d*100+'%'; $('tbSel').style.width=(e-s)/d*100+'%';
  $('tbHead').style.left=vid.currentTime/d*100+'%';
}
function stopPreview(){ if(!previewing) return; previewing=false; vid.pause(); $('preview').textContent='▶ Preview clip'; }
function tickPreview(){
  bar();
  if(!previewing) return;
  const [,e]=range.get();
  if(vid.currentTime>=e-0.02||vid.ended){ stopPreview(); TP.seek(vid,e).then(bar); return; }
  requestAnimationFrame(tickPreview);
}
$('preview').onclick=async()=>{
  if(!info||busy) return;
  if(previewing) return stopPreview();
  const [s]=range.get();
  await TP.seek(vid,s);
  previewing=true; $('preview').textContent='■ Stop preview';
  try{ await vid.play(); }catch{ stopPreview(); return; }
  tickPreview();
};
vid.addEventListener('pause',()=>{ if(previewing&&!vid.ended){ const [,e]=range.get(); if(vid.currentTime<e-0.05) stopPreview(); } });
vid.addEventListener('timeupdate',bar);
vid.addEventListener('seeked',bar);
$('jumpS').onclick=()=>{ stopPreview(); TP.seek(vid,range.get()[0]); };
$('jumpE').onclick=()=>{ stopPreview(); TP.seek(vid,Math.max(0,range.get()[1]-0.04)); };
// typing a time shows that frame
$('start').addEventListener('change',()=>{ stopPreview(); TP.seek(vid,range.get()[0]); });
$('end').addEventListener('change',()=>{ stopPreview(); TP.seek(vid,Math.max(0,range.get()[1]-0.04)); });
// click the bar to jump there
$('trimbar').addEventListener('click',e=>{ if(!info) return; stopPreview(); const r=$('trimbar').getBoundingClientRect(); TP.seek(vid,(e.clientX-r.left)/r.width*info.duration); });
UI.seg($('q'),v=>{q=v;});

UI.dropzone($('drop'),$('file'),async f=>{
  if(busy) return;
  $('err').hidden=true; $('result').hidden=true; prog.reset(); prog.say('Loading…');
  try{
    info=await TP.loadVideo(vid,f); file=f;
    $('empty').hidden=true; vid.hidden=false; $('trimbar').hidden=false; $('pvActions').hidden=false;
    prog.say('Checking frame rate…');
    srcFps=await TP.detectFps(vid);
    $('fileinfo').textContent=`${f.name} · ${info.width}×${info.height} · ${srcFps} fps · ${UI.time(info.duration)} · ${UI.bytes(f.size)}`;
    range.reset(info.duration);
    $('go').disabled=false; prog.say('Ready.');
  }catch(e){ fail(e.message); }
});

$('cancel').onclick=()=>{cancelled=true;};
$('go').onclick=async()=>{
  if(busy||!file) return;
  stopPreview(); busy=true; cancelled=false; vid.pause(); vid.controls=false;
  $('err').hidden=true; $('result').hidden=true; $('cancel').hidden=false;
  const ctl=[$('go'),$('q'),$('start'),$('end'),$('setStart'),$('setEnd'),$('preview'),$('jumpS'),$('jumpE')];
  UI.lock(ctl,true);
  const job=UI.job(), [s,e]=range.get();
  // cap at 4K-ish to stay within encoder limits
  const scale=Math.min(1, 3840/Math.max(info.width,info.height));
  const w=TP.even(info.width*scale), h=TP.even(info.height*scale);
  const srcRate=file.size*8/info.duration;
  const px=w*h*srcFps;
  const bitrate=q==='same' ? Math.min(60e6,Math.max(srcRate*1.15, px*0.12)) : Math.max(500e3, Math.min(srcRate*0.5, px*0.05));
  try{
    const r=await TP.renderMp4({video:vid,file,start:s,end:e,fps:srcFps,width:w,height:h,bitrate,
      draw:(c,v,W,H)=>c.drawImage(v,0,0,W,H),
      onProgress:(p,t)=>{prog.set(p);prog.say(t);job.title(Math.round(p*100)+'%');}, cancelled:()=>cancelled});
    UI.showResult($('result'),{blob:r.blob,filename:UI.baseName(file.name)+'_trimmed.mp4',previewType:'video',
      meta:`MP4 · ${UI.bytes(r.blob.size)} · ${r.width}×${r.height} · ${srcFps} fps · ${(e-s).toFixed(2)}s${r.audioCodec?'':' · no audio'}`});
    prog.say('Done.');
  }catch(x){ if(x.name==='AbortError'){prog.reset();prog.say('Cancelled.');} else fail(x.message||String(x)); }
  finally{ job.end(); busy=false; vid.controls=true; $('cancel').hidden=true; UI.lock(ctl,false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
