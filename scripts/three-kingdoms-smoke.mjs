import {
  applyBattleResult,
  autoplayBattle,
  beginResolution,
  completeMonth,
  createGame,
  factionCities,
  issueOrder,
  prepareBattle,
  rngFrom,
  EDGES,
} from "../public/three-kingdoms/js/logic.js";
import { CITIES, OFFICERS } from "../public/three-kingdoms/js/data.js";

const problems = [];
function check(cond, msg) {
  if (!cond) problems.push(msg);
}

const ids = new Set(OFFICERS.map((o) => o.id));
for (const city of CITIES) {
  check(ids.has(city.governor), `${city.id} governor missing`);
  for (const oid of city.officers) check(ids.has(oid), `${city.id} officer ${oid} missing`);
  check(city.officers.includes(city.governor), `${city.id} governor not in city`);
}
const placed = new Map();
for (const city of CITIES) {
  for (const oid of city.officers) {
    check(!placed.has(oid), `${oid} placed twice`);
    placed.set(oid, city.id);
  }
}
for (const [a, b] of EDGES) {
  check(CITIES.some((c) => c.id === a) && CITIES.some((c) => c.id === b), `bad edge ${a}-${b}`);
}

function audit(state, label) {
  const seen = new Set();
  for (const city of Object.values(state.cities)) {
    check(Number.isFinite(city.gold) && city.gold >= 0, `${label} gold ${city.id}`);
    check(Number.isFinite(city.rice) && city.rice >= 0, `${label} rice ${city.id}`);
    check(Number.isFinite(city.soldiers) && city.soldiers >= 0, `${label} soldiers ${city.id}`);
    for (const key of ["land", "flood", "trade", "people", "walls", "training"]) {
      check(city[key] >= 0 && city[key] <= 100, `${label} ${city.id} ${key}`);
    }
    if (city.governor) check(city.officerIds.includes(city.governor), `${label} governor drift ${city.id}`);
    for (const oid of city.officerIds) {
      check(!seen.has(oid), `${label} ${oid} in two cities`);
      seen.add(oid);
      const o = state.officers[oid];
      check(o && o.alive && o.status === "active" && o.cityId === city.id, `${label} officer sync ${oid}`);
    }
  }
  for (const o of Object.values(state.officers)) {
    if (o.status === "active" && o.alive) check(seen.has(o.id), `${label} active officer homeless ${o.id}`);
    if (!o.alive) check(o.status === "dead", `${label} dead status ${o.id}`);
  }
}

const game = createGame("liubei");
check(game.officers.zhugeliang.status === "hidden", "zhuge should be hidden");
check(game.cities.xiaopei.soldiers === 3000, "xiaopei troops");
audit(game, "start");

const cultivated = issueOrder(game, "xiaopei", { type: "cultivate" });
check(cultivated.ok, cultivated.reason || "cultivate");
const before = game.cities.xiaopei.land;
let rng = rngFrom(3);
let turned = beginResolution(game, rng);
check(turned.battles.length === 0, "cultivate should not battle");
check(game.cities.xiaopei.land > before, "land should rise");
completeMonth(game, rng);
check(game.month === 2, "month advances");
audit(game, "after cultivate");

const war = createGame("liubei");
const march = issueOrder(war, "xiaopei", {
  type: "march",
  to: "donghai",
  officers: ["guanyu", "zhangfei", "zhaoyun"],
  soldiers: 2400,
});
check(march.ok, march.reason || "march");
rng = rngFrom(7);
turned = beginResolution(war, rng);
check(turned.battles.length === 1, `expected one battle, got ${turned.battles.length}`);
const battle = turned.battles[0];
autoplayBattle(war, battle, rng);
check(battle.done && battle.winner === "attacker", `Liu Bei should take Donghai, got ${battle.winner}`);
applyBattleResult(war, battle);
check(war.cities.donghai.faction === "liubei", "donghai owner");
completeMonth(war, rng);
audit(war, "after donghai");

let wins = 0;
for (let seed = 1; seed <= 12; seed++) {
  const g = createGame("liubei");
  issueOrder(g, "xiaopei", { type: "march", to: "donghai", officers: ["guanyu", "zhangfei"], soldiers: 2200 });
  const r = rngFrom(seed);
  const res = beginResolution(g, r);
  const b = res.battles[0];
  autoplayBattle(g, b, r);
  if (b.winner === "attacker") wins += 1;
  applyBattleResult(g, b);
  completeMonth(g, r);
  audit(g, `seed ${seed}`);
}
check(wins >= 9, `Donghai wins ${wins}/12`);

const long = createGame("caocao");
for (let i = 0; i < 18; i++) {
  const r = rngFrom(100 + i);
  for (const city of factionCities(long, "caocao")) {
    if (!long.orders[city.id]) issueOrder(long, city.id, { type: i % 2 ? "train" : "cultivate" });
  }
  const res = beginResolution(long, r);
  for (const b of res.battles) {
    if (!b.done) autoplayBattle(long, b, r);
    applyBattleResult(long, b);
  }
  completeMonth(long, r);
  audit(long, `year-turn ${i}`);
  if (long.outcome) break;
}
check(!problems.some((p) => p.startsWith("year-turn")), "long campaign audit");

const guest = createGame("liubiao");
guest.officers.zhugeliang.status = "guest";
guest.officers.zhugeliang.cityId = "xiangyang";
guest.officers.zhugeliang.visits = 0;
const e1 = issueOrder(guest, "xiangyang", { type: "employ", officerId: "zhugeliang" });
check(e1.ok, "employ order");
beginResolution(guest, rngFrom(1));
check(guest.officers.zhugeliang.status === "guest", "first visit should not recruit");
check(guest.officers.zhugeliang.visits === 1, "visit counted");
guest.phase = "planning";
issueOrder(guest, "xiangyang", { type: "employ", officerId: "zhugeliang" });
beginResolution(guest, rngFrom(2));
guest.phase = "planning";
issueOrder(guest, "xiangyang", { type: "employ", officerId: "zhugeliang" });
beginResolution(guest, rngFrom(3));
check(guest.officers.zhugeliang.status === "active", "third visit recruits Zhuge");
check(guest.cities.xiangyang.officerIds.includes("zhugeliang"), "zhuge placed");

const direct = createGame("zangba");
const pb = prepareBattle(direct, "donghai", {
  type: "march",
  to: "xiaopei",
  faction: "zangba",
  officers: ["zangba"],
  soldiers: 800,
});
check(pb && pb.attacker.units[0].soldiers > 0, "battle detachment");
autoplayBattle(direct, pb, rngFrom(4));
applyBattleResult(direct, pb);
audit(direct, "counter");

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok · Donghai wins ${wins}/12 · Cao Cao survived ${long.turn} months · outcome ${long.outcome || "ongoing"}`);
