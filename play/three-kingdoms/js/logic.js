function rngFrom(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function pairKey(a, b) {
  return [a, b].sort().join("|");
}

function eff(officer) {
  const out = { lea: officer.lea, war: officer.war, int: officer.int, chr: officer.chr };
  for (const id of officer.gear || []) {
    const item = ITEMS[id];
    if (!item) continue;
    out.lea += item.lea || 0;
    out.war += item.war || 0;
    out.int += item.int || 0;
    out.chr += item.chr || 0;
  }
  out.lea = clamp(out.lea, 1, 100);
  out.war = clamp(out.war, 1, 100);
  out.int = clamp(out.int, 1, 100);
  out.chr = clamp(out.chr, 1, 100);
  return out;
}

function neighborsOf(id) {
  const list = [];
  for (const [a, b] of EDGES) {
    if (a === id) list.push(b);
    else if (b === id) list.push(a);
  }
  return list;
}

const RIVALRIES = {
  [pairKey("caocao", "lvbu")]: 18,
  [pairKey("liubei", "lvbu")]: 30,
  [pairKey("yuanshao", "gongsunzan")]: 12,
  [pairKey("yuanshao", "yuanshu")]: 22,
  [pairKey("sunce", "yuanshu")]: 58,
  [pairKey("lijue", "caocao")]: 22,
  [pairKey("lijue", "yuanshao")]: 24,
  [pairKey("lijue", "liubei")]: 26,
  [pairKey("caocao", "yuanshao")]: 36,
  [pairKey("caocao", "liubei")]: 40,
  [pairKey("sunce", "liubiao")]: 34,
};

function createGame(factionId, rng = Math.random) {
  if (!FACTIONS[factionId]) throw new Error(`Unknown lord: ${factionId}`);
  const officers = {};
  for (const src of OFFICERS) {
    const o = structuredClone(src);
    o.gear = [...(src.gear || [])];
    o.status = src.status || "active";
    o.alive = true;
    o.visits = 0;
    o.cityId = null;
    o.field = false;
    officers[o.id] = o;
  }
  const cities = {};
  for (const src of CITIES) {
    const c = structuredClone(src);
    c.neighbors = neighborsOf(src.id);
    c.officerIds = [...src.officers];
    c.job = defaultJob(c);
    delete c.officers;
    cities[c.id] = c;
    for (const id of c.officerIds) {
      officers[id].cityId = c.id;
      officers[id].faction = c.faction;
    }
  }
  for (const o of Object.values(officers)) {
    if (o.status === "hidden") o.cityId = o.homeCity;
  }
  const rulers = {};
  for (const id of Object.keys(FACTIONS)) {
    if (officers[id]) rulers[id] = id;
  }
  const relations = {};
  const ids = Object.keys(FACTIONS);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = pairKey(ids[i], ids[j]);
      relations[key] = RIVALRIES[key] ?? 42;
    }
  }
  const home = Object.values(cities).find((c) => c.faction === factionId && c.governor === factionId)
    || Object.values(cities).find((c) => c.faction === factionId);
  const state = {
    version: 2,
    year: 194,
    month: 1,
    turn: 1,
    phase: "planning",
    player: factionId,
    rulers,
    heirs: { ...HEIRS },
    officers,
    cities,
    relations,
    alliances: [],
    orders: {},
    diplomacy: null,
    plot: null,
    emperorAt: "changan",
    mandate: null,
    revealed: null,
    shadowOrders: {},
    threats: [],
    lastActs: {},
    aimsMet: {},
    duelWins: {},
    log: [
      {
        text: "Spring, 194. The Han court is a shadow in Chang'an. Warlords tax the passes, and oaths last as long as the grain.",
      },
    ],
    selected: home ? home.id : Object.keys(cities)[0],
    dismissedTip: false,
    outcome: null,
    intrigue: null,
    intrigueQuietUntil: null,
    intrigueLastId: null,
    pendingRescue: null,
    rngNote: typeof rng === "function" ? "external" : "",
  };
  planShadow(state, rng);
  openIntrigue(state);
  for (const line of intrigueBlurb(state)) pushLog(state, line);
  return state;
}

function monthLabel(state) {
  const [season, month] = MONTHS[state.month - 1];
  return `${season}, ${state.year} · ${month}`;
}

function factionCities(state, faction) {
  return Object.values(state.cities).filter((c) => c.faction === faction);
}

function rulerOfficer(state, faction) {
  const id = state.rulers?.[faction];
  return id ? state.officers[id] : null;
}

function isRuler(state, officer) {
  if (!officer || !state.rulers) return false;
  return Object.values(state.rulers).includes(officer.id);
}

function activeInCity(state, city) {
  return city.officerIds
    .map((id) => state.officers[id])
    .filter((o) => o && o.alive && o.status === "active");
}

function totals(state, faction) {
  const cities = factionCities(state, faction);
  return cities.reduce(
    (acc, c) => {
      acc.cities += 1;
      acc.gold += c.gold;
      acc.rice += c.rice;
      acc.soldiers += c.soldiers;
      return acc;
    },
    { cities: 0, gold: 0, rice: 0, soldiers: 0 },
  );
}

function relationOf(state, a, b) {
  if (a === b) return 100;
  return state.relations[pairKey(a, b)] ?? 40;
}

function allianceKeyOf(row) {
  return typeof row === "string" ? row : row?.key;
}

function isAllied(state, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const key = pairKey(a, b);
  const row = (state.alliances || []).find((item) => allianceKeyOf(item) === key);
  if (!row) return false;
  if (typeof row === "string") return true;
  return state.turn < row.untilTurn;
}

function addRelation(state, a, b, delta) {
  if (a === b) return;
  const key = pairKey(a, b);
  state.relations[key] = clamp((state.relations[key] ?? 40) + delta, 0, 100);
}

function formAlliance(state, a, b) {
  const key = pairKey(a, b);
  state.alliances = (state.alliances || []).filter((item) => allianceKeyOf(item) !== key);
  state.alliances.push({ key, untilTurn: state.turn + 12 });
  state.relations[key] = Math.max(state.relations[key] ?? 40, 66);
}

function breakAlliance(state, a, b) {
  const key = pairKey(a, b);
  state.alliances = (state.alliances || []).filter((item) => allianceKeyOf(item) !== key);
  addRelation(state, a, b, -28);
}

function unplace(state, id) {
  const o = state.officers[id];
  if (!o) return;
  if (o.cityId && state.cities[o.cityId]) {
    const c = state.cities[o.cityId];
    c.officerIds = c.officerIds.filter((x) => x !== id);
    if (c.governor === id) c.governor = c.officerIds[0] || null;
  }
  o.cityId = null;
  o.field = false;
}

function place(state, id, cityId) {
  const o = state.officers[id];
  const city = state.cities[cityId];
  if (!o || !city) return;
  unplace(state, id);
  o.cityId = cityId;
  o.status = "active";
  o.alive = true;
  o.field = false;
  delete o.heldBy;
  delete o.heldAt;
  if (!city.officerIds.includes(id)) city.officerIds.push(id);
  if (!city.governor) city.governor = id;
}

function ensureGovernor(state, city) {
  if (!city) return;
  if (city.governor && city.officerIds.includes(city.governor) && state.officers[city.governor]?.alive) return;
  city.governor = city.officerIds.find((id) => state.officers[id]?.alive) || null;
}

function otherCity(state, faction, exceptId) {
  return factionCities(state, faction).find((c) => c.id !== exceptId) || null;
}

function ensureRuler(state, faction, logs) {
  const cities = factionCities(state, faction);
  if (!cities.length) return;
  const current = state.officers[state.rulers[faction]];
  if (current && current.alive && current.status === "active" && current.faction === faction) return;
  const pool = [];
  for (const city of cities) {
    for (const id of city.officerIds) {
      const o = state.officers[id];
      if (o && o.alive && o.status === "active" && o.faction === faction) pool.push(o);
    }
  }
  if (!pool.length) return;
  const heirId = state.heirs[faction];
  const heir = pool.find((o) => o.id === heirId);
  const next = heir || pool.sort((a, b) => eff(b).lea + eff(b).chr - (eff(a).lea + eff(a).chr))[0];
  state.rulers[faction] = next.id;
  next.loyalty = 100;
  if (logs) logs.push(`${next.name} takes command of the ${FACTIONS[faction].name} host.`);
}

function bestBy(list, score) {
  if (!list.length) return null;
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}

function pushLog(state, text) {
  state.log.unshift({ text });
  if (state.log.length > 80) state.log.length = 80;
}

const JOB_TYPE = {
  fields: "cultivate",
  dikes: "irrigate",
  markets: "trade",
  drill: "train",
  patrol: "patrol",
  walls: "fortify",
  levy: "recruit",
};

function orderLabel(state, order) {
  if (!order) return "Keeps its job";
  const cityName = (id) => state.cities[id]?.name || "the road";
  switch (order.type) {
    case "job": return `Set the job to ${JOBS[order.job]?.label || "work"}`;
    case "cultivate": return "Cultivate fields";
    case "irrigate": return "Repair dikes";
    case "trade": return "Open markets";
    case "recruit": return "Levy troops";
    case "train": return "Drill the camp";
    case "patrol": return "Patrol the wards";
    case "fortify": return "Raise the walls";
    case "search": return "Search the countryside";
    case "reward": return `Reward ${state.officers[order.officerId]?.name || "an officer"}`;
    case "move": return `Send ${state.officers[order.officerId]?.name || "an officer"} to ${cityName(order.to)}`;
    case "transfer": return `Shift men to ${cityName(order.to)}`;
    case "march": return `March on ${cityName(order.to)}`;
    case "employ": return `Call on ${state.officers[order.officerId]?.name || "a guest"}`;
    case "spy": return `Spy on ${FACTIONS[order.watch || order.faction]?.name || "a lord"}`;
    case "escort": return `Escort the emperor to ${cityName(order.to)}`;
    default: return "Keeps its job";
  }
}

function validate(state, city, order) {
  if (!order || !order.type) return "Empty order.";
  const mine = activeInCity(state, city);
  if (!mine.length && !["transfer"].includes(order.type)) return "No officer remains to carry out an order.";
  const friends = city.neighbors.filter((id) => state.cities[id].faction === city.faction);
  const foes = city.neighbors.filter((id) => state.cities[id].faction !== city.faction);
  switch (order.type) {
    case "job":
      if (!JOBS[order.job]) return "That is not a job a city can keep.";
      return null;
    case "spy": {
      const near = city.neighbors.some((id) => state.cities[id].faction === order.faction);
      if (!near || order.faction === city.faction) return "Spy a lord on a neighboring road.";
      return null;
    }
    case "escort": {
      if (state.emperorAt !== city.id) return "The emperor is not in this city.";
      const dest = state.cities[order.to];
      if (!dest || dest.faction !== city.faction) return "Escort him to a city you hold.";
      return null;
    }
    case "reward": {
      const o = state.officers[order.officerId];
      if (!o || o.cityId !== city.id || isRuler(state, o)) return "Choose a retainer in this city.";
      return null;
    }
    case "move": {
      if (!mine.some((o) => o.id === order.officerId)) return "That officer is not here.";
      if (!friends.includes(order.to)) return "They can only ride to a neighboring city of yours.";
      return null;
    }
    case "transfer": {
      if (!friends.includes(order.to)) return "Men can only shift to a neighboring city of yours.";
      if ((order.soldiers || 0) < 100) return "Send at least 100 soldiers.";
      return null;
    }
    case "march": {
      if (!foes.includes(order.to)) return "Choose an enemy city on a neighboring road.";
      if (isAllied(state, city.faction, state.cities[order.to].faction)) return "That city belongs to an ally.";
      if (!order.officers?.length) return "Name at least one officer to lead the march.";
      if (order.officers.some((id) => !mine.some((o) => o.id === id))) return "One of those officers is not in the city.";
      if ((order.soldiers || 0) < 400) return "A march needs at least 400 soldiers.";
      return null;
    }
    case "employ": {
      const g = state.officers[order.officerId];
      if (!g || g.status !== "guest" || g.cityId !== city.id) return "No such guest is waiting in this city.";
      return null;
    }
    default:
      return null;
  }
}

function issueOrder(state, cityId, order) {
  const city = state.cities[cityId];
  if (!city || city.faction !== state.player) return { ok: false, reason: "That city is not yours." };
  if (state.phase !== "planning") return { ok: false, reason: "The month is already turning." };
  const err = validate(state, city, order);
  if (err) return { ok: false, reason: err };
  const stored = { ...order, faction: city.faction };
  if (order.type === "spy") stored.watch = order.faction;
  state.orders[cityId] = stored;
  return { ok: true };
}

function clearCityOrder(state, cityId) {
  delete state.orders[cityId];
}

function setDiplomacy(state, action) {
  if (state.phase !== "planning") return { ok: false, reason: "Too late for envoys." };
  state.diplomacy = action;
  return { ok: true };
}

function setPlot(state, action) {
  if (state.phase !== "planning") return { ok: false, reason: "Too late for plots." };
  state.plot = action;
  return { ok: true };
}

function advise(state) {
  const plans = courtProposals(state);
  if (!plans.length) return { ok: false, reason: "The court is silent." };
  return fundPlan(state, plans[0]);
}

function spend(city, n) {
  if (city.gold < n) return false;
  city.gold -= n;
  return true;
}

function applyMovement(state, city, order, logs) {
  if (order.type === "move") {
    const dest = state.cities[order.to];
    if (!dest || dest.faction !== city.faction || !city.neighbors.includes(dest.id)) return;
    if (!city.officerIds.includes(order.officerId)) return;
    place(state, order.officerId, dest.id);
    state.officers[order.officerId].faction = dest.faction;
    ensureGovernor(state, city);
    logs.push(`${state.officers[order.officerId].name} rides to ${dest.name}.`);
    return;
  }
  if (order.type === "transfer") {
    const dest = state.cities[order.to];
    if (!dest || dest.faction !== city.faction || !city.neighbors.includes(dest.id)) return;
    const n = Math.min(order.soldiers || 0, Math.max(0, city.soldiers - 80));
    if (n > 0) {
      city.soldiers -= n;
      dest.soldiers += n;
    }
    for (const id of order.officers || []) {
      if (!city.officerIds.includes(id)) continue;
      place(state, id, dest.id);
      state.officers[id].faction = dest.faction;
    }
    ensureGovernor(state, city);
    logs.push(`${n.toLocaleString()} soldiers shift from ${city.name} to ${dest.name}.`);
  }
}

function applyDomestic(state, city, order, rng, logs) {
  const officers = activeInCity(state, city);
  const gov = state.officers[city.governor] || officers[0];
  if (!gov) return;
  const st = eff(gov);
  switch (order.type) {
    case "cultivate": {
      if (!spend(city, 40)) { logs.push(`${city.name} lacks the gold to open new fields.`); return; }
      const gain = 4 + Math.round((st.int + st.lea) / 45);
      city.land = clamp(city.land + gain, 0, 100);
      logs.push(`${gov.name} opens fields at ${city.name}. Farmland stands at ${city.land}.`);
      break;
    }
    case "irrigate": {
      if (!spend(city, 50)) { logs.push(`${city.name} cannot fund the dikes.`); return; }
      const gain = 4 + Math.round(st.int / 28);
      city.flood = clamp(city.flood + gain, 0, 100);
      logs.push(`Dikes and canals at ${city.name} improve. Flood control is ${city.flood}.`);
      break;
    }
    case "trade": {
      if (!spend(city, 55)) { logs.push(`${city.name} cannot endow the market.`); return; }
      const gain = 4 + Math.round(st.int / 26);
      city.trade = clamp(city.trade + gain, 0, 100);
      logs.push(`Merchants take the road into ${city.name}. Commerce is ${city.trade}.`);
      break;
    }
    case "recruit": {
      const gain = Math.round((700 + st.chr * 10) * (city.people / 100));
      const cap = 2000 + city.people * 120;
      const actual = Math.max(0, Math.min(gain, cap - city.soldiers));
      if (actual < 80) { logs.push(`${city.name} has no more men willing to enlist.`); return; }
      const cost = Math.round(40 + actual / 12);
      if (!spend(city, cost)) { logs.push(`${city.name} cannot pay a levy.`); return; }
      city.soldiers += actual;
      city.training = clamp(city.training - 4, 0, 100);
      logs.push(`${actual.toLocaleString()} men join the camp at ${city.name}.`);
      break;
    }
    case "train": {
      if (!spend(city, 25)) { logs.push(`${city.name} cannot pay the drillmasters.`); return; }
      const gain = 6 + Math.round(st.lea / 18);
      city.training = clamp(city.training + gain, 0, 100);
      logs.push(`The camp at ${city.name} drills. Training is ${city.training}.`);
      break;
    }
    case "patrol": {
      if (!spend(city, 30)) { logs.push(`${city.name} cannot feed a patrol.`); return; }
      const gain = 5 + Math.round(st.chr / 18);
      city.people = clamp(city.people + gain, 0, 100);
      logs.push(`Patrols quiet ${city.name}. The people's order is ${city.people}.`);
      break;
    }
    case "fortify": {
      if (!spend(city, 80)) { logs.push(`${city.name} cannot pay the masons.`); return; }
      const gain = 6 + Math.round(st.lea / 22);
      city.walls = clamp(city.walls + gain, 0, 100);
      logs.push(`Walls rise at ${city.name}. Defense is ${city.walls}.`);
      break;
    }
    case "search": {
      if (!spend(city, 35)) { logs.push(`${city.name} cannot spare searchers.`); return; }
      const intrigue = state.intrigue;
      if (intrigue?.kind === "letter" && intrigue.solve?.type === "search" && intrigue.solve.cityId === city.id) {
        order.landed = true;
        logs.push(`Searchers in ${city.name} take a letter from the archive.`);
        return;
      }
      if (intrigue?.kind === "search" && intrigue.solve?.type === "search" && intrigue.solve.cityId === city.id) {
        order.landed = true;
        const target = state.officers[intrigue.solve.officerId];
        if (target && target.status === "hidden") {
          target.status = "guest";
          target.cityId = city.id;
          order.found = target.id;
          logs.push(`Searchers in ${city.name} find ${target.name} (${target.courtesy || "no courtesy name"}). He will hear an offer, not yet take a seal.`);
        } else if (target) {
          logs.push(`${target.name} is already known in ${city.name}.`);
        }
        return;
      }
      const seeker = bestBy(officers, (o) => eff(o).int);
      const hidden = Object.values(state.officers)
        .filter((o) => o.status === "hidden" && o.homeCity === city.id)
        .sort((a, b) => a.difficulty - b.difficulty);
      for (const h of hidden) {
        const chance = clamp((eff(seeker).int - h.difficulty + 28) / 120, 0.05, 0.6);
        if (rng() < chance) {
          h.status = "guest";
          h.cityId = city.id;
          logs.push(`Searchers in ${city.name} find ${h.name} (${h.courtesy || "no courtesy name"}). He will hear an offer, not yet take a seal.`);
          return;
        }
      }
      const roll = rng();
      if (roll < 0.45) {
        const gold = 80 + Math.round(rng() * 180);
        city.gold += gold;
        logs.push(`A forgotten cache in ${city.name} yields ${gold} gold.`);
      } else if (roll < 0.75) {
        const rice = 400 + Math.round(rng() * 900);
        city.rice += rice;
        logs.push(`Villagers of ${city.name} bring in ${rice.toLocaleString()} measures of grain.`);
      } else {
        logs.push(`The lanes around ${city.name} are quiet.`);
      }
      break;
    }
    case "reward": {
      const o = state.officers[order.officerId];
      if (!o || o.cityId !== city.id) return;
      if (!spend(city, 100)) { logs.push(`${city.name} cannot afford a gift.`); return; }
      order.landed = true;
      o.loyalty = clamp(o.loyalty + 8 + Math.round(st.chr / 20), 0, 100);
      logs.push(`${o.name} accepts a gift. Loyalty is ${o.loyalty}.`);
      break;
    }
    case "employ": {
      const g = state.officers[order.officerId];
      if (!g || g.status !== "guest" || g.cityId !== city.id) return;
      if (!spend(city, 40)) { logs.push(`There is no gift to carry to ${g.name}.`); return; }
      order.landed = true;
      g.visits += 1;
      const lines = VISIT_LINES[g.id];
      if (g.visits < (g.visitsNeeded || 1)) {
        const line = lines ? lines[Math.min(g.visits, lines.length) - 1] : `${g.name} hears the offer and does not answer.`;
        logs.push(line);
        return;
      }
      const ruler = rulerOfficer(state, city.faction);
      const chr = ruler ? eff(ruler).chr : st.chr;
      const gap = (g.pride || 60) - chr;
      if (gap > 18 && rng() < 0.75) {
        logs.push(`${g.name} declines. The lord's name does not yet move him.`);
        return;
      }
      g.status = "active";
      g.faction = city.faction;
      g.loyalty = clamp(62 + Math.round((chr - (g.pride || 60)) / 2), 45, 97);
      place(state, g.id, city.id);
      const done = lines ? lines[lines.length - 1] : `${g.name} accepts service in ${city.name}.`;
      logs.push(done);
      break;
    }
    case "spy": {
      if (!spend(city, 60)) { logs.push(`${city.name} cannot pay the agents.`); return; }
      order.landed = true;
      const watched = order.watch || order.faction;
      state._spy = watched;
      logs.push(`Agents from ${city.name} watch ${FACTIONS[watched].name}. Next month their plans will be known.`);
      break;
    }
    case "escort": {
      if (state.emperorAt !== city.id) { logs.push("The emperor is not in this city."); return; }
      const dest = state.cities[order.to] || city;
      if (dest.faction !== city.faction) { logs.push("There is no city of yours to receive the court."); return; }
      const fromName = city.name;
      state.emperorAt = dest.id;
      state.mandate = city.faction;
      const neighbors = new Set(city.neighbors.map((id) => state.cities[id].faction).filter((f) => f && f !== city.faction));
      for (const id of dest.neighbors) {
        const f = state.cities[id].faction;
        if (f && f !== city.faction) neighbors.add(f);
      }
      for (const f of neighbors) addRelation(state, city.faction, f, -8);
      logs.push(`${FACTIONS[city.faction].name} escorts the emperor from ${fromName} to ${dest.name}. The neighboring lords call it a theft of the court.`);
      break;
    }
    default:
      break;
  }
}

function richestCity(state, faction) {
  return factionCities(state, faction).sort((a, b) => b.gold - a.gold)[0] || null;
}

function applyDiplomacy(state, rng, logs) {
  const d = state.diplomacy;
  if (!d) return;
  const treasury = richestCity(state, state.player);
  if (!treasury) return;
  if (d.type === "gift") {
    const gold = d.gold;
    if (playerMarchingOn(state, d.faction)) {
      logs.push(`A gift cannot buy ${FACTIONS[d.faction].name} while your banners are already on their road.`);
      return;
    }
    if (treasury.gold < gold) { logs.push("The gift cannot be paid."); return; }
    treasury.gold -= gold;
    addRelation(state, state.player, d.faction, Math.round(gold / 38));
    logs.push(`A gift of ${gold} gold reaches ${FACTIONS[d.faction].name}. Standing is now ${relationOf(state, state.player, d.faction)}.`);
    return;
  }
  if (d.type === "alliance") {
    if (isAllied(state, state.player, d.faction)) { logs.push("You are already allied."); return; }
    const price = alliancePrice(state, d.faction);
    if (price.blocked) {
      addRelation(state, state.player, d.faction, -6);
      logs.push(`${FACTIONS[d.faction].name} will not hear an oath while your army is marching on them.`);
      return;
    }
    if (treasury.gold < price.gold) {
      logs.push(`The oath costs ${price.gold.toLocaleString()} gold, and the treasury is short.`);
      return;
    }
    treasury.gold -= price.gold;
    formAlliance(state, state.player, d.faction);
    logs.push(`${FACTIONS[d.faction].name} accepts the oath for ${price.gold.toLocaleString()} gold. It lasts a year.`);
    return;
  }
  if (d.type === "break") {
    if (!isAllied(state, state.player, d.faction)) return;
    breakAlliance(state, state.player, d.faction);
    logs.push(`The alliance with ${FACTIONS[d.faction].name} is broken.`);
    return;
  }
  if (d.type === "demand") {
    const theirs = factionCities(state, d.faction);
    const us = totals(state, state.player);
    const them = totals(state, d.faction);
    if (theirs.length !== 1 || us.soldiers < them.soldiers * 2.2) {
      logs.push(`${FACTIONS[d.faction].name} laughs off the demand.`);
      addRelation(state, state.player, d.faction, -10);
      return;
    }
    const ourR = rulerOfficer(state, state.player);
    const theirR = rulerOfficer(state, d.faction);
    let chance = clamp(((ourR ? eff(ourR).chr : 50) - (theirR ? eff(theirR).chr : 50) + 25) / 120, 0.1, 0.75);
    if (state.mandate === state.player) chance = clamp(chance + 0.2, 0.1, 0.9);
    if (rng() < chance) {
      const city = theirs[0];
      logs.push(`${FACTIONS[d.faction].name} yields ${city.name} rather than fight.`);
      const prisoners = [];
      for (const id of [...city.officerIds]) {
        const o = state.officers[id];
        if (!o) continue;
        if (isRuler(state, o)) {
          const refuge = null;
          if (refuge) place(state, id, refuge.id);
          else {
            unplace(state, id);
            o.status = "prisoner";
            o.factionHold = d.faction;
            o.heldBy = state.player;
            o.heldAt = city.id;
            prisoners.push(id);
          }
        } else {
          unplace(state, id);
          o.status = "prisoner";
          o.factionHold = d.faction;
          o.heldBy = state.player;
          o.heldAt = city.id;
          prisoners.push(id);
        }
      }
      city.faction = state.player;
      city.people = Math.max(20, city.people - 6);
      ensureGovernor(state, city);
      state.pendingPrisoners = (state.pendingPrisoners || []).concat(prisoners);
      ensureRuler(state, d.faction, logs);
      lastAct(state, d.faction, city, logs);
    } else {
      addRelation(state, state.player, d.faction, -16);
      logs.push(`${FACTIONS[d.faction].name} rejects the demand and calls the banners.`);
    }
  }
}

function applyPlot(state, rng, logs) {
  const plot = state.plot;
  if (!plot || plot.type !== "discord") return;
  const city = state.cities[plot.cityId];
  if (!city || city.faction === state.player || isAllied(state, state.player, city.faction)) {
    logs.push("The plot has nowhere honest to land.");
    return;
  }
  const agents = factionCities(state, state.player).flatMap((c) => activeInCity(state, c));
  const agent = bestBy(agents, (o) => eff(o).int);
  if (!agent) return;
  const victims = activeInCity(state, city).filter((o) => !isRuler(state, o));
  if (!victims.length) { logs.push("No retainer in that city can be turned."); return; }
  const victim = victims[Math.floor(rng() * victims.length)];
  const theirRuler = rulerOfficer(state, city.faction);
  const roll = eff(agent).int + rng() * 22;
  const resist = (victim.loyalty + (theirRuler ? eff(theirRuler).chr : 50)) / 2 + rng() * 18;
  if (roll > resist) {
    victim.loyalty = clamp(victim.loyalty - (12 + Math.round(eff(agent).int / 16)), 0, 100);
    logs.push(`Rumors in ${city.name} sour ${victim.name}. Loyalty falls to ${victim.loyalty}.`);
  } else {
    logs.push(`The whisper in ${city.name} is traced and dies.`);
    addRelation(state, state.player, city.faction, -6);
  }
}

function negotiate(state, rng, logs) {
  let envoy = null;
  const ai = Object.keys(FACTIONS).filter((id) => id !== state.player && factionCities(state, id).length);
  for (const id of ai) {
    const neighbors = new Set();
    for (const city of factionCities(state, id)) {
      for (const n of city.neighbors) neighbors.add(state.cities[n].faction);
    }
    for (const other of neighbors) {
      if (!other || other === id || isAllied(state, id, other)) continue;
      if (!factionCities(state, other).length) continue;
      const rel = relationOf(state, id, other);
      const me = totals(state, id).soldiers;
      const them = totals(state, other).soldiers;
      const wants = rel >= 50 || (rel >= 36 && me < them * 0.85);
      if (!wants || rng() > 0.35) continue;
      if (other === state.player) {
        if (!envoy && rel >= 34 && state.turn >= 3) envoy = { from: id, relation: rel };
      } else if (other !== state.player && rng() < 0.5) {
        formAlliance(state, id, other);
        logs.push(`${FACTIONS[id].name} and ${FACTIONS[other].name} swear a quiet alliance.`);
      }
    }
  }
  return envoy;
}

function unitStats(state, unit) {
  if (!unit.officerId) {
    return { lea: 32, war: 34, int: 22, chr: 30, name: "City militia" };
  }
  const o = state.officers[unit.officerId];
  if (!o) return { lea: 30, war: 30, int: 20, chr: 30, name: "Unknown" };
  return { ...eff(o), name: o.name };
}

function livingUnits(units) {
  return units.filter((u) => !u.routed && !u.slain && u.soldiers > 0);
}

function applyDamage(units, amount) {
  let left = Math.max(0, Math.round(amount));
  const routed = [];
  const targets = livingUnits(units).sort((a, b) => b.soldiers - a.soldiers);
  for (const t of targets) {
    if (left <= 0) break;
    const dmg = Math.min(t.soldiers, left);
    t.soldiers -= dmg;
    left -= dmg;
    t.morale = clamp(t.morale - (dmg > 250 ? 8 : 4), 0, 100);
    if (t.soldiers < 70) {
      t.routed = true;
      routed.push(t);
    }
  }
  return routed;
}

function sidePower(state, units) {
  let power = 0;
  for (const u of livingUnits(units)) {
    const s = unitStats(state, u);
    power += u.soldiers * 0.135 * (0.5 + s.war / 150) * (0.85 + s.lea / 220) * (0.65 + u.morale / 180);
  }
  return power;
}

function maybeSlay(state, unit, rng) {
  if (!unit.routed || unit.slain || !unit.officerId) return;
  const o = state.officers[unit.officerId];
  if (!o || isRuler(state, o)) return;
  if (rng() < 0.1) unit.slain = true;
}

function duelPairKey(a, b) {
  return [a, b].sort().join("|");
}

function chooseAction(state, battle, side, rng) {
  const pack = battle[side];
  const enemy = side === "attacker" ? battle.defender : battle.attacker;
  const mine = livingUnits(pack.units);
  const theirs = livingUnits(enemy.units);
  if (!mine.length) return { type: "attack" };
  const myPower = sidePower(state, pack.units);
  const theirPower = sidePower(state, enemy.units);
  if (side === "attacker" && myPower < theirPower * 0.42 && rng() < 0.55) return { type: "withdraw" };
  const bestWar = bestBy(mine, (u) => unitStats(state, u).war);
  const bestInt = bestBy(mine, (u) => unitStats(state, u).int);
  const avgMorale = mine.reduce((s, u) => s + u.morale, 0) / mine.length;
  if (avgMorale < 48 && rng() < 0.4) return { type: "rally", officerId: bestWar.officerId };
  const enemyBest = bestBy(theirs, (u) => unitStats(state, u).war);
  if (
    bestWar
    && enemyBest
    && unitStats(state, bestWar).war > unitStats(state, enemyBest).war - 4
    && rng() < 0.42
  ) {
    return { type: "duel", officerId: bestWar.officerId, targetId: enemyBest.officerId };
  }
  if (bestInt && unitStats(state, bestInt).int >= 72 && rng() < 0.38) {
    return { type: "scheme", officerId: bestInt.officerId };
  }
  return { type: "attack" };
}

function resolveActions(state, battle, attackerAction, defenderAction, rng) {
  const logs = [];
  if (attackerAction?.type === "withdraw") {
    battle.done = true;
    battle.winner = "defender";
    logs.push("The attacker sounds the retreat.");
    logs.push(...oathRetreat(state, battle.attacker));
    battle.log.push(...logs);
    return;
  }
  if (defenderAction?.type === "withdraw") {
    battle.done = true;
    battle.winner = "attacker";
    logs.push("The defenders abandon the walls.");
    logs.push(...oathRetreat(state, battle.defender));
    battle.log.push(...logs);
    return;
  }
  const packs = [
    ["attacker", attackerAction, battle.attacker, battle.defender],
    ["defender", defenderAction, battle.defender, battle.attacker],
  ];
  for (const [, action, mine, enemy] of packs) {
    if (action?.type === "rally") {
      for (const u of livingUnits(mine.units)) u.morale = clamp(u.morale + 14, 0, 100);
      logs.push(`${sideName(state, mine)} rallies.`);
    }
  }
  for (const [, action, mine, enemy] of packs) {
    if (action?.type !== "scheme") continue;
    const caster = mine.units.find((u) => u.officerId === action.officerId) || bestBy(livingUnits(mine.units), (u) => unitStats(state, u).int);
    if (!caster || caster.routed) continue;
    const cs = unitStats(state, caster);
    const foe = bestBy(livingUnits(enemy.units), (u) => unitStats(state, u).int);
    const fs = foe ? unitStats(state, foe) : { int: 30, name: "the camp" };
    const roll = cs.int + rng() * 24;
    const resist = fs.int + rng() * 20;
    if (roll > resist) {
      for (const u of livingUnits(enemy.units)) u.morale = clamp(u.morale - 16, 0, 100);
      const extra = sidePower(state, mine.units) * 0.22;
      const walls = enemy === battle.defender ? enemy.walls : 0;
      applyDamage(enemy.units, extra * (1 - Math.min(0.4, walls / 180)));
      logs.push(`${cs.name}'s stratagem lands. ${fs.name === "the camp" ? "The line" : fs.name + "'s line"} wavers.`);
    } else {
      logs.push(`${fs.name} reads ${cs.name}'s stratagem and lets it pass.`);
    }
  }
  for (const [, action, mine, enemy] of packs) {
    if (action?.type !== "duel") continue;
    const mineU = livingUnits(mine.units);
    const foeU = livingUnits(enemy.units);
    if (!mineU.length || !foeU.length) continue;
    const actor = mineU.find((u) => u.officerId && u.officerId === action.officerId) || bestBy(mineU, (u) => unitStats(state, u).war);
    const target = foeU.find((u) => u.officerId && u.officerId === action.targetId) || bestBy(foeU, (u) => unitStats(state, u).war);
    if (!actor || !target) continue;
    const a = unitStats(state, actor);
    const b = unitStats(state, target);
    const aScore = a.war * (0.9 + rng() * 0.2) + a.lea * 0.08;
    const bScore = b.war * (0.9 + rng() * 0.2) + b.lea * 0.08;
    const actorWins = aScore >= bScore;
    const winner = actorWins ? actor : target;
    const loser = actorWins ? target : actor;
    const margin = Math.abs(aScore - bScore);
    loser.soldiers = Math.max(0, Math.round(loser.soldiers * (0.78 - Math.min(0.28, margin / 350))));
    loser.morale = clamp(loser.morale - 18, 0, 100);
    winner.morale = clamp(winner.morale + 8, 0, 100);
    if (loser.soldiers < 70) loser.routed = true;
    const flavor = DUEL_LINES[duelPairKey(actor.officerId || "", target.officerId || "")];
    const wn = unitStats(state, winner).name;
    const ln = unitStats(state, loser).name;
    logs.push(flavor || `${wn} prevails over ${ln} in single combat.`);
    const winnerFaction = battle.attacker.units.includes(winner) ? battle.attackerFaction : battle.defenderFaction;
    const loserOfficer = loser.officerId ? state.officers[loser.officerId] : null;
    if (loserOfficer && isRuler(state, loserOfficer)) {
      state.duelWins = state.duelWins || {};
      state.duelWins[winnerFaction] = loserOfficer.id;
    }
    maybeSlay(state, loser, rng);
    if (loser.slain) {
      logs.push(`${ln} does not leave the field.`);
      if (winner.officerId && loser.officerId) logs.push(...giveGear(state, loser.officerId, winner.officerId));
    }
  }
  const strikes = [];
  for (const [, action, mine, enemy] of packs) {
    if (action && action.type !== "attack") continue;
    const walls = enemy === battle.defender ? enemy.walls : 0;
    const power = sidePower(state, mine.units) * (0.92 + rng() * 0.2) * (1 - Math.min(0.42, walls / 175));
    const fromName = unitStats(state, livingUnits(mine.units)[0] || mine.units[0]).name;
    strikes.push({ enemy, power, fromName });
  }
  for (const strike of strikes) {
    const routed = applyDamage(strike.enemy.units, strike.power);
    logs.push(`${strike.fromName}'s line crashes in.`);
    for (const u of routed) {
      maybeSlay(state, u, rng);
      const nm = unitStats(state, u).name;
      logs.push(u.slain ? `${nm} is cut down as the line breaks.` : `${nm}'s company breaks.`);
    }
  }
  battle.log.push(...logs);
  conclude(battle);
}

function sideName(state, pack) {
  const u = livingUnits(pack.units)[0] || pack.units[0];
  return u ? unitStats(state, u).name : "The host";
}

function conclude(battle) {
  if (battle.done) return;
  const a = livingUnits(battle.attacker.units).length;
  const d = livingUnits(battle.defender.units).length;
  if (a === 0 && d === 0) {
    battle.done = true;
    battle.winner = "defender";
    battle.log.push("Both lines are spent. The city still stands.");
    return;
  }
  if (a === 0) {
    battle.done = true;
    battle.winner = "defender";
    battle.log.push("The attack breaks.");
    return;
  }
  if (d === 0) {
    battle.done = true;
    battle.winner = "attacker";
    battle.log.push("The defense collapses.");
    return;
  }
  battle.round += 1;
  if (battle.round > battle.maxRounds) {
    const aMen = livingUnits(battle.attacker.units).reduce((s, u) => s + u.soldiers, 0);
    const dMen = livingUnits(battle.defender.units).reduce((s, u) => s + u.soldiers, 0);
    const dHeld = dMen * (1 + (battle.defender.walls || 0) / 220);
    battle.done = true;
    battle.winner = aMen > dHeld ? "attacker" : "defender";
    battle.log.push(battle.winner === "attacker"
      ? "Night falls, but the attackers still hold the field and take the gates."
      : "The assault stalls and pulls back.");
  }
}

function stepBattle(state, battle, playerSide, action, rng) {
  if (battle.done) return battle;
  const enemySide = playerSide === "attacker" ? "defender" : "attacker";
  const enemyAction = action?.type === "withdraw" ? null : chooseAction(state, battle, enemySide, rng);
  const attackerAction = playerSide === "attacker" ? action : enemyAction;
  const defenderAction = playerSide === "defender" ? action : enemyAction;
  resolveActions(state, battle, attackerAction, defenderAction, rng);
  return battle;
}

function autoplayBattle(state, battle, rng) {
  let guard = 0;
  while (!battle.done && guard < 16) {
    guard += 1;
    resolveActions(
      state,
      battle,
      chooseAction(state, battle, "attacker", rng),
      chooseAction(state, battle, "defender", rng),
      rng,
    );
  }
  if (!battle.done) {
    battle.done = true;
    battle.winner = "defender";
  }
  return battle;
}

function giveGear(state, fromId, toId) {
  const from = state.officers[fromId];
  const to = state.officers[toId];
  if (!from || !to || !from.gear?.length) return [];
  const notes = [];
  to.gear = to.gear || [];
  for (const itemId of from.gear) {
    if (to.gear.length >= 2) break;
    if (to.gear.includes(itemId)) continue;
    to.gear.push(itemId);
    notes.push(`${to.name} takes ${ITEMS[itemId]?.name || "a relic"}.`);
  }
  from.gear = from.gear.filter((id) => !to.gear.includes(id));
  return notes;
}

function autoAssignPrisoner(state, id, winnerFaction, cityId, logs) {
  const o = state.officers[id];
  if (!o || o.status !== "prisoner") return;
  const old = o.factionHold;
  const refuge = old ? factionCities(state, old)[0] : null;
  const winner = rulerOfficer(state, winnerFaction);
  const chr = winner ? eff(winner).chr : 50;
  if (refuge && o.loyalty >= 76) {
    o.faction = old;
    o.status = "active";
    o.loyalty = clamp(o.loyalty, 40, 100);
    place(state, id, refuge.id);
    logs.push(`${o.name} refuses ${FACTIONS[winnerFaction].name} and escapes to ${refuge.name}.`);
    return;
  }
  if (!refuge || chr + 8 >= o.loyalty) {
    o.faction = winnerFaction;
    o.status = "active";
    let loyalty = Math.round(28 + chr / 4);
    if (o.id === "lvbu") loyalty = Math.min(loyalty, 34);
    o.loyalty = clamp(loyalty, 18, 72);
    place(state, id, cityId);
    logs.push(`${o.name} submits and serves ${FACTIONS[winnerFaction].name}.`);
    return;
  }
  o.faction = old;
  o.status = "active";
  o.loyalty = clamp(Math.max(o.loyalty, 48), 0, 100);
  place(state, id, refuge.id);
  logs.push(`${o.name} is set free and returns to ${refuge.name}.`);
}

function applyBattleResult(state, battle) {
  const logs = [];
  const from = state.cities[battle.fromId];
  const to = state.cities[battle.toId];
  const attWon = battle.winner === "attacker";

  for (const unit of [...battle.attacker.units, ...battle.defender.units]) {
    if (!unit.slain || !unit.officerId) continue;
    const o = state.officers[unit.officerId];
    if (!o || !o.alive) continue;
    o.alive = false;
    o.status = "dead";
    o.field = false;
    unplace(state, o.id);
    logs.push(`${o.name} is dead.`);
  }

  const survivorIds = (units) => units
    .filter((u) => u.officerId && state.officers[u.officerId]?.alive)
    .map((u) => u.officerId);

  const soldierSum = (units, routedOnly) => units
    .filter((u) => (routedOnly ? u.routed : !u.routed) && !u.slain)
    .reduce((s, u) => s + Math.max(0, u.soldiers), 0);

  if (attWon) {
    const oldFaction = to.faction;
    const refugeFor = (officer) => otherCity(state, officer.faction, to.id);
    const captured = [];
    const handleDefender = (id) => {
      const o = state.officers[id];
      if (!o || !o.alive) return;
      if (isRuler(state, o)) {
        const refuge = refugeFor(o);
        if (refuge) {
          o.faction = oldFaction;
          place(state, id, refuge.id);
          logs.push(`${o.name} slips away to ${refuge.name}.`);
          return;
        }
      }
      unplace(state, id);
      o.status = "prisoner";
      o.factionHold = oldFaction;
      o.heldBy = battle.attackerFaction;
      o.heldAt = to.id;
      captured.push(id);
    };
    for (const id of battle.defenderIds) handleDefender(id);
    for (const id of battle.stayedIds) handleDefender(id);

    to.faction = battle.attackerFaction;
    for (const id of survivorIds(battle.attacker.units)) {
      const o = state.officers[id];
      o.faction = battle.attackerFaction;
      place(state, id, to.id);
    }
    to.soldiers = soldierSum(battle.attacker.units, false) + Math.round(soldierSum(battle.attacker.units, true) * 0.45);
    to.training = clamp(Math.round((from.training + to.training) / 2) - 4, 15, 100);
    to.people = clamp(to.people - 8, 8, 100);
    to.walls = clamp(to.walls - 10, 0, 100);
    ensureGovernor(state, to);
    ensureGovernor(state, from);
    ensureRuler(state, oldFaction, logs);
    ensureRuler(state, battle.attackerFaction, logs);
    if (state.emperorAt === to.id) {
      if (state.mandate && state.mandate !== battle.attackerFaction) state.mandate = null;
      logs.push(`The emperor is now in ${FACTIONS[battle.attackerFaction].name}'s hands at ${to.name}.`);
    }
    logs.push(`${to.name} falls to ${FACTIONS[battle.attackerFaction].name}.`);
    lastAct(state, oldFaction, to, logs);
    if (battle.attackerFaction === state.player) {
      battle.captured = captured;
    } else {
      for (const id of captured) autoAssignPrisoner(state, id, battle.attackerFaction, to.id, logs);
      battle.captured = [];
    }
    const winnerUnit = livingUnits(battle.attacker.units)[0] || battle.attacker.units.find((u) => u.officerId && state.officers[u.officerId]?.alive);
    if (winnerUnit?.officerId) {
      for (const id of battle.defenderIds) {
        if (!state.officers[id] || state.officers[id].alive) continue;
        logs.push(...giveGear(state, id, winnerUnit.officerId));
      }
    }
  } else {
    for (const id of survivorIds(battle.attacker.units)) {
      const o = state.officers[id];
      if (from.faction === battle.attackerFaction) {
        o.faction = battle.attackerFaction;
        place(state, id, from.id);
      } else {
        const home = otherCity(state, battle.attackerFaction, from.id) || factionCities(state, battle.attackerFaction)[0];
        if (home) place(state, id, home.id);
        else {
          o.status = "gone";
          unplace(state, id);
        }
      }
    }
    from.soldiers += soldierSum(battle.attacker.units, false) + Math.round(soldierSum(battle.attacker.units, true) * 0.5);
    to.soldiers += soldierSum(battle.defender.units, false) + Math.round(soldierSum(battle.defender.units, true) * 0.55);
    ensureGovernor(state, from);
    ensureGovernor(state, to);
    battle.captured = [];
    logs.push(`${from.name} fails to take ${to.name}.`);
    for (const unit of battle.attacker.units) {
      if (!unit.slain || !unit.officerId) continue;
      const taker = battle.defender.units.find((u) => u.officerId && state.officers[u.officerId]?.alive);
      if (taker) logs.push(...giveGear(state, unit.officerId, taker.officerId));
    }
  }
  logs.push(...settleRescue(state, battle, attWon));
  return logs;
}

function prepareBattle(state, fromId, order) {
  const from = state.cities[fromId];
  const to = state.cities[order.to];
  if (!from || !to) return null;
  if (from.faction !== order.faction) return null;
  if (to.faction === from.faction) return null;
  if (isAllied(state, from.faction, to.faction)) return null;
  if (!from.neighbors.includes(to.id)) return null;
  const ids = (order.officers || []).filter((id) => from.officerIds.includes(id) && state.officers[id]?.alive);
  if (!ids.length) return null;
  const minKeep = from.soldiers > 600 ? 100 : 0;
  let soldiers = Math.min(order.soldiers || 0, from.soldiers - minKeep);
  if (soldiers < 300) return null;
  const departed = soldiers;
  const roadNotes = [];
  let fatigue = 0;
  let morale = clamp(from.training, 15, 100);
  if (seasonName(state.month) === "winter") {
    fatigue += 0.1;
    morale -= 12;
    roadNotes.push("winter tires the march");
  }
  if (passRoad(from.id, to.id)) {
    fatigue += 0.15;
    morale -= 12;
    roadNotes.push("the pass is steep");
  }
  if (riverRoad(from.id, to.id)) {
    fatigue += 0.15;
    morale -= 12;
    roadNotes.push("the river crossing is slow");
  }
  const lost = Math.round(departed * Math.min(0.45, fatigue));
  soldiers = Math.max(1, departed - lost);
  morale = clamp(morale, 8, 100);
  from.soldiers -= departed;
  const leaders = ids.map((id) => state.officers[id]);
  const leaSum = leaders.reduce((s, o) => s + eff(o).lea, 0) || 1;
  const units = leaders.map((o) => ({
    officerId: o.id,
    soldiers: Math.max(1, Math.round(soldiers * (eff(o).lea / leaSum))),
    morale,
    routed: false,
    slain: false,
  }));
  const drift = soldiers - units.reduce((s, u) => s + u.soldiers, 0);
  units[0].soldiers += drift;
  for (const id of ids) {
    from.officerIds = from.officerIds.filter((x) => x !== id);
    state.officers[id].cityId = null;
    state.officers[id].field = true;
  }
  ensureGovernor(state, from);

  const defIds = to.officerIds.filter((id) => state.officers[id]?.alive);
  const ranked = defIds.map((id) => state.officers[id]).sort((a, b) => eff(b).war + eff(b).lea * 0.2 - (eff(a).war + eff(a).lea * 0.2));
  const fighters = ranked.slice(0, 3);
  const stayed = ranked.slice(3);
  const defSoldiers = to.soldiers;
  to.soldiers = 0;
  let dUnits;
  if (!fighters.length) {
    dUnits = [{
      officerId: null,
      soldiers: defSoldiers,
      morale: clamp(to.training - 10, 15, 100),
      routed: false,
      slain: false,
    }];
  } else {
    const dLea = fighters.reduce((s, o) => s + eff(o).lea, 0) || 1;
    dUnits = fighters.map((o) => ({
      officerId: o.id,
      soldiers: Math.max(1, Math.round(defSoldiers * (eff(o).lea / dLea))),
      morale: clamp(to.training, 15, 100),
      routed: false,
      slain: false,
    }));
    const dDrift = defSoldiers - dUnits.reduce((s, u) => s + u.soldiers, 0);
    dUnits[0].soldiers += dDrift;
  }
  return {
    fromId,
    toId: to.id,
    attackerFaction: from.faction,
    defenderFaction: to.faction,
    attackerIds: ids,
    defenderIds: fighters.map((o) => o.id),
    stayedIds: stayed.map((o) => o.id),
    attacker: { units },
    defender: { units: dUnits, walls: to.walls },
    round: 1,
    maxRounds: 8,
    log: [`${from.name} marches on ${to.name}${roadNotes.length ? `. ${roadNotes[0].charAt(0).toUpperCase()}${roadNotes[0].slice(1)}${roadNotes.length > 1 ? `, and ${roadNotes.slice(1).join(", ")}` : ""}` : ""}.`],
    done: false,
    winner: null,
    captured: [],
  };
}

function beginResolution(state, rng = Math.random) {
  if (state.phase !== "planning") return null;
  state.phase = "resolving";
  const logs = [];
  for (const city of Object.values(state.cities)) city._payGovernor = city.governor;
  for (const [cid, order] of Object.entries(state.shadowOrders || {})) {
    const city = state.cities[cid];
    if (!city || city.faction === state.player || !order) continue;
    if (!state.orders[cid]) state.orders[cid] = order;
  }
  const entries = Object.entries(state.orders);
  for (const [cid, order] of entries) {
    if (!order || (order.type !== "move" && order.type !== "transfer")) continue;
    const city = state.cities[cid];
    if (!city || city.faction !== order.faction) continue;
    applyMovement(state, city, order, logs);
  }
  for (const city of Object.values(state.cities)) {
    const order = state.orders[city.id];
    if (order && city.faction !== order.faction) continue;
    if (order && (order.type === "move" || order.type === "transfer" || order.type === "march")) continue;
    if (!order) {
      applyStanding(state, city, city.job || "fields", rng, logs);
      continue;
    }
    if (order.type === "job") {
      if (JOBS[order.job]) city.job = order.job;
      applyStanding(state, city, city.job || "fields", rng, logs);
      continue;
    }
    const local = [];
    applyDomestic(state, city, order, rng, local);
    if (city.faction === state.player || order.type === "search" || order.type === "employ" || order.type === "escort" || order.type === "spy") {
      logs.push(...local);
    }
  }
  applyDiplomacy(state, rng, logs);
  applyPlot(state, rng, logs);
  const envoy = negotiate(state, rng, logs);
  const battles = [];
  const marchIds = entries
    .filter(([, order]) => order?.type === "march")
    .map(([cid]) => cid)
    .sort((a, b) => totals(state, state.cities[a].faction).soldiers - totals(state, state.cities[b].faction).soldiers);
  for (const cid of marchIds) {
    const order = state.orders[cid];
    const city = state.cities[cid];
    if (!city || city.faction !== order.faction) {
      logs.push(`The host meant for the road from ${city?.name || "a lost city"} never forms.`);
      continue;
    }
    if (isAllied(state, city.faction, state.cities[order.to]?.faction)) {
      logs.push(`${city.name} holds back. The road leads to an ally.`);
      continue;
    }
    const battle = prepareBattle(state, cid, order);
    if (battle) battles.push(battle);
    else logs.push(`${city.name} cannot muster that march.`);
  }
  judgeIntrigue(state, logs, battles);
  state.revealed = state._spy || state._intrigueReveal || null;
  delete state._spy;
  delete state._intrigueReveal;
  state.orders = {};
  state.shadowOrders = {};
  state.threats = [];
  state.diplomacy = null;
  state.plot = null;
  state.pendingPrisoners = state.pendingPrisoners || [];
  return { logs, battles, envoy };
}

function answerEnvoy(state, envoy, accept) {
  if (!envoy) return [];
  const logs = [];
  if (accept) {
    formAlliance(state, envoy.from, state.player);
    logs.push(`${FACTIONS[envoy.from].name} and you swear alliance.`);
  } else {
    addRelation(state, envoy.from, state.player, -8);
    logs.push(`You refuse ${FACTIONS[envoy.from].name}.`);
  }
  return logs;
}

function recruitPrisoner(state, id, cityId) {
  const o = state.officers[id];
  const city = state.cities[cityId];
  if (!o || o.status !== "prisoner" || !city || city.faction !== state.player) return false;
  const ruler = rulerOfficer(state, state.player);
  const chr = ruler ? eff(ruler).chr : 60;
  let loyalty = Math.round(22 + chr / 3);
  if (o.id === "lvbu") loyalty = Math.min(loyalty, 34);
  if (o.id === "yuanshu") loyalty = Math.min(loyalty, 42);
  o.loyalty = clamp(loyalty, 15, 88);
  o.faction = state.player;
  o.status = "active";
  o.alive = true;
  place(state, id, cityId);
  return true;
}

function releasePrisoner(state, id) {
  const o = state.officers[id];
  if (!o || o.status !== "prisoner") return null;
  const old = o.factionHold;
  const refuge = old ? factionCities(state, old)[0] : null;
  if (refuge) {
    o.faction = old;
    o.status = "active";
    o.loyalty = clamp(Math.max(o.loyalty, 50), 0, 100);
    place(state, id, refuge.id);
    if (old && old !== state.player) addRelation(state, state.player, old, 8);
    return `${o.name} is released and returns to ${refuge.name}.`;
  }
  o.status = "gone";
  o.cityId = null;
  delete o.heldBy;
  delete o.heldAt;
  return `${o.name} is released and leaves the map.`;
}

function guestsIn(state, cityId) {
  return Object.values(state.officers).filter((o) => o.status === "guest" && o.cityId === cityId && o.alive);
}

function checkOutcome(state) {
  const mine = factionCities(state, state.player);
  if (!mine.length) return "defeat";
  const living = Object.keys(FACTIONS).filter((id) => factionCities(state, id).length);
  if (living.length === 1 && living[0] === state.player) return "victory";
  if (mine.length >= 12) return "victory";
  return null;
}

function completeMonth(state, rng = Math.random) {
  const logs = [];
  const season = seasonName(state.month);
  for (const city of Object.values(state.cities)) {
    const pay = projectedIncome(state, city);
    const goldIn = pay.gold;
    const riceIn = pay.rice;
    const upkeep = pay.upkeep;
    city.gold += goldIn;
    city.rice += riceIn - upkeep;
    if (city.rice < 0) {
      const desert = Math.min(city.soldiers, Math.round((-city.rice) * 1.4));
      city.soldiers -= desert;
      city.rice = 0;
      city.people = clamp(city.people - 6, 0, 100);
      logs.push(`${city.name} is short of grain. ${desert.toLocaleString()} soldiers drift away.`);
      for (const id of city.officerIds) {
        const o = state.officers[id];
        if (o && !isRuler(state, o)) o.loyalty = clamp(o.loyalty - 4, 0, 100);
      }
    }
    let floodChance = city.flood < 30 ? 0.1 : city.flood < 48 ? 0.04 : 0.01;
    if (season === "summer" && city.flood < 50) floodChance += 0.14;
    if (rng() < floodChance) {
      city.land = clamp(city.land - 8, 5, 100);
      city.rice = Math.round(city.rice * 0.72);
      city.people = clamp(city.people - 6, 0, 100);
      logs.push(`Floodwater tears through ${city.name}. Fields and granaries suffer.`);
    }
  }

  for (const faction of Object.keys(FACTIONS)) {
    const ruler = rulerOfficer(state, faction);
    if (!ruler || !ruler.alive) continue;
    const pull = (eff(ruler).chr - 72) / 12;
    for (const city of factionCities(state, faction)) {
      for (const id of city.officerIds) {
        const o = state.officers[id];
        if (!o || isRuler(state, o) || !o.alive) continue;
        let drift = pull;
        if (THIN_LOYALTY.includes(o.id)) drift -= 1;
        if (o.id === "chengong" && o.faction === "lvbu") drift -= 1;
        o.loyalty = clamp(o.loyalty + drift, 0, 100);
      }
    }
  }

  for (const o of Object.values(state.officers)) {
    const uneasy = THIN_LOYALTY.includes(o.id) || (o.id === "chengong" && o.faction === "lvbu");
    if (!o.alive || o.status !== "active" || isRuler(state, o) || o.loyalty >= (uneasy ? 42 : 30)) continue;
    if (rng() > 0.45) continue;
    const city = state.cities[o.cityId];
    if (!city) continue;
    let best = null;
    let bestChr = eff(rulerOfficer(state, o.faction) || o).chr;
    for (const nid of city.neighbors) {
      const nf = state.cities[nid].faction;
      if (nf === o.faction) continue;
      const r = rulerOfficer(state, nf);
      if (!r) continue;
      const chr = eff(r).chr;
      if (chr > bestChr + 4 && (!best || chr > bestChr)) {
        best = state.cities[nid];
        bestChr = chr;
      }
    }
    if (!best) continue;
    const fromName = FACTIONS[o.faction]?.name || "his lord";
    o.faction = best.faction;
    o.loyalty = 58;
    place(state, o.id, best.id);
    logs.push(`${o.name} abandons ${fromName} and slips into ${best.name}.`);
  }

  for (const faction of Object.keys(FACTIONS)) ensureRuler(state, faction, logs);

  const outcome = checkOutcome(state);
  state.outcome = outcome;
  state.month += 1;
  if (state.month > 12) {
    state.month = 1;
    state.year += 1;
    logs.push(`The year turns. It is now ${state.year}.`);
  }
  if (state.year === 200 && state.month === 1) {
    logs.push("The new century opens on the same broken map.");
  }
  if (state.month === 4) logs.push("Summer. The rivers rise, and a low dike will not hold.");
  if (state.month === 7) logs.push("Autumn. The fields pay what the governor has earned.");
  if (state.month === 10) logs.push("Winter. The camps eat more, and a march arrives tired.");
  state.turn += 1;
  const kept = [];
  for (const row of state.alliances || []) {
    if (typeof row === "string") {
      kept.push({ key: row, untilTurn: state.turn + 11 });
      continue;
    }
    if (state.turn >= row.untilTurn) {
      const [a, b] = row.key.split("|");
      logs.push(`The oath between ${FACTIONS[a]?.name || a} and ${FACTIONS[b]?.name || b} runs out.`);
      if (a && b) addRelation(state, a, b, -4);
    } else kept.push(row);
  }
  state.alliances = kept;
  const aim = aimStatus(state, state.player);
  if (aim?.met && !state.aimsMet[state.player]) {
    state.aimsMet[state.player] = true;
    logs.push(`Aim met: ${aim.title}. ${aim.text}`);
  }
  state.phase = "planning";
  for (const city of Object.values(state.cities)) delete city._payGovernor;
  if (state.pendingRescue) {
    logs.push("You did not bring him out.");
    state.pendingRescue = null;
  }
  logs.push(...tickIntrigue(state));
  planShadow(state, rng);
  return { logs, outcome };
}

function playerBattleSide(state, battle) {
  if (battle.attackerFaction === state.player) return "attacker";
  if (battle.defenderFaction === state.player) return "defender";
  return null;
}

function defaultJob(city) {
  if (city.flood < 38) return "dikes";
  if (city.people < 45) return "patrol";
  if (city.land < 48) return "fields";
  if (city.training < 55 && city.soldiers > 1000) return "drill";
  if (city.walls < 36) return "walls";
  if (city.trade < 50) return "markets";
  if (city.soldiers < 2200 && city.people > 40) return "levy";
  return "fields";
}

function seasonName(month) {
  if (month <= 3) return "spring";
  if (month <= 6) return "summer";
  if (month <= 9) return "autumn";
  return "winter";
}

const SEASON_RICE = { spring: 0.35, summer: 0.45, autumn: 1.6, winter: 0.15 };

function upkeepOf(city, month) {
  const winter = seasonName(month) === "winter" ? 1.6 : 1;
  return Math.max(0, Math.round(city.soldiers * 0.16 * winter));
}

function governorPresent(state, city) {
  const id = city._payGovernor || city.governor;
  const gov = id ? state.officers[id] : null;
  if (!gov || !gov.alive || gov.field || gov.cityId !== city.id) return null;
  if (city._payGovernor) return gov;
  const order = state.orders?.[city.id];
  if (!order) return gov;
  if (order.type === "march" && (order.officers || []).includes(gov.id)) return null;
  if (order.type === "move" && order.officerId === gov.id) return null;
  if (order.type === "transfer" && (order.officers || []).includes(gov.id)) return null;
  return gov;
}

function yieldMult(state, city) {
  const gov = governorPresent(state, city);
  if (!gov) return { gold: 1, grain: 1, name: null };
  const st = eff(gov);
  return {
    gold: 1 + st.int / 250,
    grain: 1 + (st.int + st.lea) / 400,
    name: gov.name,
  };
}

function projectedIncome(state, city) {
  const season = seasonName(state.month);
  const mult = yieldMult(state, city);
  const gold = Math.round((city.trade * 6 + city.people * 0.35) * mult.gold);
  const rice = Math.round(city.land * (16 + city.flood * 0.18) * SEASON_RICE[season] * mult.grain);
  const upkeep = upkeepOf(city, state.month);
  return {
    gold,
    rice,
    upkeep,
    netRice: rice - upkeep,
    governor: mult.name,
    grainMult: mult.grain,
    goldMult: mult.gold,
    season,
  };
}

function foodOutlook(state, city) {
  const upkeep = upkeepOf(city, state.month);
  return {
    upkeep,
    months: upkeep > 0 ? city.rice / upkeep : null,
    season: seasonName(state.month),
  };
}

function realmFood(state, faction) {
  const cities = factionCities(state, faction);
  const rice = cities.reduce((sum, city) => sum + city.rice, 0);
  const upkeep = cities.reduce((sum, city) => sum + upkeepOf(city, state.month), 0);
  return { rice, upkeep, months: upkeep > 0 ? rice / upkeep : null };
}

function applyStanding(state, city, job, rng, logs) {
  const type = JOB_TYPE[job] || "cultivate";
  const local = [];
  applyDomestic(state, city, { type, faction: city.faction }, rng, local);
  if (city.faction === state.player) logs.push(...local);
}

function passRoad(a, b) {
  return PASS_ROADS.has(pairKey(a, b));
}

function riverRoad(a, b) {
  return RIVER_ROADS.has(pairKey(a, b));
}

function playerMarchingOn(state, faction) {
  return Object.entries(state.orders || {}).some(([cityId, order]) => {
    if (order?.type !== "march") return false;
    const from = state.cities[cityId];
    if (!from || from.faction !== state.player) return false;
    return state.cities[order.to]?.faction === faction;
  });
}

function alliancePrice(state, faction) {
  const rel = relationOf(state, state.player, faction);
  const rivals = RIVAL_PAIRS.some((pair) => pair.includes(state.player) && pair.includes(faction));
  const gold = Math.max(0, 56 - rel) * 40 + (rivals ? 800 : 0);
  return { gold, blocked: playerMarchingOn(state, faction), rel, rivals };
}

function lordTemper(faction) {
  if (faction === "lvbu") return "duelist";
  if (faction === "yuanshao") return "proud";
  if (faction === "liubiao") return "cautious";
  return "steady";
}

function chooseAiOrder(state, city, rng) {
  const officers = activeInCity(state, city);
  if (!officers.length) return null;
  const temper = lordTemper(city.faction);
  const foes = city.neighbors
    .map((id) => state.cities[id])
    .filter((other) => other.faction !== city.faction && !isAllied(state, city.faction, other.faction));
  const ranked = foes.slice().sort((a, b) => a.soldiers * (1 + a.walls / 120) - b.soldiers * (1 + b.walls / 120));
  const weakest = ranked[0];
  const atYou = ranked.find((other) => other.faction === state.player);
  const target = atYou && rng() < (temper === "duelist" ? 0.72 : 0.48) ? atYou : weakest;
  const duelLooksGood = temper === "duelist" && target && officers.some((o) => eff(o).war >= 90);
  let marchChance = temper === "duelist" ? 0.62 : temper === "cautious" ? 0.16 : 0.42;
  let needRatio = temper === "duelist" ? 1.15 : temper === "cautious" ? 2.4 : 1.55;
  const aimsAtYou = target && target.faction === state.player;
  if (state.turn < 2) marchChance = aimsAtYou ? (temper === "duelist" ? 0.55 : 0.34) : marchChance * 0.2;
  if (target && riverRoad(city.id, target.id)) {
    needRatio += temper === "cautious" ? 1.4 : 0.7;
    if (temper === "cautious") marchChance = Math.min(marchChance, 0.08);
  }
  if (duelLooksGood) marchChance = Math.max(marchChance, state.turn < 2 ? (aimsAtYou ? 0.55 : 0.2) : 0.78);
  if (
    target
    && city.soldiers > 1600
    && city.soldiers > target.soldiers * needRatio
    && city.training >= 36
    && rng() < marchChance
  ) {
    const leaders = officers
      .slice()
      .sort((a, b) => eff(b).war - eff(a).war)
      .slice(0, Math.min(3, officers.length))
      .map((o) => o.id);
    const garrison = Math.max(200, Math.round(city.soldiers * 0.28));
    return {
      type: "march",
      to: target.id,
      officers: leaders,
      soldiers: city.soldiers - garrison,
      faction: city.faction,
    };
  }
  if (temper === "proud" && rng() < 0.55) return null;
  const low = officers.filter((o) => !isRuler(state, o) && o.loyalty < 46);
  if (low.length && city.gold > 180 && rng() < 0.4) {
    return { type: "reward", officerId: low[0].id, faction: city.faction };
  }
  const gov = state.officers[city.governor] || officers[0];
  const hidden = Object.values(state.officers).some((o) => o.status === "hidden" && o.homeCity === city.id);
  if (hidden && city.gold > 80 && eff(gov).int > 70 && rng() < 0.35) {
    return { type: "search", faction: city.faction };
  }
  if (city.rice < upkeepOf(city, state.month) * 3 && city.job !== "fields") {
    return { type: "job", job: "fields", faction: city.faction };
  }
  if (seasonName(state.month) === "summer" && city.flood < 42 && city.job !== "dikes") {
    return { type: "job", job: "dikes", faction: city.faction };
  }
  if (city.people < 36 && city.job !== "patrol") return { type: "job", job: "patrol", faction: city.faction };
  return null;
}

function planShadow(state, rng = Math.random) {
  state.shadowOrders = {};
  state.threats = [];
  for (const city of Object.values(state.cities)) {
    if (!city.faction || city.faction === state.player) continue;
    const order = chooseAiOrder(state, city, rng);
    if (!order) continue;
    state.shadowOrders[city.id] = order;
    if (order.type === "march" && state.cities[order.to]?.faction === state.player) {
      state.threats.push({ from: city.id, to: order.to, faction: city.faction });
    }
  }
}

function fundPlan(state, plan) {
  if (!plan || state.phase !== "planning") return { ok: false, reason: "The month is already turning." };
  const res = issueOrder(state, plan.cityId, plan.order);
  if (!res.ok) return res;
  return { ok: true, plan };
}

function courtProposals(state) {
  const ideas = [];
  for (const city of factionCities(state, state.player)) {
    for (const officer of activeInCity(state, city)) {
      const idea = ideaFor(state, officer, city);
      if (idea) ideas.push(idea);
    }
  }
  const preferred = ["zhangfei", "guanyu", "zhaoyun", "xunyu", "guojia", "chengong", "zhangliao", "tianfeng", "zhouyu", "xiahoudun"];
  ideas.sort((a, b) => {
    const ap = preferred.indexOf(a.speakerId);
    const bp = preferred.indexOf(b.speakerId);
    return (ap < 0 ? 40 : ap) - (bp < 0 ? 40 : bp);
  });
  const picked = [];
  const seen = new Set();
  for (const idea of ideas) {
    const key = `${idea.cityId}:${idea.order.type}:${idea.order.job || ""}:${idea.order.to || ""}:${idea.order.officerId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(idea);
    if (picked.length >= 3) break;
  }
  return picked;
}

function ideaFor(state, officer, city) {
  const st = eff(officer);
  const jobOrder = (job, line) => ({
    speakerId: officer.id,
    cityId: city.id,
    line,
    cost: JOBS[job]?.cost || 0,
    order: { type: "job", job },
  });
  if (officer.id === "chengong") {
    const job = city.flood < 60 ? "dikes" : "patrol";
    return jobOrder(job, `${officer.name} doubts another fight. He wants ${city.name} kept, not wagered.`);
  }
  if (officer.id === "zhangliao" && officer.loyalty < 75) {
    return {
      speakerId: officer.id,
      cityId: city.id,
      line: `${officer.name}'s loyalty is thin. A purse would hold him longer than a speech.`,
      cost: 100,
      order: { type: "reward", officerId: officer.id },
    };
  }
  const foes = city.neighbors
    .map((id) => state.cities[id])
    .filter((other) => other.faction !== city.faction && !isAllied(state, city.faction, other.faction));
  const weakest = foes.slice().sort((a, b) => a.soldiers - b.soldiers)[0];
  if (st.war >= 88 && st.int < 55 && weakest && city.soldiers >= 800 && city.soldiers > weakest.soldiers * 1.15) {
    const leaders = activeInCity(state, city).slice().sort((a, b) => eff(b).war - eff(a).war).slice(0, 3).map((o) => o.id);
    const soldiers = Math.max(400, city.soldiers - Math.max(200, Math.round(city.soldiers * 0.28)));
    return {
      speakerId: officer.id,
      cityId: city.id,
      line: `${officer.name} wants the road to ${weakest.name}. The job can wait a month.`,
      cost: 0,
      order: { type: "march", to: weakest.id, officers: leaders, soldiers },
    };
  }
  if (st.war >= 88 && st.int < 55) {
    return jobOrder("drill", `${officer.name} would rather drill ${city.name} than sit in council.`);
  }
  const hidden = Object.values(state.officers).some((o) => o.status === "hidden" && o.homeCity === city.id);
  if (st.int >= 86 && hidden) {
    return {
      speakerId: officer.id,
      cityId: city.id,
      line: `${officer.name} has heard of a recluse near ${city.name}.`,
      cost: 35,
      order: { type: "search" },
    };
  }
  if (st.int >= 80 && city.flood < 62) {
    return jobOrder("dikes", `${officer.name} wants the dikes at ${city.name} raised before the rivers do.`);
  }
  if (st.int >= 80) {
    return jobOrder("markets", `${officer.name} would set ${city.name} to the markets, and let the governor's mind raise the gold.`);
  }
  const low = activeInCity(state, city).find((o) => !isRuler(state, o) && o.loyalty < 66);
  if (st.chr >= 82 && low) {
    return {
      speakerId: officer.id,
      cityId: city.id,
      line: `${officer.name} asks a gift for ${low.name}. Loyalty there is ${low.loyalty}.`,
      cost: 100,
      order: { type: "reward", officerId: low.id },
    };
  }
  if (st.chr >= 78 && city.people < 78) {
    return jobOrder("patrol", `${officer.name} wants the wards of ${city.name} walked.`);
  }
  if (city.job !== "fields" && city.land < 70) {
    return jobOrder("fields", `${officer.name} would put ${city.name} back on the fields.`);
  }
  return null;
}

function oathGroup(id) {
  return OATHS.find((group) => group.includes(id)) || null;
}

function oathRetreat(state, pack) {
  const notes = [];
  const down = new Set(pack.units.filter((unit) => unit.slain || unit.routed).map((unit) => unit.officerId));
  const livingIds = livingUnits(pack.units).map((unit) => unit.officerId).filter(Boolean);
  for (const id of livingIds) {
    const group = oathGroup(id);
    if (!group) continue;
    const left = group.find((other) => other !== id && down.has(other));
    if (!left) continue;
    const officer = state.officers[id];
    const other = state.officers[left];
    if (officer) officer.loyalty = clamp(officer.loyalty - 12, 0, 100);
    notes.push(`${officer?.name || "An oath-brother"} retreats while ${other?.name || "the other"} is still in the dust.`);
  }
  return notes;
}

function battleIsPersonal(state, battle) {
  const ids = [...battle.attacker.units, ...battle.defender.units].map((unit) => unit.officerId).filter(Boolean);
  for (const id of ids) {
    const officer = state.officers[id];
    if (!officer) continue;
    if (isRuler(state, officer)) return true;
    if (oathGroup(id)) return true;
  }
  const att = new Set(battle.attacker.units.map((unit) => unit.officerId));
  const def = new Set(battle.defender.units.map((unit) => unit.officerId));
  return RIVAL_PAIRS.some(([a, b]) => (att.has(a) && def.has(b)) || (att.has(b) && def.has(a)));
}

function lastAct(state, faction, city, logs) {
  if (!faction || factionCities(state, faction).length) return;
  state.lastActs = state.lastActs || {};
  if (state.lastActs[faction]) return;
  state.lastActs[faction] = true;
  if (faction === "lvbu") {
    for (const officer of Object.values(state.officers)) {
      if (!officer.alive || (officer.faction !== "lvbu" && officer.factionHold !== "lvbu")) continue;
      officer.loyalty = Math.min(officer.loyalty, officer.status === "prisoner" ? 22 : 30);
    }
    logs.push("Lü Bu's company scatters. No captain holds them.");
    return;
  }
  const men = Object.values(state.officers).filter((officer) => (
    officer.alive
    && officer.status === "prisoner"
    && officer.factionHold === faction
    && !isRuler(state, officer)
  ));
  const loyal = men.slice().sort((a, b) => b.loyalty - a.loyalty)[0];
  if (loyal && loyal.loyalty >= 70 && city) {
    const burned = Math.round(city.rice * 0.4);
    city.rice = Math.max(0, city.rice - burned);
    logs.push(`${loyal.name} sets fire to the granary at ${city.name} before the seal changes hands (${burned.toLocaleString()} grain).`);
    return;
  }
  if (loyal) logs.push(`${loyal.name} does not die with the house. The seal is for sale.`);
  else logs.push(`The house of ${FACTIONS[faction]?.name || faction} is gone.`);
}

function aimStatus(state, faction) {
  const aim = AIMS[faction];
  if (!aim) return null;
  const held = new Set(factionCities(state, faction).map((city) => city.id));
  let met = false;
  if (faction === "liubei" || faction === "caocao") {
    met = state.mandate === faction && !!state.emperorAt && state.cities[state.emperorAt]?.faction === faction;
  } else if (faction === "sunce") met = ["jianye", "wu", "jiangling"].every((id) => held.has(id));
  else if (faction === "yuanshao") met = ["ye", "jinyang", "beiping"].every((id) => held.has(id));
  else if (faction === "lvbu") met = !!state.duelWins?.[faction];
  else if (faction === "liubiao") met = held.has("xiangyang") && held.has("jiangling");
  else if (faction === "liuzhang") met = held.has("chengdu") && held.has("hanzhong");
  else if (faction === "mateng") met = held.has("tianshui") && held.has("changan");
  else if (faction === "gongsunzan") met = held.has("ye");
  else if (faction === "yuanshu") met = held.has("shouchun") && held.has("jianye");
  else if (faction === "zhanglu") met = held.has("hanzhong") && held.has("chengdu");
  else if (faction === "lijue") met = held.has("changan") && state.emperorAt === "changan";
  else if (faction === "kongrong") met = held.has("beihai") && held.size >= 2;
  else if (faction === "zangba") met = held.has("donghai") && state.year > 194;
  return { ...aim, met };
}

function bondBlurb(id) {
  if (OATHS.some((group) => group.includes(id))) return "Bound by oath. Retreating while the other is down will be remembered.";
  if (THIN_LOYALTY.includes(id)) return "His loyalty is thin, and it thins further every month.";
  if (DOUBTS.some((pair) => pair.includes(id))) return "He doubts the lord he serves.";
  if (RIVAL_PAIRS.some((pair) => pair.includes(id))) return "A named rival keeps this feud personal.";
  return "";
}

const GIFT_MEN = {
  chengong: {
    rank: 2,
    failFaction: "caocao",
    hint: "A gift may keep the man who writes at night.",
    lead: (name, lord) => `Reward ${name} before the season turns. If it turns first, he writes to ${lord}.`,
    fail: (name, lord) => `${name} writes to ${lord} and leaves.`,
  },
  zhangliao: {
    rank: 0,
    failFaction: null,
    hint: "A purse would hold him longer than a speech.",
    lead: (name) => `Reward ${name} before the season turns.`,
    fail: (name) => `${name} slips away in the night.`,
  },
  jiaxu: {
    rank: 0,
    failFaction: null,
    hint: "Pay him before he prices a different lord.",
    lead: (name) => `Reward ${name} before the season turns.`,
    fail: (name) => `${name} finds a colder lord to advise.`,
  },
  tianfeng: {
    rank: 0,
    failFaction: null,
    hint: "The harsh counselor is cheaper to keep than to replace.",
    lead: (name) => `Reward ${name} before the season turns.`,
    fail: (name) => `${name} takes his counsel to another camp.`,
  },
};

function nextSeasonStart(state) {
  const month = state.month;
  if (month < 4) return { year: state.year, month: 4 };
  if (month < 7) return { year: state.year, month: 7 };
  if (month < 10) return { year: state.year, month: 10 };
  return { year: state.year + 1, month: 1 };
}

function seasonReached(state, mark) {
  if (!mark) return false;
  if (state.year > mark.year) return true;
  if (state.year < mark.year) return false;
  return state.month >= mark.month;
}

function clueLevel(state) {
  const tag = FACTIONS[state.player]?.tag;
  if (tag === "Open") return "named";
  if (tag === "Hard") return "rumor";
  return "hint";
}

function caseView(state) {
  const intrigue = state?.intrigue;
  if (!intrigue) return null;
  const level = clueLevel(state);
  const detail = level === "named" ? (intrigue.lead || "") : level === "hint" ? (intrigue.hint || "") : "";
  return {
    level,
    rumor: intrigue.rumor || "",
    detail,
    canAct: level !== "rumor" && !!intrigue.actionLabel && !intrigueFollowed(state),
    action: intrigue.actionLabel || "",
    id: intrigue.id,
  };
}

function intrigueBlurb(state) {
  const view = caseView(state);
  if (!view) return [];
  return [view.detail ? `${view.rumor} ${view.detail}` : view.rumor];
}

function spyCity(state, faction) {
  if (!faction) return null;
  for (const city of factionCities(state, state.player)) {
    if (!city.neighbors) continue;
    if (city.neighbors.some((id) => state.cities[id]?.faction === faction)) return city.id;
  }
  return null;
}

function rescueCases(state) {
  const ruler = rulerOfficer(state, state.player);
  if (!ruler?.alive || ruler.status !== "active" || !ruler.cityId) return [];
  const home = state.cities[ruler.cityId];
  if (!home || home.faction !== state.player || !home.neighbors) return [];
  const wanted = new Set();
  const group = OATHS.find((row) => row.includes(ruler.id));
  if (group) for (const id of group) if (id !== ruler.id) wanted.add(id);
  const heir = state.heirs?.[state.player];
  if (heir && heir !== ruler.id) wanted.add(heir);
  const out = [];
  for (const id of wanted) {
    const officer = state.officers[id];
    if (!officer?.alive || officer.status !== "prisoner" || !officer.heldBy) continue;
    let prison = officer.heldAt;
    if (!state.cities[prison] || state.cities[prison].faction !== officer.heldBy) {
      prison = factionCities(state, officer.heldBy)[0]?.id;
    }
    if (!prison || !home.neighbors.includes(prison)) continue;
    if (state.cities[prison].faction === state.player) continue;
    const city = state.cities[prison];
    const holder = FACTIONS[officer.heldBy]?.name || "the enemy";
    out.push({
      id: `rescue-${officer.id}`,
      kind: "rescue",
      score: 100,
      rumor: "One of your own is held behind enemy walls.",
      hint: "Only the lord's own ride brings him out.",
      lead: `Ride to ${city.name} yourself and bring ${officer.name} out.`,
      actionLabel: `Ride to ${city.name}`,
      solve: { type: "march", officerId: officer.id, cityId: prison, fromCityId: home.id, to: prison },
      spoil: null,
      failText: `${holder} presses ${officer.name} into service.`,
      solveText: `${ruler.name} rides himself. The battle decides.`,
      spoilText: "",
      failFaction: officer.heldBy,
      until: nextSeasonStart(state),
    });
  }
  return out;
}

function giftCases(state) {
  const out = [];
  for (const [id, meta] of Object.entries(GIFT_MEN)) {
    const officer = state.officers[id];
    if (!officer?.alive || officer.status !== "active" || officer.faction !== state.player) continue;
    if (isRuler(state, officer)) continue;
    const city = state.cities[officer.cityId];
    if (!city || city.faction !== state.player) continue;
    const lord = meta.failFaction ? (FACTIONS[meta.failFaction]?.name || "another lord") : "another lord";
    out.push({
      id: `gift-${officer.id}`,
      kind: "gift",
      score: 80 + (meta.rank || 0),
      rumor: "Someone in your camp is writing letters at night.",
      hint: meta.hint,
      lead: meta.lead(officer.name, lord),
      actionLabel: `Reward ${officer.name}`,
      solve: { type: "reward", officerId: officer.id, cityId: city.id, fromCityId: city.id },
      spoil: null,
      failText: meta.fail(officer.name, lord),
      solveText: `${officer.name} takes the gift and stays.`,
      spoilText: "",
      failFaction: meta.failFaction || null,
      until: nextSeasonStart(state),
    });
  }
  return out;
}

function audienceCases(state) {
  const ruler = rulerOfficer(state, state.player);
  if (!ruler?.alive || ruler.status !== "active" || !ruler.cityId) return [];
  const city = state.cities[ruler.cityId];
  if (!city || city.faction !== state.player) return [];
  const out = [];
  for (const officer of Object.values(state.officers)) {
    if (!officer?.alive || officer.status !== "guest" || officer.cityId !== city.id) continue;
    out.push({
      id: `audience-${officer.id}`,
      kind: "audience",
      score: 70,
      rumor: "A guest will hear the lord, and no captain in his place.",
      hint: `Call on the guest in ${city.name} yourself.`,
      lead: `Call on ${officer.name} while you remain in ${city.name}.`,
      actionLabel: `Call on ${officer.name}`,
      solve: { type: "employ", officerId: officer.id, cityId: city.id, fromCityId: city.id },
      spoil: null,
      failText: `${officer.name} leaves without an answer.`,
      solveText: `${officer.name} hears the lord.`,
      spoilText: "",
      failFaction: null,
      until: nextSeasonStart(state),
    });
  }
  return out;
}

function recluseCases(state) {
  const out = [];
  for (const officer of Object.values(state.officers)) {
    if (!officer || officer.status !== "hidden" || officer.alive === false || !officer.homeCity) continue;
    const city = state.cities[officer.homeCity];
    if (!city || city.faction !== state.player) continue;
    out.push({
      id: `search-${officer.id}`,
      kind: "search",
      score: officer.id === "zhugeliang" ? 65 : 60,
      rumor: "A recluse near your walls will not come to the gate.",
      hint: `Search the countryside of ${city.name}. A march will not find him.`,
      lead: `Search ${city.name}. ${officer.name} can be found before the season turns.`,
      actionLabel: `Search ${city.name}`,
      solve: { type: "search", officerId: officer.id, cityId: city.id, fromCityId: city.id },
      spoil: null,
      failText: `${officer.name} hears the camps and goes deeper into the hills.`,
      solveText: `${officer.name} will hear an offer, not yet take a seal.`,
      spoilText: "",
      failFaction: null,
      until: nextSeasonStart(state),
    });
  }
  return out;
}

function enemyDoubtCases(state) {
  const groups = new Map();
  const consider = (id, priority) => {
    const officer = state.officers[id];
    if (!officer?.alive || officer.status !== "active" || !officer.faction || officer.faction === state.player) return;
    const prev = groups.get(officer.faction);
    if (!prev || priority > prev.priority) groups.set(officer.faction, { officer, priority });
  };
  for (const pair of DOUBTS) {
    const id = pair.find((item) => state.officers[item] && !isRuler(state, state.officers[item])) || pair[0];
    consider(id, 2);
  }
  for (const id of THIN_LOYALTY) consider(id, 1);
  const out = [];
  for (const [faction, row] of groups) {
    const from = spyCity(state, faction);
    if (!from) continue;
    const officer = row.officer;
    const lord = FACTIONS[faction]?.name || "that lord";
    const city = state.cities[officer.cityId];
    if (!city) continue;
    out.push({
      id: `turn-${officer.id}`,
      kind: "turn",
      score: 50,
      rumor: `A man in ${lord}'s camp doubts his lord.`,
      hint: "Watching that camp may matter more than a march.",
      lead: `Spy ${lord}. ${officer.name} will come over. March on his city and he burns the letter instead.`,
      actionLabel: `Spy ${lord}`,
      solve: { type: "spy", officerId: officer.id, faction, cityId: city.id, fromCityId: from },
      spoil: { type: "march", to: city.id },
      failText: `${officer.name} keeps his doubts to himself.`,
      solveText: `${officer.name} comes over with what he knows.`,
      spoilText: `${officer.name} sees the banners and burns the letter.`,
      failFaction: faction,
      until: nextSeasonStart(state),
    });
  }
  return out;
}

function letterCase(state) {
  const officer = state.officers.jiaxu;
  if (!officer || officer.alive === false || officer.status === "dead" || officer.status === "gone") return null;
  if (officer.faction === state.player && officer.status === "active") return null;
  const city = state.cities[officer.cityId] || state.cities.changan;
  if (!city) return null;
  let solve;
  if (city.faction === state.player) {
    solve = { type: "search", officerId: "jiaxu", faction: officer.faction, cityId: city.id, fromCityId: city.id };
  } else {
    const faction = officer.faction || city.faction;
    const from = faction ? spyCity(state, faction) : null;
    if (!from) return null;
    solve = { type: "spy", officerId: "jiaxu", faction, cityId: city.id, fromCityId: from };
  }
  const lord = FACTIONS[solve.faction]?.name || "that lord";
  return {
    id: "letter-jiaxu",
    kind: "letter",
    score: 40,
    rumor: "A letter is moving that names a lord's weakness.",
    hint: `A march on ${city.name} burns it. A quieter watch may not.`,
    lead: solve.type === "search"
      ? `Search ${city.name}. Jia Xu's letter is there. A march on ${city.name} burns it.`
      : `Spy ${lord}. Jia Xu's letter will show their plans. March on ${city.name} and it burns.`,
    actionLabel: solve.type === "search" ? `Search ${city.name}` : `Spy ${lord}`,
    solve,
    spoil: { type: "march", to: city.id },
    failText: "The letter goes cold, and Jia Xu grows more careful.",
    solveText: "Jia Xu's letter is read. Their plans for next month are known.",
    spoilText: "The letter burns before it can be read.",
    failFaction: solve.faction || null,
    until: nextSeasonStart(state),
  };
}

function openIntrigue(state) {
  if (!state?.officers || !state?.cities || !state.player || !FACTIONS[state.player]) return null;
  let list = [
    ...rescueCases(state),
    ...giftCases(state),
    ...audienceCases(state),
    ...recluseCases(state),
    ...enemyDoubtCases(state),
  ];
  const letter = letterCase(state);
  if (letter) list.push(letter);
  if (state.intrigueLastId && list.some((item) => item.id !== state.intrigueLastId)) {
    list = list.filter((item) => item.id !== state.intrigueLastId);
  }
  if (!list.length) {
    state.intrigue = null;
    return null;
  }
  list.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pick = list[0];
  state.intrigue = pick;
  state.intrigueLastId = pick.id;
  return pick;
}

function closeIntrigue(state, how) {
  state.intrigue = null;
  state.intrigueQuietUntil = how === "failed"
    ? { year: state.year, month: state.month }
    : nextSeasonStart(state);
}

function orderMatchesCase(order, intrigue, cityId) {
  const solve = intrigue.solve;
  if (!order || !solve || order.type !== solve.type) return false;
  if (solve.type === "reward" || solve.type === "employ") return order.officerId === solve.officerId;
  if (solve.type === "spy") return (order.watch || order.faction) === solve.faction;
  if (solve.type === "search") return cityId === solve.cityId || cityId === solve.fromCityId;
  if (solve.type === "march") return order.to === solve.to;
  return false;
}

function playerOrderEntries(state) {
  return Object.entries(state.orders || {}).filter(([, order]) => order && order.faction === state.player);
}

function intrigueFollowed(state) {
  const intrigue = state?.intrigue;
  if (!intrigue?.solve) return false;
  if (intrigue.kind === "rescue") {
    const ruler = rulerOfficer(state, state.player);
    return playerOrderEntries(state).some(([, order]) => (
      order.type === "march"
      && order.to === intrigue.solve.to
      && ruler
      && (order.officers || []).includes(ruler.id)
    ));
  }
  return playerOrderEntries(state).some(([cityId, order]) => orderMatchesCase(order, intrigue, cityId));
}

function followIntrigue(state) {
  const intrigue = state.intrigue;
  if (!intrigue) return { ok: false, reason: "There is no case." };
  if (clueLevel(state) === "rumor") return { ok: false, reason: "The rumor does not name the step." };
  if (intrigueFollowed(state)) return { ok: true };
  const solve = intrigue.solve;
  if (intrigue.kind === "rescue") {
    const city = state.cities[solve.fromCityId];
    const ruler = rulerOfficer(state, state.player);
    if (!city || !ruler || ruler.cityId !== city.id) return { ok: false, reason: "The lord is not at the gate." };
    const others = (city.officerIds || []).filter((id) => id !== ruler.id && state.officers[id]?.alive && state.officers[id].status === "active");
    const keep = city.soldiers > 600 ? Math.min(200, city.soldiers - 400) : 0;
    const soldiers = city.soldiers - keep;
    if (soldiers < 400) return { ok: false, reason: "Not enough men to ride." };
    return issueOrder(state, city.id, {
      type: "march",
      to: solve.to,
      officers: [ruler.id, ...others.slice(0, 2)],
      soldiers,
    });
  }
  const order = { type: solve.type };
  if (solve.type === "reward" || solve.type === "employ") order.officerId = solve.officerId;
  if (solve.type === "spy") order.faction = solve.faction;
  return issueOrder(state, solve.fromCityId, order);
}

function spoilQueued(state, intrigue) {
  if (!intrigue.spoil || intrigue.spoil.type !== "march") return false;
  return playerOrderEntries(state).some(([, order]) => order.type === "march" && order.to === intrigue.spoil.to);
}

function lordStayed(state, intrigue) {
  const ruler = rulerOfficer(state, state.player);
  return !!(ruler && !ruler.field && ruler.cityId === intrigue.solve.cityId);
}

function solveMatched(state, intrigue, battles) {
  const solve = intrigue.solve;
  if (!solve) return false;
  if (intrigue.kind === "rescue") {
    const ruler = rulerOfficer(state, state.player);
    return (battles || []).some((battle) => (
      battle.attackerFaction === state.player
      && battle.toId === solve.to
      && ruler
      && (battle.attackerIds || []).includes(ruler.id)
    ));
  }
  const landed = playerOrderEntries(state).some(([cityId, order]) => order.landed && orderMatchesCase(order, intrigue, cityId));
  if (!landed) return false;
  if (intrigue.kind === "audience") return lordStayed(state, intrigue);
  return true;
}

function defectOfficer(state, officer, prefer) {
  const from = state.cities[officer.cityId];
  let target = null;
  if (prefer && prefer !== officer.faction && factionCities(state, prefer).length) {
    target = from?.neighbors?.map((id) => state.cities[id]).find((city) => city?.faction === prefer)
      || factionCities(state, prefer)[0];
  }
  if (!target && from?.neighbors) {
    target = from.neighbors.map((id) => state.cities[id]).find((city) => city?.faction && city.faction !== officer.faction);
  }
  if (!target?.faction) return null;
  officer.loyalty = 58;
  officer.faction = target.faction;
  place(state, officer.id, target.id);
  return target;
}

function applySpoil(state, intrigue) {
  const officer = state.officers[intrigue.solve?.officerId];
  if (intrigue.kind === "turn" && officer?.alive) officer.loyalty = clamp(officer.loyalty + 12, 0, 100);
  if (intrigue.kind === "letter" && officer?.alive) officer.loyalty = clamp(officer.loyalty + 8, 0, 100);
}

function applySolve(state, intrigue) {
  const officer = state.officers[intrigue.solve?.officerId];
  if (intrigue.kind === "gift") {
    if (officer) officer.loyalty = Math.max(officer.loyalty, 72);
    return;
  }
  if (intrigue.kind === "turn" && officer) {
    officer.faction = state.player;
    officer.loyalty = 64;
    officer.status = "active";
    place(state, officer.id, intrigue.solve.fromCityId);
    return;
  }
  if (intrigue.kind === "letter") {
    if (officer) officer.loyalty = clamp(officer.loyalty - 14, 0, 100);
    state._intrigueReveal = intrigue.solve.faction || officer?.faction || null;
    return;
  }
  if (intrigue.kind === "rescue") {
    state.pendingRescue = { officerId: intrigue.solve.officerId, to: intrigue.solve.to };
  }
}

function judgeIntrigue(state, logs, battles) {
  const intrigue = state.intrigue;
  if (!intrigue) return;
  if (spoilQueued(state, intrigue)) {
    applySpoil(state, intrigue);
    if (intrigue.spoilText) logs.push(intrigue.spoilText);
    closeIntrigue(state, "spoiled");
    return;
  }
  if (!solveMatched(state, intrigue, battles)) return;
  applySolve(state, intrigue);
  if (intrigue.solveText) logs.push(intrigue.solveText);
  closeIntrigue(state, "solved");
}

function failIntrigue(state) {
  const intrigue = state.intrigue;
  if (!intrigue) return [];
  const officer = state.officers[intrigue.solve?.officerId];
  if (intrigue.kind === "gift" && officer?.alive && officer.status === "active" && officer.faction === state.player) {
    defectOfficer(state, officer, intrigue.failFaction);
  } else if (intrigue.kind === "turn" && officer?.alive && officer.status === "active") {
    officer.loyalty = clamp(officer.loyalty + 6, 0, 100);
  } else if (intrigue.kind === "letter") {
    if (officer?.alive) officer.loyalty = clamp(officer.loyalty + 8, 0, 100);
    if (intrigue.solve?.faction && intrigue.solve.faction !== state.player) {
      addRelation(state, state.player, intrigue.solve.faction, -8);
    }
  } else if (intrigue.kind === "search" && officer?.status === "hidden") {
    officer.difficulty = (officer.difficulty || 70) + 12;
  } else if (intrigue.kind === "audience" && officer?.status === "guest") {
    officer.status = "hidden";
    officer.visits = 0;
    officer.cityId = officer.homeCity || null;
  } else if (intrigue.kind === "rescue" && officer?.status === "prisoner" && officer.heldBy) {
    const holder = officer.heldBy;
    let cityId = officer.heldAt;
    if (!state.cities[cityId] || state.cities[cityId].faction !== holder) {
      cityId = factionCities(state, holder)[0]?.id;
    }
    if (cityId) {
      officer.faction = holder;
      officer.loyalty = 55;
      officer.status = "active";
      place(state, officer.id, cityId);
    }
  }
  return intrigue.failText ? [intrigue.failText] : [];
}

function tickIntrigue(state) {
  const logs = [];
  if (state.intrigue && seasonReached(state, state.intrigue.until)) {
    logs.push(...failIntrigue(state));
    closeIntrigue(state, "failed");
    openIntrigue(state);
    logs.push(...intrigueBlurb(state));
  } else if (!state.intrigue && seasonReached(state, state.intrigueQuietUntil)) {
    openIntrigue(state);
    logs.push(...intrigueBlurb(state));
  }
  return logs;
}

function settleRescue(state, battle, attWon) {
  const pending = state.pendingRescue;
  if (!pending || battle.toId !== pending.to || battle.attackerFaction !== state.player) return [];
  state.pendingRescue = null;
  const officer = state.officers[pending.officerId];
  const city = state.cities[battle.toId];
  if (attWon && officer?.status === "prisoner") {
    officer.faction = state.player;
    officer.loyalty = 78;
    officer.status = "active";
    place(state, officer.id, battle.toId);
    return [`${officer.name} is brought out of ${city?.name || "the city"}.`];
  }
  return ["You did not bring him out."];
}

function normalizeSave(data) {
  if (!data || !data.cities || !data.officers) return null;
  if (data.version !== 1 && data.version !== 2) return null;
  data.version = 2;
  data.alliances = (data.alliances || []).map((row) => (
    typeof row === "string" ? { key: row, untilTurn: (data.turn || 1) + 12 } : row
  ));
  for (const city of Object.values(data.cities)) {
    if (!city.job) city.job = defaultJob(city);
  }
  data.emperorAt = data.emperorAt || "changan";
  data.mandate = data.mandate ?? null;
  data.revealed = data.revealed ?? null;
  data.shadowOrders = data.shadowOrders || {};
  data.threats = data.threats || [];
  data.lastActs = data.lastActs || {};
  data.aimsMet = data.aimsMet || {};
  data.duelWins = data.duelWins || {};
  data.orders = data.orders || {};
  data.pendingRescue = data.pendingRescue ?? null;
  data.intrigueLastId = data.intrigueLastId ?? null;
  if (!("intrigue" in data)) data.intrigue = null;
  if (!("intrigueQuietUntil" in data)) data.intrigueQuietUntil = null;
  if (data.phase === "planning" && !data.threats.length && !Object.keys(data.shadowOrders).length) {
    planShadow(data, Math.random);
  }
  if (data.phase === "planning" && !data.intrigue && !data.intrigueQuietUntil) {
    openIntrigue(data);
    if (Array.isArray(data.log)) {
      for (const line of intrigueBlurb(data)) pushLog(data, line);
    }
  }
  return data;
}

