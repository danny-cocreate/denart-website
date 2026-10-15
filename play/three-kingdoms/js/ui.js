const session = {
  state: null,
  busy: false,
  battle: null,
  side: null,
  actorId: null,
  targetId: null,
  after: null,
  prisoners: [],
  prisonCity: null,
  draft: null,
  changed: null,
};

let screen;
let modal;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function motionOk() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toast(text) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function note(state, text, mine = false) {
  state.log.unshift({ text, mine });
  if (state.log.length > 80) state.log.length = 80;
}

function noteAll(state, lines) {
  const names = factionCities(state, state.player).map((c) => c.name);
  const ruler = rulerOfficer(state, state.player)?.name;
  const mine = [];
  const rest = [];
  for (const line of lines) {
    const aboutUs = names.some((n) => line.includes(n)) || (ruler && line.includes(ruler));
    (aboutUs ? mine : rest).push(line);
  }
  for (const line of [...rest, ...mine]) note(state, line, mine.includes(line));
}

function face(officer, size = "") {
  if (!officer) {
    return `<div class="face ${size}"><span class="seal">?</span></div>`;
  }
  const initials = officer.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2);
  const img = officer.art
    ? `<img alt="${esc(officer.name)}" src="portraits/${esc(officer.art)}">`
    : "";
  return `<div class="face ${size}">${img}<span class="seal">${esc(initials)}</span></div>`;
}

function meter(label, value, kind = "") {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return `<div class="meter"><span>${label}</span><div class="track ${kind}"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
}

function save(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return normalizeSave(data);
  } catch {
    return null;
  }
}

function mount(app) {
  app.innerHTML = `<div id="screen"></div><div id="modal"></div>`;
  screen = app.querySelector("#screen");
  modal = app.querySelector("#modal");
  app.addEventListener("click", onClick);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (session.battle || session.prisoners.length || session.after || session.afterPrison) return;
    closeModal();
  });
  render();
}

function render() {
  const state = session.state;
  screen.innerHTML = state ? gameHtml(state) : titleHtml();
}

function titleHtml() {
  const saved = !!loadSave();
  const card = (id) => {
    const f = FACTIONS[id];
    const art = portraitOfficer(id);
    const easy = f.tag === "Open" ? `<em class="ribbon">Easiest</em>` : "";
    return `<button class="lord-card" data-act="play" data-faction="${id}" data-testid="play-${id}">
      ${easy}${face(art, "")}
      <span><span class="tag">${esc(f.tag)}</span><h2>${esc(f.name)}</h2><p>${esc(f.blurb)}</p></span>
    </button>`;
  };
  const rest = Object.keys(FACTIONS).filter((id) => !FEATURED.includes(id));
  return `<div class="screen-title">
    <header class="mast">
      <div class="seal" aria-hidden="true"><span>漢</span></div>
      <div class="eyebrow">194 CE · a strategy of the late Han</div>
      <h1>Warlords of the Three Kingdoms</h1>
      <p>Each city keeps a job until you change it. Once a month you may interrupt that work: a march, a search, a gift, a spy. The governor decides what the fields and markets actually pay.</p>
      <p class="note">Figures and places come from the histories and the public-domain novel. The portraits are original paintings. This is not a port of Koei’s game, and it is not affiliated with Koei Tecmo.</p>
    </header>
    <div class="title-actions">
      ${saved ? `<button class="primary" data-act="continue" data-testid="continue">Continue campaign</button>` : ""}
      <button class="ghost" data-act="help">How to play</button>
    </div>
    <p class="pick-hint">Choose a seal. Yuan Shao is the most forgiving start.</p>
    <div class="lord-grid">${FEATURED.map(card).join("")}</div>
    <details class="more-lords">
      <summary>Every other seal</summary>
      <div class="more-grid">${rest.map(card).join("")}</div>
    </details>
  </div>`;
}

function portraitOfficer(id) {
  const known = {
    liubei: { name: "Liu Bei", art: "liu-bei.jpg" },
    caocao: { name: "Cao Cao", art: "cao-cao.jpg" },
    sunce: { name: "Sun Ce", art: "sun-ce.jpg" },
    yuanshao: { name: "Yuan Shao", art: "yuan-shao.jpg" },
    lvbu: { name: "Lü Bu", art: "lv-bu.jpg" },
    liubiao: { name: "Liu Biao", art: "liu-biao.jpg" },
    liuzhang: { name: "Liu Zhang", art: "liu-zhang.jpg" },
    mateng: { name: "Ma Teng", art: "ma-teng.jpg" },
    gongsunzan: { name: "Gongsun Zan", art: "gongsun-zan.jpg" },
    yuanshu: { name: "Yuan Shu", art: "yuan-shu.jpg" },
    zhanglu: { name: "Zhang Lu", art: "zhang-lu.jpg" },
    kongrong: { name: "Kong Rong", art: "kong-rong.jpg" },
    lijue: { name: "Li Jue" },
    zangba: { name: "Zang Ba" },
  };
  return known[id] || { name: FACTIONS[id].name };
}

function gameHtml(state) {
  const ruler = rulerOfficer(state, state.player);
  const t = totals(state, state.player);
  const city = state.cities[state.selected] || factionCities(state, state.player)[0];
  if (city) state.selected = city.id;
  const held = factionCities(state, state.player);
  const oneOffs = held.filter((c) => state.orders[c.id] && state.orders[c.id].type !== "job").length;
  const aim = aimStatus(state, state.player);
  const food = realmFood(state, state.player);
  const foodLabel = food.months == null ? "fed" : `${food.months.toFixed(1)} mo`;
  const threats = state.threats || [];
  const threatText = threats.map((threat) => {
    const from = state.cities[threat.from];
    const to = state.cities[threat.to];
    return `${FACTIONS[threat.faction].name} is on the road from ${from?.name || "a city"} toward ${to?.name || "you"}.`;
  }).join(" ");
  const tip = !state.dismissedTip && state.turn === 1
    ? `<div class="tip"><b>First month.</b> ${esc(FACTIONS[state.player].blurb)} Cities already have a job. Leave them, or spend the month on one interruption. Your march waits at the gate. An enemy already coming sits partway along the road.<div><button data-act="dismiss-tip">Understood</button></div></div>`
    : "";
  return `<div class="game">
    <header class="topbar">
      <div class="who">${face(ruler, "tiny")}<div><h1>${esc(ruler?.name || FACTIONS[state.player].name)}</h1><div class="when" title="${esc(aim?.text || "")}">${esc(monthLabel(state))}${aim ? ` · ${esc(aim.title)}` : ""}</div></div></div>
      <div class="resources">
        <div><span>Cities</span><b>${t.cities}</b></div>
        <div><span>Gold</span><b>${t.gold.toLocaleString()}</b></div>
        <div><span>Grain</span><b>${t.rice.toLocaleString()}</b></div>
        <div title="How long the granaries feed the camps at this month's rations"><span>Food</span><b>${esc(foodLabel)}</b></div>
        <div><span>Troops</span><b>${t.soldiers.toLocaleString()}</b></div>
        <div><span>Orders</span><b>${oneOffs}</b></div>
      </div>
      <div class="top-actions">
        <button data-act="advise" data-testid="advise" title="Two or three officers will each propose one plan. Fund one.">Advice</button>
        <button class="primary ready" data-act="end-month" data-testid="end-month" title="Cities you leave alone repeat last month's job">End month</button>
        <button data-act="help" title="Rules for a month, the court, and battle">How to play</button>
        <button data-act="roster">Roster</button>
        <button data-act="save" title="Keep this campaign in the browser">Save</button>
        <button data-act="title" title="Return to the list of lords">Menu</button>
      </div>
    </header>
    <div class="mapwrap season-${seasonName(state.month)}">
      ${mapSvg(state)}
      <div class="legend" aria-hidden="true">
        <span><i class="dot you"></i>Your walls</span>
        <span><i class="dot march"></i>Your order</span>
        <span><i class="dot threat"></i>Enemy on the road</span>
      </div>
      ${threatText ? `<p class="threat-banner">${esc(threatText)}</p>` : ""}
      <p class="map-hint">${oneOffs ? `${oneOffs} one-off ${oneOffs === 1 ? "order" : "orders"}. Other cities keep their jobs.` : "No one-off orders. Every city keeps its job."}</p>
    </div>
    <aside class="side">${tip}${intrigueCard(state)}${city ? cityPanel(state, city) : ""}</aside>
    <section class="chronicle" aria-label="Chronicle"><h2>Chronicle</h2><div class="lines">${state.log.slice(0, 12).map((l, i) => `<p class="${l.mine ? "mine" : ""} ${i === 0 ? "fresh" : ""}">${esc(l.text)}</p>`).join("")}</div></section>
  </div>`;
}

const LABEL_AT = {
  ye: [-10, -36],
  puyang: [-8, 18],
  xiaopei: [6, -38],
  xiapi: [10, 18],
  donghai: [8, -36],
  chengdu: [20, 18],
  tianshui: [0, -36],
  shouchun: [0, -36],
  xiangyang: [-8, -36],
  jinyang: [-26, 18],
  jianye: [0, 18],
  wu: [14, 18],
};

function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

function rnd(n) {
  return Math.round(n * 10) / 10;
}

function peakMark(x, y, s) {
  return `<path class="peak" d="M${x - s},${y} l${s},${rnd(-s * 1.45)} l${rnd(s * 0.85)},${rnd(s * 1.45)} z"/>`;
}

function jobGlyph(job) {
  if (job === "fields") return `<g class="job-mark wheat"><path d="M0,6 q1.1,-4.5 0,-6.4 M1.8,6 q1,-4 0,-5.4 M-1.8,6 q-1,-4 0,-5.2"/></g>`;
  if (job === "dikes") return `<path class="job-mark dike" d="M-3,4 q1.6,-2.2 3.2,0 t3.2,0"/>`;
  if (job === "markets") return `<circle class="job-mark coin" cx="0" cy="3" r="2.1"/>`;
  if (job === "drill") return `<g class="job-mark spear"><line x1="0" y1="6" x2="0" y2="-2"/><path d="M0,-2 l1.3,2.1 h-2.6 z"/></g>`;
  if (job === "patrol") return `<circle class="job-mark patrol" r="1.45" cx="0" cy="3"/>`;
  if (job === "walls") return `<rect class="job-mark mason" x="-2.2" y="1.5" width="4.4" height="3.2"/>`;
  if (job === "levy") return `<g class="job-mark levy"><circle cx="-1.6" cy="2.2" r="1.05"/><circle cx="1.6" cy="2.6" r="1.05"/></g>`;
  return "";
}

function townMark(state, city) {
  const color = FACTIONS[city.faction].color;
  const mine = city.faction === state.player;
  const selected = city.id === state.selected;
  const ally = !mine && isAllied(state, state.player, city.faction);
  const ordered = !!state.orders[city.id];
  const threatened = (state.threats || []).some((threat) => threat.to === city.id);
  const emperor = state.emperorAt === city.id;
  const changed = session.changed?.has(city.id);
  const nudge = LABEL_AT[city.id] || [0, 16];
  const w = Math.max(48, Math.ceil(city.name.length * 7.2 + 14));
  const y = nudge[1];
  const men = city.soldiers >= 1000 ? `${Math.round(city.soldiers / 100) / 10}k` : String(city.soldiers);
  const job = mine ? jobGlyph(city.job) : "";
  return `<g class="city ${mine ? "is-mine" : ""} ${selected ? "is-selected" : ""} ${ally ? "is-ally" : ""} ${threatened ? "is-threatened" : ""} ${emperor ? "is-emperor" : ""} ${changed ? "just-changed" : ""}" data-act="select" data-id="${city.id}" data-testid="city-${city.id}" transform="translate(${city.x} ${city.y})">
    <title>${esc(city.name)} · ${esc(FACTIONS[city.faction].name)} · ${city.soldiers.toLocaleString()} troops</title>
    <circle class="hit" r="22"/>
    ${selected ? `<circle class="ring" r="20"/>` : ""}
    ${threatened ? `<circle class="threat-ring" r="18"/>` : ""}
    ${changed ? `<circle class="taken-flash" r="16"/>` : ""}
    ${ally ? `<circle class="ally-mark" r="22"/>` : ""}
    ${emperor ? `<circle class="emperor-glow" r="15"/>` : ""}
    <ellipse class="shade" cx="0" cy="9.2" rx="15" ry="2.8"/>
    <path class="keep" d="M-12,8 L-12,-1 L-9,-1 L-9,-5.2 L-5,-5.2 L-5,-1 L-1,-1 L-1,-5.2 L3,-5.2 L3,-1 L7,-1 L7,-5.2 L11,-5.2 L11,-1 L12,-1 L12,8 Z"/>
    <polygon class="roof" points="-6.2,-5 0,-14 6.2,-5" fill="${color}"/>
    <line class="ridge" x1="-5.6" y1="-5.4" x2="0" y2="-13.2"/>
    <line class="ridge" x1="5.6" y1="-5.4" x2="0" y2="-13.2"/>
    <rect class="slit" x="-7.6" y="0.4" width="1.4" height="3.5"/>
    <rect class="slit" x="6.1" y="0.4" width="1.4" height="3.5"/>
    <rect class="gate" x="-2.1" y="2.2" width="4.2" height="5.8"/>
    <g class="banner-flag">
      <line x1="13" y1="2" x2="13" y2="-21"/>
      <g transform="translate(13 -21)">
        <path class="cloth" d="M0,0 h15 l-3.1,4.6 3.1,4.6 H0 z" fill="${color}" stroke="rgba(255,248,236,0.8)" stroke-width="0.6"/>
      </g>
    </g>
    ${job ? `<g class="job" transform="translate(-16 1)">${job}</g>` : ""}
    <text class="garrison" y="20">${men}</text>
    ${emperor ? `<text class="emperor-mark" y="-22">帝</text>` : ""}
    ${ordered ? `<circle class="order-pip" cx="-15" cy="-15" r="3.6"/>` : ""}
    <g class="placard" transform="translate(${nudge[0]} 0)">
      <rect x="${-w / 2}" y="${y}" width="${w}" height="16" rx="1.5"/>
      <text y="${y + 12}">${esc(city.name)}</text>
    </g>
  </g>`;
}

function roadSpan(A, B) {
  if (!A || !B) return null;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const inset = Math.min(16, Math.max(10, len * 0.16));
  return {
    x1: A.x + (dx / len) * inset,
    y1: A.y + (dy / len) * inset,
    x2: B.x - (dx / len) * inset,
    y2: B.y - (dy / len) * inset,
    len,
  };
}

function columnBody(kind, color) {
  if (kind === "shift") {
    return `<rect x="-6.5" y="-4.2" width="13" height="8.4" rx="1.4" fill="${color}" stroke="#24170f" stroke-width="0.8"/>`;
  }
  return `<circle r="6.4" fill="${color}" stroke="#24170f" stroke-width="0.9"/><path d="M3.2,-2.4 h10.5 l-2.2,3.2 2.2,3.2 h-10.5 z" fill="${color}" stroke="#24170f" stroke-width="0.55"/>`;
}

function along(span, t) {
  return {
    x: span.x1 + (span.x2 - span.x1) * t,
    y: span.y1 + (span.y2 - span.y1) * t,
  };
}

function columnMark(A, B, kind) {
  const span = roadSpan(A, B);
  if (!span) return "";
  const color = kind === "spied" ? "#1d4578" : kind === "shift" ? "#1c3d34" : (FACTIONS[A.faction]?.color || "#8d2e2a");
  const body = columnBody(kind, color);
  const label = kind === "threat" ? "Enemy column" : kind === "spied" ? "Reported march" : kind === "shift" ? "Men shifting" : "Your column";
  const ang = Math.atan2(span.y2 - span.y1, span.x2 - span.x1) * 180 / Math.PI;
  const face = `<g class="column-face" transform="rotate(${rnd(ang)})"><title>${label}</title>${body}</g>`;
  const restT = kind === "threat" ? 0.7 : kind === "spied" ? 0.4 : 0;
  const rest = along(span, restT);
  const from = `${rnd(rest.x)} ${rnd(rest.y)}`;
  const to = `${rnd(span.x2)} ${rnd(span.y2)}`;
  if (!motionOk()) {
    return `<g class="column ${kind}" transform="translate(${from})">${face}</g>`;
  }
  const remain = Math.hypot(span.x2 - rest.x, span.y2 - rest.y);
  const dur = Math.max(0.55, Math.min(0.95, remain / 220)).toFixed(2);
  return `<g class="column ${kind}" transform="translate(${from})">
    <animateTransform attributeName="transform" type="translate" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 0.84 0.2 1" data-from="${from}" data-to="${to}" values="${from}; ${to}" dur="${dur}s"/>
    ${face}
  </g>`;
}

function arrowLine(A, B, kind) {
  const span = roadSpan(A, B);
  if (!span) return { line: "", column: "" };
  const marker = kind === "shift" ? "shift" : kind === "spied" ? "spied" : "march";
  return {
    line: `<line class="move-arrow ${kind}" x1="${rnd(span.x1)}" y1="${rnd(span.y1)}" x2="${rnd(span.x2)}" y2="${rnd(span.y2)}" marker-end="url(#arrow-${marker})"/>`,
    column: columnMark(A, B, kind),
  };
}

function movementArrows(state) {
  const pieces = [];
  for (const [fromId, order] of Object.entries(state.orders)) {
    if (!order?.to || !["march", "transfer", "move", "escort"].includes(order.type)) continue;
    const kind = order.type === "march" ? "march" : "shift";
    pieces.push(arrowLine(state.cities[fromId], state.cities[order.to], kind));
  }
  for (const threat of state.threats || []) {
    pieces.push(arrowLine(state.cities[threat.from], state.cities[threat.to], "threat"));
  }
  if (state.revealed) {
    for (const [fromId, order] of Object.entries(state.shadowOrders || {})) {
      if (order?.type !== "march" || state.cities[fromId]?.faction !== state.revealed) continue;
      if ((state.threats || []).some((threat) => threat.from === fromId)) continue;
      pieces.push(arrowLine(state.cities[fromId], state.cities[order.to], "spied"));
    }
  }
  return {
    lines: pieces.map((piece) => piece.line).join(""),
    columns: pieces.map((piece) => piece.column).join(""),
  };
}

function seasonWash(month) {
  const season = seasonName(month);
  if (season === "summer") return "#e2a84a";
  if (season === "autumn") return "#c4622a";
  if (season === "winter") return "#d7e6f0";
  return "#7f9a55";
}


function mapSvg(state) {
  for (const src of CITIES) {
    const city = state.cities[src.id];
    const place = PLACES[src.id];
    if (city && place) {
      city.x = place.x;
      city.y = place.y;
    }
  }
  const roads = EDGES.map(([a, b]) => {
    const A = state.cities[a];
    const B = state.cities[b];
    const pass = PASS_ROADS.has(edgeKey(a, b)) ? " pass" : "";
    return `<path class="road${pass}" d="M ${A.x} ${A.y} L ${B.x} ${B.y}"/>`;
  }).join("");
  const rivers = RIVERS.map((r) => {
    const bank = r.rank === "major" ? `<path class="river bank ${r.rank}" d="${r.d}"/>` : "";
    return `${bank}<path class="river ${r.rank}" d="${r.d}"/>`;
  }).join("");
  const notes = NOTES.map((n) => {
    const sea = n.t === "BOHAI" || n.t.endsWith("SEA");
    return `<text class="${sea ? "seaname" : "watername"}" x="${n.x}" y="${n.y}" text-anchor="middle">${n.t}</text>`;
  }).join("");
  const nodes = Object.values(state.cities).map((c) => townMark(state, c)).join("");
  const moves = movementArrows(state);
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Map of the late Han, traced from the real coast and rivers">
    <defs>
      <linearGradient id="seaShade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d5ebf0"/>
        <stop offset="0.55" stop-color="#9ec2cd"/>
        <stop offset="1" stop-color="#6f97a6"/>
      </linearGradient>
      <linearGradient id="landShade" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#f0e2c4"/>
        <stop offset="1" stop-color="#c9b084"/>
      </linearGradient>
      <filter id="grain" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4"/>
        <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0 0.14  0 0 0 0.22 0"/>
      </filter>
      <marker id="arrow-march" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#8d2e2a"/>
      </marker>
      <marker id="arrow-shift" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#1c3d34"/>
      </marker>
      <marker id="arrow-spied" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#1d4578"/>
      </marker>
    </defs>
    <rect class="sea" width="${MAP_W}" height="${MAP_H}"/>
    <path class="grat" d="${GRATICULE}"/>
    <path class="land" fill="url(#landShade)" fill-rule="evenodd" d="${LAND}"/>
    <path class="season-wash" fill="${seasonWash(state.month)}" fill-rule="evenodd" d="${LAND}"/>
    <path class="grain" filter="url(#grain)" fill-rule="evenodd" d="${LAND}"/>
    <path class="lake" d="${LAKES}"/>
    ${PEAKS.map(([x, y, s]) => peakMark(x, y, s)).join("")}
    <path class="wall" d="${WALL}"/>
    ${rivers}
    ${notes}
    ${GRAT_LABELS.map((g) => `<text class="grat-label" text-anchor="${g.anchor}" x="${g.x}" y="${g.y}">${g.t}</text>`).join("")}
    ${roads}
    ${moves.lines}
    <g class="compass" transform="translate(868 688)" aria-hidden="true">
      <circle r="18" />
      <polygon class="north" points="0,-14 3.2,1 0,4 -3.2,1"/>
      <polygon class="south" points="0,14 3.2,-1 0,-4 -3.2,-1"/>
      <text y="-20">N</text>
    </g>
    ${nodes}
    ${moves.columns}
  </svg>`;
}

function cityPanel(state, city) {
  const mine = city.faction === state.player;
  const ruler = rulerOfficer(state, city.faction);
  const officers = activeInCity(state, city);
  const guests = guestsIn(state, city);
  const order = state.orders[city.id];
  const shownJob = order?.type === "job" ? order.job : city.job;
  const pay = projectedIncome(state, city);
  const food = foodOutlook(state, city);
  const foodText = food.months == null ? "no mouths to feed" : `${food.months.toFixed(1)} months of food`;
  const seasonWord = pay.season.charAt(0).toUpperCase() + pay.season.slice(1);
  const govLine = pay.governor
    ? `${pay.governor} governs. Gold ×${pay.goldMult.toFixed(2)}, grain ×${pay.grainMult.toFixed(2)}.`
    : "The governor is away. This month pays the base yield.";
  const rel = mine ? "" : `<p>Standing with ${esc(FACTIONS[city.faction].name)}: <b>${relationOf(state, state.player, city.faction)}</b>${isAllied(state, state.player, city.faction) ? " · allied this year" : ""}</p>`;
  const chips = officers.map((o) => `<button class="officer-chip" data-act="dossier" data-id="${o.id}">
    ${face(o, "tiny")}<span><b>${esc(o.name)}</b><small>${isRuler(state, o) ? "Ruler" : city.governor === o.id ? "Governor" : "Officer"} · loyalty ${o.loyalty}</small></span>
  </button>`).join("");
  const guestHtml = guests.map((o) => `<button class="guest-chip" data-act="dossier" data-id="${o.id}">
    ${face(o, "tiny")}<span><b>${esc(o.name)}</b><small>Guest · visit ${o.visits}/${o.visitsNeeded || 1}</small></span>
  </button>`).join("");
  const emperorHere = state.emperorAt === city.id;
  const jobButtons = Object.values(JOBS).map((job) => {
    const on = shownJob === job.id && (!order || order.type === "job");
    return `<button class="${on ? "is-current" : ""}" title="${esc(job.hint)} Costs ${job.cost} gold." aria-pressed="${on}" data-act="set-job" data-job="${job.id}" data-testid="job-${job.id}">${job.label}</button>`;
  }).join("");
  const oneOff = order && order.type !== "job";
  const cmds = mine ? `<h3>Standing job</h3>
    <div class="commands jobs">${jobButtons}</div>
    <h3>One-off order</h3>
    <div class="commands">
      <button data-act="search-order" data-city="${city.id}" class="${order?.type === "search" ? "is-current" : ""}" title="Look for a recluse, or a cache. The job waits.">Search</button>
      <button data-act="reward" data-city="${city.id}" class="${order?.type === "reward" ? "is-current" : ""}" title="Spend 100 gold to raise a retainer's loyalty">Reward</button>
      <button data-act="shift" data-city="${city.id}" title="Send men or an officer to a neighboring city of yours">Shift men</button>
      <button class="${order?.type === "march" ? "is-current" : ""}" data-act="march" data-city="${city.id}" data-type="march" data-testid="cmd-march" title="Attack a neighboring enemy city. The governor, if he goes, does not raise this month's yield.">March</button>
      <button data-act="spy" data-city="${city.id}" class="${order?.type === "spy" ? "is-current" : ""}" title="Spend 60 gold. Next month you see that lord's orders, not only the marches aimed at you.">Spy</button>
      ${guests.length ? `<button data-act="employ" data-city="${city.id}" title="Visit a guest. Some require more than one call">Call on a guest</button>` : ""}
      ${emperorHere ? `<button data-act="escort" data-city="${city.id}" data-testid="cmd-escort" title="Move the emperor to a city you hold and claim the mandate. Neighbors will resent it.">Escort the emperor</button>` : ""}
    </div>` : foreignActions(state, city);
  const workLine = oneOff
    ? `This month is spent on a one-off. The ${JOBS[city.job]?.label || "job"} waits.`
    : `Left alone, ${city.name} keeps working the ${JOBS[shownJob]?.label || "job"}.`;
  return `<div class="province">${esc(city.province)} province${emperorHere ? " · the emperor is here" : ""}</div>
    <h2>${esc(city.name)}</h2>
    <div class="ownerline">${esc(FACTIONS[city.faction].name)}${ruler ? ` · ${esc(ruler.name)}` : ""}</div>
    ${rel}
    <div class="pair"><div><span>Gold</span><b>${city.gold.toLocaleString()}</b></div><div><span>Grain</span><b>${city.rice.toLocaleString()}</b></div><div><span>Troops</span><b>${city.soldiers.toLocaleString()}</b></div></div>
    <p class="yield" data-testid="yield">${esc(seasonWord)}. About ${pay.gold.toLocaleString()} gold and ${pay.rice.toLocaleString()} grain, against ${pay.upkeep.toLocaleString()} rations. ${esc(foodText)}. ${esc(govLine)}</p>
    <p class="yield-job">${esc(workLine)}</p>
    ${order ? `<div class="order-flag">This month: ${esc(orderLabel(state, order))} <button data-act="clear-order" data-city="${city.id}">Clear</button></div>` : ""}
    ${cmds}
    <div class="officer-row">${chips || "<p>No officers in the city.</p>"}</div>
    ${mine && officers.length > 1 ? `<div class="choice-grid">${officers.map((o) => `<button data-act="appoint" data-city="${city.id}" data-id="${o.id}" title="The governor's intellect and leadership change this city's gold and grain">${city.governor === o.id ? "Governor" : "Appoint"} ${esc(o.name)}</button>`).join("")}</div>` : ""}
    ${guestHtml ? `<h3>Guests</h3><div class="officer-row">${guestHtml}</div>` : ""}
    <div class="meters">
      ${meter("Farmland", city.land)}
      ${meter("Dikes", city.flood)}
      ${meter("Markets", city.trade, "gold")}
      ${meter("People", city.people)}
      ${meter("Walls", city.walls)}
      ${meter("Training", city.training, "war")}
    </div>
    ${orderSummary(state)}
    ${planNote(state)}`;
}

function marchSizes(soldiers) {
  const raw = [800, 1500, Math.round(soldiers * 0.6), Math.max(400, soldiers - 200)];
  return raw.filter((n, i, a) => n >= 400 && n <= soldiers && a.indexOf(n) === i).sort((a, b) => a - b);
}

function orderSummary(state) {
  const rows = factionCities(state, state.player)
    .filter((c) => state.orders[c.id] && c.id !== state.selected)
    .map((c) => `${c.name}: ${orderLabel(state, state.orders[c.id])}`);
  if (!rows.length) return "";
  return `<div class="order-flag">${rows.map((row) => esc(row)).join("<br>")}</div>`;
}

function intrigueCard(state) {
  const view = caseView(state);
  if (!view) return "";
  const followed = intrigueFollowed(state);
  const button = view.canAct
    ? `<button data-act="follow-intrigue" data-testid="follow-intrigue">${esc(view.action)}</button>`
    : followed
      ? `<p class="fine">The order follows the case.</p>`
      : "";
  return `<div class="intrigue" data-testid="intrigue">
    <h3>The case</h3>
    <p>${esc(view.rumor)}</p>
    ${view.detail ? `<p>${esc(view.detail)}</p>` : ""}
    <p class="fine">It will not keep past this season.</p>
    ${button}
  </div>`;
}

function planNote(state) {
  const bits = [];
  if (state.diplomacy?.type === "gift") bits.push(`Gift of ${state.diplomacy.gold} gold set aside`);
  if (state.diplomacy?.type === "alliance") bits.push(`Alliance offered to ${FACTIONS[state.diplomacy.faction].name}`);
  if (state.diplomacy?.type === "break") bits.push(`Alliance with ${FACTIONS[state.diplomacy.faction].name} will break`);
  if (state.diplomacy?.type === "demand") bits.push(`Surrender demanded of ${FACTIONS[state.diplomacy.faction].name}`);
  if (state.plot?.cityId) bits.push(`Rumors aimed at ${state.cities[state.plot.cityId].name}`);
  if (state.revealed && FACTIONS[state.revealed]) {
    const known = Object.entries(state.shadowOrders || [])
      .filter(([cityId]) => state.cities[cityId]?.faction === state.revealed)
      .map(([cityId, order]) => `${state.cities[cityId].name}: ${orderLabel(state, order)}`);
    bits.push(known.length
      ? `You know ${FACTIONS[state.revealed].name}'s plans. ${known.join(". ")}`
      : `${FACTIONS[state.revealed].name} is leaving every city at its job`);
  }
  return bits.length ? `<p>${esc(bits.join(". "))}.</p>` : "";
}

function cmd(type, label, hint, current) {
  const on = current === type;
  return `<button class="${on ? "is-current" : ""}" title="${esc(hint)}" aria-pressed="${on}" data-act="order" data-type="${type}">${label}</button>`;
}

function foreignActions(state, city) {
  const borders = factionCities(state, state.player).filter((c) => c.neighbors.includes(city.id));
  const march = borders.map((c) => `<button data-act="march" data-city="${c.id}" data-to="${city.id}">March from ${esc(c.name)}</button>`).join("");
  const price = alliancePrice(state, city.faction);
  const allied = isAllied(state, state.player, city.faction);
  const pact = allied
    ? `<p>Allied until the oath runs out.</p><button data-act="break" data-faction="${city.faction}">Break alliance</button>`
    : price.blocked
      ? `<p>They will not hear a gift or an oath while you are marching on them.</p>`
      : `<button data-act="gift" data-faction="${city.faction}">Send gold</button>
         <button data-act="alliance" data-faction="${city.faction}" data-testid="alliance">Alliance · ${price.gold.toLocaleString()} gold for a year</button>`;
  const mandate = state.mandate === state.player ? " The court speaks in your name, which makes a demand heavier." : "";
  return `<div class="stack">
    ${march || "<p>No army of yours stands on a road into this city.</p>"}
    ${pact}
    <button data-act="demand" data-faction="${city.faction}">Demand surrender</button>
    <p class="fine">A demand lands only on a lord with one city, and only if you have more than twice the troops.${esc(mandate)}</p>
    <button data-act="plot" data-city="${city.id}">Sow discord</button>
  </div>`;
}

function closeModal() {
  modal.innerHTML = "";
  session.draft = null;
}

function openModal(html, wide = false) {
  modal.innerHTML = `<div class="modal-back"><div class="modal ${wide ? "wide" : ""}" role="dialog">${html}</div></div>`;
}

function onClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const state = session.state;
  if (act === "play") {
    session.state = createGame(el.dataset.faction);
    note(session.state, `${FACTIONS[el.dataset.faction].name} takes the field.`);
    closeModal();
    render();
    return;
  }
  if (act === "continue") {
    const saved = loadSave();
    if (saved) {
      session.state = saved;
      closeModal();
      render();
    }
    return;
  }
  if (act === "title") {
    session.state = null;
    closeModal();
    render();
    return;
  }
  if (act === "help") { helpModal(); return; }
  if (act === "close") { closeModal(); return; }
  if (!state) return;
  if (act === "select") {
    state.selected = el.dataset.id;
    render();
    const side = document.querySelector(".side");
    if (side) side.scrollTo({ top: 0, behavior: motionOk() ? "smooth" : "auto" });
    return;
  }
  if (act === "dismiss-tip") { state.dismissedTip = true; render(); return; }
  if (act === "follow-intrigue") {
    const res = followIntrigue(state);
    if (!res.ok) toast(res.reason || "That order cannot be given.");
    else if (state.intrigue?.solve?.fromCityId) {
      const city = state.cities[state.intrigue.solve.fromCityId];
      const order = city && state.orders[city.id];
      if (city && order) note(state, `${city.name}: ${orderLabel(state, order)}.`, true);
    }
    render();
    return;
  }
  if (act === "save") {
    save(state);
    note(state, "The campaign is sealed in this browser.");
    render();
    toast("Saved in this browser.");
    return;
  }
  if (act === "roster") { rosterModal(state); return; }
  if (act === "dossier") { dossierModal(state, el.dataset.id); return; }
  if (act === "appoint") {
    const city = state.cities[el.dataset.city];
    if (city && city.officerIds.includes(el.dataset.id)) {
      city.governor = el.dataset.id;
      note(state, `${state.officers[el.dataset.id].name} is governor of ${city.name}.`);
      render();
    }
    return;
  }
  if (act === "clear-order") { clearCityOrder(state, el.dataset.city); render(); return; }
  if (act === "set-job") {
    const city = state.cities[state.selected];
    if (!city) return;
    const job = el.dataset.job;
    if (city.job === job && (!state.orders[city.id] || state.orders[city.id].type === "job")) {
      clearCityOrder(state, city.id);
      render();
      return;
    }
    const res = issueOrder(state, city.id, { type: "job", job });
    if (!res.ok) toast(res.reason);
    else note(state, `${city.name}: ${orderLabel(state, state.orders[city.id])}.`, true);
    render();
    return;
  }
  if (act === "search-order") {
    const city = state.cities[el.dataset.city];
    if (!city) return;
    const res = issueOrder(state, city.id, { type: "search" });
    if (!res.ok) toast(res.reason);
    else note(state, `${city.name}: search the countryside. The job waits.`, true);
    render();
    return;
  }
  if (act === "order") {
    const city = state.cities[state.selected];
    if (!city) return;
    const res = issueOrder(state, city.id, { type: el.dataset.type });
    if (!res.ok) {
      note(state, res.reason);
      render();
      toast(res.reason);
    } else {
      note(state, `${city.name}: ${orderLabel(state, state.orders[city.id])}.`, true);
      render();
    }
    return;
  }
  if (act === "advise") { courtModal(state); return; }
  if (act === "fund-plan") {
    const plan = session.proposals?.[Number(el.dataset.index)];
    const res = plan ? fundPlan(state, plan) : { ok: false, reason: "That plan has gone." };
    if (!res.ok) toast(res.reason);
    else note(state, `${state.officers[plan.speakerId]?.name || "An officer"} is funded. ${state.cities[plan.cityId].name}: ${orderLabel(state, plan.order)}.`, true);
    closeModal();
    render();
    return;
  }
  if (act === "end-month") { endMonth(); return; }
  if (act === "reward") { rewardModal(state, el.dataset.city); return; }
  if (act === "shift") { shiftModal(state, el.dataset.city); return; }
  if (act === "march") { marchModal(state, el.dataset.city, el.dataset.to || null); return; }
  if (act === "employ") { employModal(state, el.dataset.city); return; }
  if (act === "spy") { spyModal(state, el.dataset.city); return; }
  if (act === "escort") { escortModal(state, el.dataset.city); return; }
  if (act === "pick-spy") {
    const res = issueOrder(state, session.draft.cityId, { type: "spy", faction: el.dataset.faction });
    if (!res.ok) toast(res.reason);
    else note(state, `Agents will watch ${FACTIONS[el.dataset.faction].name}.`, true);
    closeModal();
    render();
    return;
  }
  if (act === "pick-escort") {
    const res = issueOrder(state, session.draft.cityId, { type: "escort", to: el.dataset.id });
    if (!res.ok) toast(res.reason);
    else note(state, `The emperor will be escorted to ${state.cities[el.dataset.id].name}.`, true);
    closeModal();
    render();
    return;
  }
  if (act === "gift") {
    if (playerMarchingOn(state, el.dataset.faction)) {
      toast("A gift is worthless while you are marching on them.");
      return;
    }
    giftModal(state, el.dataset.faction);
    return;
  }
  if (act === "alliance") {
    const price = alliancePrice(state, el.dataset.faction);
    if (price.blocked) {
      toast("They will not swear while your army is on their road.");
      return;
    }
    const res = setDiplomacy(state, { type: "alliance", faction: el.dataset.faction });
    note(state, res.ok ? `An envoy will offer ${FACTIONS[el.dataset.faction].name} a year-long oath for ${price.gold.toLocaleString()} gold.` : res.reason);
    render();
    return;
  }
  if (act === "break") {
    setDiplomacy(state, { type: "break", faction: el.dataset.faction });
    note(state, `You will break with ${FACTIONS[el.dataset.faction].name} at month's end.`);
    render();
    return;
  }
  if (act === "demand") {
    setDiplomacy(state, { type: "demand", faction: el.dataset.faction });
    note(state, `A demand of surrender will be sent to ${FACTIONS[el.dataset.faction].name}.`);
    render();
    return;
  }
  if (act === "plot") {
    setPlot(state, { type: "discord", cityId: el.dataset.city });
    note(state, `Rumors are prepared for ${state.cities[el.dataset.city].name}.`);
    render();
    return;
  }
  if (act === "pick-reward") {
    const res = issueOrder(state, session.draft.cityId, { type: "reward", officerId: el.dataset.id });
    if (!res.ok) note(state, res.reason);
    closeModal();
    render();
    return;
  }
  if (act === "pick-employ") {
    const res = issueOrder(state, session.draft.cityId, { type: "employ", officerId: el.dataset.id });
    if (!res.ok) note(state, res.reason);
    closeModal();
    render();
    return;
  }
  if (act === "gift-amt") {
    setDiplomacy(state, { type: "gift", faction: session.draft.faction, gold: Number(el.dataset.gold) });
    note(state, `A gift of ${el.dataset.gold} gold is set aside.`);
    closeModal();
    render();
    return;
  }
  if (act === "toggle-officer") {
    const id = el.dataset.id;
    if (session.draft.officers.has(id)) session.draft.officers.delete(id);
    else if (session.draft.officers.size < 3) session.draft.officers.add(id);
    if (session.draft.kind === "march") marchModal(state, session.draft.fromId, session.draft.to);
    else shiftModal(state, session.draft.fromId);
    return;
  }
  if (act === "dest") {
    session.draft.to = el.dataset.id;
    if (session.draft.kind === "march") marchModal(state, session.draft.fromId, session.draft.to);
    else shiftModal(state, session.draft.fromId);
    return;
  }
  if (act === "soldiers") {
    session.draft.soldiers = Number(el.dataset.n);
    if (session.draft.kind === "march") marchModal(state, session.draft.fromId, session.draft.to);
    else shiftModal(state, session.draft.fromId);
    return;
  }
  if (act === "confirm-march") {
    const d = session.draft;
    const res = issueOrder(state, d.fromId, {
      type: "march",
      to: d.to,
      officers: [...d.officers],
      soldiers: d.soldiers,
    });
    if (!res.ok) note(state, res.reason);
    else note(state, `${state.cities[d.fromId].name}: ${orderLabel(state, state.orders[d.fromId])}.`, true);
    closeModal();
    render();
    return;
  }
  if (act === "confirm-shift") {
    const d = session.draft;
    const moving = [...d.officers];
    let res = { ok: true };
    if (moving.length && d.soldiers >= 100) {
      res = issueOrder(state, d.fromId, { type: "transfer", to: d.to, officers: moving, soldiers: d.soldiers });
    } else if (moving.length === 1 && d.soldiers < 100) {
      res = issueOrder(state, d.fromId, { type: "move", officerId: moving[0], to: d.to });
    } else if (d.soldiers >= 100) {
      res = issueOrder(state, d.fromId, { type: "transfer", to: d.to, officers: [], soldiers: d.soldiers });
    } else res = { ok: false, reason: "Choose men, an officer, or both." };
    if (!res.ok) note(state, res.reason);
    else note(state, `${state.cities[d.fromId].name}: ${orderLabel(state, state.orders[d.fromId])}.`, true);
    closeModal();
    render();
    return;
  }
  if (act === "battle-attack") return battleAct({ type: "attack" });
  if (act === "battle-duel") return battleAct({ type: "duel", officerId: session.actorId, targetId: session.targetId });
  if (act === "battle-scheme") return battleAct({ type: "scheme", officerId: session.actorId });
  if (act === "battle-rally") return battleAct({ type: "rally", officerId: session.actorId });
  if (act === "battle-withdraw") return battleAct({ type: "withdraw" });
  if (act === "battle-auto") return battleAuto();
  if (act === "pick-actor") { session.actorId = el.dataset.id || null; paintBattle(); return; }
  if (act === "pick-target") { session.targetId = el.dataset.id || null; paintBattle(); return; }
  if (act === "employ-prisoner") {
    recruitPrisoner(state, el.dataset.id, session.prisonCity);
    note(state, `${state.officers[el.dataset.id].name} takes service.`);
    session.prisoners = session.prisoners.filter((id) => id !== el.dataset.id);
    if (!session.prisoners.length) finishPrisoners();
    else paintPrisoners();
    return;
  }
  if (act === "release-prisoner") {
    const line = releasePrisoner(state, el.dataset.id);
    if (line) note(state, line);
    session.prisoners = session.prisoners.filter((id) => id !== el.dataset.id);
    if (!session.prisoners.length) finishPrisoners();
    else paintPrisoners();
    return;
  }
  if (act === "prisoners-done") {
    for (const id of [...session.prisoners]) {
      const line = releasePrisoner(state, id);
      if (line) note(state, line);
    }
    finishPrisoners();
  }
}

function rewardModal(state, cityId) {
  const city = state.cities[cityId];
  const list = activeInCity(state, city).filter((o) => !isRuler(state, o));
  session.draft = { cityId };
  openModal(`<h2>Reward a retainer</h2><p>Costs 100 gold. Raises loyalty.</p>
    <div class="choice-grid">${list.map((o) => `<button data-act="pick-reward" data-id="${o.id}">${esc(o.name)} · ${o.loyalty}</button>`).join("") || "<p>No retainer here needs a purse. The ruler cannot be bought.</p>"}
    <p><button data-act="close">Close</button></p>`);
}

function employModal(state, cityId) {
  session.draft = { cityId };
  const guests = guestsIn(state, cityId);
  openModal(`<h2>Call on a guest</h2><p>Some men require more than one visit. Zhuge Liang requires three.</p>
    <div class="choice-grid">${guests.map((o) => `<button data-act="pick-employ" data-id="${o.id}">${esc(o.name)} · visit ${o.visits}/${o.visitsNeeded || 1}</button>`).join("")}
    <p><button data-act="close">Close</button></p>`);
}

function giftModal(state, faction) {
  session.draft = { faction };
  openModal(`<h2>Gift to ${esc(FACTIONS[faction].name)}</h2>
    <div class="choice-grid">
      <button data-act="gift-amt" data-gold="200">200 gold</button>
      <button data-act="gift-amt" data-gold="500">500 gold</button>
      <button data-act="gift-amt" data-gold="1000">1000 gold</button>
    </div>
    <p><button data-act="close">Close</button></p>`);
}

function marchModal(state, fromId, preset) {
  const city = state.cities[fromId];
  const foes = city.neighbors
    .map((id) => state.cities[id])
    .filter((c) => c.faction !== city.faction && !isAllied(state, city.faction, c.faction));
  if (!session.draft || session.draft.kind !== "march" || session.draft.fromId !== fromId) {
    const ranked = activeInCity(state, city).slice().sort((a, b) => eff(b).war - eff(a).war);
    const sizes = marchSizes(city.soldiers);
    session.draft = {
      kind: "march",
      fromId,
      to: preset && foes.some((c) => c.id === preset) ? preset : foes[0]?.id,
      officers: new Set(ranked.slice(0, 3).map((o) => o.id)),
      soldiers: sizes[sizes.length - 1] || 400,
    };
  } else if (preset) session.draft.to = preset;
  const d = session.draft;
  const officers = activeInCity(state, city);
  openModal(`<h2>March from ${esc(city.name)}</h2>
    <p>${city.soldiers.toLocaleString()} soldiers are in camp. Leave a garrison. If the governor goes with them, this city pays the base yield.</p>
    <h3>Road</h3>
    <div class="choice-grid">${foes.map((c) => `<button class="pick ${d.to === c.id ? "on" : ""}" data-act="dest" data-id="${c.id}">${esc(c.name)} · ${c.soldiers.toLocaleString()} · walls ${c.walls}</button>`).join("") || "<p>No enemy road leaves this city.</p>"}</div>
    <h3>Officers (up to three)</h3>
    <div class="choice-grid">${officers.map((o) => `<button class="pick ${d.officers.has(o.id) ? "on" : ""}" data-act="toggle-officer" data-id="${o.id}">${esc(o.name)} · war ${eff(o).war}</button>`).join("")}</div>
    <h3>Soldiers</h3>
    <div class="choice-grid">
      ${marchSizes(city.soldiers).map((n) => `<button class="pick ${d.soldiers === n ? "on" : ""}" data-act="soldiers" data-n="${n}">${n.toLocaleString()}</button>`).join("")}
    </div>
    <p><button class="primary" data-act="confirm-march" data-testid="confirm-march">Order the march</button> <button data-act="close">Close</button></p>`);
}

function shiftModal(state, fromId) {
  const city = state.cities[fromId];
  const friends = city.neighbors.map((id) => state.cities[id]).filter((c) => c.faction === city.faction);
  if (!session.draft || session.draft.kind !== "shift" || session.draft.fromId !== fromId) {
    session.draft = { kind: "shift", fromId, to: friends[0]?.id, officers: new Set(), soldiers: 0 };
  }
  const d = session.draft;
  const officers = activeInCity(state, city);
  openModal(`<h2>Shift from ${esc(city.name)}</h2>
    <p>Send an officer alone, soldiers alone, or both, to a neighboring city of yours.</p>
    <div class="choice-grid">${friends.map((c) => `<button class="pick ${d.to === c.id ? "on" : ""}" data-act="dest" data-id="${c.id}">${esc(c.name)}</button>`).join("") || "<p>No friendly neighbor.</p>"}</div>
    <h3>Officers</h3>
    <div class="choice-grid">${officers.map((o) => `<button class="pick ${d.officers.has(o.id) ? "on" : ""}" data-act="toggle-officer" data-id="${o.id}">${esc(o.name)}</button>`).join("")}</div>
    <h3>Soldiers</h3>
    <div class="choice-grid">
      <button class="pick ${d.soldiers === 0 ? "on" : ""}" data-act="soldiers" data-n="0">Officers only</button>
      ${[500, 1000, Math.max(100, Math.round(city.soldiers / 2))].filter((n) => n < city.soldiers).map((n) => `<button class="pick ${d.soldiers === n ? "on" : ""}" data-act="soldiers" data-n="${n}">${n.toLocaleString()}</button>`).join("")}
    </div>
    <p><button class="primary" data-act="confirm-shift">Confirm</button> <button data-act="close">Close</button></p>`);
}

function dossierModal(state, id) {
  const o = state.officers[id];
  if (!o) return;
  const s = eff(o);
  const gear = (o.gear || []).map((g) => ITEMS[g]?.name).filter(Boolean);
  openModal(`<div class="dossier">
    ${face(o, "lg")}
    <div>
      <h2>${esc(o.name)}</h2>
      <p>${o.courtesy ? `Courtesy ${esc(o.courtesy)}. ` : ""}${esc(o.bio || "")}</p>
      <div class="meters">
        ${meter("Leadership", s.lea)}
        ${meter("War", s.war, "war")}
        ${meter("Intellect", s.int, "gold")}
        ${meter("Charm", s.chr)}
        ${meter("Loyalty", o.loyalty)}
      </div>
      <p>${gear.length ? `Carries ${esc(gear.join(", "))}.` : "No named weapon."} Status: ${esc(o.status)}${o.alive ? "" : " · dead"}.</p>
      ${bondBlurb(o.id) ? `<p>${esc(bondBlurb(o.id))}</p>` : ""}
      <button data-act="close">Close</button>
    </div>
  </div>`);
}

function rosterModal(state) {
  const cards = Object.values(state.officers).map((o) => {
    if (o.status === "hidden") {
      const home = state.cities[o.homeCity];
      return `<div class="roster-card"><div class="face unknown"><span class="seal">?</span></div><b>Recluse</b><span>Somewhere near ${esc(home?.name || "the hills")}</span></div>`;
    }
    return `<button class="roster-card" data-act="dossier" data-id="${o.id}">${face(o, "")}<b>${esc(o.name)}</b><span>${esc(o.courtesy || "")} ${o.alive ? "" : "· fallen"}</span></button>`;
  }).join("");
  openModal(`<h2>Roster</h2><div class="roster-grid">${cards}</div><p><button data-act="close">Close</button></p>`, true);
}

function helpModal() {
  openModal(`<div class="help">
    <h2>How a month works</h2>
    <p>Every city has a standing job: fields, dikes, markets, drill, patrol, walls, or a levy. Leave it alone and the job repeats. Gold and grain arrive at the end of the month, and the governor changes the amount. A clever, steady governor pays more than a fighter in the same chair. Pull that governor onto a march and the city pays the base yield.</p>
    <p>Spring is lean, summer floods a low dike, autumn is the real harvest, and winter eats more and tires a march. The food number is how many months the granary covers at this season's rations.</p>
    <h3>One-off orders</h3>
    <p>Search, reward, shift, march, spy, or call on a guest spends the month. The job waits. You also get one diplomatic offer. The oath has a price, lasts a year, and is refused if you are already marching on that lord.</p>
    <h3>The case</h3>
    <p>One intrigue a season. Some lords hear only a rumor. A named lead is rarer. A quiet order solves it: spy, reward, search, a visit, or the lord riding out himself. Marching on that city can burn the chance. Ignore it until the season turns and it is lost. A solved case waits until the next season before another begins.</p>
    <h3>What you can see</h3>
    <p>Enemy marches aimed at you are on the map before the month resolves. Their other orders stay hidden unless you spied them last month. A weaker army moves first.</p>
    <h3>The court</h3>
    <p>Advice is two or three officers speaking in character. Fund one. Zhang Fei asks for a road or a drill. Xun Yu asks for dikes and markets. Chen Gong doubts Lü Bu. Zhang Liao's loyalty is thin.</p>
    <h3>Battle</h3>
    <p>You take the field when a ruler, an oath-brother, or a named rival is there. Other fights resolve themselves. A pass or a river crossing arrives short of men and spirit. A duel names both fighters, and the winner takes the weapon. Retreating while an oath-brother is down costs loyalty.</p>
    <p>When a house loses its last city, a loyal captain may burn the granary. Lü Bu's men scatter. Twelve cities, or the last banner, wins. Each lord also has an aim. Liu Bei and Cao Cao must escort the emperor out of Chang'an.</p>
    <h3>Guests</h3>
    <p>Search can turn a recluse into a guest. Calling on Zhuge Liang takes three visits, as in the novel. He waits near Xiangyang. The year is 194: the novel gathers him early; the histories made him wait.</p>
    <p><button data-act="close">Close</button></p>
  </div>`);
}

function courtModal(state) {
  const plans = courtProposals(state);
  session.proposals = plans;
  const cards = plans.map((plan, index) => {
    const speaker = state.officers[plan.speakerId];
    const cost = plan.cost ? `${plan.cost} gold when the month turns` : "No gold";
    return `<button class="court-card" data-act="fund-plan" data-index="${index}" data-testid="plan-${index}">
      ${face(speaker, "tiny")}
      <span><b>${esc(speaker?.name || "Officer")}</b><small>${esc(cost)}</small><span class="plan-line">${esc(plan.line)}</span></span>
    </button>`;
  }).join("");
  openModal(`<h2>The court</h2>
    <p>Fund one plan. The others keep their peace, and every city you do not touch repeats its job.</p>
    <div class="stack">${cards || "<p>No one in the camp has a proposal.</p>"}</div>
    <p><button data-act="close">Close</button></p>`);
}

function spyModal(state, cityId) {
  const city = state.cities[cityId];
  session.draft = { cityId };
  const factions = [...new Set(city.neighbors.map((id) => state.cities[id].faction).filter((id) => id && id !== city.faction))];
  openModal(`<h2>Spy from ${esc(city.name)}</h2>
    <p>Costs 60 gold. Next month you see that lord's orders. Marches aimed at you are already visible.</p>
    <div class="choice-grid">${factions.map((id) => `<button data-act="pick-spy" data-faction="${id}">${esc(FACTIONS[id].name)}</button>`).join("") || "<p>No neighboring lord to watch.</p>"}</div>
    <p><button data-act="close">Close</button></p>`);
}

function escortModal(state, cityId) {
  const city = state.cities[cityId];
  session.draft = { cityId };
  const homes = factionCities(state, state.player);
  openModal(`<h2>Escort the emperor</h2>
    <p>He is in ${esc(city.name)}. Move the court to a city you hold. Neighbors treat it as theft, and a later demand carries more weight.</p>
    <div class="choice-grid">${homes.map((home) => `<button data-act="pick-escort" data-id="${home.id}">${esc(home.name)}</button>`).join("")}</div>
    <p><button data-act="close">Close</button></p>`);
}

async function endMonth() {
  const state = session.state;
  if (!state || state.phase !== "planning" || session.busy) return;
  session.busy = true;
  closeModal();
  try {
    const before = {};
    for (const city of Object.values(state.cities)) before[city.id] = city.faction;
    if (motionOk()) {
      const columns = [...document.querySelectorAll(".column animateTransform")];
      screen.classList.add("turning");
      if (columns.length) screen.classList.add("arriving");
      let waitMs = columns.length ? 0 : 380;
      for (const node of columns) {
        const dur = Math.round(parseFloat(node.getAttribute("dur")) * 1000) || 700;
        waitMs = Math.max(waitMs, dur);
        try { node.beginElement(); } catch (err) { /* the column is waiting at its mark */ }
      }
      await wait(waitMs + 60);
      screen.classList.remove("turning", "arriving");
    }
    const rng = Math.random;
    const result = beginResolution(state, rng);
    if (!result) return;
    noteAll(state, result.logs);
    render();
    let battles = result.battles;
    if (result.envoy) {
      const accept = await envoyModal(result.envoy);
      for (const line of answerEnvoy(state, result.envoy, accept)) note(state, line);
      if (accept) {
        battles = battles.filter((b) => !(
          (b.attackerFaction === state.player && b.defenderFaction === result.envoy.from)
          || (b.defenderFaction === state.player && b.attackerFaction === result.envoy.from)
        ));
      }
    }
    for (const battle of battles) {
      const side = playerBattleSide(state, battle);
      const personal = battleIsPersonal(state, battle);
      if (!side || !personal) {
        autoplayBattle(state, battle, rng);
        const lines = applyBattleResult(state, battle);
        const city = state.cities[battle.toId];
        const settled = side && !personal ? `The fight at ${city.name} is settled without you. No ruler, oath-brother, or rival was on the field.` : "";
        note(state, `${FACTIONS[battle.attackerFaction].name} marches on ${city.name}. ${battle.winner === "attacker" ? `${city.name} falls.` : "The attack fails."}${settled ? ` ${settled}` : ""}`);
        for (const line of lines) note(state, line);
      } else {
        await playerBattle(state, battle, side, rng);
      }
      render();
    }
    if (state.pendingPrisoners?.length) {
      await prisonerFlow(state, state.pendingPrisoners, state.selected);
      state.pendingPrisoners = [];
    }
    const done = completeMonth(state, rng);
    noteAll(state, done.logs);
    session.changed = new Set(Object.keys(before).filter((id) => state.cities[id] && state.cities[id].faction !== before[id]));
    save(state);
    render();
    session.changed = null;
    if (done.outcome) outcomeModal(state, done.outcome);
  } finally {
    session.busy = false;
  }
}

function envoyModal(envoy) {
  return new Promise((resolve) => {
    session.after = resolve;
    openModal(`<h2>Envoy from ${esc(FACTIONS[envoy.from].name)}</h2>
      <p>Their standing with you is ${envoy.relation}. They offer alliance.</p>
      <p><button class="primary" data-act="envoy-yes">Accept</button> <button data-act="envoy-no">Refuse</button></p>`);
    modal.querySelector("[data-act=envoy-yes]").onclick = () => { closeModal(); resolve(true); };
    modal.querySelector("[data-act=envoy-no]").onclick = () => { closeModal(); resolve(false); };
  });
}

function playerBattle(state, battle, side, rng) {
  return new Promise((resolve) => {
    session.battle = battle;
    session.side = side;
    session.rng = rng;
    session.after = resolve;
    const mine = living(battle[side].units);
    const enemy = living(battle[side === "attacker" ? "defender" : "attacker"].units);
    session.actorId = mine[0]?.officerId || null;
    session.targetId = enemy[0]?.officerId || null;
    paintBattle();
  });
}

function living(units) {
  return units.filter((u) => !u.routed && !u.slain && u.soldiers > 0);
}

function battleAct(action) {
  const state = session.state;
  const battle = session.battle;
  if (!battle || battle.done) return;
  stepBattle(state, battle, session.side, action, session.rng || Math.random);
  if (battle.done) finishBattle();
  else paintBattle();
}

function battleAuto() {
  const state = session.state;
  const battle = session.battle;
  if (!battle || battle.done) return;
  autoplayBattle(state, battle, session.rng || Math.random);
  finishBattle();
}

function finishBattle() {
  const state = session.state;
  const battle = session.battle;
  const lines = applyBattleResult(state, battle);
  for (const line of lines) note(state, line, true);
  const caps = battle.captured || [];
  session.battle = null;
  render();
  if (caps.length) {
    session.prisoners = caps.slice();
    session.prisonCity = battle.toId;
    session.afterPrison = session.after;
    paintPrisoners();
  } else {
    closeModal();
    const done = session.after;
    session.after = null;
    if (done) done();
  }
}

function paintBattle() {
  const state = session.state;
  const battle = session.battle;
  if (!battle) return;
  const side = session.side;
  const foe = side === "attacker" ? "defender" : "attacker";
  const unitHtml = (pack, pickAct, selected) => pack.units.map((u) => {
    const o = u.officerId ? state.officers[u.officerId] : null;
    const name = o ? o.name : "City militia";
    const on = selected && u.officerId === selected;
    const fallen = u.slain || u.routed;
    const spirit = Math.max(0, Math.min(100, Math.round(u.morale || 0)));
    return `<button class="unit ${on ? "on" : ""} ${u.slain ? "slain" : ""} ${u.routed ? "routed" : ""} ${fallen ? "fallen" : ""}" data-act="${pickAct}" data-id="${u.officerId || ""}">
      ${face(o, "sm")}
      <span><b>${esc(name)}</b><span class="meta">${u.slain ? "Fallen" : u.routed ? "Routed" : `${u.soldiers.toLocaleString()} soldiers`}</span>${fallen ? "" : `<span class="spirit" title="Spirit ${spirit}"><i style="width:${spirit}%"></i></span>`}</span>
    </button>`;
  }).join("");
  const withdrawLabel = side === "attacker" ? "Retreat" : "Abandon the city";
  const atkColor = FACTIONS[battle.attackerFaction]?.color || "#8d2e2a";
  const defColor = FACTIONS[battle.defenderFaction]?.color || "#1c3d34";
  const latest = battle.log[battle.log.length - 1] || "";
  const clashKind = /duel/i.test(latest) ? "duel" : /stratagem|scheme/i.test(latest) ? "scheme" : "strike";
  openModal(`<div class="clash ${clashKind}" aria-hidden="true">
      <span class="banner" style="background:${atkColor}">${esc(FACTIONS[battle.attackerFaction].name)}</span>
      <span class="vs">${esc(state.cities[battle.toId].name)}</span>
      <span class="banner" style="background:${defColor}">${esc(FACTIONS[battle.defenderFaction].name)}</span>
    </div>
    <div class="battle-head">
      <h2>${esc(state.cities[battle.toId].name)}</h2>
      <div>Round ${battle.round} · walls ${battle.defender.walls}</div>
    </div>
    <div class="battle-cols">
      <div><h3>${side === "attacker" ? "Your march" : "Your defense"}</h3>${unitHtml(battle[side], "pick-actor", session.actorId)}</div>
      <div><h3>Enemy</h3>${unitHtml(battle[foe], "pick-target", session.targetId)}</div>
    </div>
    <div class="battle-log">${battle.log.slice(-8).map((l, i, arr) => `<p class="${i === arr.length - 1 ? "fresh" : ""}">${esc(l)}</p>`).join("")}</div>
    <div class="actions">
      <button class="primary" data-act="battle-attack" data-testid="battle-attack">Attack</button>
      <button data-act="battle-duel" data-testid="battle-duel">Duel</button>
      <button data-act="battle-scheme">Stratagem</button>
      <button data-act="battle-rally">Rally</button>
      <button data-act="battle-withdraw">${withdrawLabel}</button>
      <button data-act="battle-auto" data-testid="battle-auto">Resolve the rest</button>
    </div>`, true);
  const log = modal.querySelector(".battle-log");
  if (log) log.scrollTop = log.scrollHeight;
}

function prisonerFlow(state, ids, cityId) {
  return new Promise((resolve) => {
    session.prisoners = ids.slice();
    session.prisonCity = cityId && state.cities[cityId]?.faction === state.player ? cityId : factionCities(state, state.player)[0]?.id;
    session.afterPrison = resolve;
    paintPrisoners();
  });
}

function paintPrisoners() {
  const state = session.state;
  const city = state.cities[session.prisonCity];
  const rows = session.prisoners.map((id) => {
    const o = state.officers[id];
    return `<div class="officer-chip">${face(o, "tiny")}<span><b>${esc(o.name)}</b><small>${esc(o.bio || "")}</small></span>
      <button data-act="employ-prisoner" data-id="${id}">Employ</button>
      <button data-act="release-prisoner" data-id="${id}">Release</button></div>`;
  }).join("");
  openModal(`<h2>Prisoners</h2><p>They wait in ${esc(city?.name || "your camp")}. Lü Bu does not stay loyal.</p>${rows}
    <p><button data-act="prisoners-done">Release the rest</button></p>`);
}

function finishPrisoners() {
  closeModal();
  const done = session.afterPrison || session.after;
  session.afterPrison = null;
  session.after = null;
  session.prisoners = [];
  if (done) done();
}

function outcomeModal(state, outcome) {
  const win = outcome === "victory";
  openModal(`<h2>${win ? "The realm has a lord" : "The banner falls"}</h2>
    <p>${win ? `${esc(rulerOfficer(state, state.player)?.name || "Your house")} holds the passes that matter.` : "Your last city is gone. The chronicles move on without you."}</p>
    <p><button class="primary" data-act="title">Return to the seals</button></p>`);
}

