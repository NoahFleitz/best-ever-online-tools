(()=>{
const {$}=UI;
const vid=$('vid'), cv=$('cv'), ctx=cv.getContext('2d',{alpha:false});
const W=1080,H=1920;
const bg=document.createElement('canvas'); bg.width=135; bg.height=240;
const bctx=bg.getContext('2d',{alpha:false});
const hasFilter='filter' in bctx;
const prog=UI.progress($('bar'),$('status'));
let file=null, info=null, mode='blur', fps=30, bitrate=8e6, geo=null, busy=false, cancelled=false;

const range=UI.range({start:$('start'),end:$('end'),setStart:$('setStart'),setEnd:$('setEnd'),video:vid,onChange:([s,e])=>{
  const len=e-s;
  $('rangeNote').textContent=info?`Clip: ${len.toFixed(1)}s · ${Math.round(len*fps)} frames to render`+(len>180?' · over 3 minutes, too long for YouTube Shorts':''):'';
}});
// "Now" buttons use the scrub position
$('setStart').title=$('setEnd').title='Use the preview position';

UI.seg($('mode'),v=>{mode=v;calc();draw();});
UI.seg($('fps'),v=>{fps=+v;$('start').dispatchEvent(new Event('input'));slowNote();});
UI.seg($('q'),v=>{bitrate=+v;slowNote();});
function slowNote(){
  const hi60=fps===60, hiQ=bitrate>8e6, n=$('slowNote');
  n.hidden=!(hi60||hiQ);
  if(n.hidden) return;
  const what=hi60&&hiQ?'60 fps and High quality':hi60?'60 fps':'High quality';
  n.innerHTML=`<strong>${what} can take a while.</strong> `+(hi60?'60 fps renders twice as many frames, so it takes about twice as long. It only looks smoother if your original video is 60 fps. ':'')+(hiQ?'High quality makes a sharper, bigger file and adds encoding time. ':'')+'Switch back to 30 fps and Good for the fastest result.';
}
$('pos').oninput=()=>{$('posV').textContent=$('pos').value+'%';calc();draw();};
$('zoom').oninput=()=>{$('zoomV').textContent=($('zoom').value/100).toFixed(2)+'×';calc();draw();};
$('posV').textContent='50%'; $('zoomV').textContent='1.00×';

UI.dropzone($('drop'),$('file'),async f=>{
  if(busy) return;
  $('err').hidden=true; $('result').hidden=true; prog.reset();
  prog.say('Loading…');
  try{
    info=await TP.loadVideo(vid,f); file=f;
    $('fileinfo').textContent=`${f.name} · ${info.width}×${info.height} · ${UI.time(info.duration)} · ${UI.bytes(f.size)}`;
    range.reset(info.duration, Math.min(info.duration,60));
    calc(); draw();
    $('go').disabled=$('play').disabled=false;
    prog.say('Ready.');
  }catch(e){ fail(e.message); }
});

function calc(){
  if(!info) return;
  const vw=info.width,vh=info.height,z=$('zoom').value/100,p=$('pos').value/100;
  const cover=Math.max(W/vw,H/vh), fit=Math.min(W/vw,H/vh);
  const s=(mode==='crop'?cover:fit)*z, dw=vw*s, dh=vh*s;
  const main=[Math.round((W-dw)*p),Math.round((H-dh)/2),Math.round(dw),Math.round(dh)];
  const bs=Math.max(135/vw,240/vh)*1.1, bw=vw*bs, bh=vh*bs;
  geo={main,back:[(135-bw)/2,(240-bh)/2,bw,bh],covers:main[0]<=0&&main[1]<=0&&main[0]+main[2]>=W&&main[1]+main[3]>=H};
}
function paint(c){
  if(!geo) return;
  if(mode==='blur'){
    if(hasFilter) bctx.filter='blur(6px) saturate(1.2)';
    bctx.drawImage(vid,...geo.back);
    c.imageSmoothingEnabled=true; c.imageSmoothingQuality='low';
    c.drawImage(bg,-40,-40,W+80,H+80);
    c.fillStyle='rgba(0,0,0,.42)'; c.fillRect(0,0,W,H);
  } else if(!geo.covers){ c.fillStyle='#000'; c.fillRect(0,0,W,H); }
  c.imageSmoothingQuality='high';
  c.drawImage(vid,...geo.main);
}
function draw(){ paint(ctx); }

// scrub + preview
$('scrub').oninput=async()=>{ if(!info||busy) return; vid.pause(); await TP.seek(vid,$('scrub').value/1000*info.duration); draw(); };
let rafOn=false;
function loop(){ draw(); $('scrub').value=vid.currentTime/info.duration*1000; const [,e]=range.get(); if(vid.currentTime>=e) vid.pause(); if(!vid.paused) requestAnimationFrame(loop); else rafOn=false; }
$('play').onclick=async()=>{
  if(busy||!info) return;
  if(!vid.paused){ vid.pause(); return; }
  const [s,e]=range.get();
  if(vid.currentTime<s||vid.currentTime>=e-0.05) await TP.seek(vid,s);
  await vid.play().catch(()=>{}); $('play').textContent='Pause';
  if(!rafOn){ rafOn=true; loop(); }
};
vid.addEventListener('pause',()=>{ $('play').textContent='Play preview'; });

$('cancel').onclick=()=>{cancelled=true;};
$('go').onclick=async()=>{
  if(busy||!file) return;
  busy=true; cancelled=false; vid.pause();
  $('err').hidden=true; $('result').hidden=true; $('cancel').hidden=false;
  UI.lock([$('go'),$('play'),$('mode'),$('fps'),$('q'),$('pos'),$('zoom'),$('start'),$('end'),$('scrub')],true);
  const job=UI.job();
  const [s,e]=range.get();
  try{
    calc();
    const r=await TP.renderMp4({video:vid,file,start:s,end:e,fps,width:W,height:H,bitrate,
      canvas:cv, draw:(c)=>paint(c),
      onProgress:(p,t)=>{prog.set(p);prog.say(t);job.title(Math.round(p*100)+'%');},
      cancelled:()=>cancelled});
    UI.showResult($('result'),{blob:r.blob,filename:UI.baseName(file.name)+`_vertical_${fps}fps.mp4`,previewType:'video',
      meta:`MP4 · ${UI.bytes(r.blob.size)} · 1080×1920 · ${fps} fps · ${r.videoCodec}${r.audioCodec?' + '+r.audioCodec:' · no audio'} · made in ${r.seconds.toFixed(0)}s`});
    prog.say('Done.');
  }catch(x){ if(x.name==='AbortError'){prog.reset();prog.say('Cancelled.');} else fail(x.message||String(x)); }
  finally{
    job.end(); busy=false; $('cancel').hidden=true;
    UI.lock([$('go'),$('play'),$('mode'),$('fps'),$('q'),$('pos'),$('zoom'),$('start'),$('end'),$('scrub')],false);
  }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }

// placeholder frame
ctx.fillStyle='#0c0d10';ctx.fillRect(0,0,W,H);
ctx.fillStyle='#3a3c44';ctx.font='600 54px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('Vertical preview',W/2,H/2);
})();
