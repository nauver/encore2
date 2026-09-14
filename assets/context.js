/* =========================================================================
   enCoR — transcripts: deep search and context
   Purpose: everything that reads data/transcripts.js. The file is large
   (~900 KB) so it is fetched on first use only, never on page load.
   Exposes: loadTranscripts(cb), drawDeep(), toggleCtx(card, session, quote)
   ========================================================================= */

// Recherche dans les transcripts complets : chargés à la première recherche
// seulement, pour ne pas alourdir l'ouverture de la page.
let TX=null, txLoading=false, txShown=8;
function loadTranscripts(cb){
  if (TX) return cb();
  if (txLoading) return;
  txLoading=true;
  const sc=document.createElement("script");
  sc.src="data/transcripts.js";
  sc.onload=()=>{ TX=window.TRANSCRIPTS||{}; txLoading=false; cb(); };
  sc.onerror=()=>{ TX={}; txLoading=false; cb(); };
  document.body.appendChild(sc);
}
const titleOf = id => (SESSIONS.find(s=>s.id===id)||{}).title || id;

function drawDeep(){
  const box=document.getElementById("deep");
  if (!query || query.length<3){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML="<h2>Elsewhere in the transcripts</h2><p class='lead'>Searching everything that was said…</p>";
  loadTranscripts(()=>{
    if (!query) { box.hidden=true; return; }
    const hits=[];
    Object.entries(TX).forEach(([id,d])=>{
      d.segments.forEach(([t,txt])=>{ if (hasTerm(txt)) hits.push({id,t,txt,d}); });
    });
    if (!hits.length){
      box.innerHTML="<h2>Elsewhere in the transcripts</h2><p class='lead'>Nothing else was said on this.</p>";
      return;
    }
    const shown=hits.slice(0,txShown);
    box.innerHTML="<h2>Elsewhere in the transcripts</h2>" +
      `<p class='lead'>${hits.length} passage${hits.length===1?"":"s"} in ${new Set(hits.map(h=>h.id)).size} session(s) where this was discussed but not selected as a quote. Raw transcript: unchecked wording, and it may include people speaking from the floor.</p>` +
      shown.map(h=>`
        <div class="seg">
          <div class="t">${tc(h.t)}</div>
          <div>
            <p class="s">${esc(titleOf(h.id))}</p>
            <p class="x">${hl(h.txt)}</p>
            <a href="https://webstreaming.cor.europa.eu/en/cor/${h.d.reference}/seek/${h.d.startUTC+h.t-3}" target="_blank" rel="noopener">Watch this moment</a>
          </div>
        </div>`).join("") +
      (hits.length>shown.length ? `<div class="more"><button id="moreBtn">Show ${Math.min(20,hits.length-shown.length)} more</button></div>` : "");
    const mb=document.getElementById("moreBtn");
    if (mb) mb.onclick=()=>{ txShown+=20; drawDeep(); };
  });
}

// Contexte : au clic, la citation recule legerement et le transcript
// environnant se deplie autour d'elle. Les segments viennent du meme index
// que la recherche profonde, charge a la demande.
function toggleCtx(card, sess, q){
  const box = card.querySelector("[data-ctx]");
  if (card.classList.contains("open")){ card.classList.remove("open"); return; }
  card.classList.add("open");
  if (box.dataset.done) return;
  box.innerHTML = '<p class="loading">Loading the surrounding transcript…</p>';
  loadTranscripts(()=>{
    const d = TX && TX[sess.id];
    if (!d){ box.innerHTML = '<p>No transcript available for this session.</p>'; box.dataset.done=1; return; }
    const from = q.start_sec - 75, to = q.start_sec + 150;
    const near = d.segments.filter(([t]) => t >= from && t <= to);
    if (!near.length){ box.innerHTML = '<p>Nothing found around this timecode.</p>'; box.dataset.done=1; return; }
    box.innerHTML = '<p class="lbl">Around this moment, in the raw transcript</p>' +
      near.map(([t,txt]) => {
        const here = Math.abs(t - q.start_sec) < 25;
        return `<p class="${here?"here":""}">${esc(txt)}</p>`;
      }).join("");
    box.dataset.done=1;
  });
}
