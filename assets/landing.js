/* =========================================================================
   enCoR — landing page
   Purpose: count what the corpus holds and build the entry cards from the
   datasets themselves, so the page never states figures that have gone stale.
   Reads only data/index.js plus each dataset's header — the quotes are loaded
   but not rendered here.
   ========================================================================= */

const SESSIONS = [];
function registerSession(s){ SESSIONS.push(s); }

const esc = t => String(t||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function build(){
  if (!SESSIONS.length) return;

  const quotes   = SESSIONS.reduce((n,s) => n + s.quotes.length, 0);
  const hours    = Math.round(SESSIONS.reduce((n,s) => n + (s.durationSec||0), 0) / 3600);
  const editions = [...new Set(SESSIONS.map(s => s.edition))].sort().reverse();

  document.getElementById("stats").innerHTML = [
    [editions.length, "editions"],
    [SESSIONS.length, "sessions"],
    [quotes,          "reviewed quotes"],
    [hours + " h",    "of video, timecoded"]
  ].map(([v,l]) => `<li><b>${v}</b><span>${l}</span></li>`).join("");

  // Une carte par edition, plus une carte pour l'evenement entier.
  const byEdition = editions.map(ed => {
    const list = SESSIONS.filter(s => s.edition === ed);
    const q = list.reduce((n,s) => n + s.quotes.length, 0);
    const year = (ed.match(/\d{4}/)||[""])[0];
    return `<a class="card" href="read.html?edition=${encodeURIComponent(ed)}">
      <span class="yr">${esc(year || ed)}</span>
      <span class="meta">${plural(list.length,"session")} · ${plural(q,"quote")}</span>
      <span class="go">Open this edition →</span>
    </a>`;
  });

  const total = SESSIONS.length;
  const all = `<a class="card all" href="read.html?event=EuroPCom">
      <span class="yr">EuroPCom</span>
      <span class="meta">${plural(total,"session")} · ${editions.length} editions · ${plural(quotes,"quote")}</span>
      <span class="go">Browse the whole event →</span>
    </a>`;

  document.getElementById("cards").innerHTML = all + byEdition.join("");
}

(function(){
  const ids = window.SESSIONS_MANIFEST || [];
  let left = ids.length;
  if (!left) return;
  ids.forEach(id => {
    const s = document.createElement("script");
    s.src = `data/${id}.js`;
    s.onload = s.onerror = () => { if (--left === 0) build(); };
    document.body.appendChild(s);
  });
})();
