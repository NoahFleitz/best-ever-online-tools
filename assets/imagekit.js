/* Best Ever Online Tools image kit — decode, encode, EXIF read/strip, and a batch file list UI. Runs locally. */
window.IK = (()=>{
  const typeOf = f => (f.type || ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',svg:'image/svg+xml',avif:'image/avif'})[UI.ext(f.name)] || '');
  const EXT = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};

  // decode to something drawable; createImageBitmap applies EXIF orientation
  async function decode(file){
    const t=typeOf(file);
    if(t!=='image/svg+xml'){
      try{ const b=await createImageBitmap(file,{imageOrientation:'from-image'}); return {src:b,w:b.width,h:b.height,close:()=>b.close&&b.close()}; }catch{}
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image(); img.decoding='async'; img.src=url;
      await img.decode();
      let w=img.naturalWidth||1024, h=img.naturalHeight||1024;
      return {src:img,w,h,close:()=>URL.revokeObjectURL(url)};
    }catch{ URL.revokeObjectURL(url); throw new Error('Your browser can’t open this image. HEIC/HEIF photos need converting on the phone first, or try JPG/PNG/WebP.'); }
  }
  function canvasFrom(d, w, h, opts={}){
    w=Math.max(1,Math.round(w||d.w)); h=Math.max(1,Math.round(h||d.h));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const x=c.getContext('2d');
    if(opts.bg){ x.fillStyle=opts.bg; x.fillRect(0,0,w,h); }
    x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
    // step down large reductions in halves for sharper results
    let src=d.src, sw=d.w, sh=d.h;
    while(sw/2>=w*1.01 && sh/2>=h*1.01){
      const t=document.createElement('canvas'); t.width=Math.round(sw/2); t.height=Math.round(sh/2);
      const tx=t.getContext('2d'); tx.imageSmoothingQuality='high'; tx.drawImage(src,0,0,t.width,t.height);
      src=t; sw=t.width; sh=t.height;
    }
    if(opts.crop){ const [cx,cy,cw,ch]=opts.crop; x.drawImage(d.src,cx,cy,cw,ch,0,0,w,h); }
    else x.drawImage(src,0,0,w,h);
    return c;
  }
  function encode(canvas, type, q){
    return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Encoding failed.')), type, q));
  }
  const supportCache={};
  async function canEncode(type){
    if(type in supportCache) return supportCache[type];
    const c=document.createElement('canvas'); c.width=c.height=2;
    const b=await encode(c,type,.8).catch(()=>null);
    return supportCache[type]=!!(b&&b.type===type);
  }
  const hasAlpha=t=>t==='image/png'||t==='image/webp'||t==='image/gif'||t==='image/svg+xml';

  // ---------- EXIF (read a few useful tags) ----------
  function readExif(buf){
    const v=new DataView(buf), out={};
    if(v.byteLength<4||v.getUint16(0)!==0xFFD8) return out;
    let o=2;
    while(o+4<v.byteLength){
      const m=v.getUint16(o), len=v.getUint16(o+2);
      if(m===0xFFE1 && v.getUint32(o+4)===0x45786966){ parseTiff(v,o+10,out); break; }
      if((m&0xFF00)!==0xFF00||m===0xFFDA) break;
      o+=2+len;
    }
    return out;
  }
  function parseTiff(v,t,out){
    const le=v.getUint16(t)===0x4949, u16=p=>v.getUint16(p,le), u32=p=>v.getUint32(p,le);
    const str=(p,n)=>{let s='';for(let i=0;i<n;i++){const c=v.getUint8(p+i);if(!c)break;s+=String.fromCharCode(c);}return s.trim();};
    const ifd=(p,cb)=>{ if(p<=0||t+p+2>v.byteLength) return; const n=u16(t+p); for(let i=0;i<n;i++){ const e=t+p+2+i*12; if(e+12>v.byteLength) return; cb(u16(e),u16(e+2),u32(e+4),e+8); } };
    const ascii=(cnt,vo)=>cnt<=4?str(vo,cnt):str(t+u32(vo),cnt);
    ifd(u32(t+4),(tag,type,cnt,vo)=>{
      if(tag===0x0112) out.orientation=u16(vo);
      if(tag===0x010F) out.make=ascii(cnt,vo);
      if(tag===0x0110) out.model=ascii(cnt,vo);
      if(tag===0x0131) out.software=ascii(cnt,vo);
      if(tag===0x0132) out.date=ascii(cnt,vo);
      if(tag===0x8825) out.gps=true;
      if(tag===0x8769) ifd(u32(vo),(t2,ty2,c2,v2)=>{ if(t2===0x9003) out.date=ascii(c2,v2); });
    });
  }
  // ---------- lossless metadata strip ----------
  function stripJpeg(buf){
    const v=new DataView(buf), parts=[new Uint8Array(buf,0,2)];
    let o=2;
    while(o+4<=v.byteLength){
      const m=v.getUint16(o);
      if(m===0xFFDA){ parts.push(new Uint8Array(buf,o)); break; }
      if((m&0xFF00)!==0xFF00) throw new Error('Unreadable JPEG.');
      const len=v.getUint16(o+2);
      const keep=!((m>=0xFFE1&&m<=0xFFEF&&m!==0xFFE2)||m===0xFFFE); // drop APP1, APP3–15, comments; keep APP0 (JFIF) & APP2 (color profile)
      if(keep) parts.push(new Uint8Array(buf,o,2+len));
      o+=2+len;
    }
    return new Blob(parts,{type:'image/jpeg'});
  }
  function stripPng(buf){
    const v=new DataView(buf), parts=[new Uint8Array(buf,0,8)], drop=new Set(['tEXt','iTXt','zTXt','eXIf','tIME']);
    let o=8;
    while(o+8<=v.byteLength){
      const len=v.getUint32(o), type=String.fromCharCode(v.getUint8(o+4),v.getUint8(o+5),v.getUint8(o+6),v.getUint8(o+7));
      if(!drop.has(type)) parts.push(new Uint8Array(buf,o,12+len));
      o+=12+len;
      if(type==='IEND') break;
    }
    return new Blob(parts,{type:'image/png'});
  }
  function pngHasText(buf){
    const v=new DataView(buf); let o=8, found=[];
    while(o+8<=v.byteLength){ const len=v.getUint32(o), type=String.fromCharCode(v.getUint8(o+4),v.getUint8(o+5),v.getUint8(o+6),v.getUint8(o+7)); if(['tEXt','iTXt','zTXt','eXIf','tIME'].includes(type)) found.push(type); o+=12+len; if(type==='IEND') break; }
    return found;
  }

  // ---------- batch list UI ----------
  function list(container, {onChange}={}){
    const rows=[];
    function add(file){
      const row={file,out:null,outName:'',el:document.createElement('div')};
      row.el.className='frow';
      const thumbUrl=URL.createObjectURL(file);
      row.el.innerHTML=`<img class="fthumb" alt="" src="${thumbUrl}"><div class="fmeta"><b></b><span class="fsub"></span></div><div class="fout"></div><button class="fx" type="button" aria-label="Remove">×</button>`;
      row.el.querySelector('b').textContent=file.name;
      row.el.querySelector('.fsub').textContent=UI.bytes(file.size);
      const th=row.el.querySelector('img'); th.classList.add('zoomable'); th.title='Click to view larger';
      th.onclick=()=>{
        const views=[{label:'Original',src:thumbUrl,note:`${file.name} · ${UI.bytes(file.size)}`}];
        if(row.out&&row.out.type.startsWith('image/')) views.push({label:'Result',src:row.url,note:`${row.outName} · ${UI.bytes(row.out.size)}`});
        UI.lightbox(views, views.length-1);
      };
      row.el.querySelector('img').onerror=function(){ this.replaceWith(Object.assign(document.createElement('div'),{className:'fthumb ph',textContent:UI.ext(file.name).toUpperCase()||'FILE'})); };
      row.el.querySelector('.fx').onclick=()=>{ const i=rows.indexOf(row); if(i>=0) rows.splice(i,1); row.el.remove(); URL.revokeObjectURL(thumbUrl); if(row.url) URL.revokeObjectURL(row.url); onChange&&onChange(rows); };
      row.sub=t=>row.el.querySelector('.fsub').textContent=t;
      row.status=(t,cls)=>{ const o=row.el.querySelector('.fout'); o.className='fout'+(cls?' '+cls:''); o.textContent=t; };
      row.done=(blob,name,text)=>{
        if(row.url) URL.revokeObjectURL(row.url);
        row.out=blob; row.outName=name; row.url=URL.createObjectURL(blob);
        const o=row.el.querySelector('.fout'); o.className='fout ok'; o.innerHTML='';
        const s=document.createElement('span'); s.textContent=text;
        const a=document.createElement('a'); a.className='mini dl'; a.href=row.url; a.download=name; a.textContent='Download';
        o.append(s,a);
      };
      rows.push(row); container.appendChild(row.el);
      return row;
    }
    return {
      rows, add,
      clear(){ rows.splice(0).forEach(r=>r.el.remove()); onChange&&onChange(rows); },
      async zipAll(name){ const items=rows.filter(r=>r.out).map(r=>({name:r.outName,blob:r.out})); UI.download(await UI.zip(items), name); }
    };
  }
  // wire up a standard "drop many files → process each → download / zip" tool
  function batch(o){
    const {$}=UI, prog=UI.progress($('bar'),$('status'));
    const L=list($('list'),{onChange:rows=>{ $('go').disabled=!rows.length; $('zipAll').hidden=true; if(!rows.length) prog.say('Choose files to start.'); }});
    let busy=false;
    UI.dropzoneMulti($('drop'),$('file'),files=>{
      if(busy) return;
      $('err').hidden=true;
      const ok=files.filter(o.accept), bad=files.length-ok.length;
      ok.forEach(f=>{ const r=L.add(f); o.onAdd&&o.onAdd(r); });
      if(bad){ $('err').textContent=`Skipped ${bad} file${bad>1?'s':''} that ${bad>1?'aren’t':'isn’t'} supported here.`; $('err').hidden=false; }
      $('go').disabled=!L.rows.length;
      prog.say(`${L.rows.length} file${L.rows.length>1?'s':''} ready.`);
    });
    $('zipAll').onclick=()=>L.zipAll(o.zipName||'best-ever-online-tools.zip');
    $('go').onclick=async()=>{
      if(busy||!L.rows.length) return;
      busy=true; UI.lock([$('go'),...(o.controls||[])],true); $('zipAll').hidden=true; $('err').hidden=true;
      const job=UI.job(); let done=0, failed=0;
      for(let i=0;i<L.rows.length;i++){
        const r=L.rows[i];
        r.status('Working…');
        prog.say(`Processing ${i+1} of ${L.rows.length}…`);
        try{ const res=await o.process(r); r.done(res.blob,res.name,res.text); done++; }
        catch(x){ r.status(x.message||'Failed','bad'); failed++; }
        prog.set((i+1)/L.rows.length);
      }
      job.end(); busy=false; UI.lock([$('go'),...(o.controls||[])],false);
      $('zipAll').hidden=done<2; if(done) BM.success();
      prog.say(`Done: ${done} file${done!==1?'s':''}`+(failed?`, ${failed} failed`:'')+'.');
    };
    return L;
  }
  const pct=(a,b)=>{ const d=Math.round((1-b/a)*100); return d>=0?`−${d}%`:`+${-d}%`; };

  return {typeOf,EXT,decode,canvasFrom,encode,canEncode,hasAlpha,readExif,stripJpeg,stripPng,pngHasText,list,batch,pct};
})();
