/* =========================================================================
   CoRstellation — fifteen years of CoR photo albums

   1 configuration · 2 colour ramp · 3 field engine · 4 galaxy layout
   5 galaxy render · 6 level of detail · 7 labels · 8 album field
   9 lightbox · 10 boot

   The field engine is written once and used twice: the galaxy of albums and
   the photographs inside an album behave identically — same drag, same zoom,
   same momentum. Entering an album changes the contents, not the interface.
   ========================================================================= */

/* --- 1. configuration --------------------------------------------------- */

const FLICKR_KEY  = window.FLICKR_KEY || "METTRE_LA_CLE_ICI";
const FLICKR_NSID = "62673028@N02";
const ALBUMS      = window.CORSTELLATION_ALBUMS || [];

// https://live.staticflickr.com/{server}/{id}_{secret}_{size}.jpg
// q = 150 px square, n = 320 px, b = 1024 px.
const photoUrl = (server, id, secret, size) =>
  `https://live.staticflickr.com/${server}/${id}_${secret}_${size}.jpg`;

const ARMS    = 3;
const TURNS   = 2.1;
const R_INNER = 80;
const R_OUTER = 880;
const K_START = 0.62;
const K_COVER = 0.55;      // au-dela, les pastilles deviennent des couvertures

const esc = t => String(t || "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const yearOf = a => a.d.slice(0, 4);

function notice(text){
  const el = document.getElementById("notice");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
}

/* --- 2. colour ramp ----------------------------------------------------- */
// Le temps se lit dans la couleur : bleu roi en 2011, or en 2026. Une rampe
// continue plutot qu'une couleur par annee - l'oeil suit une progression.

const RAMP = [
  [224, 76, 52], [214, 80, 58], [199, 74, 58],
  [180, 62, 58], [ 96, 52, 58], [ 52, 88, 62], [ 44, 94, 66]
];

function ramp(t){
  const x = Math.max(0, Math.min(0.999, t)) * (RAMP.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  return `hsl(${(a[0] + (b[0] - a[0]) * f).toFixed(0)} ` +
         `${(a[1] + (b[1] - a[1]) * f).toFixed(0)}% ` +
         `${(a[2] + (b[2] - a[2]) * f).toFixed(0)}%)`;
}

/* --- 3. field engine ---------------------------------------------------- */
// Un champ : une scene, un calque transforme, une vue qui glisse vers une
// cible. Le calque unique laisse le GPU composer le deplacement ; la cible
// donne l'inertie et la glisse, sans bibliotheque d'animation.

function makeField(stage, world, opts){
  const o = Object.assign({ kMin: 0.08, kMax: 8, onTick: null }, opts || {});
  const view   = { x: 0, y: 0, k: 1 };
  const target = { x: 0, y: 0, k: 1 };
  let raf = null, bounds = null, enabled = false;

  function tick(){
    const e = 0.18;
    view.x += (target.x - view.x) * e;
    view.y += (target.y - view.y) * e;
    view.k += (target.k - view.k) * e;

    world.style.transform =
      `translate(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px) scale(${view.k.toFixed(4)})`;

    if (o.onTick) o.onTick(view);

    const moving = Math.abs(target.x - view.x) > 0.3 ||
                   Math.abs(target.y - view.y) > 0.3 ||
                   Math.abs(target.k - view.k) > 0.0008;
    raf = moving ? requestAnimationFrame(tick) : null;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function zoomAt(px, py, factor){
    // Dezoomer au-dela du cadrage d'ouverture est une facon naturelle de
    // ressortir : dans un album, c'est le geste qui ramene a la galaxie.
    if (factor < 1 && o.onZoomOutPast && target.k <= o.onZoomOutPast.threshold()) {
      o.onZoomOutPast.action();
      return;
    }
    const k = Math.max(o.kMin, Math.min(o.kMax, target.k * factor));
    // Le point sous le curseur reste immobile : c'est ce qui evite de se perdre.
    target.x = px - (px - target.x) * (k / target.k);
    target.y = py - (py - target.y) * (k / target.k);
    target.k = k;
    kick();
  }

  function centreOn(x, y, k){
    target.k = k;
    target.x = innerWidth  / 2 - x * k;
    target.y = innerHeight / 2 - y * k;
    kick();
  }

  let fitK = 1;
  function showAll(pad = 80){
    if (!bounds) return;
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    const k = Math.max(o.kMin,
      Math.min((innerWidth - pad * 2) / bw, (innerHeight - pad * 2) / bh));
    fitK = k;
    centreOn(bounds.x0 + bw / 2, bounds.y0 + bh / 2, k);
  }

  // --- gestes ------------------------------------------------------------
  let drag = null, vx = 0, vy = 0, lastX = 0, lastY = 0, lastT = 0, pinch = null;

  stage.addEventListener("wheel", e => {
    if (!enabled) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });

  stage.addEventListener("pointerdown", e => {
    if (!enabled || e.target.closest("[data-item]")) return;
    drag = { px: e.clientX, py: e.clientY, tx: target.x, ty: target.y };
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    vx = vy = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
  });

  stage.addEventListener("pointermove", e => {
    if (!drag) return;
    const now = performance.now(), dt = Math.max(1, now - lastT);
    vx = (e.clientX - lastX) / dt;
    vy = (e.clientY - lastY) / dt;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    target.x = drag.tx + (e.clientX - drag.px);
    target.y = drag.ty + (e.clientY - drag.py);
    view.x = target.x; view.y = target.y;      // pas de retard pendant le geste
    kick();
  });

  const release = () => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("dragging");
    target.x += Math.max(-700, Math.min(700, vx * 150));    // inertie
    target.y += Math.max(-700, Math.min(700, vy * 150));
    kick();
  };
  ["pointerup", "pointercancel", "pointerleave"]
    .forEach(t => stage.addEventListener(t, release));

  stage.addEventListener("touchstart", e => {
    if (!enabled || e.touches.length !== 2) return;
    drag = null;
    const a = e.touches[0], b = e.touches[1];
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  }, { passive: true });

  stage.addEventListener("touchmove", e => {
    if (!enabled || e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const a = e.touches[0], b = e.touches[1];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, pinch.d / d);
    pinch.d = d;
  }, { passive: false });

  stage.addEventListener("touchend", () => { pinch = null; }, { passive: true });
  stage.addEventListener("dblclick", e => { if (enabled) zoomAt(e.clientX, e.clientY, 2); });

  return {
    view, target, kick, zoomAt, centreOn, showAll,
    setBounds(b){ bounds = b; },
    fitScale(){ return fitK; },
    enable(v){ enabled = v; },
    isEnabled(){ return enabled; }
  };
}

/* --- 4. galaxy layout --------------------------------------------------- */
// Trois bras en spirale, parcourus dans l'ordre chronologique : 2011 pres du
// centre, 2026 au bord. La densite d'une annee se lit d'un coup d'oeil.

let nodes = [];

function layoutGalaxy(){
  const n = ALBUMS.length;
  let seed = 20260914;                        // graine : disposition stable
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const placed = [];

  nodes = ALBUMS.map((a, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = 4 + 2.1 * Math.sqrt(a.n);

    let rad = R_INNER + (R_OUTER - R_INNER) * Math.pow(t, 0.78);
    let ang = t * TURNS * Math.PI * 2 + (i % ARMS) * (Math.PI * 2 / ARMS);
    ang += (rnd() - 0.5) * 0.34;
    rad *= 1 + (rnd() - 0.5) * 0.14;

    let x = rad * Math.cos(ang), y = rad * Math.sin(ang), guard = 0;
    while (guard++ < 500 &&
           placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 5)) {
      rad += r * 0.45;
      x = rad * Math.cos(ang); y = rad * Math.sin(ang);
    }
    placed.push({ x, y, r });
    return { a, x, y, r, t, el: null, label: null, labelW: 0,
             mode: null, cover: null, onScreen: false, sx: 0, sy: 0 };
  });

  const pad = 60;
  return {
    x0: Math.min.apply(null, nodes.map(p => p.x - p.r)) - pad,
    y0: Math.min.apply(null, nodes.map(p => p.y - p.r)) - pad,
    x1: Math.max.apply(null, nodes.map(p => p.x + p.r)) + pad,
    y1: Math.max.apply(null, nodes.map(p => p.y + p.r)) + pad
  };
}

/* --- 5. galaxy render --------------------------------------------------- */

const world = document.getElementById("world");

function renderGalaxy(){
  const frag = document.createDocumentFragment();

  nodes.forEach(node => {
    const d = document.createElement("div");
    d.className    = "album";
    d.dataset.item = "1";
    d.style.left   = node.x + "px";
    d.style.top    = node.y + "px";
    d.style.width  = d.style.height = (node.r * 2) + "px";
    d.style.color  = ramp(node.t);
    d.title = `${node.a.t} — ${node.a.n} photos`;
    d.onclick = e => { e.stopPropagation(); enterAlbum(node); };
    node.el = d;
    if (node.a.p && node.a.s && node.a.c) {
      node.cover = photoUrl(node.a.s, node.a.p, node.a.c, "q");
    }
    frag.appendChild(d);

    const l = document.createElement("div");
    l.className  = "label";
    l.style.left = node.x + "px";
    l.innerHTML  = `${esc(node.a.t.slice(0, 44))}` +
                   `<small>${yearOf(node.a)} · ${node.a.n} photos</small>`;
    node.label  = l;
    node.labelW = Math.min(44, node.a.t.length) * 6.6 + 12;   // largeur estimee
    frag.appendChild(l);
  });

  world.appendChild(frag);

  const years = [];
  ALBUMS.forEach(a => { const y = yearOf(a); if (years.indexOf(y) < 0) years.push(y); });
  years.sort();

  document.getElementById("years").innerHTML = years.map((y, i) => {
    const ph = ALBUMS.filter(a => yearOf(a) === y).reduce((s, a) => s + a.n, 0);
    const c  = ramp(i / Math.max(1, years.length - 1));
    return `<span style="border-left-color:${c}">` +
           `<b style="color:${c}">${y}</b>${ph.toLocaleString("en")}</span>`;
  }).join("");

  const total = ALBUMS.reduce((s, a) => s + a.n, 0);
  document.getElementById("sub").textContent =
    `${ALBUMS.length.toLocaleString("en")} albums · ` +
    `${total.toLocaleString("en")} photographs · ` +
    `${years[0]}–${years[years.length - 1]}`;
}

/* --- 6. level of detail ------------------------------------------------- */
// Seuls les albums a l'ecran sont traites : poser mille deux cents couvertures
// couterait une seconde a chaque image.

let detailPass = 0;

function updateDetail(view){
  if (++detailPass % 3) return;
  const k = view.k, pad = 260;

  nodes.forEach(node => {
    const sx = node.x * k + view.x, sy = node.y * k + view.y;
    node.sx = sx; node.sy = sy;
    node.onScreen = sx > -pad && sx < innerWidth + pad &&
                    sy > -pad && sy < innerHeight + pad;

    const want = (node.onScreen && k >= K_COVER && node.cover) ? "cover" : "dot";
    if (want !== node.mode) {
      if (want === "cover") {
        node.el.style.backgroundImage = `url(${node.cover})`;
        node.el.classList.add("cover");
      } else {
        node.el.style.backgroundImage = "";
        node.el.classList.remove("cover");
      }
      node.mode = want;
    }
  });

  placeLabels(k);
}

/* --- 7. labels ---------------------------------------------------------- */
// Tout afficher les rend illisibles ; en afficher un nombre fixe les laisse se
// chevaucher. On procede donc par priorite : les albums les plus fournis
// d'abord, et chaque titre n'est retenu que s'il ne recouvre aucun de ceux
// deja places. Le calcul se fait en coordonnees ecran, et le nombre affiche
// s'ajuste de lui-meme a la densite du moment.

const LABEL_H    = 30;
const LABEL_MAX  = 22;
const LABEL_MIN_R = 26;   // rayon a l'ecran, en pixels

function placeLabels(k){
  // Un titre n'apparait que lorsque son album est assez gros a l'ecran, c'est
  // a dire lorsqu'on s'en est approche. De loin, la galaxie reste une forme ;
  // les noms arrivent quand ils deviennent utiles.
  const cands = nodes
    .filter(n => n.onScreen && n.r * k >= LABEL_MIN_R)
    .sort((a, b) => b.r - a.r);

  const taken = [];
  let shown = 0;

  for (let i = 0; i < cands.length; i++) {
    const n = cands[i];
    let ok = shown < LABEL_MAX;
    if (ok) {
      const w = n.labelW, h = LABEL_H;
      const x = n.sx - w / 2, y = n.sy + n.r * k + 6;
      for (let j = 0; j < taken.length; j++) {
        const t = taken[j];
        if (x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y) { ok = false; break; }
      }
      if (ok) { taken.push({ x, y, w, h }); shown++; }
    }
    setLabel(n, ok, k);
  }
  nodes.forEach(n => { if (!n.onScreen) setLabel(n, false, k); });
}

function setLabel(n, show, k){
  if (!n.label) return;
  if (show) {
    n.label.style.top = (n.y + n.r + 6) + "px";
    n.label.style.transform = `translate(-50%,0) scale(${(1 / k).toFixed(3)})`;
  }
  if (show !== n.label.classList.contains("show")) {
    n.label.classList.toggle("show", show);
  }
}

/* --- 8. album field ----------------------------------------------------- */
// Le meme moteur, un autre contenu : les photographies forment a leur tour un
// champ que l'on parcourt. Une grille aurait impose un autre geste au milieu
// d'une exploration.

const photoCache = new Map();
let current    = { list: [], index: 0 };
let albumField = null;

async function fetchPhotos(albumId){
  if (photoCache.has(albumId)) return photoCache.get(albumId);
  const u = "https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos" +
            `&api_key=${FLICKR_KEY}&photoset_id=${albumId}&user_id=${FLICKR_NSID}` +
            "&per_page=500&format=json&nojsoncallback=1";
  try {
    const r = await fetch(u);
    const j = await r.json();
    const list = (j.photoset && j.photoset.photo) ? j.photoset.photo : [];
    if (!list.length && j.stat === "fail") notice("Flickr: " + (j.message || "request refused"));
    photoCache.set(albumId, list);
    return list;
  } catch (err) {
    notice("Flickr API unreachable — check the key in index.html.");
    photoCache.set(albumId, []);
    return [];
  }
}

async function enterAlbum(node){
  const box = document.getElementById("album");
  document.getElementById("aTitle").textContent = node.a.t;
  document.getElementById("aMeta").textContent =
    `${node.a.n.toLocaleString("en")} photographs · ` +
    new Date(node.a.d).toLocaleDateString("en-GB",
      { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("aFlickr").href =
    `https://www.flickr.com/photos/cor-photos/albums/${node.a.i}`;

  const pworld = document.getElementById("pworld");
  pworld.innerHTML = "";
  box.hidden = false;
  galaxy.enable(false);
  hideHint();

  const list = await fetchPhotos(node.a.i);
  if (box.hidden) return;
  current = { list, index: 0 };

  // Semis en phyllotaxie : dense, regulier, sans chevauchement, et la forme
  // repond a celle de la galaxie.
  const S = 120;
  const frag = document.createDocumentFragment();
  let maxR = 0;

  list.forEach((p, i) => {
    const ang = i * 2.3999632;
    const rad = S * 0.70 * Math.sqrt(i);
    const x = rad * Math.cos(ang), y = rad * Math.sin(ang);
    if (rad > maxR) maxR = rad;

    const d = document.createElement("div");
    d.className    = "photo";
    d.dataset.item = "1";
    d.style.left   = x + "px";
    d.style.top    = y + "px";
    d.style.width  = d.style.height = S + "px";
    d.style.backgroundImage = `url(${photoUrl(p.server, p.id, p.secret, "q")})`;
    d.title = p.title || "";
    d.onclick = e => { e.stopPropagation(); openLight(i); };
    frag.appendChild(d);
  });
  pworld.appendChild(frag);

  const b = maxR + S;
  albumField.setBounds({ x0: -b, y0: -b, x1: b, y1: b });
  albumField.enable(true);
  albumField.showAll(90);

  const more = document.getElementById("aMore");
  if (node.a.n > list.length) {
    more.textContent =
      `Showing the first ${list.length} of ${node.a.n} photographs — the rest are on Flickr.`;
    more.hidden = false;
  } else {
    more.hidden = true;
  }
}

function leaveAlbum(){
  document.getElementById("album").hidden = true;
  document.getElementById("pworld").innerHTML = "";
  if (albumField) albumField.enable(false);
  galaxy.enable(true);
  galaxy.kick();
}

/* --- 9. lightbox -------------------------------------------------------- */

function openLight(i){
  if (!current.list.length) return;
  current.index = (i + current.list.length) % current.list.length;
  const p = current.list[current.index];
  const img = document.getElementById("lightImg");
  img.src = photoUrl(p.server, p.id, p.secret, "b");
  img.alt = p.title || "";
  document.getElementById("lightCap").textContent =
    `${p.title || "Untitled"} · ${current.index + 1} of ${current.list.length}`;
  document.getElementById("light").hidden = false;
}

function closeLight(){ document.getElementById("light").hidden = true; }
function stepLight(d){ openLight(current.index + d); }

/* --- 10. boot ----------------------------------------------------------- */

let hintTimer = null;
function hideHint(){
  const h = document.getElementById("hint");
  if (!h || h.classList.contains("gone")) return;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add("gone"), 800);
}

const galaxy = makeField(
  document.getElementById("stage"),
  world,
  { kMin: 0.10, kMax: 8, onTick: updateDetail }
);

function active(){
  return (albumField && albumField.isEnabled()) ? albumField : galaxy;
}

(function(){
  if (!ALBUMS.length) {
    document.getElementById("sub").textContent = "No album data loaded.";
    return;
  }
  if (!FLICKR_KEY || FLICKR_KEY === "METTRE_LA_CLE_ICI") {
    notice("No Flickr key set in index.html — covers and photographs will not load.");
  } else if (!ALBUMS.some(a => a.p && a.s && a.c)) {
    notice("Album data has no cover fields (p, s, c) — re-export to see the covers.");
  }

  galaxy.setBounds(layoutGalaxy());
  renderGalaxy();
  galaxy.enable(true);

  albumField = makeField(
    document.getElementById("pstage"),
    document.getElementById("pworld"),
    { kMin: 0.12, kMax: 6,
      onZoomOutPast: {
        threshold: () => albumField.fitScale() * 0.82,
        action:    () => leaveAlbum()
      } }
  );

  document.getElementById("zoomIn").onclick  =
    () => active().zoomAt(innerWidth / 2, innerHeight / 2, 1.6);
  document.getElementById("zoomOut").onclick =
    () => active().zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.6);
  document.getElementById("showAll").onclick = () => active().showAll();

  document.getElementById("back").onclick       = leaveAlbum;
  document.getElementById("lightClose").onclick = closeLight;
  document.getElementById("lightPrev").onclick  = () => stepLight(-1);
  document.getElementById("lightNext").onclick  = () => stepLight(1);
  document.getElementById("light").onclick      =
    e => { if (e.target.id === "light") closeLight(); };

  addEventListener("keydown", e => {
    if (!document.getElementById("light").hidden) {
      if (e.key === "Escape")     closeLight();
      if (e.key === "ArrowRight") stepLight(1);
      if (e.key === "ArrowLeft")  stepLight(-1);
      return;
    }
    if (!document.getElementById("album").hidden && e.key === "Escape") {
      leaveAlbum();
      return;
    }
    const f = active();
    if (e.key === "+" || e.key === "=") f.zoomAt(innerWidth / 2, innerHeight / 2, 1.5);
    if (e.key === "-")                  f.zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.5);
    if (e.key === "0")                  f.showAll();
    const step = 150;
    if (e.key === "ArrowLeft")  { f.target.x += step; f.kick(); }
    if (e.key === "ArrowRight") { f.target.x -= step; f.kick(); }
    if (e.key === "ArrowUp")    { f.target.y += step; f.kick(); }
    if (e.key === "ArrowDown")  { f.target.y -= step; f.kick(); }
  });

  addEventListener("resize", () => active().kick());

  // On ouvre sur le coeur de la galaxie plutot que sur l'ensemble : mille deux
  // cents disques vus de tres loin ne sont qu'une brume.
  galaxy.centreOn(0, 0, K_START);
  setTimeout(hideHint, 6000);
})();
