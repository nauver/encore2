/* =========================================================================
   CoRstellation — fifteen years of CoR photo albums, as one navigable field

   1 configuration · 2 colour ramp · 3 state · 4 layout · 5 render
   6 view loop · 7 level of detail · 8 input · 9 album view · 10 lightbox
   11 boot

   Two decisions drive the feel:
   - the world is a single transformed layer, so panning and zooming are
     composited by the GPU rather than re-laid out on every frame;
   - the view is animated towards a target rather than set directly, which
     gives momentum on release and a glide when zooming. On a large screen an
     abrupt jump reads as a fault rather than as movement.
   ========================================================================= */

/* --- 1. configuration --------------------------------------------------- */

const FLICKR_KEY  = window.FLICKR_KEY || "METTRE_LA_CLE_ICI";
const FLICKR_NSID = "62673028@N02";
const ALBUMS      = window.CORSTELLATION_ALBUMS || [];

// https://live.staticflickr.com/{server}/{id}_{secret}_{size}.jpg
// q = 150 px square, n = 320 px, b = 1024 px.
const photoUrl = (server, id, secret, size) =>
  `https://live.staticflickr.com/${server}/${id}_${secret}_${size}.jpg`;

const ARMS      = 3;        // bras de la spirale
const TURNS     = 2.1;      // tours effectues du centre au bord
const R_INNER   = 80;
const R_OUTER   = 880;      // resserre : au-dela, les disques deviennent des
                            // poussieres une fois la galaxie entiere a l'ecran
const K_START   = 0.62;     // echelle d'ouverture : lisible d'emblee
const K_MIN     = 0.10;
const K_MAX     = 8;
const K_COVER   = 0.55;     // au-dela, les pastilles deviennent des couvertures

/* --- 2. colour ramp ----------------------------------------------------- */
// Le temps se lit dans la couleur : bleu roi en 2011, or en 2026. Une rampe
// continue plutot qu'une couleur par annee - l'oeil suit une progression,
// comme une temperature, pas un classement.

const RAMP = [
  [224, 76, 52],
  [214, 80, 58],
  [199, 74, 58],
  [180, 62, 58],
  [ 96, 52, 58],
  [ 52, 88, 62],
  [ 44, 94, 66]
];

function ramp(t){
  const x = Math.max(0, Math.min(0.999, t)) * (RAMP.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  const h = a[0] + (b[0] - a[0]) * f;
  const s = a[1] + (b[1] - a[1]) * f;
  const l = a[2] + (b[2] - a[2]) * f;
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
}

/* --- 3. state ----------------------------------------------------------- */

const view   = { x: 0, y: 0, k: K_START };   // ce qui est affiche
const target = { x: 0, y: 0, k: K_START };   // ce vers quoi on glisse

let nodes  = [];
let bounds = null;
let raf    = null;

const world = document.getElementById("world");
const stage = document.getElementById("stage");

const esc    = t => String(t || "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const yearOf = a => a.d.slice(0, 4);

function notice(text){
  const el = document.getElementById("notice");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
}

/* --- 4. layout: a galaxy of time ---------------------------------------- */
// Les albums sont ranges par date sur trois bras en spirale : 2011 au centre,
// 2026 au bord. La densite d'une annee se lit d'un coup d'oeil, et le creux de
// 2020-2021 apparait comme une respiration dans le motif.

function layout(){
  const n = ALBUMS.length;

  // Generateur a graine : la disposition ne change pas d'un chargement a
  // l'autre, ce qui compte pour un ecran qu'on regarde souvent.
  let seed = 20260914;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  const placed = [];

  nodes = ALBUMS.map((a, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = 4 + 2.1 * Math.sqrt(a.n);

    let rad = R_INNER + (R_OUTER - R_INNER) * Math.pow(t, 0.78);
    let ang = t * TURNS * Math.PI * 2 + (i % ARMS) * (Math.PI * 2 / ARMS);

    ang += (rnd() - 0.5) * 0.34;          // epaisseur du bras
    rad *= 1 + (rnd() - 0.5) * 0.14;

    let x = rad * Math.cos(ang);
    let y = rad * Math.sin(ang);

    // On ecarte le long du rayon tant qu'un voisin est touche : la structure
    // en bras est preservee, contrairement a un ecartement en toute direction.
    let guard = 0;
    while (guard++ < 500 &&
           placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 5)) {
      rad += r * 0.45;
      x = rad * Math.cos(ang);
      y = rad * Math.sin(ang);
    }

    placed.push({ x, y, r });
    return { a, x, y, r, t, el: null, label: null, mode: null, cover: null };
  });

  const pad = 60;
  bounds = {
    x0: Math.min(...nodes.map(p => p.x - p.r)) - pad,
    y0: Math.min(...nodes.map(p => p.y - p.r)) - pad,
    x1: Math.max(...nodes.map(p => p.x + p.r)) + pad,
    y1: Math.max(...nodes.map(p => p.y + p.r)) + pad
  };
}

/* --- 5. render ---------------------------------------------------------- */

function render(){
  const frag = document.createDocumentFragment();

  nodes.forEach(node => {
    const d = document.createElement("div");
    d.className   = "album";
    d.style.left  = node.x + "px";
    d.style.top   = node.y + "px";
    d.style.width = d.style.height = (node.r * 2) + "px";
    d.style.color = ramp(node.t);
    d.title = `${node.a.t} — ${node.a.n} photos`;
    d.onclick = e => { e.stopPropagation(); enterAlbum(node); };
    node.el = d;

    if (node.a.p && node.a.s && node.a.c) {
      node.cover = photoUrl(node.a.s, node.a.p, node.a.c, "q");
    }
    frag.appendChild(d);

    // Un libelle par album serait illisible ; le seuil s'abaisse avec le zoom.
    if (node.a.n >= 25) {
      const l = document.createElement("div");
      l.className  = "label";
      l.style.left = node.x + "px";
      l.style.top  = (node.y + node.r + 6) + "px";
      l.innerHTML  = `${esc(node.a.t.slice(0, 44))}` +
                     `<small>${yearOf(node.a)} · ${node.a.n} photos</small>`;
      node.label = l;
      frag.appendChild(l);
    }
  });

  world.appendChild(frag);

  const years = [...new Set(ALBUMS.map(yearOf))].sort();
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

/* --- 6. view loop ------------------------------------------------------- */
// On n'ecrit jamais la transformation directement : on approche la cible d'un
// facteur constant par image. De la viennent l'inertie et la glisse, sans
// bibliotheque d'animation.

function tick(){
  const e = 0.18;
  view.x += (target.x - view.x) * e;
  view.y += (target.y - view.y) * e;
  view.k += (target.k - view.k) * e;

  world.style.transform =
    `translate(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px) scale(${view.k.toFixed(4)})`;

  updateDetail();

  const moving = Math.abs(target.x - view.x) > 0.3 ||
                 Math.abs(target.y - view.y) > 0.3 ||
                 Math.abs(target.k - view.k) > 0.0008;
  raf = moving ? requestAnimationFrame(tick) : null;
}

function kick(){ if (!raf) raf = requestAnimationFrame(tick); }

function zoomAt(px, py, factor){
  const k = Math.max(K_MIN, Math.min(K_MAX, target.k * factor));
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

function showWholeGalaxy(pad = 70){
  const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
  const k = Math.max(K_MIN,
    Math.min((innerWidth - pad * 2) / bw, (innerHeight - pad * 2) / bh));
  centreOn(bounds.x0 + bw / 2, bounds.y0 + bh / 2, k);
}

/* --- 7. level of detail ------------------------------------------------- */
// Seuls les albums reellement a l'ecran sont traites. Sans ce filtrage, poser
// mille deux cents couvertures couterait une seconde a chaque image.

let detailPass = 0;

function updateDetail(){
  if (++detailPass % 4) return;

  const k = view.k, pad = 260;

  nodes.forEach(node => {
    const sx = node.x * k + view.x;
    const sy = node.y * k + view.y;
    const onScreen = sx > -pad && sx < innerWidth + pad &&
                     sy > -pad && sy < innerHeight + pad;

    const want = (onScreen && k >= K_COVER && node.cover) ? "cover" : "dot";
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

    if (!node.label) return;
    const floor = k > 1.5 ? 0 : k > 0.95 ? 60 : k > 0.55 ? 150 : Infinity;
    const show  = onScreen && node.a.n >= floor;
    if (show !== node.label.classList.contains("show")) {
      node.label.classList.toggle("show", show);
    }
    if (show) {
      node.label.style.transform = `translate(-50%,0) scale(${(1 / k).toFixed(3)})`;
    }
  });
}

/* --- 8. input: mouse, wheel, touch, keyboard ---------------------------- */

let hintTimer = null;

function hideHint(){
  const h = document.getElementById("hint");
  if (!h || h.classList.contains("gone")) return;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add("gone"), 800);
}

function installInput(){
  let drag = null, vx = 0, vy = 0, lastT = 0, lastX = 0, lastY = 0;

  stage.addEventListener("wheel", e => {
    e.preventDefault();
    hideHint();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });

  stage.addEventListener("pointerdown", e => {
    if (e.target.closest(".album")) return;
    drag  = { px: e.clientX, py: e.clientY, tx: target.x, ty: target.y };
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    vx = vy = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
    hideHint();
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
    // Inertie : on prolonge le geste, la boucle amortit.
    target.x += Math.max(-700, Math.min(700, vx * 150));
    target.y += Math.max(-700, Math.min(700, vy * 150));
    kick();
  };
  ["pointerup", "pointercancel", "pointerleave"]
    .forEach(t => stage.addEventListener(t, release));

  // Pincement a deux doigts.
  let pinch = null;
  stage.addEventListener("touchstart", e => {
    if (e.touches.length !== 2) return;
    drag = null;
    const [a, b] = e.touches;
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  }, { passive: true });

  stage.addEventListener("touchmove", e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, pinch.d / d);
    pinch.d = d;
  }, { passive: false });

  stage.addEventListener("touchend", () => { pinch = null; }, { passive: true });

  stage.addEventListener("dblclick", e => zoomAt(e.clientX, e.clientY, 2));

  addEventListener("keydown", e => {
    if (!document.getElementById("light").hidden) {
      if (e.key === "Escape")     closeLight();
      if (e.key === "ArrowRight") stepLight(1);
      if (e.key === "ArrowLeft")  stepLight(-1);
      return;
    }
    if (!document.getElementById("album").hidden) {
      if (e.key === "Escape") leaveAlbum();
      return;
    }
    if (e.key === "+" || e.key === "=") zoomAt(innerWidth / 2, innerHeight / 2, 1.5);
    if (e.key === "-")                  zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.5);
    if (e.key === "0")                  showWholeGalaxy();
    const step = 150;
    if (e.key === "ArrowLeft")  { target.x += step; kick(); }
    if (e.key === "ArrowRight") { target.x -= step; kick(); }
    if (e.key === "ArrowUp")    { target.y += step; kick(); }
    if (e.key === "ArrowDown")  { target.y -= step; kick(); }
  });

  document.getElementById("zoomIn").onclick  =
    () => zoomAt(innerWidth / 2, innerHeight / 2, 1.6);
  document.getElementById("zoomOut").onclick =
    () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.6);
  document.getElementById("showAll").onclick = () => showWholeGalaxy();

  addEventListener("resize", () => kick());
}

/* --- 9. album view ------------------------------------------------------ */
// On entre dans l'album : le champ s'efface, les photos respirent. Une
// couronne de vignettes dans l'espace se chevauchait des que deux albums
// etaient voisins, et rien n'etait cliquable proprement.

const photoCache = new Map();
let current = { list: [], index: 0 };

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
  document.getElementById("grid").innerHTML = "";
  document.getElementById("aMore").hidden = true;
  box.hidden = false;
  box.scrollTop = 0;
  hideHint();

  const list = await fetchPhotos(node.a.i);
  if (box.hidden) return;                       // deja ressorti
  current = { list, index: 0 };

  const frag = document.createDocumentFragment();
  list.forEach((p, i) => {
    const img = document.createElement("img");
    img.loading  = "lazy";
    img.decoding = "async";
    img.src = photoUrl(p.server, p.id, p.secret, "n");
    img.alt = p.title || "";
    img.title = p.title || "";
    img.onclick = () => openLight(i);
    frag.appendChild(img);
  });
  document.getElementById("grid").appendChild(frag);

  if (node.a.n > list.length) {
    const more = document.getElementById("aMore");
    more.textContent =
      `Showing the first ${list.length} of ${node.a.n} photographs — the rest are on Flickr.`;
    more.hidden = false;
  }
}

function leaveAlbum(){
  document.getElementById("album").hidden = true;
  document.getElementById("grid").innerHTML = "";
}

/* --- 10. lightbox ------------------------------------------------------- */

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

/* --- 11. boot ----------------------------------------------------------- */

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

  layout();
  render();
  installInput();

  document.getElementById("back").onclick       = leaveAlbum;
  document.getElementById("lightClose").onclick = closeLight;
  document.getElementById("lightPrev").onclick  = () => stepLight(-1);
  document.getElementById("lightNext").onclick  = () => stepLight(1);
  document.getElementById("light").onclick      =
    e => { if (e.target.id === "light") closeLight(); };

  // On ouvre sur le coeur de la galaxie a une echelle lisible, plutot que sur
  // l'ensemble : mille deux cents disques vus de tres loin ne sont qu'une brume.
  centreOn(0, 0, K_START);
  setTimeout(hideHint, 6000);
})();
