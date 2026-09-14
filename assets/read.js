/* =========================================================================
   enCoR — reading view
   Purpose: the public page. Tabs per session, timeline, speaker filter,
   corpus-wide search. Rendering only; no data access beyond core.js.
   Exposes: boot(), select(i), draw(), renderList()
   ========================================================================= */

// Filtre d'entree : read.html?edition=EuroPCom%202026 ou ?event=EuroPCom
// La page d'accueil envoie ici avec un perimetre deja choisi, pour ne pas
// ouvrir dix-huit onglets d'un coup.
let SCOPE = null;
function applyScope(){
  const p = new URLSearchParams(location.search);
  const ed = p.get("edition"), ev = p.get("event"), q0 = p.get("q");
  if (ed){
    SCOPE = ed;
    const keep = SESSIONS.filter(s => s.edition === ed);
    if (keep.length){ SESSIONS.length = 0; SESSIONS.push(...keep); }
  } else if (ev){
    SCOPE = ev;
    const keep = SESSIONS.filter(s => (s.edition||"").toLowerCase().includes(ev.toLowerCase()));
    if (keep.length){ SESSIONS.length = 0; SESSIONS.push(...keep); }
  }
  // Ordre : editions recentes d'abord, puis chronologique dans l'edition.
  SESSIONS.sort((a,b) => (b.edition||"").localeCompare(a.edition||"") || a.date.localeCompare(b.date));
  if (q0){
    const box = document.getElementById("q");
    box.value = q0; query = q0; TERMS = expand(q0);
  }
  const crumb = document.getElementById("scope");
  if (crumb){
    crumb.innerHTML = SCOPE
      ? `<a href="index.html">enCoR</a> › <b>${esc(SCOPE)}</b> · <a href="read.html">all events</a>`
      : `<a href="index.html">enCoR</a> › <b>every event</b>`;
  }
}

function boot(){
  applyScope();
  if (!SESSIONS.length){
    document.getElementById("list").innerHTML="<p style='color:var(--soft)'>No dataset loaded. Check data/index.js.</p>";
    return;
  }
  const tabs=document.getElementById("tabs");
  SESSIONS.forEach((s,i)=>{
    const b=document.createElement("button");
    b.type="button"; b.role="tab"; b.textContent = SCOPE ? s.title.replace(/^EuroPCom \d+ — /,"") : s.title.replace(/^EuroPCom /,"").replace(" — "," · ");
    b.title=s.title;
    b.onclick=()=>{ query=""; theme=null; document.getElementById("q").value=""; select(i); };
    tabs.appendChild(b);
  });

  const themes=[...new Set(SESSIONS.flatMap(s=>s.quotes.map(q=>q.theme)).filter(Boolean))].sort();
  const chips=document.getElementById("chips");
  themes.forEach(t=>{
    const b=document.createElement("button");
    b.type="button"; b.textContent=t; b.setAttribute("aria-pressed","false");
    b.onclick=()=>{
      theme = theme===t ? null : t;
      [...chips.children].forEach(c=>c.setAttribute("aria-pressed", c===b && theme ? "true":"false"));
      draw();
    };
    chips.appendChild(b);
  });

  document.getElementById("q").oninput = e => {
    query = e.target.value.trim();
    TERMS = query ? expand(query) : [];
    txShown=8; draw();
  };
  select(0);
}

function select(i){
  current = SESSIONS[i]; filter = null;
  [...document.getElementById("tabs").children].forEach((b,j)=>b.setAttribute("aria-selected", j===i));
  const speakers=[...new Set(current.quotes.map(q=>q.speaker))];
  colors={}; speakers.forEach((s,k)=>colors[s]=PALETTE[k%PALETTE.length]);
  draw();
}

function matches(q, s){
  if (theme && q.theme !== theme) return false;
  if (!query) return true;
  return hasTerm([q.quote, q.translation, q.speaker, q.role, q.theme, s.title].join(" "));
}

function draw(){
  const meta=document.getElementById("meta"), warn=document.getElementById("warn");
  const tl=document.getElementById("tl"), scale=document.getElementById("scale"), lg=document.getElementById("legend");

  if (across()){
    [tl,scale,lg].forEach(e=>e.style.display="none");
    warn.innerHTML=""; meta.innerHTML="";
    const hits=[];
    SESSIONS.forEach(s=>s.quotes.forEach(q=>{ if(matches(q,s)) hits.push({s,q}); }));
    const extra = TERMS.filter(t=>t!==query.toLowerCase()).slice(0,6);
    document.getElementById("count").innerHTML =
      `${hits.length} quote${hits.length===1?"":"s"} across ${new Set(hits.map(h=>h.s.id)).size} session(s)` +
      (extra.length ? ` <span style="opacity:.7">· also matching ${extra.map(esc).join(", ")}${TERMS.length-1>6?"…":""}</span>` : "");
    renderList(hits, true);
    drawDeep();
  } else {
    [tl,scale,lg].forEach(e=>e.style.display="");
    document.getElementById("count").textContent="";
    drawSessionHeader();
    renderList(current.quotes.filter(q=>!filter||q.speaker===filter).map(q=>({s:current,q})), false);
    document.getElementById("deep").hidden=true;
  }
}

function drawSessionHeader(){
  const s=current;
  document.getElementById("meta").innerHTML =
    `${new Date(s.date).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · ` +
    `${Math.round(s.durationSec/60)} min · ${s.quotes.length} quotes · ` +
    `<a href="${s.portalUrl}" target="_blank" rel="noopener">open the session</a>`;
  document.getElementById("warn").innerHTML = s.trackNote ? `<p class="warn">${esc(s.trackNote)}</p>` : "";
  document.getElementById("scale").innerHTML =
    `<span>00:00</span><span>${tc(s.durationSec/2)}</span><span>${tc(s.durationSec)}</span>`;

  const tl=document.getElementById("tl");
  tl.innerHTML='<div class="tl-track"></div>';
  s.quotes.forEach(q=>{
    const m=document.createElement("button");
    m.className="tl-mark"; m.style.left=(q.start_sec/s.durationSec*100)+"%";
    m.style.color=colors[q.speaker]; m.title=`${q.timecode} — ${q.speaker}`;
    m.setAttribute("aria-label",`Go to ${q.speaker} at ${q.timecode}`);
    m.onclick=()=>{const el=document.getElementById(q.id);el.scrollIntoView({block:"center",behavior:"smooth"});el.querySelector("a").focus();};
    tl.appendChild(m);
  });

  const lg=document.getElementById("legend"); lg.innerHTML="";
  [...new Set(s.quotes.map(q=>q.speaker))].forEach(sp=>{
    const b=document.createElement("button");
    b.style.color=colors[sp]; b.setAttribute("aria-pressed","false");
    b.innerHTML=`<span class="dot"></span><span>${esc(sp)}</span>`;
    b.onclick=()=>{
      filter = filter===sp ? null : sp;
      [...lg.children].forEach(c=>c.setAttribute("aria-pressed", c===b && filter ? "true":"false"));
      draw();
    };
    lg.appendChild(b);
  });
}

function renderList(items, showSession){
  const list=document.getElementById("list"); list.innerHTML="";
  if(!items.length){
    list.innerHTML="<p style='color:var(--soft);padding:2rem 0'>Nothing matches.</p>";
    return;
  }
  const pal={}; let k=0;
  items.forEach(({s,q})=>{
    if(showSession && !(q.speaker in pal)) pal[q.speaker]=PALETTE[k++%PALETTE.length];
    const col = showSession ? pal[q.speaker] : colors[q.speaker];
    const d=document.createElement("article");
    d.className="q"; d.id=q.id;
    d.innerHTML=`
      <div class="q-time" style="color:${col}"><span>${q.timecode}</span></div>
      <div>
        ${showSession ? `<p class="from">${esc(s.title)}</p>` : ""}
        <blockquote>« ${hl(q.quote)} »</blockquote>
        ${q.translation ? `<p class="translation">${hl(q.translation)}</p>` : ""}
        <p class="who"><b>${hl(q.speaker)}</b> — ${esc(q.role)}${q.type && q.type!=="quote" ? `<span class="tag">${esc(q.type)}</span>` : ""}${q.theme ? `<span class="tag">${esc(q.theme)}</span>` : ""}</p>
        <div class="ctx" data-ctx></div>
        <div class="act"><a href="${q.seek_url}" target="_blank" rel="noopener">Watch in the video</a></div>
      </div>`;
    d.querySelector("blockquote").onclick=()=>toggleCtx(d, s, q);
    list.appendChild(d);
  });
}

// Datasets are scripts rather than JSON, so the page also works when opened
// straight from disk, with no server.

/* --- bootstrap ---------------------------------------------------------
   Datasets are scripts rather than JSON, so the page also works when opened
   straight from disk, with no server. */

(function(){
  const ids = window.SESSIONS_MANIFEST || [];
  let left = ids.length;
  if (!left) { boot(); return; }
  ids.forEach(id=>{
    const s=document.createElement("script");
    s.src=`data/${id}.js`;
    s.onload=s.onerror=()=>{ if(--left===0) boot(); };
    document.body.appendChild(s);
  });
})();
