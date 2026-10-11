(()=>{
const {$}=UI;
const vid=$('vid'), prog=UI.progress($('bar'),$('status'));
let file=null, ab=null, fmt='mp3', kbps=192, busy=false, cancelled=false;

const range=UI.range({start:$('start'),end:$('end'),setStart:$('setStart'),setEnd:$('setEnd'),video:vid,onChange:([s,e])=>{
  if(ab) $('rangeNote').textContent=`Keeping ${UI.time(s)} → ${UI.time(e)} (${(e-s).toFixed(1)}s)`;
}});
UI.seg($('fmt'),v=>{fmt=v; $('kbpsWrap').hidden=v==='wav';});
UI.seg($('kbps'),v=>{kbps=+v;});
(async()=>{
  let ok=false;
  try{ ok=TP.canEncodeAudio && (await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:128000})).supported; }catch{}
  if(!ok){ const b=$('fmt').querySelector('[data-v=m4a]'); b.disabled=true; b.title='Your browser can’t make M4A files'; }
})();

UI.dropzone($('drop'),$('file'),async f=>{
  if(busy) return;
  $('err').hidden=true; $('result').hidden=true; prog.reset(); prog.say('Reading audio…');
  $('go').disabled=true;
  try{
    if(vid._url) URL.revokeObjectURL(vid._url);
    vid._url=URL.createObjectURL(f); vid.src=vid._url;
    $('empty').hidden=true; vid.hidden=false;
    file=f; ab=await TP.decodeAudio(f);
    if(!ab) throw new Error('No audio found. The file has no sound track, or your browser can’t read its audio format.');
    $('fileinfo').textContent=`${f.name} · ${UI.time(ab.duration)} · ${ab.numberOfChannels>1?'stereo':'mono'} · ${UI.bytes(f.size)}`;
    range.reset(ab.duration);
    $('go').disabled=false; prog.say('Ready.');
  }catch(e){ ab=null; fail(e.message); }
});

$('cancel').onclick=()=>{cancelled=true;};
$('go').onclick=async()=>{
  if(busy||!ab) return;
  busy=true; cancelled=false; vid.pause();
  $('err').hidden=true; $('result').hidden=true; $('cancel').hidden=fmt!=='mp3';
  const ctl=[$('go'),$('fmt'),$('kbps'),$('start'),$('end'),$('setStart'),$('setEnd')];
  UI.lock(ctl,true);
  const job=UI.job(), [s,e]=range.get();
  try{
    let blob;
    prog.say('Encoding…');
    if(fmt==='wav') blob=TP.wav(ab,s,e);
    else if(fmt==='m4a') blob=await TP.m4a(ab,s,e,kbps);
    else blob=await TP.mp3(ab,s,e,kbps,p=>{prog.set(p);prog.say(`Encoding MP3… ${Math.round(p*100)}%`);job.title(Math.round(p*100)+'%');},()=>cancelled);
    prog.set(1);
    UI.showResult($('result'),{blob,filename:UI.baseName(file.name)+'.'+fmt,previewType:'audio',
      meta:`${fmt.toUpperCase()} · ${UI.bytes(blob.size)} · ${(e-s).toFixed(1)}s`+(fmt==='wav'?'':` · ${kbps} kbps`)});
    prog.say('Done.');
  }catch(x){ if(x.name==='AbortError'){prog.reset();prog.say('Cancelled.');} else fail(x.message||String(x)); }
  finally{ job.end(); busy=false; $('cancel').hidden=true; UI.lock(ctl,false); }
};
function fail(m){ $('err').textContent=m; $('err').hidden=false; prog.say(''); }
})();
