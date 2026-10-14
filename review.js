// Engine review of finished games: Stockfish evaluates every position, then Lichess's
// published formulas turn the evaluations into accuracy and inaccuracy / mistake / blunder
// judgements. Ported from lila (AccuracyPercent.scala, Advice.scala) and scalachess (eval.scala).
//
// Scores are { cp } or { mate } from White's point of view; a delivered checkmate is
// { mate: 0, winner: "w" | "b" }.

import { Chess } from "./vendor/chess.js";

const ENGINE_URL = new URL("./vendor/stockfish/stockfish-17.1-lite-single-03e3232.js", import.meta.url);
const CEILING = 1000;
const INITIAL_CP = 15; // lichess: the starting position is +0.15

// ---- Lichess formulas ----

// [-1, 1]
export function winningChances(cp) {
  const c = Math.max(-CEILING, Math.min(CEILING, cp));
  return Math.max(-1, Math.min(1, 2 / (1 + Math.exp(-0.00368208 * c)) - 1));
}

const mateSign = (s) => (s.winner ? (s.winner === "w" ? 1 : -1) : Math.sign(s.mate));
const isMate = (s) => s.mate !== undefined;
const forceAsCp = (s) => (isMate(s) ? CEILING * mateSign(s) : s.cp);
export const winPercent = (s) => 50 + 50 * winningChances(forceAsCp(s)); // White's, [0, 100]

// Score from one side's point of view.
const pov = (s, colour) => {
  const k = colour === "w" ? 1 : -1;
  return isMate(s) ? { mate: s.mate * k, sign: mateSign(s) * k } : { cp: s.cp * k };
};

// The judgement of one move, from the evaluation before it and after it (lila Advice).
export function judge(prev, next, mover) {
  if (!isMate(prev) && !isMate(next)) {
    const d = winningChances(next.cp) - winningChances(prev.cp);
    const loss = mover === "w" ? -d : d;
    return loss >= 0.3 ? "blunder" : loss >= 0.2 ? "mistake" : loss >= 0.1 ? "inaccuracy" : null;
  }
  const p = pov(prev, mover), n = pov(next, mover);
  const pCp = p.cp ?? 0, nCp = n.cp ?? 0;
  const created = p.cp !== undefined && n.sign < 0; // walked into a forced mate
  const lost = p.sign > 0 && (n.cp !== undefined || n.sign < 0); // let a forced mate slip
  if (created) return pCp < -999 ? "inaccuracy" : pCp < -700 ? "mistake" : "blunder";
  if (lost) return nCp > 999 ? "inaccuracy" : nCp > 700 ? "mistake" : "blunder";
  return null;
}

function accuracyFromWinPercents(before, after) {
  if (after >= before) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1)); // +1: lichess's uncertainty bonus
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdDev = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

// Game accuracy per colour: the mean of a volatility-weighted mean and a harmonic mean
// (lila AccuracyPercent.gameAccuracy). `scores` are the positions after each move.
export function gameAccuracy(scores, startColour = "w") {
  const wps = [50 + 50 * winningChances(INITIAL_CP), ...scores.map(winPercent)];
  const size = Math.max(2, Math.min(8, Math.floor(scores.length / 10)));
  const windows = [
    ...Array(Math.max(0, Math.min(size, wps.length) - 2)).fill(wps.slice(0, size)),
    ...Array.from({ length: Math.max(0, wps.length - size + 1) }, (_, i) => wps.slice(i, i + size)),
  ];
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));
  const per = { w: [], b: [] };
  for (let i = 0; i + 1 < wps.length && i < weights.length; i++) {
    const colour = (i % 2 === 0) === (startColour === "w") ? "w" : "b";
    const [p, n] = [wps[i], wps[i + 1]];
    const acc = colour === "w" ? accuracyFromWinPercents(p, n) : accuracyFromWinPercents(n, p);
    per[colour].push([acc, weights[i]]);
  }
  const result = {};
  for (const c of ["w", "b"]) {
    const list = per[c];
    if (!list.length) { result[c] = null; continue; }
    const weighted = list.reduce((a, [x, w]) => a + x * w, 0) / list.reduce((a, [, w]) => a + w, 0);
    const harmonic = list.length / list.reduce((a, [x]) => a + 1 / x, 0);
    result[c] = (weighted + harmonic) / 2;
  }
  return result;
}

// ---- Stockfish ----

export class Engine {
  constructor(depth = 18) {
    this.depth = depth;
    this.worker = null;
    this.listener = null;
  }

  async start() {
    if (this.worker) return;
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e) => this.listener?.(String(e.data));
    await this.send("uci", (line) => line === "uciok");
    this.worker.postMessage("setoption name Hash value 32");
    await this.send("isready", (line) => line === "readyok");
  }

  send(command, until) {
    return new Promise((resolve) => {
      this.listener = (line) => { if (until(line)) { this.listener = null; resolve(); } };
      this.worker.postMessage(command);
    });
  }

  // Evaluation of a position (after the given UCI moves), from White's point of view,
  // and the engine's best move there.
  async evaluate(moves, whiteToMove) {
    let score = { cp: 0 }, best = null;
    await new Promise((resolve) => {
      this.listener = (line) => {
        const m = line.match(/^info .*\bscore (cp|mate) (-?\d+)/);
        if (m && !/\b(lowerbound|upperbound)\b/.test(line)) {
          const v = Number(m[2]) * (whiteToMove ? 1 : -1); // UCI scores are from the side to move
          score = m[1] === "cp" ? { cp: v } : { mate: v };
        }
        if (line.startsWith("bestmove")) { best = line.split(" ")[1]; this.listener = null; resolve(); }
      };
      this.worker.postMessage(`position startpos${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
      this.worker.postMessage(`go depth ${this.depth}`);
    });
    return { score, best };
  }

  stop() { this.worker?.terminate(); this.worker = null; }
}

// ---- A whole game ----

// Analyses a finished game's PGN. Returns per-colour accuracy and judgement counts, every
// move's judgement (for annotating), and White's win% after each move (for a graph).
export async function analyseGame(engine, pgn, onProgress = () => {}) {
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const replay = new Chess();
  const uci = [];
  const scores = [];
  const bests = [(await engine.evaluate([], true)).best]; // best move in each position before a move
  for (const [i, move] of history.entries()) {
    replay.move(move.san);
    uci.push(move.from + move.to + (move.promotion || ""));
    if (replay.isCheckmate()) {
      scores.push({ mate: 0, winner: move.color });
      bests.push(null);
    } else if (replay.isStalemate() || replay.isInsufficientMaterial()) {
      scores.push({ cp: 0 });
      bests.push(null);
    } else {
      const { score, best } = await engine.evaluate(uci, replay.turn() === "w");
      scores.push(score);
      bests.push(best);
    }
    onProgress((i + 1) / history.length);
  }
  const counts = { w: { inaccuracy: 0, mistake: 0, blunder: 0 }, b: { inaccuracy: 0, mistake: 0, blunder: 0 } };
  const judgements = history.map((move, i) => {
    // Like lichess, the engine's own choice is never judged (a later drop is the engine seeing deeper).
    if (bests[i] === uci[i]) return null;
    const prev = i === 0 ? { cp: INITIAL_CP } : scores[i - 1];
    const j = judge(prev, scores[i], move.color);
    if (j) counts[move.color][j]++;
    return j;
  });
  return {
    accuracy: gameAccuracy(scores),
    counts,
    judgements,
    moves: history.map((m) => m.san),
    winPercents: [50 + 50 * winningChances(INITIAL_CP), ...scores.map(winPercent)],
  };
}
