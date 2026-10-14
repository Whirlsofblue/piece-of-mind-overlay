// Turns an analysed chess.com game into an annotated PGN for a Lichess study:
// ?! ? ?? on inaccuracies, mistakes and blunders with Lichess-style comments, the engine's
// better line as a variation, chess.com's clock times, and a note where the game left
// opening theory (from the Lichess opening explorer).

import { Chess } from "./vendor/chess.js";

const NAG = { inaccuracy: "$6", mistake: "$2", blunder: "$4" };
const NAME = { inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder" };
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Like Lichess's comments: 0.85, -1.20, #3, #-2.
export function evalText(s) {
  if (s.mate !== undefined) return s.winner ? "#" : `#${s.mate}`;
  return (s.cp / 100).toFixed(2);
}

// Plays UCI moves from a position, returning their SAN (stops at the first illegal one).
export function toSan(fen, ucis, max = 99) {
  const c = new Chess(fen);
  const out = [];
  for (const u of ucis.slice(0, max)) {
    try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
  }
  return out;
}

// FEN before each ply (index i = before move i).
export function fensBefore(ucis) {
  const c = new Chess();
  const fens = [c.fen()];
  for (const u of ucis) { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); fens.push(c.fen()); }
  return fens;
}

const clean = (text) => text.replace(/[{}]/g, "");
const moveNo = (ply) => Math.floor(ply / 2) + 1;
const prefix = (ply, force) => (ply % 2 === 0 ? `${moveNo(ply)}. ` : force ? `${moveNo(ply)}... ` : "");

// Clock comments as chess.com writes them, one per ply.
export function clocks(pgn) {
  return [...pgn.matchAll(/\[%clk ([0-9:.]+)\]/g)].map((m) => m[1]);
}

const pct = (x) => `${Math.round(x * 100)}%`;
const share = (m, total) => (m.white + m.draws + m.black) / total;
const scoreFor = (m, colour) => {
  const n = m.white + m.draws + m.black;
  return n ? ((colour === "w" ? m.white : m.black) + m.draws / 2) / n : 0;
};

// ---- Lichess opening explorer (needs a Lichess login) ----

const EXPLORER = "https://explorer.lichess.org/lichess";
const SPEEDS = { bullet: "bullet", blitz: "blitz", rapid: "rapid", daily: "correspondence,classical" };
const explorerCache = new Map();

async function explore(token, playUci, timeClass) {
  const q = new URLSearchParams({ variant: "standard", speeds: SPEEDS[timeClass] || "blitz,rapid", ratings: "2000,2200,2500", play: playUci.join(","), moves: "8", topGames: "0", recentGames: "0" });
  const url = `${EXPLORER}?${q}`;
  if (explorerCache.has(url)) return explorerCache.get(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 61000)); continue; }
    if (!r.ok) throw new Error(`explorer ${r.status}`);
    const data = await r.json();
    explorerCache.set(url, data);
    return data;
  }
  throw new Error("explorer busy");
}

// Walks a game through the explorer until it leaves well-trodden ground. Returns the
// opening's name and the first move (by either side) that most 2000+ players don't play.
export async function openingReport(token, ucis, sans, timeClass) {
  let name = null;
  for (let ply = 0; ply < Math.min(ucis.length, 30); ply++) {
    const data = await explore(token, ucis.slice(0, ply), timeClass);
    if (data.opening?.name) name = data.opening.name;
    const total = data.white + data.draws + data.black;
    if (total < 30) return { name, deviation: null, theoryEnds: ply }; // nobody's been here: already off the map
    const played = data.moves.find((m) => m.uci === ucis[ply]);
    const playedShare = played ? share(played, total) : 0;
    if (playedShare < 0.05) {
      const colour = ply % 2 === 0 ? "w" : "b";
      return {
        name,
        theoryEnds: ply,
        deviation: {
          ply, colour, total,
          played: { san: sans[ply], share: playedShare, score: played ? scoreFor(played, colour) : null },
          top: data.moves.slice(0, 3).map((m) => ({ san: m.san, uci: m.uci, share: share(m, total), score: scoreFor(m, colour) })),
        },
      };
    }
  }
  return { name, deviation: null, theoryEnds: null };
}

export function deviationText(dev, mine) {
  const tops = dev.top.map((m) => `${m.san} (${pct(m.share)}, scores ${pct(m.score)})`).join(", ");
  const who = mine ? "You left" : "Your opponent left";
  const playedLine = dev.played.share > 0
    ? `${dev.played.san} was played in ${pct(dev.played.share)} of games${dev.played.score != null ? ` and scores ${pct(dev.played.score)}` : ""}.`
    : `${dev.played.san} doesn't appear in the database here.`;
  return `📖 ${who} the common path here. In ${dev.total.toLocaleString("en")} games between 2000+ players on Lichess, the usual moves are ${tops}. ${playedLine}`;
}

// ---- PGN ----

function resultOf(g) {
  if (g.white.result === "win") return "1-0";
  if (g.black.result === "win") return "0-1";
  return "1/2-1/2";
}

// One game, annotated. `g` is the chess.com game, `r` its analyseGame() result, `opening`
// its openingReport() (or null), `me` "w" or "b".
export function annotatedPgn(g, r, opening, me) {
  const date = new Date(g.end_time * 1000);
  const ymd = `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
  const headers = {
    Event: `${g.time_class[0].toUpperCase()}${g.time_class.slice(1)} on chess.com`,
    Site: g.url,
    Date: ymd,
    White: g.white.username,
    Black: g.black.username,
    Result: resultOf(g),
    WhiteElo: String(g.white.rating),
    BlackElo: String(g.black.rating),
    TimeControl: g.time_control,
    ECO: r.headers.ECO || "?",
    Opening: opening?.name || "?",
    Annotator: "Piece of Mind (Stockfish 17.1, Lichess formulas)",
  };
  const fens = fensBefore(r.uci);
  const clk = clocks(g.pgn);
  const them = me === "w" ? "b" : "w";
  const c = r.counts[me];
  const intro = `Accuracy: you ${r.accuracy[me]?.toFixed(1)}%, opponent ${r.accuracy[them]?.toFixed(1)}%. ` +
    `Your moves: ${c.inaccuracy} inaccurac${c.inaccuracy === 1 ? "y" : "ies"}, ${c.mistake} mistake${c.mistake === 1 ? "" : "s"}, ${c.blunder} blunder${c.blunder === 1 ? "" : "s"}.` +
    (opening?.name ? ` Opening: ${opening.name}.` : "");

  let text = `{ ${clean(intro)} } `;
  let force = false;
  r.moves.forEach((san, i) => {
    const j = r.judgements[i];
    text += `${prefix(i, force)}${san}${j ? ` ${NAG[j]}` : ""} `;
    force = false;
    const notes = [];
    if (clk[i]) notes.push(`[%clk ${clk[i]}]`);
    if (j) {
      const best = toSan(fens[i], [r.bests[i]])[0];
      const before = i === 0 ? { cp: 15 } : r.scores[i - 1];
      notes.push(`(${evalText(before)} → ${evalText(r.scores[i])}) ${NAME[j]}.${best ? ` ${best} was best.` : ""}`);
    }
    if (opening?.deviation?.ply === i) notes.push(deviationText(opening.deviation, opening.deviation.colour === me));
    if (notes.length) { text += `{ ${clean(notes.join(" "))} } `; force = true; }
    if (j && r.pvs[i]?.length) {
      // The engine's line instead, as a variation.
      const line = toSan(fens[i], r.pvs[i], 8);
      if (line.length) {
        text += `(${line.map((s, k) => `${prefix(i + k, k === 0)}${s}`).join(" ")}) `;
        force = true;
      }
    }
  });
  text += headers.Result;
  return Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n") + "\n\n" + text.trim() + "\n";
}

// A one-question interactive lesson from the position before your opening deviation:
// find the move strong players choose. Returns null when there's nothing worth asking.
export function openingQuiz(g, r, opening, me) {
  const dev = opening?.deviation;
  if (!dev || dev.colour !== me) return null;
  if (r.bests[dev.ply] === r.uci[dev.ply]) return null; // rare, but the engine's own choice: nothing to fix
  const fens = fensBefore(r.uci);
  const fen = fens[dev.ply];
  // The answer: the engine's choice if strong players also play it, otherwise their most popular move.
  const engineUci = r.bests[dev.ply];
  const answer = dev.top.find((m) => m.uci === engineUci) || dev.top[0];
  if (!answer || answer.uci === r.uci[dev.ply]) return null;
  const engineSan = engineUci ? toSan(fen, [engineUci])[0] : null;
  const reply = r.pvs[dev.ply]?.[0] === answer.uci ? toSan(fen, r.pvs[dev.ply], 2)[1] : null;
  const why = `${answer.san} is played in ${pct(answer.share)} of games between 2000+ players and scores ${pct(answer.score)}.` +
    (engineSan && engineSan !== answer.san ? ` The engine's choice is ${engineSan}.` : "") +
    ` In your game you played ${dev.played.san}.`;
  const opp = g[me === "w" ? "black" : "white"].username;
  const headers = {
    Event: "Opening quiz",
    White: me === "w" ? "You" : opp,
    Black: me === "b" ? "You" : opp,
    Result: "*",
    FEN: fen,
    SetUp: "1",
  };
  const text = `{ ${clean(`From your game vs ${opp}${opening.name ? ` (${opening.name})` : ""}. What do strong players play here?`)} } ` +
    `${prefix(dev.ply, true)}${answer.san} { ${clean(why)} }${reply ? ` ${prefix(dev.ply + 1, false)}${reply}` : ""} *`;
  return Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n") + "\n\n" + text + "\n";
}

export const startFen = START;
