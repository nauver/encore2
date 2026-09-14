/* =========================================================================
   CoRstellation — fifteen years of CoR photo albums
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

// Cle publique de l'application Flickr du CoR. Elle identifie l'application,
// elle ne donne aucun droit d'ecriture : toute page qui appelle l'API depuis le
// navigateur expose la sienne. Le secret, lui, n'apparait jamais ici.
const FLICKR_KEY = window.FLICKR_KEY || "METTRE_LA_CLE_ICI";
const FLICKR_NSID = "62673028@N02";

const ALBUMS = window.CORSTELLATION_ALBUMS || [];

// https://live.staticflickr.com/{server}/{id}_{secret}_{size}.jpg
// q = 150 px carre, n = 320 px, z = 640 px. On reste petit : ce sont des
// vignettes dans un champ, pas des tirages.
const photoUrl = (server, id, secret, size) =>
  `https://live.staticflickr.com/${server}/${id}_${secret}_${size}.jpg`;
// Le temps se lit dans la couleur : bleu roi pour 2011, or pour 2026.
// Une rampe continue plutot qu'une couleur par annee - l'oeil suit alors la
// progression comme une temperature, pas comme un classement.
const RAMP = [
  [222, 74, 38],   // bleu roi profond
  [216, 78, 48],
  [205, 72, 52],
  [188, 58, 52],
  [168, 45, 52],
  [ 48, 82, 58],   // or
  [ 42, 90, 62]
];
function ramp(t){                       // t de 0 a 1
  const x = Math.max(0, Math.min(0.999, t)) * (RAMP.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  const h = a[0] + (b[0] - a[0]) * f;
  const s = a[1] + (b[1] - a[1]) * f;
  const l = a[2] + (b[2] - a[2]) * f;
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
}

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
  // Trois bras en spirale logarithmique, parcourus dans l'ordre chronologique.
  // Le rayon croit avec le temps, l'angle tourne : on obtient la forme d'une
  // galaxie plutot qu'un escargot regulier. Une dispersion aleatoire mais
  // reproductible epaissit les bras et evite l'aspect trace au compas.
  const N = ALBUMS.length;
  const ARMS = 3, TURNS = 2.35, R0 = 130, R1 = 2600;

  // Generateur pseudo-aleatoire a graine : la disposition ne change pas d'un
  // chargement a l'autre, ce qui compte pour un ecran qu'on regarde souvent.
  let seed = 20260914;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  const placed = [];
  nodes = ALBUMS.map((a, i) => {
    const t   = N > 1 ? i / (N - 1) : 0;              // position dans le temps
    const arm = i % ARMS;
    const r   = 4 + 2.4 * Math.sqrt(a.n);

    let rad = R0 + (R1 - R0) * Math.pow(t, 0.82);
    let ang = t * TURNS * Math.PI * 2 + arm * (Math.PI * 2 / ARMS);

    // epaisseur du bras : dispersion angulaire et radiale
    ang += (rnd() - 0.5) * 0.30;
    rad *= 1 + (rnd() - 0.5) * 0.13;

    let x = rad * Math.cos(ang), y = rad * Math.sin(ang);

    // On ecarte le long du rayon tant qu'un voisin est touche : la structure
    // en bras est preservee, contrairement a un ecartement dans n'importe
    // quelle direction.
    let guard = 0;
    while (placed.some(p => Math.hypot(p.x - x, p.y - y) < (p.r + r + 6)) && guard++ < 400) {
      rad += r * 0.5;
      x = rad * Math.cos(ang); y = rad * Math.sin(ang);
    }

    placed.push({ x, y, r });
    return { a, x, y, r, t, el:null, label:null };
  });

  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), rs = nodes.map(n => n.r);
  bounds = {
    x0: Math.min(...xs.map((v,i)=>v-rs[i])) - 80,
    y0: Math.min(...ys.map((v,i)=>v-rs[i])) - 80,
    x1: Math.max(...xs.map((v,i)=>v+rs[i])) + 80,
    y1: Math.max(...ys.map((v,i)=>v+rs[i])) + 80
  };
}

/* --- 3. render ---------------------------------------------------------- */

function render(){
  const years = [...new Set(ALBUMS.map(yearOf))].sort();

  const frag = document.createDocumentFragment();
  nodes.forEach(n => {
    const d = document.createElement("div");
    d.className = "album";
    d.style.left   = n.x + "px";
    d.style.top    = n.y + "px";
    d.style.width  = d.style.height = (n.r * 2) + "px";
    d.style.color  = ramp(n.t);
    // La couverture n'est posee qu'au moment ou l'echelle la rend visible :
    // douze cents images au chargement seraient un gachis.
    if (n.a.p && n.a.s && n.a.c) n.coverUrl = photoUrl(n.a.s, n.a.p, n.a.c, "q");
    d.title = `${n.a.t} — ${n.a.n} photos`;
    d.onclick = e => { e.stopPropagation(); openAlbum(n); };
    n.el = d;
    frag.appendChild(d);

    // Les libelles n'existent que pour les albums consequents : mille deux
    // cents etiquettes seraient illisibles et couteuses a afficher.
    // Un libelle par album serait illisible de loin ; on en montre de plus en
    // plus a mesure qu'on approche (voir le seuil dans la boucle d'affichage).
    if (n.a.n >= 25){
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

  document.getElementById("years").innerHTML = years.map((y, i) => {
    const list = ALBUMS.filter(a => yearOf(a) === y);
    const ph = list.reduce((s,a) => s + a.n, 0);
    const c = ramp(i / Math.max(1, years.length - 1));
    return `<span style="border-left-color:${c}"><b style="color:${c}">${y}</b>${ph.toLocaleString("en")}</span>`;
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

  updateDetail();

  // Les libelles apparaissent quand l'echelle les rend lisibles, et se
  // contre-echellent pour garder une taille constante a l'ecran.
  // Plus on approche, plus les petits albums donnent leur nom.
  const k = view.k;
  const floor = k > 1.6 ? 0 : k > 0.95 ? 60 : k > 0.5 ? 140 : Infinity;
  nodes.forEach(n => {
    if (!n.label) return;
    const show = n.a.n >= floor;
    if (show !== n.label.classList.contains("show")) n.label.classList.toggle("show", show);
    if (show) n.label.style.transform = `translate(-50%,0) scale(${(1/k).toFixed(3)})`;
  });

  const moving = Math.abs(target.x-view.x) > .3 || Math.abs(target.y-view.y) > .3 ||
                 Math.abs(target.k-view.k) > .0008;
  raf = moving ? requestAnimationFrame(tick) : null;
}
function kick(){ if (!raf) raf = requestAnimationFrame(tick); }

/* --- niveaux de detail ---------------------------------------------------
   Trois etats selon l'echelle :
     < 0.55  pastille coloree
     < 1.60  couverture de l'album
     >= 1.60 les photos de l'album, chargees a la demande

   Seuls les albums reellement visibles sont traites : sans ce filtrage, le
   troisieme niveau demanderait douze cents appels d'API.
------------------------------------------------------------------------- */

let detailPass = 0;
function updateDetail(){
  if (++detailPass % 4) return;            // une image sur quatre suffit

  const k = view.k, pad = 240;
  nodes.forEach(n => {
    const sx = n.x * k + view.x, sy = n.y * k + view.y;
    const on = sx > -pad && sx < innerWidth + pad && sy > -pad && sy < innerHeight + pad;

    const want = (on && k >= 0.5 && n.coverUrl) ? "cover" : "dot";
    if (want === n.mode) return;

    if (want === "cover"){
      n.el.style.backgroundImage = `url(${n.coverUrl})`;
      n.el.classList.add("cover");
    } else {
      n.el.style.backgroundImage = "";
      n.el.classList.remove("cover");
    }
    n.mode = want;
  });
}

/* --- vue album ------------------------------------------------------------
   Au clic, on entre dans l'album : le champ disparait, les photos s'etalent en
   grille. Une couronne de vignettes dans l'espace se chevauchait des que deux
   albums etaient voisins, et rien n'etait cliquable proprement.
------------------------------------------------------------------------- */

const photoCache = new Map();
let current = { list: [], index: 0, node: null };

async function fetchPhotos(albumId){
  if (photoCache.has(albumId)) return photoCache.get(albumId);
  const u = "https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos" +
            `&api_key=${FLICKR_KEY}&photoset_id=${albumId}&user_id=${FLICKR_NSID}` +
            "&per_page=500&format=json&nojsoncallback=1";
  try {
    const r = await fetch(u);
    const j = await r.json();
    const list = (j.photoset && j.photoset.photo) ? j.photoset.photo : [];
    photoCache.set(albumId, list);
    return list;
  } catch (e) {
    notice("Flickr API unreachable — check the key in index.html.", "warn");
    photoCache.set(albumId, []);
    return [];
  }
}

async function enterAlbum(n){
  const box = document.getElementById("album");
  document.getElementById("aTitle").textContent = n.a.t;
  document.getElementById("aMeta").textContent =
    `${n.a.n.toLocaleString("en")} photographs · ${new Date(n.a.d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`;
  document.getElementById("aFlickr").href =
    `https://www.flickr.com/photos/cor-photos/albums/${n.a.i}`;
  document.getElementById("grid").innerHTML = "";
  document.getElementById("aMore").hidden = true;
  box.hidden = false;
  box.scrollTop = 0;

  const list = await fetchPhotos(n.a.i);
  if (box.hidden) return;                    // l'utilisateur est deja ressorti
  current = { list, index: 0, node: n };

  const grid = document.getElementById("grid");
  const frag = document.createDocumentFragment();
  list.forEach((p, i) => {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = photoUrl(p.server, p.id, p.secret, "n");   // 320 px
    img.alt = p.title || "";
    img.title = p.title || "";
    img.setAttribute("role", "listitem");
    img.onclick = () => openLight(i);
    frag.appendChild(img);
  });
  grid.appendChild(frag);

  if (n.a.n > list.length){
    const more = document.getElementById("aMore");
    more.textContent = `Showing the first ${list.length} of ${n.a.n} photographs — the rest are on Flickr.`;
    more.hidden = false;
  }
}

function leaveAlbum(){
  document.getElementById("album").hidden = true;
  document.getElementById("grid").innerHTML = "";
}

/* --- photo en grand ----------------------------------------------------- */

function openLight(i){
  if (!current.list.length) return;
  current.index = (i + current.list.length) % current.list.length;
  const p = current.list[current.index];
  document.getElementById("lImg").src = photoUrl(p.server, p.id, p.secret, "b"); // 1024 px
  document.getElementById("lImg").alt = p.title || "";
  document.getElementById("lCap").textContent =
    `${p.title || "Untitled"} · ${current.index + 1} of ${current.list.length}`;
  document.getElementById("light").hidden = false;
}
function closeLight(){ document.getElementById("light").hidden = true; }
function stepLight(d){ openLight(current.index + d); }

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
    const lightOpen = !document.getElementById("light").hidden;
    const albumOpen = !document.getElementById("album").hidden;
    if (lightOpen){
      if (e.key === "Escape")     { closeLight(); return; }
      if (e.key === "ArrowRight") { stepLight(1);  return; }
      if (e.key === "ArrowLeft")  { stepLight(-1); return; }
      return;
    }
    if (albumOpen){
      if (e.key === "Escape") { leaveAlbum(); closePanel(); }
      return;
    }
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
  enterAlbum(n);

  document.getElementById("pTitle").textContent = n.a.t;
  document.getElementById("pMeta").textContent =
    `${n.a.n.toLocaleString("en")} photographs · created ${new Date(n.a.d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`;
  document.getElementById("pOpen").href =
    `https://www.flickr.com/photos/cor-photos/albums/${n.a.i}`;
  focusNode(n, Math.max(target.k, 1.2));
  hideHint();
}

function closePanel(){
  document.getElementById("panel").classList.remove("open");
  if (selected) { selected.el.classList.remove("on"); selected = null; }
}
document.getElementById("close").onclick = closePanel;
document.getElementById("back").onclick    = () => { leaveAlbum(); closePanel(); };
document.getElementById("lClose").onclick  = closeLight;
document.getElementById("lPrev").onclick   = () => stepLight(-1);
document.getElementById("lNext").onclick   = () => stepLight(1);
document.getElementById("light").onclick   = e => { if (e.target.id === "light") closeLight(); };

/* --- 7. boot ------------------------------------------------------------ */

function notice(text, tone){
  const el = document.getElementById("notice");
  if (!el) return;
  el.textContent = text;
  el.className = tone || "";
  el.hidden = false;
}

(function(){
  if (!ALBUMS.length){
    document.getElementById("sub").textContent = "No album data loaded.";
    return;
  }

  // Un echec silencieux est un defaut : on dit ce qui manque.
  if (!FLICKR_KEY || FLICKR_KEY === "METTRE_LA_CLE_ICI"){
    notice("No Flickr key set in index.html — covers and photographs will not load.", "warn");
  } else if (!ALBUMS.some(a => a.p && a.s && a.c)){
    notice("Album data has no cover fields (p, s, c) — re-export to see the covers. Photographs still load on zoom.", "warn");
  }
  layout();
  render();
  installInput();
  fit();
  setTimeout(() => hideHint(), 6000);
})();
