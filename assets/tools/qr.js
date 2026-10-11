(()=>{
const {$}=UI;
if(qrcode.stringToBytesFuncs&&qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
let kind='url', ecc='M', model=null;
const cv=$('qr');
UI.seg($('kind'),v=>{ kind=v; ['url','text','wifi','email'].forEach(k=>$('k-'+k).hidden=k!==v); draw(); });
UI.seg($('ecc'),v=>{ ecc=v; draw(); });
document.querySelectorAll('#qrForm input,#qrForm textarea,#qrForm select').forEach(el=>el.addEventListener('input',draw));
const esc=s=>s.replace(/([\;,:"])/g,'\\$1');
function payload(){
  if(kind==='url'){ let u=$('url').value.trim(); if(u&&!/^[a-z][a-z0-9+.-]*:/i.test(u)) u='https://'+u; return u; }
  if(kind==='text') return $('text').value;
  if(kind==='wifi'){ const s=$('ssid').value; if(!s) return ''; const t=$('enc').value; return `WIFI:T:${t};S:${esc(s)};${t!=='nopass'?`P:${esc($('pass').value)};`:''}${$('hiddenNet').checked?'H:true;':''};`; }
  if(kind==='email'){ const to=$('to').value.trim(); if(!to) return ''; const q=[]; if($('subj').value) q.push('subject='+encodeURIComponent($('subj').value)); if($('body').value) q.push('body='+encodeURIComponent($('body').value)); return `mailto:${to}${q.length?'?'+q.join('&'):''}`; }
}
function draw(){
  const data=payload(), size=+$('size').value, fg=$('fg').value, bg=$('bg').value, margin=+$('margin').value;
  $('sizeV').textContent=size+' px'; $('marginV').textContent=margin;
  const ctx=cv.getContext('2d');
  $('dlPng').disabled=$('dlSvg').disabled=!data;
  if(!data){ model=null; cv.width=cv.height=size; ctx.fillStyle=bg; ctx.fillRect(0,0,size,size); $('qrNote').textContent='Type something to make a code.'; return; }
  try{ model=qrcode(0,ecc); model.addData(data); model.make(); }
  catch{ model=null; $('qrNote').textContent='That’s too much text for one QR code. Shorten it or lower the error correction.'; return; }
  const n=model.getModuleCount(), cells=n+margin*2, px=size/cells;
  cv.width=cv.height=size; ctx.fillStyle=bg; ctx.fillRect(0,0,size,size); ctx.fillStyle=fg;
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(model.isDark(r,c)) ctx.fillRect(Math.floor((c+margin)*px),Math.floor((r+margin)*px),Math.ceil(px),Math.ceil(px));
  const lum=h=>{ const v=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4); return .2126*v[0]+.7152*v[1]+.0722*v[2]; };
  const L1=lum(fg),L2=lum(bg), cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
  $('qrNote').textContent=`${n}×${n} modules · ${data.length} characters`+(cr<4?' · Low contrast: some phones may not scan this.':'')+(L1>L2?' · Light-on-dark codes don’t scan in every app.':'');
}
function svg(){
  const n=model.getModuleCount(), m=+$('margin').value, s=n+m*2; let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(model.isDark(r,c)) d+=`M${c+m} ${r+m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${$('size').value}" height="${$('size').value}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${$('bg').value}"/><path fill="${$('fg').value}" d="${d}"/></svg>`;
}
$('dlPng').onclick=()=>model&&cv.toBlob(b=>UI.download(b,'qr-code.png'),'image/png');
$('dlSvg').onclick=()=>model&&UI.download(new Blob([svg()],{type:'image/svg+xml'}),'qr-code.svg');
draw();
})();
