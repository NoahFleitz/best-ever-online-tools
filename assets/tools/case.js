(()=>{
const {$}=UI, ta=$('txt');
const words=s=>s.replace(/([\p{Ll}\d])(\p{Lu})/gu,'$1 $2').match(/[\p{L}\p{N}]+/gu)||[];
const cap=w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();
const SMALL=new Set('a an and as at but by for in nor of on or so the to up yet via'.split(' '));
const T={
  upper:s=>s.toUpperCase(),
  lower:s=>s.toLowerCase(),
  title:s=>s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu,(w,i)=>(i>0&&SMALL.has(w)&&!/[.:!?]\s*$/.test(s.slice(0,i)))?w:cap(w)),
  sentence:s=>s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu,(m,a,b)=>a+b.toUpperCase()).replace(/\bi\b/g,'I'),
  camel:s=>s.split('\n').map(l=>words(l).map((w,i)=>i?cap(w):w.toLowerCase()).join('')).join('\n'),
  pascal:s=>s.split('\n').map(l=>words(l).map(cap).join('')).join('\n'),
  snake:s=>s.split('\n').map(l=>words(l).map(w=>w.toLowerCase()).join('_')).join('\n'),
  kebab:s=>s.split('\n').map(l=>words(l).map(w=>w.toLowerCase()).join('-')).join('\n'),
  constant:s=>s.split('\n').map(l=>words(l).map(w=>w.toUpperCase()).join('_')).join('\n'),
  alt:s=>{ let i=0; return [...s].map(c=>/\p{L}/u.test(c)?(i++%2?c.toUpperCase():c.toLowerCase()):c).join(''); },
  inverse:s=>[...s].map(c=>c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()).join(''),
};
$('cases').addEventListener('click',e=>{
  const b=e.target.closest('button[data-c]'); if(!b) return;
  // always convert from the text the user last typed or pasted, never from a previous conversion
  ta.value = b.dataset.c==='orig' ? original : T[b.dataset.c](original); stat();
  $('cases').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b&&b.dataset.c!=='orig'));
});
let original=ta.value;
function stat(){ $('stat').textContent=`${[...ta.value].length.toLocaleString()} characters · ${(ta.value.match(/\S+/g)||[]).length.toLocaleString()} words`; }
// typing, pasting or editing makes the current text the new original
ta.addEventListener('input',()=>{ original=ta.value; $('cases').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false')); stat(); });
$('copy').onclick=e=>UI.copy(ta.value,e.currentTarget);
$('clear').onclick=()=>{ ta.value=''; original=''; stat(); ta.focus(); };
$('save').onclick=()=>UI.download(new Blob([ta.value],{type:'text/plain'}),'text.txt');
stat();
})();
