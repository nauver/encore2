/* =========================================================================
   enCoR — core
   Purpose: shared state, palette, formatting and escaping helpers.
   Loaded first; every other module depends on it.
   Exposes: SESSIONS, registerSession(), PALETTE, tc(), esc(), hl(),
            hasTerm(), across(), current, filter, colors, theme, query
   ========================================================================= */

const SESSIONS = [];
function registerSession(s){ SESSIONS.push(s); }

const PALETTE = ["var(--s1)","var(--s2)","var(--s3)","var(--s4)","var(--s5)"];

let current = null, filter = null, colors = {}, theme = null, query = "";

function tc(t){const x=Math.floor(t);const p=n=>String(n).padStart(2,"0");return `${p(Math.floor(x/3600))}:${p(Math.floor(x%3600/60))}:${p(x%60)}`;}
const esc = t => String(t).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function hl(t){
  if(!TERMS.length) return esc(t);
  const rx = TERMS.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).sort((a,b)=>b.length-a.length).join("|");
  return esc(t).replace(new RegExp("("+rx+")","ig"),"<mark>$1</mark>");
}
const hasTerm = hay => { const h=hay.toLowerCase(); return TERMS.some(t=>h.includes(t)); };
// Mode transversal dès qu'une recherche ou un thème est actif : la question
// « qu'a-t-on dit sur X » ne se pose jamais session par session.

const across = () => !!(query || theme);
