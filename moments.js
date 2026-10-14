// The moments that decided a game, looked at more deeply, and "only move" puzzles from them.
//
// Critical moments: your moves that cost the most winning chances (Lichess's win% scale).
// Each gets a deeper look: Lichess's cloud evaluation when it has the position (often depth
// 40+), otherwise Stockfish searching deeper and returning its top moves.
// Puzzles: positions where one move was clearly better than every other (the same idea as
// Lichess's puzzle generator), taken from moments you missed.

import { winPercent } from "./review.js";
import { toSan, evalText } from "./annotate.js";

const INITIAL = { cp: 15 };
const colourOf = (ply) => (ply % 2 === 0 ? "w" : "b");
const winFor = (score, colour) => (colour === "w" ? winPercent(score) : 100 - winPercent(score));

// Up to `max` of your moves that lost at least `min` win% points, in game order. Moves that
// match the engine's choice are never counted (as on Lichess).
export function criticalPlies(r, me, max = 3, min = 8) {
  const out = [];
  r.uci.forEach((move, i) => {
    if (colourOf(i) !== me || r.bests[i] === move) return;
    const before = i === 0 ? INITIAL : r.scores[i - 1];
    const loss = winFor(before, me) - winFor(r.scores[i], me);
    if (loss >= min) out.push({ ply: i, loss });
  });
  return out.sort((a, b) => b.loss - a.loss).slice(0, max).map((m) => m.ply).sort((a, b) => a - b);
}

async function cloudLines(fen, count) {
  try {
    const r = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${count}`);
    if (!r.ok) return null;
    const data = await r.json();
    const lines = (data.pvs || []).map((p) => ({ score: p.mate !== undefined ? { mate: p.mate } : { cp: p.cp }, pv: p.moves.split(" ") }));
    return lines.length ? { lines, depth: data.depth, source: "Lichess cloud" } : null;
  } catch {
    return null;
  }
}

// The top moves before ply `ply`: from the Lichess cloud if it has a deep enough look,
// otherwise from the engine at `depth`.
export async function deepLines(engine, r, fens, ply, depth, count = 3) {
  const cloud = await cloudLines(fens[ply], count);
  if (cloud && cloud.depth >= depth + 4 && cloud.lines.length >= Math.min(count, 2)) return cloud;
  const lines = await engine.lines(r.uci.slice(0, ply), colourOf(ply) === "w", depth, count);
  return { lines, depth, source: "Stockfish" };
}

// One move clearly better than the rest, and good enough to hold or win: a puzzle.
export function isOnlyMove(lines, colour) {
  if (lines.length < 2) return false;
  const best = winFor(lines[0].score, colour), second = winFor(lines[1].score, colour);
  return best - second >= 15 && best >= 45;
}

// The comment and variations for a critical moment, ready to drop into the game's PGN.
export function momentNotes(r, fens, ply, look, me) {
  const tops = look.lines.slice(0, 3).map((l) => `${toSan(fens[ply], l.pv, 1)[0]} ${evalText(l.score)}`).join(", ");
  const comment = `🔑 Critical moment. Best here (${look.source}, depth ${look.depth}): ${tops}. ` +
    `You played ${r.moves[ply]} (${evalText(r.scores[ply])}).`;
  const variations = look.lines.slice(0, 3).map((l) => toSan(fens[ply], l.pv, 8)).filter((v) => v.length);
  return { comment, variations };
}

const moveNo = (ply) => Math.floor(ply / 2) + 1;
const prefix = (ply, force) => (ply % 2 === 0 ? `${moveNo(ply)}. ` : force ? `${moveNo(ply)}... ` : "");

// A one-move interactive lesson: the position before the moment, find the only move.
export function puzzlePgn(g, r, fens, ply, look, me) {
  const opp = g[me === "w" ? "black" : "white"].username;
  const [best, reply] = toSan(fens[ply], look.lines[0].pv, 2);
  const second = toSan(fens[ply], look.lines[1].pv, 1)[0];
  // Say what the move does: a clearly winning shot, or the one move that holds.
  const doing = winFor(look.lines[0].score, me) >= 75 ? "wins" : "holds the position";
  const why = `${best} (${evalText(look.lines[0].score)}) is the only move that ${doing}: the next best, ${second}, gives ${evalText(look.lines[1].score)}. ` +
    `In the game you played ${r.moves[ply]} (${evalText(r.scores[ply])}).`;
  const headers = { Event: "Puzzle from your game", White: me === "w" ? "You" : opp, Black: me === "b" ? "You" : opp, Result: "*", FEN: fens[ply], SetUp: "1" };
  const text = `{ From your game vs ${opp}, move ${moveNo(ply)}. Find the only move. } ` +
    `${prefix(ply, true)}${best} { ${why} }${reply ? ` ${prefix(ply + 1, false)}${reply}` : ""} *`;
  return Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n") + "\n\n" + text + "\n";
}
