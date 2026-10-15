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
  return {
    version: 1,
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
    log: [
      {
        text: "Spring, 194. The Han court is a shadow in Chang'an. Warlords tax the passes, and oaths last as long as the grain.",
      },
    ],
    selected: home ? home.id : Object.keys(cities)[0],
    dismissedTip: false,
    outcome: null,
    rngNote: typeof rng === "function" ? "external" : "",
  };
}

function monthLabel(state) {
  const [season, month] = MONTHS[state.month - 1];
  return `${season}, ${state.year} · ${month}`;
}

function factionCities(state, faction) {
  return Object.values(state.cities).filter((c) => c.faction === faction);
}

function rulerOfficer(state, faction) {
  const id = state.rulers[faction];
  return id ? state.officers[id] : null;
}

function isRuler(state, officer) {
  if (!officer) return false;
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

function isAllied(state, a, b) {
  if (a === b) return true;
  return state.alliances.includes(pairKey(a, b));
}

function addRelation(state, a, b, delta) {
  if (a === b) return;
  const key = pairKey(a, b);
  state.relations[key] = clamp((state.relations[key] ?? 40) + delta, 0, 100);
}

function formAlliance(state, a, b) {
  const key = pairKey(a, b);
  if (!state.alliances.includes(key)) state.alliances.push(key);
  state.relations[key] = Math.max(state.relations[key] ?? 40, 66);
}

function breakAlliance(state, a, b) {
  const key = pairKey(a, b);
  state.alliances = state.alliances.filter((k) => k !== key);
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

function orderLabel(state, order) {
  if (!order) return "Rest";
  const cityName = (id) => state.cities[id]?.name || "the road";
  switch (order.type) {
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
    default: return "Rest";
  }
}

function validate(state, city, order) {
  if (!order || !order.type) return "Empty order.";
  const mine = activeInCity(state, city);
  if (!mine.length && !["transfer"].includes(order.type)) return "No officer remains to carry out an order.";
  const friends = city.neighbors.filter((id) => state.cities[id].faction === city.faction);
  const foes = city.neighbors.filter((id) => state.cities[id].faction !== city.faction);
  switch (order.type) {
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
  state.orders[cityId] = { ...order, faction: city.faction };
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

function chooseOrder(state, city, rng, aggressive) {
  const officers = activeInCity(state, city);
  if (!officers.length) return null;
  const gov = state.officers[city.governor] || officers[0];
  const st = eff(gov);
  const foes = city.neighbors
    .map((id) => state.cities[id])
    .filter((c) => c.faction !== city.faction && !isAllied(state, city.faction, c.faction));
  const weakest = foes.slice().sort((a, b) => a.soldiers * (1 + a.walls / 120) - b.soldiers * (1 + b.walls / 120))[0];
  if (
    aggressive
    && weakest
    && city.soldiers > 1800
    && city.soldiers > weakest.soldiers * (1.55 + weakest.walls / 200)
    && city.training >= 40
    && rng() < 0.72
  ) {
    const leaders = officers
      .slice()
      .sort((a, b) => eff(b).war - eff(a).war)
      .slice(0, Math.min(3, officers.length))
      .map((o) => o.id);
    const garrison = Math.max(200, Math.round(city.soldiers * 0.28));
    return {
      type: "march",
      to: weakest.id,
      officers: leaders,
      soldiers: city.soldiers - garrison,
      faction: city.faction,
    };
  }
  const low = officers.filter((o) => !isRuler(state, o) && o.loyalty < 48);
  if (low.length && city.gold > 180 && rng() < 0.45) {
    return { type: "reward", officerId: low[0].id, faction: city.faction };
  }
  const hidden = Object.values(state.officers).some((o) => o.status === "hidden" && o.homeCity === city.id);
  if (hidden && city.gold > 80 && st.int > 70 && rng() < 0.4) {
    return { type: "search", faction: city.faction };
  }
  if (city.rice < city.soldiers * 0.25 && city.land < 85) return { type: "cultivate", faction: city.faction };
  if (city.people < 42) return { type: "patrol", faction: city.faction };
  if (city.flood < 36) return { type: "irrigate", faction: city.faction };
  if (city.soldiers < 2200 && city.gold > 220 && city.people > 38) return { type: "recruit", faction: city.faction };
  if (city.training < 52 && city.soldiers > 900) return { type: "train", faction: city.faction };
  if (city.walls < 36 && city.gold > 240 && rng() < 0.4) return { type: "fortify", faction: city.faction };
  if (city.trade <= city.land && city.trade < 75) return { type: "trade", faction: city.faction };
  if (city.land <= city.flood) return { type: "cultivate", faction: city.faction };
  return { type: "irrigate", faction: city.faction };
}

function advise(state, rng = Math.random) {
  if (state.phase !== "planning") return;
  for (const city of factionCities(state, state.player)) {
    if (state.orders[city.id]) continue;
    const order = chooseOrder(state, city, rng, state.turn >= 2);
    if (order) state.orders[city.id] = order;
  }
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
      o.loyalty = clamp(o.loyalty + 8 + Math.round(st.chr / 20), 0, 100);
      logs.push(`${o.name} accepts a gift. Loyalty is ${o.loyalty}.`);
      break;
    }
    case "employ": {
      const g = state.officers[order.officerId];
      if (!g || g.status !== "guest" || g.cityId !== city.id) return;
      if (!spend(city, 40)) { logs.push(`There is no gift to carry to ${g.name}.`); return; }
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
    if (treasury.gold < gold) { logs.push("The gift cannot be paid."); return; }
    treasury.gold -= gold;
    addRelation(state, state.player, d.faction, Math.round(gold / 38));
    logs.push(`A gift of ${gold} gold reaches ${FACTIONS[d.faction].name}. Standing is now ${relationOf(state, state.player, d.faction)}.`);
    return;
  }
  if (d.type === "alliance") {
    if (isAllied(state, state.player, d.faction)) { logs.push("You are already allied."); return; }
    const rel = relationOf(state, state.player, d.faction);
    const them = totals(state, d.faction).soldiers;
    const us = totals(state, state.player).soldiers;
    const accept = rel >= 56 || (rel >= 38 && them <= us * 1.15) || (rel >= 28 && them < us * 0.65);
    if (accept) {
      formAlliance(state, state.player, d.faction);
      logs.push(`${FACTIONS[d.faction].name} accepts the alliance.`);
    } else {
      addRelation(state, state.player, d.faction, -4);
      logs.push(`${FACTIONS[d.faction].name} refuses the oath.`);
    }
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
    const chance = clamp(((ourR ? eff(ourR).chr : 50) - (theirR ? eff(theirR).chr : 50) + 25) / 120, 0.1, 0.75);
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
            prisoners.push(id);
          }
        } else {
          unplace(state, id);
          o.status = "prisoner";
          o.factionHold = d.faction;
          prisoners.push(id);
        }
      }
      city.faction = state.player;
      city.people = Math.max(20, city.people - 6);
      ensureGovernor(state, city);
      state.pendingPrisoners = (state.pendingPrisoners || []).concat(prisoners);
      ensureRuler(state, d.faction, logs);
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
    battle.log.push(...logs);
    return;
  }
  if (defenderAction?.type === "withdraw") {
    battle.done = true;
    battle.winner = "attacker";
    logs.push("The defenders abandon the walls.");
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
    maybeSlay(state, loser, rng);
    if (loser.slain) logs.push(`${ln} does not leave the field.`);
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
    logs.push(`${to.name} falls to ${FACTIONS[battle.attackerFaction].name}.`);
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
  from.soldiers -= soldiers;
  const leaders = ids.map((id) => state.officers[id]);
  const leaSum = leaders.reduce((s, o) => s + eff(o).lea, 0) || 1;
  const units = leaders.map((o) => ({
    officerId: o.id,
    soldiers: Math.max(1, Math.round(soldiers * (eff(o).lea / leaSum))),
    morale: clamp(from.training, 15, 100),
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
    log: [`${from.name} marches on ${to.name}.`],
    done: false,
    winner: null,
    captured: [],
  };
}

function beginResolution(state, rng = Math.random) {
  if (state.phase !== "planning") return null;
  state.phase = "resolving";
  const logs = [];
  for (const city of Object.values(state.cities)) {
    if (city.faction === state.player) continue;
    if (!factionCities(state, city.faction).length) continue;
    const order = chooseOrder(state, city, rng, state.turn >= 3);
    if (order) state.orders[city.id] = order;
  }
  const entries = Object.entries(state.orders);
  for (const [cid, order] of entries) {
    if (!order || (order.type !== "move" && order.type !== "transfer")) continue;
    const city = state.cities[cid];
    if (!city || city.faction !== order.faction) continue;
    applyMovement(state, city, order, logs);
  }
  for (const [cid, order] of entries) {
    if (!order || order.type === "move" || order.type === "transfer" || order.type === "march") continue;
    const city = state.cities[cid];
    if (!city || city.faction !== order.faction) continue;
    applyDomestic(state, city, order, rng, logs);
  }
  applyDiplomacy(state, rng, logs);
  applyPlot(state, rng, logs);
  const envoy = negotiate(state, rng, logs);
  const battles = [];
  const marchIds = entries
    .filter(([, order]) => order?.type === "march")
    .map(([cid]) => cid)
    .sort((a, b) => {
      const pa = state.cities[a].faction === state.player ? 0 : 1;
      const pb = state.cities[b].faction === state.player ? 0 : 1;
      return pa - pb;
    });
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
  state.orders = {};
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
  for (const city of Object.values(state.cities)) {
    const goldIn = Math.round(city.trade * 6 + city.people * 0.35);
    const riceIn = Math.round(city.land * (16 + city.flood * 0.18));
    const upkeep = Math.round(city.soldiers * 0.16);
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
    const floodChance = city.flood < 30 ? 0.1 : city.flood < 48 ? 0.04 : 0.01;
    if (rng() < floodChance) {
      city.land = clamp(city.land - 8, 5, 100);
      city.rice = Math.round(city.rice * 0.72);
      city.people = clamp(city.people - 6, 0, 100);
      logs.push(`Floodwater tears through ${city.name}. Fields and granaries suffer.`);
    } else if (city.land > 68 && city.flood > 55 && rng() < 0.06) {
      const bonus = city.land * 12;
      city.rice += bonus;
      logs.push(`${city.name} brings in a heavy harvest (+${bonus.toLocaleString()} grain).`);
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
        o.loyalty = clamp(o.loyalty + pull, 0, 100);
      }
    }
  }

  for (const o of Object.values(state.officers)) {
    if (!o.alive || o.status !== "active" || isRuler(state, o) || o.loyalty >= 30) continue;
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
  state.turn += 1;
  state.phase = "planning";
  return { logs, outcome };
}

function playerBattleSide(state, battle) {
  if (battle.attackerFaction === state.player) return "attacker";
  if (battle.defenderFaction === state.player) return "defender";
  return null;
}

