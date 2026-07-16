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
<td class="dragfile" title="drag into your DAW: ${esc(x.file)}" draggable="true" data-path="${esc(x.path)}">${esc(x.file.slice(0,30))}</td>
<td><button class="cp" data-p="${esc(x.path)}">copy path</button></td></tr>`).join('');
  $('tbl').innerHTML=rows;
  $('tbl').querySelectorAll('.cp').forEach(b=>b.onclick=()=>{
    navigator.clipboard.writeText(b.dataset.p);b.textContent='✓ copied';setTimeout(()=>b.textContent='copy path',1200);
  });
}
document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{
  const k=th.dataset.k;sortD=(sortK===k)?-sortD:1;sortK=k;render();
});
$('tbl').addEventListener('dragstart',e=>{
  const td=e.target.closest('.dragfile');if(!td)return;
  e.preventDefault();window.groove.startDrag(td.dataset.path);
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
// === DRUM PREVIEW (DRSKit samples, real MIDI playback) ===
// Plays the actual note events from the groove's MIDI file through curated
// DRSKit one-shots (CC-BY 4.0 — see assets/drskit/ATTRIBUTION.md).
(function(){
  let actx=null,master=null,playing=null,playBtn=null,loopTimer=null,previewBpm=182,openHatSrc=null;
  const get=id=>document.getElementById(id);
  function ctx(){if(!actx)actx=new AudioContext();if(actx.state==='suspended')actx.resume();return actx;}
  const KIT={kick:3,snare:3,hatc:3,hato:2,tom1:2,tom2:2,tom3:2,crash:2,ride:2}; // name → layer count
  // ponytail: per-instrument trim knobs — tune by ear, samples are peak-normalized
  const TRIM={kick:1,snare:.9,hatc:.5,hato:.55,tom1:.85,tom2:.85,tom3:.85,crash:.6,ride:.5};
  const buffers={};let kitLoad=null;
  function loadKit(){
    kitLoad??=Promise.all(Object.entries(KIT).map(async([inst,n])=>{
      buffers[inst]=await Promise.all(Array.from({length:n},async(_,i)=>{
        const ab=await(await fetch(`assets/drskit/${inst}_${i+1}.flac`)).arrayBuffer();
        const buf=await ctx().decodeAudioData(ab);
        let peak=0;const d=buf.getChannelData(0);
        for(let j=0;j<d.length;j++){const v=Math.abs(d[j]);if(v>peak)peak=v;}
        return{buf,norm:peak?1/peak:1};
      }));
    }));
    return kitLoad;
  }
  // GM-ish drum map, bucketed for a 9-voice kit
  function instFor(n){
    if(n<=36)return'kick';
    if(n>=37&&n<=40)return'snare';
    if(n===42||n===44)return'hatc';
    if(n===46)return'hato';
    if(n===41||n===43)return'tom3';
    if(n===45||n===47)return'tom2';
    if(n===48||n===50)return'tom1';
    if(n===49||n===52||n===55||n===57)return'crash';
    if(n===51||n===53||n===59)return'ride';
    return null; // other percussion — skip in preview
  }
  function hit(inst,vel,t){
    const layers=buffers[inst];if(!layers)return;
    const c=ctx();
    const{buf,norm}=layers[Math.min(layers.length-1,Math.floor(vel/(128/layers.length)))];
    const src=c.createBufferSource(),g=c.createGain();
    src.buffer=buf;g.gain.value=norm*TRIM[inst]*(0.35+0.65*vel/127);
    src.connect(g);g.connect(master);src.start(t);
    if(inst==='hatc'||inst==='hato'){ // hi-hat choke: closing kills the open ring
      if(openHatSrc){try{openHatSrc.stop(t+0.03);}catch{}}
      openHatSrc=inst==='hato'?src:null;
    }
  }
  function stopLoop(){
    clearTimeout(loopTimer);loopTimer=null;
    if(master){master.disconnect();master=null;} // silences everything scheduled; buffers stay cached
    openHatSrc=null;
    if(playBtn){playBtn.textContent='▶';playBtn.style.color='';}
    playing=null;playBtn=null;
  }
  async function startLoop(row,btn){
    stopLoop();
    btn.textContent='…';playing=row;playBtn=btn;
    const[,r]=await Promise.all([loadKit(),window.groove.loadNotes(row.path)]);
    if(playing!==row)return; // user clicked elsewhere while loading
    const hits=(r.notes||[]).map(([t,n,v])=>[t,instFor(n),v]).filter(x=>x[1]);
    if(r.error||!hits.length){
      btn.textContent='✕';btn.title=r.error||'no drum notes found';
      setTimeout(()=>{if(playBtn!==btn){btn.textContent='▶';btn.title='preview groove';}},1500);
      playing=null;playBtn=null;return;
    }
    const c=ctx();
    master=c.createGain();master.connect(c.destination);
    let next=c.currentTime+0.08;
    function schedPass(){
      const s=(60/previewBpm)/r.tpb; // seconds per tick at the preview tempo
      for(const[t,inst,v]of hits)hit(inst,v,next+t*s);
      const len=r.barTicks*r.bars*s;
      next+=len;
      loopTimer=setTimeout(schedPass,Math.max(50,(len-0.3)*1000));
    }
    schedPass();
    btn.textContent='■';btn.style.color='var(--red)';
  }
  function attachPlayers(){
    document.querySelectorAll('#tbl tr').forEach(tr=>{
      if(tr.querySelector('.pv'))return;
      const cp=tr.querySelector('.cp');if(!cp)return;
      const row=DATA.find(r=>r.path===cp.dataset.p);
      if(!row)return;
      const btn=document.createElement('button');
      btn.className='cp pv';btn.textContent='▶';btn.title='preview groove';
      btn.style.marginLeft='4px';
      btn.onclick=e=>{e.stopPropagation();playing===row?stopLoop():startLoop(row,btn);};
      cp.after(btn);
      const rb=document.createElement('button');
      rb.className='cp';rb.textContent='📂';rb.title='reveal in Finder';
      rb.style.marginLeft='4px';
      rb.onclick=e=>{e.stopPropagation();window.groove.reveal(row.path);};
      btn.after(rb);
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
