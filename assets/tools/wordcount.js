(()=>{
const {$}=UI, ta=$('txt');
const STOP=new Set('a an and are as at be but by for from has have he her his i in is it its of on or our she that the their them they this to was we were will with you your not so if do does did than then there these those what which who whom how why when where all any can could would should may might just also into about over more most some such only own same very me my him us am been being'.split(' '));
const fmt=s=>{ s=Math.round(s); if(s<60) return s+' sec'; const m=Math.floor(s/60), r=s%60; return m+' min'+(r?` ${r} sec`:''); };
function update(){
  const t=ta.value;
  const words=t.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[];
  const chars=[...t].length, noSp=[...t.replace(/\s/g,'')].length;
  const sentences=(t.match(/[^.!?…]*[\p{L}\p{N}][^.!?…]*([.!?…]+|$)/gu)||[]).filter(s=>s.trim()).length;
  const paras=t.split(/\n\s*\n/).filter(p=>p.trim()).length;
  const set=(id,v)=>$(id).textContent=v;
  set('sWords',words.length.toLocaleString()); set('sChars',chars.toLocaleString()); set('sNoSp',noSp.toLocaleString());
  set('sSent',sentences.toLocaleString()); set('sPara',paras.toLocaleString());
  set('sRead',words.length?fmt(words.length/238*60):'0 sec'); set('sSpeak',words.length?fmt(words.length/150*60):'0 sec');
  set('sAvg',words.length?(words.reduce((a,w)=>a+[...w].length,0)/words.length).toFixed(1):'0');
  const freq={}; words.forEach(w=>{ const k=w.toLowerCase(); if(k.length>2&&!STOP.has(k)&&!/^\d+$/.test(k)) freq[k]=(freq[k]||0)+1; });
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);
  $('kw').innerHTML=top.length?top.map(([w,c])=>`<li><span></span><b>${c}</b><i>${(c/words.length*100).toFixed(1)}%</i></li>`).join(''):'<li class="muted">Keywords appear here as you type.</li>';
  [...$('kw').querySelectorAll('li span')].forEach((s,i)=>s.textContent=top[i][0]);
  try{ localStorage.setItem('tp_wc',t.slice(0,200000)); }catch{}
}
try{ const s=localStorage.getItem('tp_wc'); if(s) ta.value=s; }catch{}
ta.addEventListener('input',update);
$('clear').onclick=()=>{ ta.value=''; update(); ta.focus(); };
$('copy').onclick=e=>UI.copy(ta.value,e.currentTarget);
update();
})();
