const MAX=1000;
let DATA=[],sortK='pack',sortD=1,timer=null;
const $=id=>document.getElementById(id);
const fc=f=>f==='d-beat / gallop'?'f-d':f==='straight backbeat'?'f-b':f==='half-time'?'f-h':f==='fast one-beat'?'f-f':'f-x';
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c])}
function debounce(fn,ms){return()=>{clearTimeout(timer);timer=setTimeout(fn,ms);}}
function uniq(k){return[...new Set(DATA.map(r=>r[k]).filter(Boolean))].sort()}
function buildSelects(){
  [['sF','feel'],['sC','cat'],['sT','time'],['sP','pack']].forEach(([id,k])=>{
    const el=$(id); el.length=1; // keep the "all" option; rebuild on rescan
    uniq(k).forEach(v=>{const o=new Option(v,v);el.appendChild(o);});
  });
}
function filt(){
  const q=$('q').value.toLowerCase(),ff=$('sF').value,fc2=$('sC').value,ft=$('sT').value,fp=$('sP').value;
  const bn=parseFloat($('bN').value),bx=parseFloat($('bX').value);
  return DATA.filter(x=>{
    if(ff&&x.feel!==ff)return false;if(fc2&&x.cat!==fc2)return false;
    if(ft&&x.time!==ft)return false;if(fp&&x.pack!==fp)return false;
    if(!isNaN(bn)&&x.bpm!=null&&x.bpm<bn)return false;
    if(!isNaN(bx)&&x.bpm!=null&&x.bpm>bx)return false;
    if(q){if(!(x.file+' '+x.pack+' '+x.section+' '+x.kick+' '+x.feel+' '+x.cat).toLowerCase().includes(q))return false;}
    return true;
  });
}
function render(){
  let r=filt();r.sort((a,b)=>{let x=a[sortK]??'',y=b[sortK]??'';return(x>y?1:x<y?-1:0)*sortD;});
  $('cnt').textContent=r.length.toLocaleString()+' / '+DATA.length.toLocaleString()+' grooves';
  const over=r.length>MAX;$('cap').textContent=over?`Showing first ${MAX} — narrow filters to see the rest.`:'';
  const rows=(over?r.slice(0,MAX):r).map(x=>`<tr>
<td>${x.feel==null?'—':`<span class="tag ${fc(x.feel)}">${esc(x.feel)}</span>`}</td>
<td>${esc(x.cat)}</td><td>${x.bpm??'—'}</td><td>${esc(x.ts)}</td><td>${x.bars}</td>
<td>${esc(x.time)}</td><td title="${esc(x.kick)}">${esc(x.kick)}</td>
<td title="${esc(x.pack)}">${esc(x.pack.slice(0,30))}</td>
<td title="${esc(x.section)}">${esc(x.section.slice(0,30))}</td>
<td title="${esc(x.file)}">${esc(x.file.slice(0,30))}</td>
<td><button class="cp" data-p="${esc(x.path)}">copy path</button></td></tr>`).join('');
  $('tbl').innerHTML=rows;
  $('tbl').querySelectorAll('.cp').forEach(b=>b.onclick=()=>{
    navigator.clipboard.writeText(b.dataset.p);b.textContent='✓ copied';setTimeout(()=>b.textContent='copy path',1200);
  });
}
document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{
  const k=th.dataset.k;sortD=(sortK===k)?-sortD:1;sortK=k;render();
});
['q','sF','sC','sT','sP'].forEach(id=>$(id).addEventListener('input',debounce(render,150)));
['bN','bX'].forEach(id=>$(id).addEventListener('input',debounce(render,300)));
window.groove.onScanProgress(m=>{$('lp').textContent=m;});
function show(json){
  DATA=JSON.parse(json);
  buildSelects();render();
  $('loader').style.display='none';$('app').style.display='block';
}
async function pickLibrary(){
  $('pick').hidden=true;$('lp').textContent='Choose a folder…';
  const r=await window.groove.chooseLibrary();
  if(r.json)return show(r.json);
  if(r.canceled&&DATA.length){$('loader').style.display='none';$('app').style.display='block';return;}
  $('lp').textContent=r.error||'Point GrooveViewer at your groove library to get started.';
  $('pick').hidden=false;
}
async function load(){
  $('pick').onclick=pickLibrary;
  try{
    const r=await window.groove.loadCatalog();
    if(r.json)return show(r.json);
    $('lp').textContent='Point GrooveViewer at your groove library to get started.';
    $('pick').hidden=false;
  }catch(e){$('lp').textContent='Error: '+e.message;}
}
load();
// === DRUM PREVIEW ===
// ponytail: synth caricature from the prototype — kick from metadata, snare
// inferred from feel class, straight-8ths hats. Real MIDI playback replaces
// this in a later milestone.
(function(){
  let actx=null,playing=null,playBtn=null,loopTimer=null,previewBpm=182;
  const get=id=>document.getElementById(id);
  function ctx(){if(!actx)actx=new AudioContext();if(actx.state==='suspended')actx.resume();return actx;}
  function kick(c,t){
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(55,t+0.2);
    g.gain.setValueAtTime(1.5,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
    o.start(t);o.stop(t+0.35);
  }
  function snare(c,t){
    const len=0.12,buf=c.createBuffer(1,c.sampleRate*len,c.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    f.type='bandpass';f.frequency.value=300;f.Q.value=0.5;
    src.buffer=buf;src.connect(f);f.connect(g);g.connect(c.destination);
    g.gain.setValueAtTime(0.9,t);g.gain.exponentialRampToValueAtTime(0.001,t+len);
    src.start(t);src.stop(t+len);
    const o=c.createOscillator(),go=c.createGain();
    o.connect(go);go.connect(c.destination);
    o.frequency.value=190;go.gain.setValueAtTime(0.5,t);go.gain.exponentialRampToValueAtTime(0.001,t+0.04);
    o.start(t);o.stop(t+0.04);
  }
  function hat(c,t,open){
    const dur=open?0.2:0.04,buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    f.type='highpass';f.frequency.value=8000;
    src.buffer=buf;src.connect(f);f.connect(g);g.connect(c.destination);
    g.gain.setValueAtTime(0.3,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.start(t);src.stop(t+dur);
  }
  const POS={'1':0,'1e':1,'1&':2,'1a':3,'2':4,'2e':5,'2&':6,'2a':7,
             '3':8,'3e':9,'3&':10,'3a':11,'4':12,'4e':13,'4&':14,'4a':15};
  function toGrid(s){
    if(!s||s==='-')return[];
    if(s==='4-on-floor')return[0,4,8,12];
    return s.split(',').map(x=>POS[x.trim()]).filter(v=>v!=null);
  }
  function snareGrid(f){
    if(f==='d-beat / gallop')return[2,6,10,14];
    if(f==='half-time')return[8];
    if(f==='fast one-beat')return[0,4,8,12];
    if(f==='no-snare')return[];
    return[4,12];
  }
  function schedOne(row,startAt,bpm){
    const c=ctx(),step=(60/bpm)/4,bars=row.bars||4,barLen=16*step;
    const kicks=toGrid(row.kick),snares=snareGrid(row.feel);
    const hats=row.time==='none'?[]:[0,2,4,6,8,10,12,14],open=row.time==='open-hat';
    for(let b=0;b<bars;b++){
      const bt=startAt+b*barLen;
      kicks.forEach(p=>{if(p<16)kick(c,bt+p*step);});
      snares.forEach(p=>{if(p<16)snare(c,bt+p*step);});
      hats.forEach(p=>{if(p<16)hat(c,bt+p*step,open);});
    }
    return startAt+bars*barLen;
  }
  function stopLoop(){
    clearTimeout(loopTimer);loopTimer=null;
    if(playBtn){playBtn.textContent='▶';playBtn.style.color='';}
    playing=null;playBtn=null;
  }
  function startLoop(row,btn){
    stopLoop();
    const c=ctx();let next=c.currentTime+0.05;
    const loopLen=(row.bars||4)*16*(60/previewBpm)/4;
    function sched(){next=schedOne(row,next,previewBpm);loopTimer=setTimeout(sched,(loopLen-0.3)*1000);}
    sched();playing=row;playBtn=btn;
    btn.textContent='■';btn.style.color='var(--red)';
  }
  function attachPlayers(){
    document.querySelectorAll('#tbl tr').forEach(tr=>{
      if(tr.querySelector('.pv'))return;
      const cp=tr.querySelector('.cp');if(!cp)return;
      const row=DATA.find(r=>r.path===cp.dataset.p);
      if(!row)return;
      let last=cp;
      if(row.feel!=null){ // no preview until the classifier (milestone 2) fills feel/kick
        const btn=document.createElement('button');
        btn.className='cp pv';btn.textContent='▶';btn.title='preview groove';
        btn.style.marginLeft='4px';
        btn.onclick=e=>{e.stopPropagation();playing===row?stopLoop():startLoop(row,btn);};
        cp.after(btn);last=btn;
      }
      const rb=document.createElement('button');
      rb.className='cp pv';rb.textContent='📂';rb.title='reveal in Finder';
      rb.style.marginLeft='4px';
      rb.onclick=e=>{e.stopPropagation();window.groove.reveal(row.path);};
      last.after(rb);
    });
  }
  new MutationObserver(attachPlayers).observe(document.getElementById('tbl'),{childList:true});
  const COLS=["Feel","Type","BPM","Sig","Bars","Cymbal","Kick","Pack","Section","File",""];
  const hiddenCols=new Set();let colStyle=null;
  function applyColVis(){
    if(!colStyle){colStyle=document.createElement("style");document.head.appendChild(colStyle);}
    colStyle.textContent=[...hiddenCols].map(i=>"#tbl td:nth-child("+(i+1)+"),thead th:nth-child("+(i+1)+"){display:none}").join("");
  }
  function addColumns(){
    const bar=document.querySelector(".bar");
    const wrap=document.createElement("div");wrap.className="col-wrap";
    const chks=COLS.map((n,i)=>n?"<label><input type=\"checkbox\" checked data-ci=\""+i+"\"> "+n+"</label>":"").filter(Boolean).join("");
    wrap.innerHTML="<button class=\"col-btn\">columns &#9662;</button><div class=\"col-panel\" id=\"colpanel\">"+chks+"</div>";
    bar.appendChild(wrap);
    const btn=wrap.querySelector(".col-btn"),panel=wrap.querySelector(".col-panel");
    btn.onclick=e=>{e.stopPropagation();panel.classList.toggle("open");};
    document.addEventListener("click",()=>panel.classList.remove("open"));
    panel.querySelectorAll("input[type=checkbox]").forEach(cb=>{
      cb.onchange=()=>{const i=+cb.dataset.ci;cb.checked?hiddenCols.delete(i):hiddenCols.add(i);applyColVis();};
    });
  }
  function addSlider(){
    const bar=document.querySelector('.bar');
    const w=document.createElement('div');
    w.style.cssText='display:flex;align-items:center;gap:6px;color:var(--dim);font-size:11px';
    w.innerHTML='preview BPM <input type="range" id="pvbpm" min="100" max="240" value="182" style="width:80px;accent-color:var(--red)"><b id="pvv" style="color:var(--acc)">182</b>';
    bar.appendChild(w);
    get('pvbpm').oninput=function(){
      previewBpm=+this.value;get('pvv').textContent=this.value;
      if(playing){const r=playing,b=playBtn;stopLoop();startLoop(r,b);}
    };
  }
  function addLibraryBtn(){
    const bar=document.querySelector('.bar');
    const b=document.createElement('button');
    b.className='col-btn';b.textContent='library…';b.title='choose a different library folder and rescan';
    bar.appendChild(b);
    b.onclick=()=>{
      stopLoop();
      $('app').style.display='none';$('loader').style.display='flex';
      pickLibrary();
    };
  }
  addSlider();
  addColumns();
  addLibraryBtn();
})();
