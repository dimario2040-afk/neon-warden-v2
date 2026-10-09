// bfs_reach.mjs — валидация графа комнат: связность, прогрессия способностей, софтлоки, карта.
import { bfsProgression, deadEndAudit, mapConsistency, buildEdges } from "../src/worldgraph.js";
import { ROOMS } from "../src/rooms.js";

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "  OK  " : " FAIL ") + msg); if (!cond) fail++; };

console.log("== doors reciprocity ==");
const { problems: doorProblems } = buildEdges();
ok(doorProblems.length === 0, "all doors reciprocal & gates consistent" + (doorProblems.length ? ": " + doorProblems.join("; ") : ""));

console.log("== map consistency ==");
const mp = mapConsistency();
ok(mp.length === 0, "map cells adjacent per door sides, no overlaps" + (mp.length ? ": " + mp.join("; ") : ""));

console.log("== BFS progression ==");
const res = bfsProgression(); const { reach, problems, finalSet } = res;
ok(problems.length === 0, `all ${ROOMS.length} rooms reachable, abilities/cores obtainable` + (problems.length ? ": " + problems.join("; ") : ""));
console.log("  final set:", JSON.stringify(finalSet));
const order = [];
console.log("  first-visit order:", res.order.join(" → "));

console.log("== dead ends ==");
const dead = deadEndAudit();
ok(dead.length === 0, "no reward-less dead ends" + (dead.length ? ": " + dead.join(", ") : ""));

console.log(fail === 0 ? "\nBFS: PASS" : `\nBFS: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
