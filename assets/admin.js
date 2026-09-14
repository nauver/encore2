/* =========================================================================
   enCoR — admin
   Purpose: correct timings and wording, then export a validated dataset.
   Exporting IS the validation: only validated quotes are written out.
   Sections: 1 state · 2 bootstrap · 3 rendering · 4 player
             5 global controls · 6 export · 7 dataset loader
   ========================================================================= */

/* --- 1. state ---------------------------------------------------------- */
const SESSIONS=[];
function registerSession(s){ SESSIONS.push(s); }
let cur=null, curQ=null;

const tc=t=>{const x=Math.max(0,Math.floor(t));const p=n=>String(n).padStart(2,"0");
  return `${p(Math.floor(x/3600))}:${p(Math.floor(x%3600/60))}:${p(x%60)}`;};
const seek=(s,q)=>`${s.portalUrl}/seek/${s.startUTC+q.start_sec-3}`;

/* --- 2. bootstrap ------------------------------------------------------ */
function boot(){
  if(!SESSIONS.length){document.getElementById("list").innerHTML="<p>No dataset loaded. Check data/index.js.</p>";return;}
  const sel=document.getElementById("sess");
  SESSIONS.forEach((s,i)=>{const o=document.createElement("option");o.value=i;o.textContent=s.title;sel.appendChild(o);});
  sel.onchange=()=>load(+sel.value);
  load(0);
}

function load(i){
  cur=SESSIONS[i];
  cur.quotes.forEach(q=>{ if(q.validated===undefined) q.validated=false; });
  document.getElementById("startUTC").value=cur.startUTC;
  render();
}

/* --- 3. rendering: validated quotes first, the rest below -------------- */
function render(){
  const list=document.getElementById("list"); list.innerHTML="";
  // Les citations validees remontent en tete ; le reste attend en dessous,
  // dans l'ordre chronologique.
  const ordered=[...cur.quotes].sort((a,b)=>
    (b.validated?1:0)-(a.validated?1:0) || a.start_sec-b.start_sec);
  let sepDone=false;
  ordered.forEach(q=>{
    const i=cur.quotes.indexOf(q);
    if(!q.validated && !sepDone && ordered.some(x=>x.validated)){
      const h=document.createElement("div"); h.className="sep"; h.textContent="Still to review";
      list.appendChild(h); sepDone=true;
    }
    const d=document.createElement("article");
    d.className="q"+(q.validated?" valid":"")+(q===curQ?" cur":"");
    d.innerHTML=`
      <div class="row">
        <button class="tcode" data-act="play">${tc(q.start_sec)}</button>
        <span class="nudge">
          <button data-n="-10">−10</button><button data-n="-5">−5</button><button data-n="-1">−1</button>
          <button data-n="1">+1</button><button data-n="5">+5</button><button data-n="10">+10</button>
        </span>
        <label style="margin-left:auto"><input type="checkbox" data-act="valid" ${q.validated?"checked":""}> Validated</label>
        <button data-act="del" title="Remove this quote">✕</button>
      </div>
      <textarea class="or" data-f="quote" placeholder="Quote in the original language">${q.quote||""}</textarea>
      <textarea class="en" data-f="translation" placeholder="English translation (leave empty if the quote is already English)">${q.translation||""}</textarea>
      <div class="meta">
        <input data-f="speaker" value="${(q.speaker||"").replace(/"/g,"&quot;")}" placeholder="Speaker">
        <input data-f="role" value="${(q.role||"").replace(/"/g,"&quot;")}" placeholder="Role">
        <input data-f="theme" value="${(q.theme||"").replace(/"/g,"&quot;")}" placeholder="Theme">
        <input data-f="type" value="${q.type||"quote"}" placeholder="type" style="max-width:6rem">
      </div>`;
    d.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{
      q.start_sec=Math.max(0,q.start_sec+ +b.dataset.n); q.timecode=tc(q.start_sec);
      curQ=q; play(q); render();
    });
    d.querySelector('[data-act="play"]').onclick=e=>{e.stopPropagation();curQ=q;play(q);render();};
    // Un clic n'importe ou sur la carte lance le passage, sauf sur les champs
    // que l'on edite ou sur les boutons de reglage.
    d.onclick=e=>{
      if (e.target.closest("textarea,input,button")) return;
      curQ=q; play(q); render();
    };
    d.querySelector('[data-act="valid"]').onchange=e=>{q.validated=e.target.checked;render();count();};
    d.querySelector('[data-act="del"]').onclick=()=>{
      if(confirm("Remove this quote from the dataset?")){cur.quotes.splice(i,1);render();count();}
    };
    d.querySelectorAll("[data-f]").forEach(el=>el.oninput=()=>{
      const v=el.value; const f=el.dataset.f;
      if(f==="translation" && !v.trim()) delete q.translation; else q[f]=v;
    });
    list.appendChild(d);
  });
  count();
}

/* --- 4. player --------------------------------------------------------- */
function play(q){
  const url=seek(cur,q);
  document.getElementById("frame").src=url;
  document.getElementById("frameHint").textContent=url;
}

function count(){
  const v=cur.quotes.filter(q=>q.validated).length;
  document.getElementById("counter").textContent=`${v} / ${cur.quotes.length} validated`;
}

/* --- 5. global controls: startUTC and batch shift ---------------------- */
document.getElementById("startUTC").oninput=e=>{
  const v=parseInt(e.target.value,10); if(!isNaN(v)) cur.startUTC=v;
};
document.getElementById("applyShift").onclick=()=>{
  const n=parseInt(document.getElementById("shift").value,10)||0;
  if(!n) return;
  cur.quotes.forEach(q=>{q.start_sec=Math.max(0,q.start_sec+n);q.timecode=tc(q.start_sec);});
  render();
  document.getElementById("status").textContent=`Shifted ${cur.quotes.length} quotes by ${n}s.`;
};
document.getElementById("openTab").onclick=()=>{
  if(curQ) window.open(seek(cur,curQ),"_blank","noopener");
};

/* --- 6. export --------------------------------------------------------- */
function download(onlyValid){
  const qs=(onlyValid?cur.quotes.filter(q=>q.validated):cur.quotes).map((q,i)=>{
    const o={id:`q${String(i+1).padStart(3,"0")}`,type:q.type||"quote",speaker:q.speaker,role:q.role,
             theme:q.theme,start_sec:q.start_sec,timecode:tc(q.start_sec),quote:q.quote,
             seek_url:seek(cur,q)};
    if(q.translation) o.translation=q.translation;
    return o;
  });
  if(!qs.length){alert("Nothing to export — no quote is validated yet.");return;}
  const out={...cur, startUTC:cur.startUTC, quotes:qs};
  delete out.validated;
  const body="registerSession(\n"+JSON.stringify(out,null,2)+"\n);\n";
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([body],{type:"text/javascript"}));
  a.download=`${cur.id}.js`; a.click(); URL.revokeObjectURL(a.href);
  document.getElementById("status").textContent=`Exported ${qs.length} quotes to ${cur.id}.js — replace the file in data/.`;
}
document.getElementById("export").onclick=()=>download(true);
document.getElementById("exportAll").onclick=()=>download(false);

/* --- 7. dataset loader ------------------------------------------------- */
(function(){
  const ids=window.SESSIONS_MANIFEST||[];
  let left=ids.length; if(!left){boot();return;}
  ids.forEach(id=>{const s=document.createElement("script");s.src=`data/${id}.js`;
    s.onload=s.onerror=()=>{if(--left===0) boot();};document.body.appendChild(s);});
})();
