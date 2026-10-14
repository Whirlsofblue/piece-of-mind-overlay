// Plan maps: where strong players put their pieces after a position, drawn on the board.
//
// Takes the master games (Lichess masters database) that reached a position, follows every
// piece for the next 15 moves a side, and counts the routes, weighting games the side won.
// The result is a study chapter: arrows for the common piece routes ([%cal]), the squares
// they head for ([%csl]), a summary, and one master game showing the plan in action.

import { Chess } from "./vendor/chess.js";

const MASTERS = "https://explorer.lichess.org/masters";
const HORIZON = 30; // plies to follow after the position (15 moves a side)
const NAMES = { n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King", p: "Pawn" };
const fenKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
const cache = new Map();

async function get(token, url, json = true) {
  if (cache.has(url)) return cache.get(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 61000)); continue; }
    if (!r.ok) throw new Error(`masters ${r.status}`);
    const data = json ? await r.json() : await r.text();
    cache.set(url, data);
    return data;
  }
  throw new Error("masters database busy");
}

const masters = (token, moves) => get(token, `${MASTERS}?${new URLSearchParams({ play: moves.join(","), moves: "3", topGames: "15" })}`);

// Master games through a position: its top games plus those of its two most played moves.
async function gamesThrough(token, moves) {
  const here = await masters(token, moves);
  const ids = new Map(here.topGames.map((g) => [g.id, g]));
  for (const m of here.moves.slice(0, 2)) {
    for (const g of (await masters(token, [...moves, m.uci])).topGames) ids.set(g.id, g);
  }
  return { total: here.white + here.draws + here.black, games: [...ids.values()].slice(0, 24) };
}

// Follows every piece from the position (`key`) through a master game. Returns
// { routes: { "w n b1": ["d2", "f1", "g3"] }, moves: [SAN...], winner } or null.
function follow(pgn, key) {
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const board = new Chess();
  let start = -1;
  if (fenKey(board.fen()) === key) start = 0;
  for (let i = 0; i < history.length && start < 0; i++) {
    board.move(history[i].san);
    if (fenKey(board.fen()) === key) start = i + 1;
  }
  if (start < 0) return null;
  // Name each piece by colour, type and the square it stood on at the position.
  const idAt = {};
  for (const row of board.board()) for (const p of row) if (p) idAt[p.square] = `${p.color} ${p.type} ${p.square}`;
  const routes = {};
  const step = (from, to) => {
    const id = idAt[from];
    if (!id) return;
    delete idAt[from];
    idAt[to] = id;
    (routes[id] ||= []).push(to);
  };
  const sans = [];
  for (const m of history.slice(start, start + HORIZON)) {
    sans.push(m.san);
    if (m.flags.includes("e")) delete idAt[m.to[0] + m.from[1]]; // the pawn taken en passant
    else delete idAt[m.to];
    step(m.from, m.to);
    if (m.flags.includes("k")) step(m.color === "w" ? "h1" : "h8", m.color === "w" ? "f1" : "f8");
    if (m.flags.includes("q")) step(m.color === "w" ? "a1" : "a8", m.color === "w" ? "d1" : "d8");
  }
  const result = game.getHeaders().Result;
  return { routes, sans, winner: result === "1-0" ? "w" : result === "0-1" ? "b" : null, headers: game.getHeaders() };
}

// Weighted share of games in which each piece took each route (and each shorter start of
// it); keeps the longest route at least `min` of the weight agrees on.
function commonRoutes(followed, colour, min = 0.3) {
  const weight = (f) => (f.winner === colour ? 1 : f.winner ? 0.25 : 0.5);
  const total = followed.reduce((a, f) => a + weight(f), 0);
  const counts = {}; // "w n b1" -> { "d2-f1": w }
  for (const f of followed) {
    for (const [id, path] of Object.entries(f.routes)) {
      if (!id.startsWith(colour)) continue;
      const [, type, from] = id.split(" ");
      let squares = path.filter((sq, i) => sq !== path[i - 1]);
      if (type === "k") squares = squares.slice(0, 1); // castling (or the king's first step) is the plan
      // A rook's hop when castling isn't a plan of its own; its moves after that are.
      if (type === "r" && ({ h1: "f1", a1: "d1", h8: "f8", a8: "d8" })[from] === squares[0]) squares = squares.slice(1);
      squares = squares.slice(0, 3);
      for (let n = 1; n <= squares.length; n++) {
        const k = squares.slice(0, n).join("-");
        (counts[id] ||= {})[k] = (counts[id][k] || 0) + weight(f);
      }
    }
  }
  const out = [];
  for (const [id, routes] of Object.entries(counts)) {
    const best = Object.entries(routes).filter(([, w]) => w / total >= min)
      .sort((a, b) => b[0].split("-").length - a[0].split("-").length || b[1] - a[1])[0];
    if (best) {
      const [, type, origin] = id.split(" ");
      const castled = { h1: "f1", a1: "d1", h8: "f8", a8: "d8" }[origin];
      const to = best[0].split("-");
      // A rook that castled starts its route from its castled square.
      const from = type === "r" && castled ? castledFrom(followed, id, castled, origin) : origin;
      out.push({ type, from, to, share: best[1] / total });
    }
  }
  return out.sort((a, b) => b.share - a.share);
}

// Where a rook's own route begins: its castled square if it castled in most games.
function castledFrom(followed, id, castled, origin) {
  const hopped = followed.filter((f) => f.routes[id]?.[0] === castled).length;
  return hopped * 2 >= followed.length ? castled : origin;
}

const pct = (x) => `${Math.round(x * 100)}%`;
function describe(r) {
  const castles = r.type === "k" && r.from[0] === "e" && ["g", "c"].includes(r.to[0][0]) && r.to[0][1] === r.from[1];
  if (castles) return `castles ${r.to[0][0] === "g" ? "short" : "long"} (${pct(r.share)})`;
  return `${NAMES[r.type].toLowerCase()} ${[r.from, ...r.to].join("–")} (${pct(r.share)})`;
}
const arrows = (r, colour) => [r.from, ...r.to].slice(0, -1).map((sq, i) => `${colour}${sq}${[r.from, ...r.to][i + 1]}`);

// A plan-map chapter for the position after `moves` (UCI from the start), for the player of
// `me`. Steps back a couple of moves at a time if too few master games got this far.
export async function planMap(token, moves, me, label) {
  let at = moves.length, found = null;
  while (at >= 6) {
    found = await gamesThrough(token, moves.slice(0, at));
    if (found.games.length >= 8) break;
    at -= 2;
  }
  if (!found || found.games.length < 8) return null;
  const pgns = [];
  for (const g of found.games) {
    try { pgns.push(await get(token, `${MASTERS}/pgn/${g.id}`, false)); } catch {}
  }
  return planFromPgns(pgns, moves.slice(0, at), me, label, found.total);
}

// The plan map itself, from the PGNs of games that pass through the position after `moves`.
export function planFromPgns(pgns, moves, me, label, total = pgns.length) {
  const pos = new Chess();
  for (const u of moves) pos.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const key = fenKey(pos.fen());
  const followed = [];
  for (const pgn of pgns) {
    try { const f = follow(pgn, key); if (f) followed.push(f); } catch {}
  }
  if (followed.length < 6) return null;

  const them = me === "w" ? "b" : "w";
  const mine = commonRoutes(followed, me), theirs = commonRoutes(followed, them);
  const pieces = (list) => list.filter((r) => r.type !== "p" && r.type !== "k").slice(0, 4);
  const pawns = (list) => list.filter((r) => r.type === "p").slice(0, 2);
  const castle = (list) => list.filter((r) => describe(r).startsWith("castles")).slice(0, 1);
  const myPlan = [...castle(mine), ...pieces(mine), ...pawns(mine)];
  const theirPlan = [...castle(theirs), ...pieces(theirs).slice(0, 2), ...pawns(theirs).slice(0, 1)];
  if (!myPlan.length) return null;

  const shapes = [
    ...pieces(mine).flatMap((r) => arrows(r, "G")), ...pawns(mine).flatMap((r) => arrows(r, "Y")),
    ...pieces(theirs).slice(0, 2).flatMap((r) => arrows(r, "R")),
  ];
  const marks = [...new Set(pieces(mine).map((r) => `G${r.to.at(-1)}`))];

  // The plan in action: the best-rated master game the player's side won.
  const wins = followed.filter((f) => f.winner === me);
  const rating = (f) => (Number(f.headers.WhiteElo) || 0) + (Number(f.headers.BlackElo) || 0);
  const shown = (wins.length ? wins : followed).sort((a, b) => rating(b) - rating(a))[0];
  const h = shown.headers;
  const who = `${h.White?.split(",")[0]}–${h.Black?.split(",")[0]}, ${(h.Date || "").slice(0, 4)} (${h.Result})`;

  const side = (c) => (c === "w" ? "White" : "Black");
  const intro = `Plan map from ${followed.length} master games that reached this position (${total.toLocaleString("en")} in the database). ` +
    `${side(me)} usually: ${myPlan.map(describe).join(", ")}. ` +
    (theirPlan.length ? `${side(them)} usually: ${theirPlan.map(describe).join(", ")}. ` : "") +
    `Green and yellow arrows: ${side(me)}'s routes and pawn moves; red: ${side(them)}'s. ` +
    `Percentages are of games, weighted towards wins. Then: ${who}, the plan in action.`;

  const fen = pos.fen();
  const startPly = (Number(fen.split(" ")[5]) - 1) * 2 + (fen.split(" ")[1] === "b" ? 1 : 0);
  const num = (ply, force) => (ply % 2 === 0 ? `${Math.floor(ply / 2) + 1}. ` : force ? `${Math.floor(ply / 2) + 1}... ` : "");
  const line = shown.sans.slice(0, 24).map((s, k) => `${num(startPly + k, k === 0)}${s}`).join(" ");
  const headers = { Event: `Plan map: ${label}`, White: h.White || "?", Black: h.Black || "?", Result: "*", FEN: fen, SetUp: "1", Annotator: "Piece of Mind (Lichess masters database)" };
  const pgn = Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n") + "\n\n" +
    `{ [%cal ${shapes.join(",")}]${marks.length ? ` [%csl ${marks.join(",")}]` : ""} ${intro.replace(/[{}]/g, "")} } ${line} *\n`;
  return { pgn, games: followed.length, plan: myPlan.map(describe) };
}
