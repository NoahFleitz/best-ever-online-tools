(()=>{
const {$}=UI;
const vid=$('vid'), prog=UI.progress($('bar'),$('status'));
let file=null, info=null, srcFps=30, sizeSel='10', busy=false, cancelled=false;
const AUDIO_BPS=96000;

const range=UI.range({start:$('start'),end:$('end'),setStart:$('setStart'),setEnd:$('setEnd'),video:vid,onChange:()=>estimate()});
UI.seg($('size'),v=>{sizeSel=v; $('customWrap').hidden=v!=='custom'; estimate();});
['customMB','res','fpsSel'].forEach(id=>$(id).addEventListener('input',estimate));

function plan(){
  const [s,e]=range.get(), len=Math.max(0.1,e-s);
  const mb=sizeSel==='custom' ? Math.max(0.1,+$('customMB').value||1) : +sizeSel;
  const target=+$('res').value;
  const short=Math.min(info.width,info.height);
  const scale=target&&target<short ? target/short : Math.min(1, 3840/Math.max(info.width,info.height));
  const w=TP.even(info.width*scale), h=TP.even(info.height*scale);
  const f=+$('fpsSel').value; const fps=f&&f<srcFps ? f : srcFps;
  const total=mb*8e6*0.92/len;                 // leave ~8% for container overhead
  let vbps=total-AUDIO_BPS;
  const srcRate=file.size*8/info.duration;
  const capped=vbps>srcRate*0.9; if(capped) vbps=srcRate*0.9;
  vbps=Math.max(80e3,vbps);
  const bpp=vbps/(w*h*fps);                    // bits per pixel → rough quality signal
  return {s,e,len,mb,w,h,fps,vbps,bpp,capped};
}
function estimate(){
  if(!info) return;
  const p=plan();
  $('rangeNote').textContent=`Clip: ${(p.len).toFixed(1)}s`;
  const quality=p.bpp>0.1?'great':p.bpp>0.05?'good':p.bpp>0.025?'okay':'low';
  let t=`Output ${p.w}×${p.h} at ${p.fps} fps, about ${(p.vbps/1e6).toFixed(2)} Mbps. Expected quality: ${quality}.`;
  if(quality==='low') t+=' Try a lower resolution, a shorter clip or a bigger size.';
  if(p.capped) t+=' Your video is already smaller than this target, so it will be compressed only lightly.';
  $('estimate').textContent=t;
}

UI.dropzone($('drop'),$('file'),async f=>{
  if(busy) return;
  $('err').hidden=true; $('result').hidden=true; prog.reset(); prog.say('Loading…');
  try{
    info=await TP.loadVideo(vid,f); file=f;
    $('empty').hidden=true; vid.hidden=false;
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
  busy=true; cancelled=false; vid.pause(); vid.controls=false;
  $('err').hidden=true; $('result').hidden=true; $('cancel').hidden=false;
  const ctl=[$('go'),$('size'),$('customMB'),$('res'),$('fpsSel'),$('start'),$('end'),$('setStart'),$('setEnd')];
  UI.lock(ctl,true);
  const job=UI.job(), p=plan();
  try{
    const r=await TP.renderMp4({video:vid,file,start:p.s,end:p.e,fps:p.fps,width:p.w,height:p.h,bitrate:Math.round(p.vbps),bitrateMode:'constant',audioBitrate:AUDIO_BPS,
      draw:(c,v,W,H)=>{c.imageSmoothingQuality='high';c.drawImage(v,0,0,W,H);},
      onProgress:(x,t)=>{prog.set(x);prog.say(t);job.title(Math.round(x*100)+'%');}, cancelled:()=>cancelled});
    const over=r.blob.size>p.mb*1e6;
    UI.showResult($('result'),{blob:r.blob,filename:UI.baseName(file.name)+'_compressed.mp4',previewType:'video',
      meta:`MP4 · ${UI.bytes(r.blob.size)} (was ${UI.bytes(file.size)}) · ${r.width}×${r.height} · ${p.fps} fps`+(over?` · slightly over ${p.mb} MB, try a smaller target`:'')});
    prog.say('Done.');
  }catch(x){ if(x.name==='AbortError'){prog.reset();prog.say('Cancelled.');} else fail(x.message||String(x)); }
  finally{ job.end(); busy=false; vid.controls=true; $('cancel').hidden=true; UI.lock(ctl,false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
