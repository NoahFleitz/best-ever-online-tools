(()=>{
const {$}=UI;
let cur=[26,143,135];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hex=([r,g,b])=>'#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
function rgb2hsl([r,g,b]){ r/=255;g/=255;b/=255; const M=Math.max(r,g,b),m=Math.min(r,g,b),l=(M+m)/2; let h=0,s=0; if(M!==m){ const d=M-m; s=l>.5?d/(2-M-m):d/(M+m); h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4; h*=60; } return [Math.round(h),Math.round(s*100),Math.round(l*100)]; }
function hsl2rgb(h,s,l){ s/=100;l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1)); return [f(0),f(8),f(4)].map(x=>Math.round(x*255)); }
function rgb2hsv([r,g,b]){ r/=255;g/=255;b/=255; const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m; let h=0; if(d){ h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4; h*=60; } return [Math.round(h),Math.round(M?d/M*100:0),Math.round(M*100)]; }
function rgb2cmyk([r,g,b]){ const k=1-Math.max(r,g,b)/255; if(k>=1) return [0,0,0,100]; return [r,g,b].map(x=>Math.round((1-x/255-k)/(1-k)*100)).concat(Math.round(k*100)); }
const lum=c=>{ const v=c.map(x=>x/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4); return .2126*v[0]+.7152*v[1]+.0722*v[2]; };
const ratio=(a,b)=>{ const A=lum(a),B=lum(b); return (Math.max(A,B)+.05)/(Math.min(A,B)+.05); };

function set(c, from){
  cur=c.map(x=>clamp(Math.round(x),0,255));
  const h=hex(cur), [H,S,L]=rgb2hsl(cur), [vh,vs,vv]=rgb2hsv(cur), cm=rgb2cmyk(cur);
  $('swatch').style.background=h;
  if(from!=='native') $('native').value=h;
  if(from!=='hex') $('hexIn').value=h.toUpperCase();
  const vals={vHex:h.toUpperCase(),vRgb:`rgb(${cur.join(', ')})`,vHsl:`hsl(${H}, ${S}%, ${L}%)`,vHsv:`hsv(${vh}, ${vs}%, ${vv}%)`,vCmyk:`cmyk(${cm.join('%, ')}%)`};
  for(const k in vals) $(k).textContent=vals[k];
  const w=ratio(cur,[255,255,255]), b=ratio(cur,[0,0,0]);
  const grade=r=>r>=7?'AAA':r>=4.5?'AA':r>=3?'AA large':'Fail';
  $('cW').textContent=`${w.toFixed(2)}:1 · ${grade(w)}`; $('cB').textContent=`${b.toFixed(2)}:1 · ${grade(b)}`;
  $('prevW').style.background=h; $('prevB').style.background=h;
  // shades → tints
  const row=$('shades'); row.innerHTML='';
  [10,20,30,40,50,60,70,80,90].forEach(l=>{ const c2=hsl2rgb(H,S,l), b2=document.createElement('button'); b2.type='button'; b2.className='chip'; b2.style.background=hex(c2); b2.title=hex(c2).toUpperCase(); b2.setAttribute('aria-label','Use '+hex(c2)); b2.onclick=()=>set(c2); row.appendChild(b2); });
}
$('native').addEventListener('input',()=>{ const v=$('native').value; set([1,3,5].map(i=>parseInt(v.substr(i,2),16)),'native'); });
$('hexIn').addEventListener('input',()=>{ let v=$('hexIn').value.trim().replace(/^#/,''); if(/^[0-9a-f]{3}$/i.test(v)) v=v.replace(/./g,'$&$&'); if(/^[0-9a-f]{6}$/i.test(v)) set([0,2,4].map(i=>parseInt(v.substr(i,2),16)),'hex'); });
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>UI.copy($(b.dataset.copy).textContent,b));

if('EyeDropper' in window){ $('eye').hidden=false; $('eye').onclick=async()=>{ try{ const r=await new EyeDropper().open(); const v=r.sRGBHex; if(v.startsWith('#')) set([1,3,5].map(i=>parseInt(v.substr(i,2),16))); else{ const m=v.match(/\d+/g); if(m) set(m.slice(0,3).map(Number)); } }catch{} }; }

// pick from an image (zoomable) + extract a palette
const pc=$('pickCanvas'), pctx=pc.getContext('2d',{willReadFrequently:true});
const lc=$('loupeCv'), lctx=lc.getContext('2d'), pop=$('loupePop');
let viewer=null;
UI.dropzone($('drop'),$('file'),async f=>{
  try{
    $('err').hidden=true;
    const d=await IK.decode(f), s=Math.min(1,4096/Math.max(d.w,d.h));
    pc.width=Math.round(d.w*s); pc.height=Math.round(d.h*s); pctx.drawImage(d.src,0,0,pc.width,pc.height); d.close();
    $('pickWrap').hidden=false;
    if(!viewer) viewer=UI.viewer($('pickVp'),pc,{width:pc.width,height:pc.height,maxZoom:48,onPoint:(x,y)=>set(px(x,y)),onHover:hover});
    else viewer.setSize(pc.width,pc.height);
    palette();
  }catch(e){ $('err').textContent=e.message; $('err').hidden=false; }
});
function px(x,y){ return [...pctx.getImageData(clamp(Math.floor(x),0,pc.width-1),clamp(Math.floor(y),0,pc.height-1),1,1).data].slice(0,3); }
function hover(x,y,e){
  if(x==null){ pop.hidden=true; return; }
  const ix=Math.floor(x), iy=Math.floor(y);
  lctx.imageSmoothingEnabled=false; lctx.fillStyle='#000'; lctx.fillRect(0,0,121,121);
  lctx.drawImage(pc,ix-5,iy-5,11,11,0,0,121,121);
  lctx.strokeStyle='#fff'; lctx.lineWidth=2; lctx.strokeRect(55,55,11,11); lctx.strokeStyle='#000'; lctx.lineWidth=1; lctx.strokeRect(53.5,53.5,14,14);
  const c=px(x,y); $('loupeHex').textContent=hex(c).toUpperCase();
  const r=$('pickVp').getBoundingClientRect(); let lx=e.clientX-r.left+18, ly=e.clientY-r.top+18;
  if(lx+130>r.width) lx=e.clientX-r.left-148; if(ly+150>r.height) ly=e.clientY-r.top-168;
  pop.style.left=lx+'px'; pop.style.top=ly+'px'; pop.hidden=false;
}
function palette(){
  // k-means on a downsampled copy
  const t=document.createElement('canvas'), s=Math.min(1,96/Math.max(pc.width,pc.height)); t.width=Math.max(1,Math.round(pc.width*s)); t.height=Math.max(1,Math.round(pc.height*s));
  const tx=t.getContext('2d'); tx.drawImage(pc,0,0,t.width,t.height);
  const d=tx.getImageData(0,0,t.width,t.height).data, px=[];
  for(let i=0;i<d.length;i+=4) if(d[i+3]>200) px.push([d[i],d[i+1],d[i+2]]);
  if(!px.length) return;
  const K=6; let C=[...Array(K)].map((_,i)=>px[Math.floor((i+.5)*px.length/K)].slice());
  for(let it=0;it<10;it++){
    const sum=C.map(()=>[0,0,0,0]);
    for(const p of px){ let bi=0,bd=1e9; C.forEach((c,i)=>{ const dd=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2; if(dd<bd){bd=dd;bi=i;} }); const s2=sum[bi]; s2[0]+=p[0];s2[1]+=p[1];s2[2]+=p[2];s2[3]++; }
    C=C.map((c,i)=>sum[i][3]?[sum[i][0]/sum[i][3],sum[i][1]/sum[i][3],sum[i][2]/sum[i][3],sum[i][3]]:c);
  }
  C.sort((a,b)=>(b[3]||0)-(a[3]||0));
  const row=$('palette'); row.innerHTML='';
  C.forEach(c=>{ const c3=c.slice(0,3).map(Math.round), b=document.createElement('button'); b.type='button'; b.className='chip big'; b.style.background=hex(c3); b.innerHTML=`<span>${hex(c3).toUpperCase()}</span>`; b.style.color=lum(c3)>.4?'#000':'#fff'; b.onclick=()=>set(c3); row.appendChild(b); });
}
set(cur);
})();
