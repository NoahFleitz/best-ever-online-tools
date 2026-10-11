(()=>{
const {$}=UI;
const ok=f=>/^image\/(jpeg|png|webp)$/.test(IK.typeOf(f));
IK.batch({
  accept:ok,
  zipName:'clean-images.zip',
  async onAdd(r){
    const t=IK.typeOf(r.file), buf=await r.file.arrayBuffer();
    let found=[];
    if(t==='image/jpeg'){
      const e=IK.readExif(buf); r.exif=e;
      if(e.gps) found.push('GPS location');
      if(e.make||e.model) found.push('camera: '+[e.make,e.model].filter(Boolean).join(' '));
      if(e.date) found.push('date: '+e.date);
      if(e.software) found.push('software: '+e.software);
      if(!found.length && Object.keys(e).length) found.push('EXIF data');
    } else if(t==='image/png'){ const k=IK.pngHasText(buf); if(k.length) found.push('text chunks ('+[...new Set(k)].join(', ')+')'); }
    else found.push('may contain EXIF/XMP');
    r.sub(`${UI.bytes(r.file.size)} · ${found.length?'Found: '+found.join(' · '):'No metadata found'}`);
  },
  async process(r){
    const f=r.file, t=IK.typeOf(f), base=UI.baseName(f.name)+'_clean.';
    if(t==='image/jpeg'){
      if(r.exif&&r.exif.orientation>1){
        // removing EXIF would also remove the rotation flag, so re-save with the rotation baked in
        const d=await IK.decode(f), c=IK.canvasFrom(d,d.w,d.h); d.close();
        const blob=await IK.encode(c,'image/jpeg',.95);
        return {blob,name:base+'jpg',text:`Cleaned · ${UI.bytes(blob.size)} · re-saved to keep rotation`};
      }
      const blob=IK.stripJpeg(await f.arrayBuffer());
      return {blob,name:base+'jpg',text:`Cleaned · ${UI.bytes(blob.size)} · no quality loss`};
    }
    if(t==='image/png'){
      const blob=IK.stripPng(await f.arrayBuffer());
      return {blob,name:base+'png',text:`Cleaned · ${UI.bytes(blob.size)} · no quality loss`};
    }
    const d=await IK.decode(f), c=IK.canvasFrom(d,d.w,d.h); d.close();
    const blob=await IK.encode(c,'image/webp',.95);
    return {blob,name:base+'webp',text:`Cleaned · ${UI.bytes(blob.size)}`};
  }
});
})();
