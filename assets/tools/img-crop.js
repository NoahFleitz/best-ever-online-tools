(()=>{
const {$}=UI;
const cv=$('cimg'), box=$('box'), stage=$('stage'), prog=UI.progress($('bar'),$('status'));
let viewer=null, file=null, d=null, W=0, H=0, st={x:0,y:0,w:0,h:0}, ratio=0, fmt='keep', drag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function render(){
  box.style.left=st.x/W*100+'%'; box.style.top=st.y/H*100+'%';
  box.style.width=st.w/W*100+'%'; box.style.height=st.h/H*100+'%';
  $('dims').textContent=`${Math.round(st.w)} × ${Math.round(st.h)} px`;
}
function setAspect(r){
  ratio=r; if(!W) return;
  let w=W*.9, h=H*.9;
  if(r){ if(w/h>r) w=h*r; else h=w/r; }
  st={x:(W-w)/2,y:(H-h)/2,w,h}; render();
}
UI.seg($('aspect'),v=>{ if(v==='free') return setAspect(0); const [a,b]=v.split(':').map(Number); setAspect(a/b); });
UI.seg($('fmt'),v=>fmt=v);

UI.dropzone($('drop'),$('file'),async f=>{
  $('err').hidden=true; $('result').hidden=true;
  try{
    const nd=await IK.decode(f); d&&d.close(); d=nd; file=f; W=d.w; H=d.h;
    const s=Math.min(1,4096/Math.max(W,H));
    cv.width=Math.round(W*s); cv.height=Math.round(H*s);
    cv.getContext('2d').drawImage(d.src,0,0,cv.width,cv.height);
    $('stageWrap').hidden=false; $('empty').hidden=true;
    if(!viewer) viewer=UI.viewer($('cropVp'),stage,{width:W,height:H}); else viewer.setSize(W,H);
    $('fileinfo').textContent=`${f.name} · ${W}×${H} · ${UI.bytes(f.size)}`;
    setAspect(ratio); $('go').disabled=false; prog.say('Drag the box or its corners to choose the area.');
  }catch(e){ $('err').textContent=e.message; $('err').hidden=false; }
});

box.addEventListener('pointerdown',e=>{
  e.preventDefault(); e.stopPropagation();
  drag={k:e.target.dataset.h||'move',sx:e.clientX,sy:e.clientY,s:{...st}};
  box.setPointerCapture(e.pointerId);
});
box.addEventListener('pointermove',e=>{
  if(!drag) return;
  const sc=W/stage.getBoundingClientRect().width, dx=(e.clientX-drag.sx)*sc, dy=(e.clientY-drag.sy)*sc, s=drag.s;
  let {x,y,w,h}=s;
  if(drag.k==='move'){ x=clamp(s.x+dx,0,W-s.w); y=clamp(s.y+dy,0,H-s.h); }
  else{
    const left=drag.k.includes('w'), top=drag.k.includes('n');
    const ax=left?s.x+s.w:s.x, ay=top?s.y+s.h:s.y;
    const px=clamp((left?s.x:s.x+s.w)+dx,0,W), py=clamp((top?s.y:s.y+s.h)+dy,0,H);
    w=Math.max(8,Math.abs(px-ax)); h=Math.max(8,Math.abs(py-ay));
    if(ratio){
      if(w/h>ratio) w=h*ratio; else h=w/ratio;
      const mw=left?ax:W-ax, mh=top?ay:H-ay;
      if(w>mw){ w=mw; h=w/ratio; } if(h>mh){ h=mh; w=h*ratio; }
    }
    x=left?ax-w:ax; y=top?ay-h:ay;
  }
  st={x,y,w,h}; render();
});
['pointerup','pointercancel'].forEach(t=>box.addEventListener(t,()=>drag=null));
// arrow keys nudge the box
box.addEventListener('keydown',e=>{
  const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key]; if(!k) return;
  e.preventDefault(); const step=e.shiftKey?10:1;
  st.x=clamp(st.x+k[0]*step,0,W-st.w); st.y=clamp(st.y+k[1]*step,0,H-st.h); render();
});

$('go').onclick=async()=>{
  if(!d) return;
  const t=IK.typeOf(file);
  let out=fmt!=='keep'?fmt:(t==='image/png'||t==='image/gif'||t==='image/svg+xml')?'image/png':t==='image/webp'?'image/webp':'image/jpeg';
  if(out==='image/webp'&&!(await IK.canEncode('image/webp'))) out='image/png';
  const x=Math.round(st.x), y=Math.round(st.y), w=Math.round(st.w), h=Math.round(st.h);
  const c=IK.canvasFrom(d,w,h,{crop:[x,y,w,h],bg:out==='image/jpeg'?'#ffffff':null});
  const blob=await IK.encode(c,out,.92);
  UI.showResult($('result'),{blob,filename:`${UI.baseName(file.name)}_cropped.${IK.EXT[out]}`,previewType:'image',meta:`${w}×${h} · ${UI.bytes(blob.size)}`});
  prog.say('Done.');
};
})();
