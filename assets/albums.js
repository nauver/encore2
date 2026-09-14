/* =========================================================================
   enCoR — album constellation
   Purpose: fifteen years of CoR photo albums as one navigable field.
   Sections: 1 state · 2 layout · 3 render · 4 view loop · 5 input
             6 panel · 7 boot

   Two choices drive the feel:
   - the world is a single transformed layer, so panning and zooming are
     composited by the GPU rather than re-laid out on every frame;
   - the view is animated towards a target rather than set directly, which
     gives inertia on release and a smooth glide when zooming. That is what
     makes it usable on a wall display, where abrupt jumps read as glitches.
   ========================================================================= */

/* --- 1. state ----------------------------------------------------------- */

const ALBUMS = window.FLICKR_ALBUMS || [];
const PALETTE = ["#C4562E","#1F6B5C","#7A5C9E","#2B4EA8","#8A6A2F","#4A7C59","#A0433A"];

const view   = { x:0, y:0, k:1 };        // ce qui est affiche
const target = { x:0, y:0, k:1 };        // ce vers quoi on glisse
let nodes = [], bounds = null, selected = null, raf = null;

const world = document.getElementById("world");
const stage = document.getElementById("stage");

const esc = t => String(t||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const yearOf = a => a.d.slice(0,4);

/* --- 2. layout: a spiral of time ---------------------------------------- */
// Les albums sont ranges par date sur une spirale d'Archimede : 2011 au
// centre, 2026 a la peripherie. La densite d'une annee se lit donc a l'oeil,
// et le creux de 2020-2021 apparait comme une respiration dans le motif.
// Chaque disque est ecarte tant qu'il chevauche un voisin : aucun
// recouvrement, sans simulation physique.

function layout(){
  const placed = [];
  let step = 0;

  nodes = ALBUMS.map((a, i) => {
    const r = 5 + 2.6 * Math.sqrt(a.n);          // rayon selon le nombre de photos
    let x = 0, y = 0;

    for (;;){
      step += 0.55;
      const ang = step * 0.42;
      const rad = 26 * Math.sqrt(step);
      x = rad * Math.cos(ang);
      y = rad * Math.sin(ang);
      const clash = placed.some(p =>
        Math.hypot(p.x - x, p.y - y) < (p.r + r + 7));
      if (!clash) break;
      if (step > 1e5) break;                      // garde-fou
    }
    placed.push({ x, y, r });
    return { a, x, y, r, el:null, label:null };
  });

  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const rs = nodes.map(n => n.r);
  bounds = {
    x0: Math.min(...xs.map((v,i)=>v-rs[i])) - 60,
    y0: Math.min(...ys.map((v,i)=>v-rs[i])) - 60,
    x1: Math.max(...xs.map((v,i)=>v+rs[i])) + 60,
    y1: Math.max(...ys.map((v,i)=>v+rs[i])) + 60
  };
}

/* --- 3. render ---------------------------------------------------------- */

function render(){
  const years = [...new Set(ALBUMS.map(yearOf))].sort();
  const colOf = y => PALETTE[years.indexOf(y) % PALETTE.length];

  const frag = document.createDocumentFragment();
  nodes.forEach(n => {
    const d = document.createElement("div");
    d.className = "album";
    d.style.left   = n.x + "px";
    d.style.top    = n.y + "px";
    d.style.width  = d.style.height = (n.r * 2) + "px";
    d.style.color  = colOf(yearOf(n.a));
    d.title = `${n.a.t} — ${n.a.n} photos`;
    d.onclick = e => { e.stopPropagation(); openAlbum(n); };
    n.el = d;
    frag.appendChild(d);

    // Les libelles n'existent que pour les albums consequents : mille deux
    // cents etiquettes seraient illisibles et couteuses a afficher.
    if (n.a.n >= 120){
      const l = document.createElement("div");
      l.className = "label";
      l.style.left = n.x + "px";
      l.style.top  = (n.y + n.r + 6) + "px";
      l.innerHTML = `${esc(n.a.t.slice(0,46))}<small>${n.a.d.slice(0,4)} · ${n.a.n} photos</small>`;
      n.label = l;
      frag.appendChild(l);
    }
  });
  world.appendChild(frag);

  document.getElementById("years").innerHTML = years.map(y => {
    const list = ALBUMS.filter(a => yearOf(a) === y);
    const ph = list.reduce((s,a) => s + a.n, 0);
    return `<span><b>${y}</b>${ph.toLocaleString("en")}</span>`;
  }).join("");

  const total = ALBUMS.reduce((s,a) => s + a.n, 0);
  document.getElementById("sub").textContent =
    `${ALBUMS.length.toLocaleString("en")} albums · ${total.toLocaleString("en")} photographs · ${years[0]}–${years[years.length-1]}`;
}

/* --- 4. view loop ------------------------------------------------------- */
// On n'ecrit jamais la transformation directement : on approche la cible d'un
// facteur constant par image. C'est ce qui donne l'inertie a la fin d'un
// glissement et la glisse du zoom, sans bibliotheque d'animation.

function tick(){
  const e = 0.18;
  view.x += (target.x - view.x) * e;
  view.y += (target.y - view.y) * e;
  view.k += (target.k - view.k) * e;

  world.style.transform = `translate(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px) scale(${view.k.toFixed(4)})`;

  // Les libelles apparaissent quand l'echelle les rend lisibles, et se
  // contre-echellent pour garder une taille constante a l'ecran.
  const show = view.k > 0.42;
  nodes.forEach(n => {
    if (!n.label) return;
    if (show !== n.label.classList.contains("show")) n.label.classList.toggle("show", show);
    if (show) n.label.style.transform = `translate(-50%,0) scale(${(1/view.k).toFixed(3)})`;
  });

  const moving = Math.abs(target.x-view.x) > .3 || Math.abs(target.y-view.y) > .3 ||
                 Math.abs(target.k-view.k) > .0008;
  raf = moving ? requestAnimationFrame(tick) : null;
}
function kick(){ if (!raf) raf = requestAnimationFrame(tick); }

function zoomAt(px, py, factor){
  const k = Math.max(0.06, Math.min(6, target.k * factor));
  // On garde le point sous le doigt immobile : c'est ce qui evite de se perdre.
  target.x = px - (px - target.x) * (k / target.k);
  target.y = py - (py - target.y) * (k / target.k);
  target.k = k;
  kick();
}

function fit(pad = 90){
  const w = innerWidth, h = innerHeight;
  const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
  const k = Math.min((w - pad*2) / bw, (h - pad*2) / bh);
  target.k = k;
  target.x = w/2 - (bounds.x0 + bw/2) * k;
  target.y = h/2 - (bounds.y0 + bh/2) * k;
  kick();
}

function focusNode(n, k = 1.6){
  target.k = k;
  target.x = innerWidth/2  - n.x * k;
  target.y = innerHeight/2 - n.y * k;
  kick();
}

/* --- 5. input: mouse, wheel, touch, keyboard ---------------------------- */

function installInput(){
  let drag = null, moved = false, vx = 0, vy = 0, lastT = 0;

  stage.addEventListener("wheel", e => {
    e.preventDefault();
    hideHint();
    // Molette classique et pave tactile : on lisse l'amplitude pour eviter
    // les sauts d'un cran a l'autre.
    const f = Math.exp(-e.deltaY * 0.0016);
    zoomAt(e.clientX, e.clientY, f);
  }, { passive:false });

  stage.addEventListener("pointerdown", e => {
    if (e.target.closest(".album")) return;
    drag = { px:e.clientX, py:e.clientY, tx:target.x, ty:target.y };
    moved = false; vx = vy = 0; lastT = performance.now();
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
    hideHint();
  });

  stage.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const now = performance.now(), dt = Math.max(1, now - lastT);
    vx = (e.clientX - (drag.px + (target.x - drag.tx))) / dt;
    vy = (e.clientY - (drag.py + (target.y - drag.ty))) / dt;
    lastT = now;
    target.x = drag.tx + dx;
    target.y = drag.ty + dy;
    view.x = target.x; view.y = target.y;    // pendant le glissement, pas de retard
    kick();
  });

  const release = () => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("dragging");
    // Inertie : on prolonge le geste puis on laisse la boucle amortir.
    target.x += Math.max(-600, Math.min(600, vx * 140));
    target.y += Math.max(-600, Math.min(600, vy * 140));
    kick();
  };
  ["pointerup","pointercancel","pointerleave"].forEach(t => stage.addEventListener(t, release));

  // Pincement a deux doigts.
  let pinch = null;
  stage.addEventListener("touchstart", e => {
    if (e.touches.length !== 2) return;
    drag = null;
    const [a,b] = e.touches;
    pinch = { d: Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY) };
  }, { passive:true });
  stage.addEventListener("touchmove", e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const [a,b] = e.touches;
    const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
    zoomAt((a.clientX+b.clientX)/2, (a.clientY+b.clientY)/2, d / pinch.d);
    pinch.d = d;
  }, { passive:false });
  stage.addEventListener("touchend", () => { pinch = null; }, { passive:true });

  // Double-clic et double-tap : plonger.
  stage.addEventListener("dblclick", e => zoomAt(e.clientX, e.clientY, 2));
  let lastTap = 0;
  stage.addEventListener("pointerup", e => {
    if (e.pointerType !== "touch" || moved) return;
    const now = performance.now();
    if (now - lastTap < 320) zoomAt(e.clientX, e.clientY, 2);
    lastTap = now;
  });

  addEventListener("keydown", e => {
    if (e.key === "Escape") closePanel();
    if (e.key === "+" || e.key === "=") zoomAt(innerWidth/2, innerHeight/2, 1.5);
    if (e.key === "-") zoomAt(innerWidth/2, innerHeight/2, 1/1.5);
    if (e.key === "0") fit();
    const step = 140;
    if (e.key === "ArrowLeft")  { target.x += step; kick(); }
    if (e.key === "ArrowRight") { target.x -= step; kick(); }
    if (e.key === "ArrowUp")    { target.y += step; kick(); }
    if (e.key === "ArrowDown")  { target.y -= step; kick(); }
  });

  document.getElementById("zIn").onclick  = () => zoomAt(innerWidth/2, innerHeight/2, 1.6);
  document.getElementById("zOut").onclick = () => zoomAt(innerWidth/2, innerHeight/2, 1/1.6);
  document.getElementById("fit").onclick  = () => { closePanel(); fit(); };
  addEventListener("resize", () => fit());
}

let hintTimer = null;
function hideHint(){
  const h = document.getElementById("hint");
  if (!h || h.classList.contains("gone")) return;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add("gone"), 900);
}

/* --- 6. panel ----------------------------------------------------------- */

function openAlbum(n){
  if (selected) selected.el.classList.remove("on");
  selected = n;
  n.el.classList.add("on");

  document.getElementById("pTitle").textContent = n.a.t;
  document.getElementById("pMeta").textContent =
    `${n.a.n.toLocaleString("en")} photographs · created ${new Date(n.a.d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`;
  document.getElementById("pOpen").href =
    `https://www.flickr.com/photos/cor-photos/albums/${n.a.i}`;
  document.getElementById("panel").classList.add("open");
  focusNode(n, Math.max(target.k, 1.2));
  hideHint();
}

function closePanel(){
  document.getElementById("panel").classList.remove("open");
  if (selected) { selected.el.classList.remove("on"); selected = null; }
}
document.getElementById("close").onclick = closePanel;

/* --- 7. boot ------------------------------------------------------------ */

(function(){
  if (!ALBUMS.length){
    document.getElementById("sub").textContent = "No album data loaded.";
    return;
  }
  layout();
  render();
  installInput();
  fit();
  setTimeout(() => hideHint(), 6000);
})();
