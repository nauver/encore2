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
const R_OUTER = 1010;   // desserre : il faut du fond pour saisir le champ
const K_START = 0.62;
const K_COVER = 0.55;      // au-dela, les pastilles deviennent des couvertures
const K_ENTER = 3.2;       // au-dela, la planete centree s'ouvre d'elle-meme

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

  // On glisse depuis n'importe ou, y compris depuis une planete : sur un ecran
  // tactile, il n'y a pas assez de fond entre les objets pour saisir le champ.
  // Ce qui distingue un clic d'un deplacement, c'est la distance parcourue.
  stage.addEventListener("pointerdown", e => {
    if (!enabled) return;
    drag = { px: e.clientX, py: e.clientY, tx: target.x, ty: target.y, moved: false };
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
    if (Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py) > 6) drag.moved = true;
    target.x = drag.tx + (e.clientX - drag.px);
    target.y = drag.ty + (e.clientY - drag.py);
    view.x = target.x; view.y = target.y;      // pas de retard pendant le geste
    kick();
  });

  // setPointerCapture redirige l'evenement "click" vers la scene : le
  // gestionnaire pose sur une planete ne le recoit jamais. On decide donc
  // nous-memes, au relachement, s'il s'agissait d'un tap, et on retrouve
  // l'objet vise par sa position a l'ecran.
  function release(e){
    if (!drag) return;
    const wasTap = !drag.moved;
    drag = null;
    stage.classList.remove("dragging");

    if (wasTap && e && o.onTap) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const item = el && el.closest ? el.closest("[data-item]") : null;
      if (item) { o.onTap(item); return; }        // un tap ne lance pas d'inertie
    }

    target.x += Math.max(-700, Math.min(700, vx * 150));    // inertie
    target.y += Math.max(-700, Math.min(700, vy * 150));
    kick();
  }
  stage.addEventListener("pointerup", release);
  // Un depart du pointeur n'est pas un tap : on termine le glissement sans
  // declencher d'ouverture.
  ["pointercancel", "pointerleave"]
    .forEach(t => stage.addEventListener(t, () => release(null)));

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
    // Ecarter les doigts agrandit : le facteur est donc la distance nouvelle
    // sur l'ancienne, et non l'inverse.
    zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, d / pinch.d);
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

/* --- 3bis. topics ------------------------------------------------------- */
// Les themes sont tires des titres d'albums, pas des mots-cles des photos :
// les titres suivent la nomenclature de l'institution et sont bien plus
// reguliers. Un album peut en porter plusieurs - c'est ce qui donne au nuage
// sa forme. Ceux qui n'en portent aucun ne sont pas forces dans une categorie :
// ce sont des occasions, pas des sujets, et ils restent visibles a la peripherie.

const TOPICS = (window.CORSTELLATION_TOPICS || []).map(t => ({
  name: t.name, re: new RegExp(t.rx, "i"), albums: []
}));

function tagAlbums(){
  nodes.forEach(n => {
    n.topics = TOPICS.filter(t => t.re.test(n.a.t));
    n.topics.forEach(t => t.albums.push(n));
  });
  // Les themes vides ne meritent pas un amas.
  for (let i = TOPICS.length - 1; i >= 0; i--) {
    if (!TOPICS[i].albums.length) TOPICS.splice(i, 1);
  }
  TOPICS.sort((a, b) => b.albums.length - a.albums.length);
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
           placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 16)) {
      rad += r * 0.45;
      x = rad * Math.cos(ang); y = rad * Math.sin(ang);
    }
    placed.push({ x, y, r });
    return { a, x, y, r, t, el: null, hx: x, hy: y, tx: x, ty: y, topics: [],
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

/* --- 4bis. topic layout -------------------------------------------------
   Les memes objets, une autre organisation : un amas par theme, dispose en
   spirale de phyllotaxie, et a l'interieur de chaque amas les albums semes de
   la meme facon. Un album porteur de plusieurs themes rejoint le plus petit
   d'entre eux - celui ou il compte le plus.

   Les positions sont calculees une fois pour toutes ; la bascule se contente
   de les appliquer, ce qui permet de l'animer.
------------------------------------------------------------------------- */

let topicClusters = [];
let timeBounds = null, topicBounds = null;

function layoutTopics(){
  // Chaque album n'apparait qu'une fois : on le rattache au theme le moins
  // frequent qu'il porte, sinon les gros themes avaleraient tout.
  const home = new Map();
  nodes.forEach(n => {
    if (!n.topics.length) return;
    const t = n.topics.reduce((a, b) => a.albums.length <= b.albums.length ? a : b);
    if (!home.has(t)) home.set(t, []);
    home.get(t).push(n);
  });

  const groups = [...home.entries()]
    .map(([t, list]) => ({ topic: t, list }))
    .sort((a, b) => b.list.length - a.list.length);

  const orphans = nodes.filter(n => !n.topics.length);

  topicClusters = [];
  const placed = [];
  let step = 0;

  groups.forEach(g => {
    // rayon de l'amas : de quoi loger ses albums sans se toucher
    const area = g.list.reduce((s, n) => s + (n.r + 9) * (n.r + 9) * 4, 0);
    const R = Math.max(70, Math.sqrt(area / Math.PI) * 1.18);

    let cx = 0, cy = 0;
    for (;;) {
      step += 0.7;
      const ang = step * 0.48, rad = 118 * Math.sqrt(step);
      cx = rad * Math.cos(ang); cy = rad * Math.sin(ang);
      if (!placed.some(p => Math.hypot(p.cx - cx, p.cy - cy) < p.R + R + 90)) break;
      if (step > 4e4) break;
    }
    placed.push({ cx, cy, R });
    topicClusters.push({ topic: g.topic, cx, cy, R, count: g.list.length });

    g.list.forEach((n, i) => {
      const ang = i * 2.3999632;
      const rad = R * 0.86 * Math.sqrt(i + 0.6) / Math.sqrt(g.list.length + 0.6);
      n.tx = cx + rad * Math.cos(ang);
      n.ty = cy + rad * Math.sin(ang);
    });
  });

  // Les sans-theme forment une couronne exterieure, discrete.
  const maxR = Math.max(...placed.map(p => Math.hypot(p.cx, p.cy) + p.R), 400);
  orphans.forEach((n, i) => {
    const ang = i * 2.3999632;
    const rad = maxR + 190 + 26 * Math.sqrt(i);
    n.tx = rad * Math.cos(ang);
    n.ty = rad * Math.sin(ang);
  });

  const xs = nodes.map(n => n.tx), ys = nodes.map(n => n.ty);
  return {
    x0: Math.min.apply(null, xs) - 140, y0: Math.min.apply(null, ys) - 140,
    x1: Math.max.apply(null, xs) + 140, y1: Math.max.apply(null, ys) + 140
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
    d.__node = node;
    d.onpointerenter = () => showTip(node);
    d.onpointerleave = () => hideTip();
    node.el = d;
    if (node.a.p && node.a.s && node.a.c) {
      node.cover = photoUrl(node.a.s, node.a.p, node.a.c, "q");
    }
    frag.appendChild(d);
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

/* --- 5bis. switching layouts --------------------------------------------
   La bascule anime la position de chaque album vers sa nouvelle place. Voir
   les memes objets se reorganiser dit plus qu'un changement d'ecran : on
   comprend que c'est le meme fonds, lu autrement.
------------------------------------------------------------------------- */

let mode = "time";              // "time" | "topics"
let morph = null;               // animation en cours

function setMode(next){
  if (next === mode) return;
  mode = next;

  document.getElementById("byTime").setAttribute("aria-pressed", mode === "time");
  document.getElementById("byTopic").setAttribute("aria-pressed", mode === "topics");
  document.getElementById("topicLabels").hidden = mode !== "topics";
  hideTip();

  const t0 = performance.now(), DUR = 900;
  const from = nodes.map(n => ({ x: n.x, y: n.y }));
  const to   = nodes.map(n => mode === "topics" ? { x: n.tx, y: n.ty }
                                                : { x: n.hx, y: n.hy });

  if (morph) cancelAnimationFrame(morph);
  (function step(){
    const p = Math.min(1, (performance.now() - t0) / DUR);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // douceur
    nodes.forEach((n, i) => {
      n.x = from[i].x + (to[i].x - from[i].x) * e;
      n.y = from[i].y + (to[i].y - from[i].y) * e;
      n.el.style.left = n.x + "px";
      n.el.style.top  = n.y + "px";
    });
    galaxy.kick();
    morph = p < 1 ? requestAnimationFrame(step) : null;
    if (p >= 1) {
      galaxy.setBounds(mode === "topics" ? topicBounds : timeBounds);
      placeTopicLabels();
    }
  })();
}

// Les noms de themes sont poses hors du calque transforme, comme le libelle
// de survol : taille constante, aucun recalcul d'echelle.
function placeTopicLabels(){
  const box = document.getElementById("topicLabels");
  if (mode !== "topics") { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = topicClusters.map((c, i) =>
    `<div class="tlabel" data-c="${i}"><b>${esc(c.topic.name)}</b>` +
    `<span>${c.count} albums</span></div>`).join("");
  moveTopicLabels();
}

function moveTopicLabels(){
  if (mode !== "topics") return;
  const k = galaxy.view.k;
  document.querySelectorAll(".tlabel").forEach(el => {
    const c = topicClusters[+el.dataset.c];
    el.style.left = (c.cx * k + galaxy.view.x) + "px";
    el.style.top  = (c.cy * k + galaxy.view.y - c.R * k - 26) + "px";
    el.style.opacity = (c.R * k > 40) ? 1 : 0;
  });
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

  moveTip();
  moveTopicLabels();
  maybeEnter(k);
}

// Continuer a zoomer sur un album centre revient a vouloir y entrer : le geste
// se prolonge au lieu de buter sur une limite. Un delai apres une sortie evite
// d'y retomber aussitot.
let enterLock = 0;

function maybeEnter(k){
  if (k < K_ENTER || performance.now() < enterLock) return;
  if (!document.getElementById("album").hidden) return;

  const cx = innerWidth / 2, cy = innerHeight / 2;
  let best = null, bestD = Infinity;
  nodes.forEach(n => {
    if (!n.onScreen) return;
    const d = Math.hypot(n.sx - cx, n.sy - cy);
    if (d < n.r * k && d < bestD) { best = n; bestD = d; }
  });
  if (best) { enterLock = performance.now() + 1200; enterAlbum(best); }
}

/* --- 7. label ------------------------------------------------------------
   Un seul libelle, celui de l'album survole, pose hors du calque transforme :
   il garde donc sa taille quelle que soit l'echelle, sans contre-mise a
   l'echelle a chaque image. Afficher mille deux cents titres demandait un
   calcul de chevauchement a chaque passe et restait brouillon ; ne montrer que
   ce que l'on designe est plus lisible et bien moins couteux.
------------------------------------------------------------------------- */

let hovered = null;
const tip = document.getElementById("tip");

function showTip(node){
  hovered = node;
  tip.innerHTML = `${esc(node.a.t)}<small>${yearOf(node.a)} · ` +
                  `${node.a.n.toLocaleString("en")} photos</small>`;
  tip.hidden = false;
  moveTip();
}

function hideTip(){
  hovered = null;
  tip.hidden = true;
}

function moveTip(){
  if (!hovered) return;
  const k = galaxy.view.k;
  tip.style.left = (hovered.x * k + galaxy.view.x) + "px";
  tip.style.top  = (hovered.y * k + galaxy.view.y + hovered.r * k + 10) + "px";
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

  hideTip();
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
    d.__index = i;
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
  enterLock = performance.now() + 1200;
  // On recule sous le seuil d'entree, sinon la planete encore centree se
  // rouvrirait immediatement.
  if (galaxy.target.k > K_ENTER * 0.85) {
    galaxy.zoomAt(innerWidth / 2, innerHeight / 2, (K_ENTER * 0.8) / galaxy.target.k);
  }
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
  { kMin: 0.10, kMax: 8,
    onTick: updateDetail,
    onTap: el => { if (el.__node) enterAlbum(el.__node); } }
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

  timeBounds = layoutGalaxy();
  galaxy.setBounds(timeBounds);
  renderGalaxy();
  tagAlbums();
  topicBounds = layoutTopics();
  galaxy.enable(true);

  document.getElementById("byTime").onclick  = () => setMode("time");
  document.getElementById("byTopic").onclick = () => setMode("topics");

  albumField = makeField(
    document.getElementById("pstage"),
    document.getElementById("pworld"),
    { kMin: 0.12, kMax: 6,
      onTap: el => { if (typeof el.__index === "number") openLight(el.__index); },
      onZoomOutPast: {
        // Le moindre recul depuis le cadrage d'ouverture ressort : c'est le
        // geste attendu, et un seuil plus bas donnait l'impression que rien
        // ne se passait pendant plusieurs crans de molette.
        threshold: () => albumField.fitScale() * 0.98,
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
