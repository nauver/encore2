/* =========================================================================
   enCoR — corpus view
   Purpose: the whole corpus as one picture, plus a full-screen mode for
   meetings. Reads the same datasets as the reading view.
   Sections: 1 state · 2 bootstrap · 3 layout · 4 tooltip · 5 detail
             6 presentation · 7 dataset loader
   ========================================================================= */

/* --- 1. state ---------------------------------------------------------- */
const SESSIONS=[];
function registerSession(s){ SESSIONS.push(s); }
const EDCOL={"EuroPCom 2024":"var(--e24)","EuroPCom 2025":"var(--e25)","EuroPCom 2026":"var(--e26)"};
let ITEMS=[], clusters=[], storyList=[], storyIdx=0, activeTheme=null;

const esc=t=>String(t||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* --- 2. bootstrap ------------------------------------------------------ */
function boot(){
  SESSIONS.forEach(s=>s.quotes.forEach(q=>ITEMS.push({s,q})));
  if(!ITEMS.length){document.getElementById("sub").textContent="No dataset loaded.";return;}

  const eds=[...new Set(SESSIONS.map(s=>s.edition))].sort();
  document.getElementById("sub").textContent =
    `${ITEMS.length} quotes · ${SESSIONS.length} sessions · ${eds.length} editions`;
  document.getElementById("legend").innerHTML =
    eds.map(e=>`<span><i style="background:${EDCOL[e]||"var(--soft)"}"></i>${esc(e)}</span>`).join("")
    + `<span><i style="border:1.5px solid var(--ink);background:none"></i>figure</span>`;

  // Un groupe par thème, ordonné du plus fourni au moins fourni.
  const by={};
  ITEMS.forEach(it=>{ const t=it.q.theme||"—"; (by[t]=by[t]||[]).push(it); });
  clusters=Object.entries(by).sort((a,b)=>b[1].length-a[1].length)
    .map(([theme,items])=>({theme,items}));

  layout();
  installNavigation();
}

/* --- 3. layout: a constellation you can pan and zoom -------------------- */

// Le corpus vit dans un espace "monde" bien plus grand que l'ecran. Les
// groupes sont semes en spirale de phyllotaxie, les plus fournis au centre,
// avec un ecartement proportionnel a leur rayon : aucune collision, et une
// densite qui se lit d'un coup d'oeil.
const WORLD = { x:0, y:0, w:0, h:0 };   // etendue reelle du contenu
let view = { x:0, y:0, w:0, h:0 };      // fenetre visible, pilotee par viewBox

function layout(){
  const svg = document.getElementById("map");
  const R = [];                          // {theme, items, cx, cy, r}
  let angle = 0, step = 0;

  clusters.forEach((c,i) => {
    const r = 34 + 15 * Math.sqrt(c.items.length);   // rayon du groupe
    R.push({ ...c, r });
  });

  // Semis : on avance sur la spirale tant que le nouveau groupe touche un voisin.
  R.forEach((c,i) => {
    if (i === 0){ c.cx = 0; c.cy = 0; return; }
    let k = i;
    for (;;){
      const a = k * 2.3999632, rad = 46 * Math.sqrt(k);
      c.cx = rad * Math.cos(a);
      c.cy = rad * Math.sin(a);
      const clash = R.slice(0,i).some(o =>
        Math.hypot(o.cx - c.cx, o.cy - c.cy) < (o.r + c.r + 54));
      if (!clash) break;
      k += 0.6;
    }
  });

  let out = "";
  R.forEach(c => {
    const fs = Math.max(13, Math.min(30, 9 + c.items.length * 0.9));
    out += `<text class="cluster-count" x="${c.cx.toFixed(1)}" y="${(c.cy+8).toFixed(1)}" `+
           `text-anchor="middle" style="font-size:${(c.r*0.85).toFixed(0)}px">${c.items.length}</text>`;
    out += `<text class="cluster-label" x="${c.cx.toFixed(1)}" y="${(c.cy + c.r + 22).toFixed(1)}" `+
           `text-anchor="middle" style="font-size:${fs.toFixed(0)}px">${esc(c.theme)}</text>`;
    c.items.forEach((it,i) => {
      const a = i * 2.3999632, rad = c.r * 0.92 * Math.sqrt(i + 0.7) / Math.sqrt(c.items.length + 0.7);
      const x = c.cx + rad * Math.cos(a), y = c.cy + rad * Math.sin(a);
      const col = EDCOL[it.s.edition] || "var(--soft)";
      const fig = it.q.type && it.q.type !== "quote";
      out += `<circle class="dot${fig?" figure":""}" data-i="${ITEMS.indexOf(it)}" `+
             `cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" `+
             `${fig?`stroke="${col}"`:`fill="${col}"`} opacity=".9">`+
             `<title>${esc(it.q.speaker)} — ${esc(it.q.timecode)}</title></circle>`;
    });
  });
  svg.innerHTML = out;

  // Etendue du contenu, marge comprise.
  const xs = R.map(c=>c.cx), ys = R.map(c=>c.cy), rs = R.map(c=>c.r);
  const pad = 90;
  WORLD.x = Math.min(...xs.map((x,i)=>x-rs[i])) - pad;
  WORLD.y = Math.min(...ys.map((y,i)=>y-rs[i])) - pad;
  WORLD.w = Math.max(...xs.map((x,i)=>x+rs[i])) + pad - WORLD.x;
  WORLD.h = Math.max(...ys.map((y,i)=>y+rs[i])) + pad*1.4 - WORLD.y;

  fitToScreen();
  svg.querySelectorAll(".dot").forEach(el => {
    el.onmouseenter = e => tip(e, ITEMS[+el.dataset.i]);
    el.onmousemove  = e => moveTip(e);
    el.onmouseleave = hideTip;
    el.onclick      = () => open_(+el.dataset.i);
  });
}

function applyView(){
  document.getElementById("map")
    .setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function fitToScreen(){
  const svg = document.getElementById("map");
  const ar  = svg.clientWidth / Math.max(1, svg.clientHeight);
  // On englobe tout le contenu en respectant le rapport de l'ecran.
  let w = WORLD.w, h = WORLD.h;
  if (w / h > ar) h = w / ar; else w = h * ar;
  view = { x: WORLD.x + WORLD.w/2 - w/2, y: WORLD.y + WORLD.h/2 - h/2, w, h };
  applyView();
}

// --- deplacement et echelle ------------------------------------------------
// Souris : molette pour l'echelle sous le curseur, glisser pour se deplacer.
// Tactile : un doigt deplace, deux doigts pincent.
function installNavigation(){
  const svg = document.getElementById("map");
  const MIN = 260, MAX = 12000;          // largeur de fenetre autorisee

  const toWorld = (px, py) => {
    const r = svg.getBoundingClientRect();
    return { x: view.x + (px - r.left) / r.width  * view.w,
             y: view.y + (py - r.top)  / r.height * view.h };
  };

  function zoomAt(px, py, factor){
    const before = toWorld(px, py);
    const w = Math.max(MIN, Math.min(MAX, view.w * factor));
    const h = w * view.h / view.w;
    view.w = w; view.h = h;
    const after = toWorld(px, py);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    applyView();
  }

  svg.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 1/1.12);
  }, { passive:false });

  let drag = null;
  svg.addEventListener("pointerdown", e => {
    if (e.target.classList.contains("dot")) return;   // le clic sur un point reste un clic
    drag = { px:e.clientX, py:e.clientY, vx:view.x, vy:view.y };
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grabbing";
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    const r = svg.getBoundingClientRect();
    view.x = drag.vx - (e.clientX - drag.px) / r.width  * view.w;
    view.y = drag.vy - (e.clientY - drag.py) / r.height * view.h;
    applyView();
  });
  ["pointerup","pointercancel","pointerleave"].forEach(t =>
    svg.addEventListener(t, () => { drag = null; svg.style.cursor = "grab"; }));

  // Pincement a deux doigts.
  let pinch = null;
  svg.addEventListener("touchstart", e => {
    if (e.touches.length !== 2) return;
    drag = null;
    const [a,b] = e.touches;
    pinch = { d: Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY) };
  }, { passive:true });
  svg.addEventListener("touchmove", e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const [a,b] = e.touches;
    const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
    zoomAt((a.clientX+b.clientX)/2, (a.clientY+b.clientY)/2, pinch.d / d);
    pinch.d = d;
  }, { passive:false });
  svg.addEventListener("touchend", () => { pinch = null; }, { passive:true });

  document.getElementById("zoomIn").onclick  = () => zoomAt(innerWidth/2, innerHeight/2, 1/1.5);
  document.getElementById("zoomOut").onclick = () => zoomAt(innerWidth/2, innerHeight/2, 1.5);
  document.getElementById("fit").onclick     = fitToScreen;
  svg.style.cursor = "grab";
  addEventListener("resize", fitToScreen);
}

/* --- 4. tooltip -------------------------------------------------------- */
const tipEl=document.getElementById("tip");
function tip(e,it){
  tipEl.innerHTML=`<b>${esc(it.q.speaker)} · ${esc(it.s.edition)}</b>${esc(it.q.quote.slice(0,180))}${it.q.quote.length>180?"…":""}`;
  tipEl.style.opacity=1; moveTip(e);
}
function moveTip(e){
  const p=12, w=tipEl.offsetWidth, h=tipEl.offsetHeight;
  tipEl.style.left=Math.min(e.clientX+p, innerWidth-w-p)+"px";
  tipEl.style.top=Math.min(e.clientY+p, innerHeight-h-p)+"px";
}
function hideTip(){ tipEl.style.opacity=0; }

/* --- 5. detail panel --------------------------------------------------- */
function open_(i){
  const {s,q}=ITEMS[i];
  document.getElementById("detailBody").innerHTML=`
    <blockquote>« ${esc(q.quote)} »</blockquote>
    ${q.translation?`<p class="tr">${esc(q.translation)}</p>`:""}
    <p class="who">${esc(q.speaker)}</p>
    <p class="role">${esc(q.role)}</p>
    <p class="src" style="margin-top:1rem">${esc(s.title)} · ${esc(q.timecode)}${q.theme?" · "+esc(q.theme):""}</p>
    <a class="watch" href="${q.seek_url}" target="_blank" rel="noopener">Watch in the video</a>`;
  document.getElementById("detail").classList.add("open");
  activeTheme=q.theme;
}
document.getElementById("closeDetail").onclick=()=>document.getElementById("detail").classList.remove("open");

/* --- 6. presentation mode --------------------------------------------- */
// --- mode présentation ---------------------------------------------------
function startStory(){
  storyList = activeTheme ? ITEMS.filter(it=>it.q.theme===activeTheme) : ITEMS.slice();
  if(!storyList.length) storyList=ITEMS.slice();
  storyList.sort((a,b)=> a.s.date.localeCompare(b.s.date) || a.q.start_sec-b.q.start_sec);
  storyIdx=0; document.getElementById("story").classList.add("on"); showStory();
}
function showStory(){
  const {s,q}=storyList[storyIdx];
  document.getElementById("sTheme").textContent=[q.theme,s.edition].filter(Boolean).join(" · ");
  document.getElementById("sQuote").textContent="« "+q.quote+" »";
  document.getElementById("sTr").textContent=q.translation||"";
  document.getElementById("sWho").innerHTML=`${esc(q.speaker)} <span>— ${esc(q.role)}</span>`;
  document.getElementById("prog").style.width=((storyIdx+1)/storyList.length*100)+"%";
}
function step(n){
  storyIdx=(storyIdx+n+storyList.length)%storyList.length; showStory();
}
document.getElementById("playBtn").onclick=startStory;
document.getElementById("story").onclick=()=>step(1);
addEventListener("keydown",e=>{
  const on=document.getElementById("story").classList.contains("on");
  if(e.key==="Escape"){ document.getElementById("story").classList.remove("on");
    document.getElementById("detail").classList.remove("open"); }
  if(!on) return;
  if(e.key==="ArrowRight"||e.key===" "){e.preventDefault();step(1);}
  if(e.key==="ArrowLeft"){e.preventDefault();step(-1);}
});

/* --- 7. dataset loader ------------------------------------------------- */
(function(){
  const ids=window.SESSIONS_MANIFEST||[];
  let left=ids.length; if(!left){boot();return;}
  ids.forEach(id=>{const sc=document.createElement("script");sc.src=`data/${id}.js`;
    sc.onload=sc.onerror=()=>{if(--left===0) boot();};document.body.appendChild(sc);});
})();
