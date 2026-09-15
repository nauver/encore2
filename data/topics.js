/* =========================================================================
   CoRstellation — topic vocabulary

   Topics are derived from album titles, not from photo tags: the titles follow
   the institution's own nomenclature and are far more consistent than the tags
   attached to individual photographs.

   This file is meant to be edited. Each entry is a display name and a regular
   expression matched, case-insensitively, against the album title. An album can
   carry several topics — that is what gives the cloud its shape.

   Roughly 60% of albums match at least one topic. The remainder are bilateral
   meetings, receptions and ceremonies: occasions rather than subjects. They are
   kept, shown at the edge, and counted honestly rather than forced into a
   category.

   Adding a topic: add a line. Nothing else to change.
   ========================================================================= */

window.CORSTELLATION_TOPICS = [
  // --- subjects --------------------------------------------------------
  { name: "Cohesion",         rx: "cohesion" },
  { name: "Cities",           rx: "\\bcities\\b|urban|mayors?\\b" },
  { name: "Climate & energy", rx: "climate|energy|green deal|environment|renewable" },
  { name: "Ukraine",          rx: "ukrain" },
  { name: "Enlargement",      rx: "enlargement|western balkans|candidate countr|accession" },
  { name: "Democracy",        rx: "democra|subsidiarit|citizen|dialogue|participat" },
  { name: "Economy & budget", rx: "econom|budget|invest|fund|financ|recovery" },
  { name: "Research & skills",rx: "research|innovat|horizon|skills|education" },
  { name: "Youth",            rx: "youth|young|student|school" },
  { name: "Rural & agri",     rx: "rural|agri|farm|food" },
  { name: "Culture",          rx: "cultur|heritage|tourism|sport" },
  { name: "Social",           rx: "social|employment|poverty|inclusion|housing" },
  { name: "Migration",        rx: "migrat|asylum|refugee|integration" },
  { name: "Transport",        rx: "transport|mobilit|infrastructur" },
  { name: "Digital",          rx: "digital|artificial intelligence|\\bai\\b|online" },
  { name: "Health",           rx: "health|pandemic|covid|\\bcare\\b" },

  // --- commissions -----------------------------------------------------
  { name: "COTER",   rx: "\\bcoter\\b" },
  { name: "SEDEC",   rx: "\\bsedec\\b" },
  { name: "CIVEX",   rx: "\\bcivex\\b" },
  { name: "NAT",     rx: "\\bnat\\b" },
  { name: "ENVE",    rx: "\\benve\\b" },
  { name: "ECON",    rx: "\\becon\\b" },
  { name: "ARLEM",   rx: "arlem" },
  { name: "CORLEAP", rx: "corleap" },

  // --- formats ---------------------------------------------------------
  { name: "Plenary",      rx: "plenary" },
  { name: "Summit",       rx: "summit" },
  { name: "Awards",       rx: "award|prize" },
  { name: "EuroPCom",     rx: "europcom" },
  { name: "Regions Week", rx: "open days|regions and cities|euregionsweek|european week of regions" }
];
