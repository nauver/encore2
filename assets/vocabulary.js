/* =========================================================================
   enCoR — search vocabulary
   Purpose: widen a literal query to the wording actually used in the corpus,
   in English and French. No model involved; this is a hand-maintained list.
   Exposes: SYNONYMS, expand(query), TERMS
   ========================================================================= */
// --- Vocabulaire du corpus -------------------------------------------------
// Une recherche litterale rate ce qui se dit autrement : "disinformation" ne
// trouve pas "FIMI", "local" ne trouve pas "mayor". Chaque groupe reunit les
// formulations rencontrees dans les trois editions, anglais et francais.
const SYNONYMS = [
  ["disinformation","misinformation","fake news","FIMI","foreign information manipulation",
   "information manipulation","propaganda","fact check","fact-check","debunk","deepfake",
   "deep fake","conspiracy","désinformation","manipulation"],
  ["trust","distrust","mistrust","trustworthy","credibility","credible","confiance","confidence"],
  ["artificial intelligence","AI literacy","generative","chatbot","ChatGPT","large language model",
   "machine learning","synthetic","intelligence artificielle"],
  ["platform","social media","Big Tech","TikTok","Twitter","Facebook","Instagram","YouTube",
   "algorithm","algorithmic","bot","bots","réseaux sociaux","plateforme"],
  ["local","regional","municipal","municipality","mayor","city","cities","region","commune",
   "territory","grassroots","proximity","local government"],
  ["participation","participatory","citizens panel","citizen panel","engagement","deliberation",
   "deliberative","consultation","co-creation","assembly","town hall","participation citoyenne"],
  ["sovereignty","sovereign","souveraineté","autonomy","independence","European alternative",
   "made in Europe","digital sovereignty"],
  ["media literacy","literacy","education","training","school","curriculum","awareness",
   "éducation","formation","prebunking","pre-bunking"],
  ["democracy","democratic","election","elections","electoral","vote","voting","ballot",
   "turnout","démocratie","scrutin"],
  ["listening","listen","dialogue","feedback","écoute","écouter","two-way","conversation"],
  ["resilience","resilient","preparedness","prepared","defence","defense","protect","résilience"],
  ["polarisation","polarization","division","divisive","fragmentation","extremism","hate"],
  ["transparency","accountability","openness","transparence","open data"],
  ["young","youth","younger","student","generation","jeunes","Gen Z"],
  ["regulation","regulatory","DSA","AI Act","code of conduct","law","legislation","réglementation"]
];

// Renvoie tous les termes a chercher pour une saisie donnee.
function expand(q){
  const n=q.toLowerCase().trim();
  if(n.length<3) return [n];
  const terms=new Set([n]);
  SYNONYMS.forEach(g=>{
    if(g.some(w=>{const lw=w.toLowerCase(); return lw.includes(n)||n.includes(lw);}))
      g.forEach(w=>terms.add(w.toLowerCase()));
  });
  return [...terms];
}
let TERMS=[];
