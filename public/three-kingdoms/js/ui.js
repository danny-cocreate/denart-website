import { CITIES, FACTIONS, FEATURED, ITEMS, SAVE_KEY } from "./data.js";
import {
  activeInCity,
  advise,
  answerEnvoy,
  applyBattleResult,
  autoplayBattle,
  beginResolution,
  clearCityOrder,
  completeMonth,
  createGame,
  eff,
  factionCities,
  guestsIn,
  isAllied,
  isRuler,
  issueOrder,
  monthLabel,
  orderLabel,
  playerBattleSide,
  recruitPrisoner,
  relationOf,
  releasePrisoner,
  rulerOfficer,
  setDiplomacy,
  setPlot,
  stepBattle,
  totals,
  EDGES,
} from "./logic.js";

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
};

let screen;
let modal;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
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
    if (!data || data.version !== 1 || !data.cities || !data.officers) return null;
    return data;
  } catch {
    return null;
  }
}

export function mount(app) {
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
    return `<button class="lord-card" data-act="play" data-faction="${id}" data-testid="play-${id}">
      ${face(art, "")}
      <span><span class="tag">${esc(f.tag)}</span><h2>${esc(f.name)}</h2><p>${esc(f.blurb)}</p></span>
    </button>`;
  };
  const rest = Object.keys(FACTIONS).filter((id) => !FEATURED.includes(id));
  return `<div class="screen-title">
    <header class="mast">
      <div class="eyebrow">194 CE · a strategy of the late Han</div>
      <h1>Warlords of the Three Kingdoms</h1>
      <p>Hold cities through the month. Open fields, keep the dikes, drill a camp, and march when the road is short. Charm holds a court together. A duel can break one.</p>
      <p class="note">Figures and places come from the histories and the public-domain novel. The portraits are original paintings. This is not a port of Koei’s game, and it is not affiliated with Koei Tecmo.</p>
    </header>
    <div class="title-actions">
      ${saved ? `<button class="primary" data-act="continue" data-testid="continue">Continue campaign</button>` : ""}
      <button class="ghost" data-act="help">How to play</button>
    </div>
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
  const tip = !state.dismissedTip && state.turn === 1
    ? `<div class="tip"><b>First month.</b> ${esc(FACTIONS[state.player].blurb)} <div><button data-act="dismiss-tip">Understood</button></div></div>`
    : "";
  return `<div class="game">
    <header class="topbar">
      <div class="who">${face(ruler, "tiny")}<div><h1>${esc(ruler?.name || FACTIONS[state.player].name)}</h1><div class="when">${esc(monthLabel(state))}</div></div></div>
      <div class="resources">
        <div><span>Cities</span><b>${t.cities}</b></div>
        <div><span>Gold</span><b>${t.gold.toLocaleString()}</b></div>
        <div><span>Grain</span><b>${t.rice.toLocaleString()}</b></div>
        <div><span>Troops</span><b>${t.soldiers.toLocaleString()}</b></div>
      </div>
      <div class="top-actions">
        <button data-act="advise" data-testid="advise">Steward</button>
        <button class="primary" data-act="end-month" data-testid="end-month">End month</button>
        <button data-act="help">Aid</button>
        <button data-act="roster">Roster</button>
        <button data-act="save">Save</button>
        <button data-act="title">Seal</button>
      </div>
    </header>
    <div class="mapwrap">${mapSvg(state)}</div>
    <aside class="side">${tip}${city ? cityPanel(state, city) : ""}</aside>
    <section class="chronicle">${state.log.slice(0, 16).map((l) => `<p class="${l.mine ? "mine" : ""}">${esc(l.text)}</p>`).join("")}</section>
  </div>`;
}

const COAST = [
  [150, 650], [250, 668], [380, 658], [520, 648], [660, 662], [790, 652], [880, 668],
  [950, 640], [975, 590], [945, 545], [985, 510], [960, 470], [990, 410], [975, 350],
  [955, 305], [910, 260], [860, 242], [815, 255], [845, 220], [910, 200], [955, 168],
  [935, 125], [875, 108], [815, 128], [770, 158], [735, 185], [700, 150], [725, 95],
  [680, 58], [560, 48], [430, 55], [310, 48], [200, 68], [145, 105], [100, 155],
  [78, 215], [108, 265], [72, 325], [100, 385], [68, 450], [95, 515], [70, 575], [105, 625],
];

const RIVERS = {
  yellow: "M 80,200 C 140,215 200,225 270,228 C 340,220 390,205 450,218 C 500,240 530,285 575,305 C 630,290 680,230 730,175 C 760,145 790,115 820,95",
  yangtze: "M 55,600 C 130,590 200,605 280,592 C 360,578 450,555 540,535 C 630,512 710,488 790,478 C 860,472 930,495 990,515",
  han: "M 250,420 C 320,435 390,452 450,472 C 500,495 530,520 555,548",
  huai: "M 500,400 C 570,430 650,455 740,448 C 830,440 920,420 990,400",
  wei: "M 145,312 C 210,306 260,300 330,252",
};

const ROAD_MIDS = {
  "beihai|beiping": [[705, 188], [778, 228], [835, 214]],
  "beihai|ye": [[730, 222]],
  "beihai|puyang": [[760, 250]],
  "jiangling|jianye": [[520, 565], [660, 535]],
  "jiangling|wu": [[500, 568], [680, 508], [820, 500], [870, 555]],
  "hanzhong|jiangling": [[290, 495]],
  "jianye|xiangyang": [[560, 455], [680, 490]],
  "donghai|xiaopei": [[770, 315]],
  "changan|hanzhong": [[250, 355]],
  "hanzhong|tianshui": [[175, 355]],
  "chengdu|hanzhong": [[175, 480]],
  "chenliu|shouchun": [[545, 425]],
  "shouchun|xiangyang": [[530, 465]],
  "jianye|wu": [[860, 548]],
  "jianye|xiapi": [[780, 465]],
  "jianye|shouchun": [[710, 515]],
};

const PASSES = new Set(["changan|hanzhong", "hanzhong|tianshui", "chengdu|hanzhong"]);

const LABEL_ABOVE = new Set(["beihai"]);

const PEAKS = [
  [168, 352, 8], [198, 336, 11], [230, 356, 8], [262, 338, 10], [296, 360, 7], [328, 346, 8],
  [448, 118, 8], [466, 148, 10], [450, 180, 7], [472, 208, 6],
  [122, 205, 9], [140, 242, 7], [118, 325, 8], [142, 385, 6], [128, 465, 8], [150, 500, 6],
  [205, 468, 7], [238, 486, 6], [268, 470, 8], [155, 590, 6],
];

const REGIONS = [
  ["YOU", 500, 74],
  ["BING", 292, 122],
  ["QING", 918, 152],
  ["YAN", 512, 308],
  ["XU", 708, 328],
  ["YANG", 705, 618],
  ["YI", 248, 638],
];

function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

function rnd(n) {
  return Math.round(n * 10) / 10;
}

function smoothClosed(pts) {
  const n = pts.length;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${rnd(c1x)} ${rnd(c1y)} ${rnd(c2x)} ${rnd(c2y)} ${p2[0]} ${p2[1]}`;
  }
  return `${d} Z`;
}

function smoothOpen(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${rnd(c1x)} ${rnd(c1y)} ${rnd(c2x)} ${rnd(c2y)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function roadPath(a, b) {
  const key = edgeKey(a.id, b.id);
  const mids = ROAD_MIDS[key];
  if (mids) return smoothOpen([[a.x, a.y], ...mids, [b.x, b.y]]);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const mag = Math.min(16, len * 0.07);
  return `M ${a.x} ${a.y} Q ${rnd(mx + (-dy / len) * mag)} ${rnd(my + (dx / len) * mag)} ${b.x} ${b.y}`;
}

function peakMark(x, y, s) {
  return `<path class="peak" d="M${x - s},${y} l${s},${rnd(-s * 1.45)} l${rnd(s * 0.85)},${rnd(s * 1.45)} z"/>`;
}

function townMark(state, city) {
  const color = FACTIONS[city.faction].color;
  const mine = city.faction === state.player;
  const selected = city.id === state.selected;
  const ally = !mine && isAllied(state, state.player, city.faction);
  const ordered = !!state.orders[city.id];
  const above = LABEL_ABOVE.has(city.id);
  const w = Math.max(48, Math.ceil(city.name.length * 7.2 + 14));
  const y = above ? -40 : 16;
  return `<g class="city ${mine ? "is-mine" : ""} ${selected ? "is-selected" : ""}" data-act="select" data-id="${city.id}" data-testid="city-${city.id}" transform="translate(${city.x} ${city.y})">
    <title>${esc(city.name)} · ${esc(FACTIONS[city.faction].name)} · ${city.soldiers.toLocaleString()} troops</title>
    <circle class="hit" r="20"/>
    ${selected ? `<circle class="ring" r="24"/>` : ""}
    ${ally ? `<circle class="ally-mark" r="22"/>` : ""}
    <polygon class="roof" points="-13,-3 0,-16 13,-3" fill="${color}"/>
    <rect class="walls" x="-10" y="-3" width="20" height="13"/>
    <rect class="gate" x="-2.2" y="4" width="4.4" height="6"/>
    ${ordered ? `<circle class="order-pip" cx="14" cy="-14" r="3.4"/>` : ""}
    <g class="placard">
      <rect x="${-w / 2}" y="${y}" width="${w}" height="16" rx="1.5"/>
      <text y="${y + 12}">${esc(city.name)}</text>
    </g>
  </g>`;
}

function mapSvg(state) {
  for (const src of CITIES) {
    const city = state.cities[src.id];
    if (city) {
      city.x = src.x;
      city.y = src.y;
    }
  }
  const land = smoothClosed(COAST);
  const roads = EDGES.map(([a, b]) => {
    const A = state.cities[a];
    const B = state.cities[b];
    const pass = PASSES.has(edgeKey(a, b)) ? " pass" : "";
    return `<path class="road${pass}" d="${roadPath(A, B)}"/>`;
  }).join("");
  const river = (id, d, thin = false) => {
    const cls = thin ? "river thin" : "river";
    return `<path id="${id}" class="${cls} bank" d="${d}"/><path class="${cls}" d="${d}"/>`;
  };
  const nodes = Object.values(state.cities).map((c) => townMark(state, c)).join("");
  return `<svg viewBox="0 0 1040 700" role="img" aria-label="Map of the late Han">
    <defs>
      <linearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d7e4e0"/>
        <stop offset="1" stop-color="#8eaaa6"/>
      </linearGradient>
      <linearGradient id="landGrad" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0" stop-color="#f0e2c6"/>
        <stop offset="0.5" stop-color="#e6d2ad"/>
        <stop offset="1" stop-color="#d4c198"/>
      </linearGradient>
    </defs>
    <rect class="sea" width="1040" height="700"/>
    <path class="land" d="${land}"/>
    <ellipse class="lake" cx="448" cy="618" rx="30" ry="13"/>
    <ellipse class="lake" cx="812" cy="648" rx="18" ry="9"/>
    ${PEAKS.map(([x, y, s]) => peakMark(x, y, s)).join("")}
    <path class="wall" d="M 155,108 C 230,86 310,98 400,78 C 470,92 545,74 610,90"/>
    ${river("yellow", RIVERS.yellow)}
    ${river("yangtze", RIVERS.yangtze)}
    ${river("han", RIVERS.han, true)}
    ${river("huai", RIVERS.huai, true)}
    ${river("wei", RIVERS.wei, true)}
    <text class="watername" x="168" y="196">YELLOW RIVER</text>
    <text class="watername" x="548" y="592">YANGTZE</text>
    <text class="watername" x="812" y="428">HUAI</text>
    ${REGIONS.map(([name, x, y]) => `<text class="region" x="${x}" y="${y}">${name}</text>`).join("")}
    <text class="seaname" x="760" y="118">BOHAI</text>
    <g class="waves">
      <path d="M992,175 q16,8 0,16 t0,16"/>
      <path d="M1012,205 q16,8 0,16 t0,16"/>
      <path d="M998,430 q18,8 0,16 t0,16"/>
      <path d="M1016,462 q18,8 0,16 t0,16"/>
    </g>
    <g class="compass-rose" transform="translate(1000,640)">
      <circle r="15"/>
      <path d="M0,-20 L4.5,-2 L0,7 L-4.5,-2 Z"/>
      <path class="south" d="M0,18 L3.2,3 L0,7 L-3.2,3 Z"/>
      <text y="-24">N</text>
    </g>
    ${roads}
    ${nodes}
  </svg>`;
}

function cityPanel(state, city) {
  const mine = city.faction === state.player;
  const ruler = rulerOfficer(state, city.faction);
  const officers = activeInCity(state, city);
  const guests = guestsIn(state, city);
  const order = state.orders[city.id];
  const rel = mine ? "" : `<p>Standing with ${esc(FACTIONS[city.faction].name)}: <b>${relationOf(state, state.player, city.faction)}</b>${isAllied(state, state.player, city.faction) ? " · allied" : ""}</p>`;
  const chips = officers.map((o) => `<button class="officer-chip" data-act="dossier" data-id="${o.id}">
    ${face(o, "tiny")}<span><b>${esc(o.name)}</b><small>${isRuler(state, o) ? "Ruler" : city.governor === o.id ? "Governor" : "Officer"} · loyalty ${o.loyalty}</small></span>
  </button>`).join("");
  const guestHtml = guests.map((o) => `<button class="guest-chip" data-act="dossier" data-id="${o.id}">
    ${face(o, "tiny")}<span><b>${esc(o.name)}</b><small>Guest · visit ${o.visits}/${o.visitsNeeded || 1}</small></span>
  </button>`).join("");
  const cmds = mine ? `<div class="commands">
    ${cmd("cultivate", "Cultivate")}
    ${cmd("irrigate", "Dikes")}
    ${cmd("trade", "Markets")}
    ${cmd("recruit", "Levy")}
    ${cmd("train", "Drill")}
    ${cmd("patrol", "Patrol")}
    ${cmd("fortify", "Walls")}
    ${cmd("search", "Search")}
    <button data-act="reward" data-city="${city.id}">Reward</button>
    <button data-act="shift" data-city="${city.id}">Shift men</button>
    <button data-act="march" data-city="${city.id}" data-type="march" data-testid="cmd-march">March</button>
    ${guests.length ? `<button data-act="employ" data-city="${city.id}">Call on a guest</button>` : ""}
  </div>` : foreignActions(state, city);
  return `<div class="province">${esc(city.province)} province</div>
    <h2>${esc(city.name)}</h2>
    <div class="ownerline">${esc(FACTIONS[city.faction].name)}${ruler ? ` · ${esc(ruler.name)}` : ""}</div>
    ${rel}
    <div class="pair"><div><span>Gold</span><b>${city.gold.toLocaleString()}</b></div><div><span>Grain</span><b>${city.rice.toLocaleString()}</b></div><div><span>Troops</span><b>${city.soldiers.toLocaleString()}</b></div></div>
    <div class="meters">
      ${meter("Farmland", city.land)}
      ${meter("Dikes", city.flood)}
      ${meter("Markets", city.trade, "gold")}
      ${meter("People", city.people)}
      ${meter("Walls", city.walls)}
      ${meter("Training", city.training, "war")}
    </div>
    <div class="officer-row">${chips || "<p>No officers in the city.</p>"}</div>
    ${guestHtml ? `<h3>Guests</h3><div class="officer-row">${guestHtml}</div>` : ""}
    ${order ? `<div class="order-flag">This month: ${esc(orderLabel(state, order))} <button data-act="clear-order" data-city="${city.id}">Clear</button></div>` : ""}
    ${orderSummary(state)}
    ${mine && officers.length > 1 ? `<div class="choice-grid">${officers.map((o) => `<button data-act="appoint" data-city="${city.id}" data-id="${o.id}">${city.governor === o.id ? "Governor" : "Appoint"} ${esc(o.name)}</button>`).join("")}</div>` : ""}
    ${cmds}
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

function planNote(state) {
  const bits = [];
  if (state.diplomacy?.type === "gift") bits.push(`Gift of ${state.diplomacy.gold} gold set aside`);
  if (state.diplomacy?.type === "alliance") bits.push(`Alliance offered to ${FACTIONS[state.diplomacy.faction].name}`);
  if (state.diplomacy?.type === "break") bits.push(`Alliance with ${FACTIONS[state.diplomacy.faction].name} will break`);
  if (state.diplomacy?.type === "demand") bits.push(`Surrender demanded of ${FACTIONS[state.diplomacy.faction].name}`);
  if (state.plot?.cityId) bits.push(`Rumors aimed at ${state.cities[state.plot.cityId].name}`);
  return bits.length ? `<p>${esc(bits.join(". "))}.</p>` : "";
}

function cmd(type, label) {
  return `<button data-act="order" data-type="${type}">${label}</button>`;
}

function foreignActions(state, city) {
  const borders = factionCities(state, state.player).filter((c) => c.neighbors.includes(city.id));
  const march = borders.map((c) => `<button data-act="march" data-city="${c.id}" data-to="${city.id}">March from ${esc(c.name)}</button>`).join("");
  return `<div class="stack">
    ${march || "<p>No army of yours stands on a road into this city.</p>"}
    <button data-act="gift" data-faction="${city.faction}">Send gold</button>
    <button data-act="alliance" data-faction="${city.faction}">Propose alliance</button>
    ${isAllied(state, state.player, city.faction) ? `<button data-act="break" data-faction="${city.faction}">Break alliance</button>` : ""}
    <button data-act="demand" data-faction="${city.faction}">Demand surrender</button>
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
    return;
  }
  if (act === "dismiss-tip") { state.dismissedTip = true; render(); return; }
  if (act === "save") { save(state); note(state, "The campaign is sealed in this browser."); render(); return; }
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
  if (act === "order") {
    const city = state.cities[state.selected];
    if (!city) return;
    const res = issueOrder(state, city.id, { type: el.dataset.type });
    if (!res.ok) note(state, res.reason);
    else note(state, `${city.name}: ${orderLabel(state, state.orders[city.id])}.`, true);
    render();
    return;
  }
  if (act === "advise") { advise(state); render(); return; }
  if (act === "end-month") { endMonth(); return; }
  if (act === "reward") { rewardModal(state, el.dataset.city); return; }
  if (act === "shift") { shiftModal(state, el.dataset.city); return; }
  if (act === "march") { marchModal(state, el.dataset.city, el.dataset.to || null); return; }
  if (act === "employ") { employModal(state, el.dataset.city); return; }
  if (act === "gift") { giftModal(state, el.dataset.faction); return; }
  if (act === "alliance") {
    const res = setDiplomacy(state, { type: "alliance", faction: el.dataset.faction });
    note(state, res.ok ? `An envoy will offer alliance to ${FACTIONS[el.dataset.faction].name}.` : res.reason);
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
    <p>${city.soldiers.toLocaleString()} soldiers are in camp. Leave a garrison.</p>
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
    <p>Each city you hold may take one order: cultivate farmland, repair dikes, open markets, levy troops, drill, patrol, raise walls, search, reward a retainer, shift men, or march. Then end the month. Grain and gold arrive afterward. Floods strike cities that neglected their dikes.</p>
    <h3>The court</h3>
    <p>Leadership drills a camp and steadies a line. War wins duels. Intellect finds recluses, runs markets, and lands a stratagem. Charm keeps loyalty from rotting and makes prisoners consider service. Liu Bei's court rises on its own. Lü Bu's does not.</p>
    <h3>Battle</h3>
    <p>A march fights the neighboring city. Attack, duel a chosen officer, attempt a stratagem, rally, or retreat. The defender's walls soak a charge. Take twelve cities, or be the last lord standing.</p>
    <h3>Guests</h3>
    <p>Search can turn a recluse into a guest. Calling on Zhuge Liang takes three visits, as in the novel. He waits near Xiangyang. The year is 194: the novel gathers him early; the histories made him wait.</p>
    <p><button data-act="close">Close</button></p>
  </div>`);
}

async function endMonth() {
  const state = session.state;
  if (!state || state.phase !== "planning" || session.busy) return;
  session.busy = true;
  closeModal();
  try {
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
      if (!side) {
        autoplayBattle(state, battle, rng);
        const lines = applyBattleResult(state, battle);
        const city = state.cities[battle.toId];
        note(state, `${FACTIONS[battle.attackerFaction].name} marches on ${city.name}. ${battle.winner === "attacker" ? `${city.name} falls.` : "The attack fails."}`);
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
    save(state);
    render();
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
    return `<button class="unit ${on ? "on" : ""}" data-act="${pickAct}" data-id="${u.officerId || ""}">
      ${face(o, "sm")}
      <span><b>${esc(name)}</b><span class="meta">${u.slain ? "Fallen" : u.routed ? "Routed" : `${u.soldiers.toLocaleString()} soldiers · spirit ${Math.round(u.morale)}`}</span></span>
    </button>`;
  }).join("");
  const withdrawLabel = side === "attacker" ? "Retreat" : "Abandon the city";
  openModal(`<div class="battle-head">
      <h2>${esc(state.cities[battle.toId].name)}</h2>
      <div>Round ${battle.round} · walls ${battle.defender.walls}</div>
    </div>
    <div class="battle-cols">
      <div><h3>${side === "attacker" ? "Your march" : "Your defense"}</h3>${unitHtml(battle[side], "pick-actor", session.actorId)}</div>
      <div><h3>Enemy</h3>${unitHtml(battle[foe], "pick-target", session.targetId)}</div>
    </div>
    <div class="battle-log">${battle.log.slice(-8).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
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

