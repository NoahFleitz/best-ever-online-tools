/* Best Ever Online Tools engine — in-browser video/audio processing.
   Video: seek to each exact output timestamp → draw to canvas → WebCodecs VideoEncoder → mp4-muxer.
   Audio: decodeAudioData → AudioEncoder (AAC/Opus) or lamejs (MP3) or WAV. Nothing is uploaded. */
window.TP = (()=>{
  const canEncodeVideo = 'VideoEncoder' in window && 'VideoFrame' in window;
  const canEncodeAudio = 'AudioEncoder' in window && 'AudioData' in window;
  const even = n => Math.max(2, Math.round(n/2)*2);
  const tick = () => new Promise(r=>setTimeout(r,0));

  // ---------- loading ----------
  function waitEvent(el, ok, bad='error', ms=20000){
    return new Promise((res,rej)=>{
      const t=setTimeout(()=>{cleanup();rej(new Error('Timed out loading the video.'));},ms);
      const okF=()=>{cleanup();res();}, badF=()=>{cleanup();rej(new Error('This browser can’t read that file. Try an MP4 (H.264) or WebM video.'));};
      const cleanup=()=>{clearTimeout(t);el.removeEventListener(ok,okF);el.removeEventListener(bad,badF);};
      el.addEventListener(ok,okF); el.addEventListener(bad,badF);
    });
  }
  async function loadVideo(video, file){
    if(video._url) URL.revokeObjectURL(video._url);
    video._url = URL.createObjectURL(file);
    video.preload='auto'; video.playsInline=true;
    const meta = waitEvent(video,'loadedmetadata');
    video.src = video._url;
    await meta;
    if(!isFinite(video.duration)){ // some recorded WebM files report Infinity until the end is reached
      const fix = waitEvent(video,'durationchange');
      video.currentTime = 1e9;
      await fix.catch(()=>{});
    }
    if(!video.videoWidth) throw new Error('No video track found in that file.');
    await seek(video, Math.min(0.05, video.duration/2));
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  }
  function seek(video, t){
    return new Promise(res=>{
      let done=false;
      const fin=()=>{ if(done) return; done=true; video.removeEventListener('seeked',fin); clearTimeout(to); res(); };
      const to=setTimeout(fin, 4000);
      video.addEventListener('seeked',fin);
      video.currentTime = t;
    });
  }

  // ---------- source frame rate (measured from decoded frames) ----------
  async function detectFps(video){
    if(!('requestVideoFrameCallback' in video)) return 30;
    const wasMuted=video.muted, t0=video.currentTime;
    try{
      video.muted=true;
      await seek(video, Math.min(video.duration*0.3, 1));
      const times=[];
      await new Promise(res=>{
        const stopAt=performance.now()+1500;
        const cb=(now,m)=>{ times.push(m.mediaTime); if(times.length>=16||performance.now()>stopAt) return res(); video.requestVideoFrameCallback(cb); };
        video.requestVideoFrameCallback(cb);
        video.play().catch(res);
        setTimeout(res,1800);
      });
      video.pause();
      const d=[]; for(let i=1;i<times.length;i++){ const x=times[i]-times[i-1]; if(x>0.001) d.push(x); }
      if(d.length<3) return 30;
      d.sort((a,b)=>a-b);
      const fps=1/d[Math.floor(d.length/4)]; // lower quartile of gaps → resistant to dropped frames
      const common=[24,25,30,48,50,60,90,120];
      const snap=common.find(c=>Math.abs(c-fps)/c<0.04);
      return snap || Math.max(1,Math.min(120,Math.round(fps)));
    }catch{ return 30; }
    finally{ video.muted=wasMuted; await seek(video,t0); }
  }

  // ---------- audio ----------
  const audioCache = new WeakMap();
  async function decodeAudio(file){
    if(audioCache.has(file)) return audioCache.get(file);
    let ab=null;
    try{
      const buf=await file.arrayBuffer();
      const ctx=new OfflineAudioContext(2,1,48000);
      ab=await ctx.decodeAudioData(buf);
    }catch{ ab=null; }
    audioCache.set(file,ab);
    return ab;
  }
  function channels(ab){ return ab.numberOfChannels>1 ? [ab.getChannelData(0),ab.getChannelData(1)] : [ab.getChannelData(0)]; }

  async function pickAudioConfig(sr, ch, bitrate){
    if(!canEncodeAudio) return null;
    for(const [codec,mux] of [['mp4a.40.2','aac'],['opus','opus']]){
      const cfg={codec,sampleRate:sr,numberOfChannels:ch,bitrate};
      try{ if((await AudioEncoder.isConfigSupported(cfg)).supported) return {cfg,mux}; }catch{}
    }
    return null;
  }
  async function encodeAudioTrack(muxer, ab, s, e, acfg){
    let err=null;
    const enc=new AudioEncoder({output:(c,m)=>muxer.addAudioChunk(c,m), error:x=>{err=x;}});
    enc.configure(acfg.cfg);
    const sr=ab.sampleRate, a0=Math.floor(s*sr), a1=Math.min(ab.length,Math.floor(e*sr));
    const chs=channels(ab), nch=acfg.cfg.numberOfChannels, N=4096;
    for(let i=a0;i<a1;i+=N){
      if(err) break;
      const n=Math.min(N,a1-i), data=new Float32Array(n*nch);
      for(let c=0;c<nch;c++) data.set(chs[Math.min(c,chs.length-1)].subarray(i,i+n), c*n);
      const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:n,numberOfChannels:nch,timestamp:Math.round((i-a0)/sr*1e6),data});
      enc.encode(ad); ad.close();
      if(enc.encodeQueueSize>32) await tick();
    }
    await enc.flush(); enc.close();
    if(err) throw err;
  }

  // ---------- video ----------
  async function pickVideoConfig(w,h,fps,bitrate,mode){
    const base={width:w,height:h,bitrate,framerate:fps,latencyMode:'quality',bitrateMode:mode||'variable'};
    for(const codec of ['avc1.640034','avc1.640033','avc1.640032','avc1.640028','avc1.4d0034','avc1.4d0028','avc1.42003e','avc1.42001f']){
      const cfg={...base,codec,avc:{format:'avc'}};
      try{ if((await VideoEncoder.isConfigSupported(cfg)).supported) return {cfg,mux:'avc'}; }catch{}
    }
    for(const codec of ['vp09.00.51.08','vp09.00.41.08','vp09.00.31.08']){
      const cfg={...base,codec};
      try{ if((await VideoEncoder.isConfigSupported(cfg)).supported) return {cfg,mux:'vp9'}; }catch{}
    }
    return null;
  }

  /* renderMp4({video, file, start, end, fps, width, height, bitrate, bitrateMode, draw(ctx,video,W,H),
                 audio=true, audioBitrate=192000, canvas, onProgress(p,text), cancelled()}) */
  async function renderMp4(o){
    if(!canEncodeVideo) throw new Error('Your browser can’t encode video. Use a recent Chrome, Edge, Firefox or Safari.');
    const W=even(o.width), H=even(o.height), fps=o.fps, s=o.start, e=o.end, video=o.video;
    const say=(p,t)=>o.onProgress&&o.onProgress(p,t);
    const vpick=await pickVideoConfig(W,H,fps,o.bitrate,o.bitrateMode);
    if(!vpick) throw new Error(`Your browser can’t encode ${W}×${H} video. Try a smaller size.`);

    let ab=null, apick=null;
    if(o.audio!==false){
      say(0,'Reading audio…');
      ab=await decodeAudio(o.file);
      if(ab) apick=await pickAudioConfig(ab.sampleRate, Math.min(2,ab.numberOfChannels), o.audioBitrate||192000);
    }
    const muxer=new Mp4Muxer.Muxer({
      target:new Mp4Muxer.ArrayBufferTarget(),
      video:{codec:vpick.mux,width:W,height:H,frameRate:fps},
      audio:apick?{codec:apick.mux,numberOfChannels:apick.cfg.numberOfChannels,sampleRate:apick.cfg.sampleRate}:undefined,
      fastStart:'in-memory', firstTimestampBehavior:'offset'
    });
    if(apick){ say(0,'Encoding audio…'); await encodeAudioTrack(muxer,ab,s,e,apick); }

    const canvas=o.canvas||document.createElement('canvas');
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d',{alpha:false});
    let err=null;
    const enc=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m), error:x=>{err=x;}});
    enc.configure(vpick.cfg);
    const total=Math.max(1,Math.round((e-s)*fps)), us=1e6/fps, dur=video.duration;
    const t0=performance.now();
    video.pause();
    for(let i=0;i<total;i++){
      if(err) throw err;
      if(o.cancelled&&o.cancelled()){ try{enc.close();}catch{} throw new DOMException('Cancelled','AbortError'); }
      await seek(video, Math.min(s+i/fps+1e-4, dur-0.001));
      o.draw(ctx,video,W,H);
      const vf=new VideoFrame(canvas,{timestamp:Math.round(i*us),duration:Math.round(us)});
      enc.encode(vf,{keyFrame:i%Math.round(fps*2)===0});
      vf.close();
      while(enc.encodeQueueSize>6){ await ('ondequeue' in enc ? new Promise(r=>enc.addEventListener('dequeue',r,{once:true})) : tick()); }
      if(i%8===0||i===total-1){
        const p=(i+1)/total, el=(performance.now()-t0)/1000;
        say(p,`Frame ${i+1} / ${total} · ${((i+1)/el).toFixed(0)} frames/s · ~${Math.ceil(el/p-el)}s left`);
      }
    }
    say(1,'Finishing file…');
    await enc.flush(); enc.close();
    if(err) throw err;
    muxer.finalize();
    return {
      blob:new Blob([muxer.target.buffer],{type:'video/mp4'}),
      videoCodec:vpick.mux==='avc'?'H.264':'VP9', audioCodec:apick?(apick.mux==='aac'?'AAC':'Opus'):null,
      hadAudio:!!ab, frames:total, seconds:(performance.now()-t0)/1000, width:W, height:H
    };
  }

  // ---------- GIF ----------
  /* renderGif({video,start,end,fps,width,loop,onProgress,cancelled}) */
  async function renderGif(o){
    const {GIFEncoder,quantize,applyPalette}=window.gifenc;
    const video=o.video, W=Math.round(o.width), H=Math.round(W*video.videoHeight/video.videoWidth);
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingQuality='high';
    const gif=GIFEncoder(), total=Math.max(1,Math.round((o.end-o.start)*o.fps)), delay=1000/o.fps;
    const t0=performance.now();
    for(let i=0;i<total;i++){
      if(o.cancelled&&o.cancelled()) throw new DOMException('Cancelled','AbortError');
      await seek(video, Math.min(o.start+i/o.fps+1e-4, video.duration-0.001));
      ctx.drawImage(video,0,0,W,H);
      const data=ctx.getImageData(0,0,W,H).data;
      const palette=quantize(data,256,{format:'rgb565'});
      const index=applyPalette(data,palette,'rgb565');
      gif.writeFrame(index,W,H,{palette,delay,repeat:o.loop?0:-1});
      if(i%4===0||i===total-1){
        const p=(i+1)/total, el=(performance.now()-t0)/1000;
        o.onProgress&&o.onProgress(p,`Frame ${i+1} / ${total} · ~${Math.ceil(el/p-el)}s left`);
      }
    }
    gif.finish();
    return {blob:new Blob([gif.bytes()],{type:'image/gif'}),width:W,height:H,frames:total};
  }

  // ---------- audio export ----------
  function wav(ab,s,e){
    const sr=ab.sampleRate, a0=Math.floor(s*sr), a1=Math.min(ab.length,Math.floor(e*sr)), n=a1-a0;
    const chs=channels(ab), nc=chs.length, buf=new ArrayBuffer(44+n*nc*2), v=new DataView(buf);
    const w=(o,str)=>{for(let i=0;i<str.length;i++)v.setUint8(o+i,str.charCodeAt(i));};
    w(0,'RIFF'); v.setUint32(4,36+n*nc*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true);
    v.setUint16(20,1,true); v.setUint16(22,nc,true); v.setUint32(24,sr,true); v.setUint32(28,sr*nc*2,true);
    v.setUint16(32,nc*2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*nc*2,true);
    let off=44;
    for(let i=a0;i<a1;i++) for(let c=0;c<nc;c++){ const x=Math.max(-1,Math.min(1,chs[c][i])); v.setInt16(off,x<0?x*0x8000:x*0x7fff,true); off+=2; }
    return new Blob([buf],{type:'audio/wav'});
  }
  async function mp3(ab,s,e,kbps,onProgress,cancelled){
    const sr=ab.sampleRate, a0=Math.floor(s*sr), a1=Math.min(ab.length,Math.floor(e*sr));
    const chs=channels(ab), nc=chs.length, enc=new lamejs.Mp3Encoder(nc,sr,kbps), out=[], B=1152;
    const toI16=(src,i,n)=>{ const d=new Int16Array(n); for(let k=0;k<n;k++){ const x=Math.max(-1,Math.min(1,src[i+k])); d[k]=x<0?x*0x8000:x*0x7fff; } return d; };
    let blocks=0;
    for(let i=a0;i<a1;i+=B){
      const n=Math.min(B,a1-i);
      const l=toI16(chs[0],i,n), r=nc>1?toI16(chs[1],i,n):undefined;
      const b=nc>1?enc.encodeBuffer(l,r):enc.encodeBuffer(l);
      if(b.length) out.push(new Uint8Array(b));
      if(++blocks%300===0){
        if(cancelled&&cancelled()) throw new DOMException('Cancelled','AbortError');
        onProgress&&onProgress((i-a0)/(a1-a0)); await tick();
      }
    }
    const f=enc.flush(); if(f.length) out.push(new Uint8Array(f));
    return new Blob(out,{type:'audio/mpeg'});
  }
  async function m4a(ab,s,e,kbps){
    const apick=await pickAudioConfig(ab.sampleRate, Math.min(2,ab.numberOfChannels), kbps*1000);
    if(!apick||apick.mux!=='aac') throw new Error('Your browser can’t make AAC audio. Choose MP3 instead.');
    const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),audio:{codec:'aac',numberOfChannels:apick.cfg.numberOfChannels,sampleRate:apick.cfg.sampleRate},fastStart:'in-memory',firstTimestampBehavior:'offset'});
    await encodeAudioTrack(muxer,ab,s,e,apick);
    muxer.finalize();
    return new Blob([muxer.target.buffer],{type:'audio/mp4'});
  }

  return {canEncodeVideo,canEncodeAudio,even,loadVideo,seek,detectFps,decodeAudio,renderMp4,renderGif,wav,mp3,m4a};
})();
