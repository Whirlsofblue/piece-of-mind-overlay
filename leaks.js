// Repertoire leaks: opening positions you reach again and again and score badly in.
//
// Builds a tree of your games' first moves, finds positions where it's your move, you've been
// there at least `minGames` times, and you score clearly below your usual score, and ranks
// them by points lost (games × the gap). For the worst few it then gathers what you played,
// what strong players play (Lichess opening explorer) and what the engine thinks.

import { Chess } from "./vendor/chess.js";
import { toSan, evalText } from "./annotate.js";

const DEPTH_PLIES = 24; // the opening: first 12 moves a side
const fenKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
const DRAWS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

export function scoreOf(g, user) {
  const side = g.white.username.toLowerCase() === user ? "white" : "black";
  const r = g[side].result;
  return r === "win" ? 1 : DRAWS.has(r) ? 0.5 : 0;
}

// Every position in your games' openings where it was your move:
// key -> { fen, moves (UCI from the start), colour, games: [index], score, played: { uci: { san, n, score } } }
export function openingTree(games, user) {
  const nodes = new Map();
  games.forEach((g, gi) => {
    const colour = g.white.username.toLowerCase() === user ? "w" : "b";
    const score = scoreOf(g, user);
    const c = new Chess();
    let moves;
    try {
      const full = new Chess();
      full.loadPgn(g.pgn);
      moves = full.history({ verbose: true }).slice(0, DEPTH_PLIES);
    } catch { return; }
    const uci = [];
    for (const m of moves) {
      if (c.turn() === colour) {
        const key = `${colour}|${fenKey(c.fen())}`;
        const node = nodes.get(key) || { fen: c.fen(), moves: [...uci], colour, games: [], score: 0, played: {} };
        node.games.push(gi);
        node.score += score;
        const u = m.from + m.to + (m.promotion || "");
        const p = (node.played[u] ||= { san: m.san, n: 0, score: 0 });
        p.n++;
        p.score += score;
        nodes.set(key, node);
      }
      c.move(m.san);
      uci.push(m.from + m.to + (m.promotion || ""));
    }
  });
  return nodes;
}

// The worst positions, most points lost first. A position whose games are mostly those of a
// worse one already listed is left out (it's the same leak a move later).
export function findLeaks(games, user, { minGames = 4, gap = 0.15, max = 5 } = {}) {
  const overall = games.reduce((a, g) => a + scoreOf(g, user), 0) / Math.max(1, games.length);
  const candidates = [];
  for (const node of openingTree(games, user).values()) {
    const n = node.games.length;
    if (n < minGames) continue;
    const score = node.score / n;
    if (score > overall - gap) continue;
    candidates.push({ ...node, n, score, lost: n * (overall - score) });
  }
  candidates.sort((a, b) => b.lost - a.lost);
  const chosen = [];
  for (const c of candidates) {
    const overlaps = chosen.some((k) => c.games.filter((g) => k.games.includes(g)).length >= 0.8 * c.games.length);
    if (!overlaps) chosen.push(c);
    if (chosen.length === max) break;
  }
  return { overall, leaks: chosen };
}

// ---- A closer look at one leak ----

const pct = (x) => `${Math.round(x * 100)}%`;

async function explorer(token, moves, timeClass) {
  if (!token) return null;
  const speeds = { bullet: "bullet", blitz: "blitz", rapid: "rapid", daily: "correspondence,classical" }[timeClass] || "blitz,rapid";
  const q = new URLSearchParams({ variant: "standard", speeds, ratings: "2000,2200,2500", play: moves.join(","), moves: "5", topGames: "0", recentGames: "0" });
  const r = await fetch(`https://explorer.lichess.org/lichess?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = await r.json();
  const total = d.white + d.draws + d.black;
  const colour = moves.length % 2 === 0 ? "w" : "b";
  return {
    total,
    name: d.opening?.name || null,
    moves: d.moves.map((m) => {
      const n = m.white + m.draws + m.black;
      return { uci: m.uci, san: m.san, share: n / total, score: ((colour === "w" ? m.white : m.black) + m.draws / 2) / n };
    }),
  };
}

// What you played, what strong players play, what the engine says; and the move to learn.
export async function examine(leak, engine, token, timeClass, depth = 18) {
  const whiteToMove = leak.colour === "w";
  const top = await engine.lines(leak.moves, whiteToMove, depth, 3);
  const evals = {};
  for (const l of top) evals[l.pv[0]] = l.score;
  for (const u of Object.keys(leak.played)) {
    if (!evals[u]) evals[u] = (await engine.evaluate([...leak.moves, u], !whiteToMove)).score;
  }
  const db = await explorer(token, leak.moves, timeClass).catch(() => null);
  const best = top[0]?.pv[0];
  // The move to learn: the engine's choice if strong players play it too, else their most popular good move.
  const popular = db?.moves.filter((m) => m.share >= 0.1) || [];
  const learn = popular.find((m) => m.uci === best) ? best : popular[0]?.uci || best;
  return { ...leak, top, evals, db, learn, learnSan: toSan(leak.fen, [learn])[0], line: top.find((l) => l.pv[0] === learn)?.pv || [learn] };
}

const moveNo = (ply) => Math.floor(ply / 2) + 1;
const prefix = (ply, force) => (ply % 2 === 0 ? `${moveNo(ply)}. ` : force ? `${moveNo(ply)}... ` : "");
const header = (h) => Object.entries(h).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n");

export function leakText(x, overall) {
  const yours = Object.entries(x.played).sort((a, b) => b[1].n - a[1].n)
    .map(([u, p]) => `${p.san} ×${p.n} (${pct(p.score / p.n)}${x.evals[u] ? `, engine ${evalText(x.evals[u])}` : ""})`).join(", ");
  const strong = x.db?.moves.slice(0, 3).map((m) => `${m.san} (${pct(m.share)}, scores ${pct(m.score)})`).join(", ");
  return `You've reached this position ${x.n} times and scored ${pct(x.score)} (your usual: ${pct(overall)}). ` +
    `You played: ${yours}. ` +
    (strong ? `2000+ players on Lichess play: ${strong}. ` : "") +
    `Engine's top moves: ${x.top.map((l) => `${toSan(x.fen, [l.pv[0]])[0]} ${evalText(l.score)}`).join(", ")}. ` +
    `The move to learn here: ${x.learnSan}.`;
}

// The leak as a study chapter: the move to learn as the main line, each move you played as a variation.
export function leakPgn(x, overall, label, gameUrls) {
  const ply = x.moves.length;
  const learned = toSan(x.fen, x.line, 6);
  const arrows = [`G${x.learn.slice(0, 2)}${x.learn.slice(2, 4)}`];
  const yourMost = Object.entries(x.played).sort((a, b) => b[1].n - a[1].n)[0][0];
  if (yourMost !== x.learn) arrows.push(`R${yourMost.slice(0, 2)}${yourMost.slice(2, 4)}`);
  let text = `{ [%cal ${arrows.join(",")}] ${leakText(x, overall)}${gameUrls.length ? ` Your games: ${gameUrls.slice(0, 3).join(" ")}` : ""} } `;
  text += learned.map((s, k) => `${prefix(ply + k, k === 0)}${s}${k === 0 ? " { The move to learn. }" : ""}`).slice(0, 1).join(" ") + " ";
  for (const [u, p] of Object.entries(x.played)) {
    if (u === x.learn) continue;
    text += `(${prefix(ply, true)}${p.san} { You: ${p.n} game${p.n === 1 ? "" : "s"}, ${pct(p.score / p.n)}${x.evals[u] ? `, engine ${evalText(x.evals[u])}` : ""}. } ) `;
  }
  text += learned.slice(1).map((s, k) => `${prefix(ply + k + 1, k === 0)}${s}`).join(" ");
  return header({ Event: `Repertoire leak: ${label}`, Result: "*", FEN: x.fen, SetUp: "1", Annotator: "Piece of Mind" }) + "\n\n" + text.trim() + " *\n";
}

// "Find the move" for My openings.
export function leakQuiz(x, label) {
  const ply = x.moves.length;
  const why = x.db?.moves.find((m) => m.uci === x.learn)
    ? (() => { const m = x.db.moves.find((d) => d.uci === x.learn); return `${x.learnSan} is played in ${pct(m.share)} of games between 2000+ players and scores ${pct(m.score)}.`; })()
    : `${x.learnSan} is the engine's choice here.`;
  const text = `{ ${label}: a position you reach often (${x.n} times, ${pct(x.score)}). What's the move? } ` +
    `${prefix(ply, true)}${x.learnSan} { ${why} } *`;
  return header({ Event: "Opening quiz", Result: "*", FEN: x.fen, SetUp: "1" }) + "\n\n" + text + "\n";
}
