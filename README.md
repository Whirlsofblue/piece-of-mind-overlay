# Stream overlay

A transparent page for OBS showing your chess.com session: rating and graph, score,
average opponent, streak, openings, an engine review of every game (accuracy, inaccuracies,
mistakes and blunders, using Stockfish and Lichess's published formulas), a graph of your
last game, and chess.com's own Brilliant / Great / Best counts from its post-game summary.

It's hosted at **https://whirlsofblue.github.io/piece-of-mind-overlay/**. (It has to be loaded from a
web address rather than opened as a file, because browsers won't run the engine from a local file.)

## Set up in OBS

1. **Sources → + → Browser.** Untick *Local file* and paste this as the URL (your
   chess.com username in place of `YOURNAME`):

   ```
   https://whirlsofblue.github.io/piece-of-mind-overlay/?user=YOURNAME
   ```

   Width 680, height 1500 for every panel, or one Browser Source per panel (see `show` below).

   **Vertical streams (Shorts):** use two Browser Sources on a 1080 × 1920 canvas instead:
   - Ticker, 600 × 74 or wider (it shrinks itself to fit), under the board: `...?user=YOURNAME&layout=vertical&show=ticker`
   - Card, 440 × 256, over the camera away from your face: `...?user=YOURNAME&layout=vertical&show=card`

   Keep both clear of the right edge and the bottom fifth, where YouTube puts its buttons, title and chat. Leave the custom CSS as it is. The background is already transparent.

2. **Move-quality counts.** These need OBS's WebSocket server and the extension:
   - In OBS: **Tools → WebSocket Server Settings**, tick *Enable WebSocket server*,
     then click *Show Connect Info* and copy the password.
   - In the Piece of Mind popup: **Stream overlay**, tick *Send move counts to OBS*,
     paste the same password, then **Test connection**. The overlay says
     "Piece of Mind connected" for a moment.

   The overlay itself needs no password: OBS passes the counts to its Browser Sources.

## Options

Add these to the URL with `&`:

| Option | What it does |
|---|---|
| `show=rating,stats` | Which panels, in order: `player`, `rating`, `stats`, `review`, `lastgame`, `openings`, `quality`. Use one panel per Browser Source to lay them out freely. |
| `site=lichess` | Follow a Lichess account (`user=` is then your Lichess name). Everything works the same, except chess.com's Brilliant/Great/Best counts, which only exist on chess.com. |
| `quality=brilliant,great,best` | Which of chess.com's tallies to show: `brilliant`, `great`, `best`, `excellent`, `good`, `book`, `inaccuracy`, `mistake`, `miss`, `blunder`. |
| `depth=18` | Engine depth per position. 18 takes about 10 seconds a game on a recent Mac; lower is quicker. |
| `engine=off` | Skip the engine review. |
| `tc=rapid` | Time control to track. The default follows your latest game. |
| `reset` | Start a new session now. Otherwise a session ends after 6 hours without games. |
| `since=2` | Count the last 2 hours as this session, if you added the overlay late. |
| `layout=vertical` | Big, phone-readable panels: `ticker` (rating, score, streak) and `card`, which rotates between your rating, the last game and the session, and shows each finished game for 12 seconds. |
| `theme=holo` | The look: `classic` (default); `holo`, translucent HUD panels with glowing chamfered frames and a hologram knight; `clean`, flat readable panels in one accent colour (with `accent=` and `light`); `cafe`, cozy lo-fi parchment panels with copper frames, ivy, window-light leaf shadows and a steaming cup (light, dark ink text); `grove`, stone frames wound with vines and leaves on forest-green panels, with sun rays and a stone knight; or `blossom`, pale pearl panels with rose-gold frames, blossoming vines, sparkles, drifting petals and a marble knight (a light theme: dark text). Every theme works with both layouts. |
| `accent=ff5a5f` | Your colour, for themes that use one (clean). Any hex colour, without the #. |
| `light` | Light panels with dark text (clean). |
| `fill=60` | How solid the panels are, from 0 (clear glass) to 100 (solid), in every theme. Defaults: classic 78, clean 86, holo 66, grove 63, blossom 70, cafe 72. |
| `font=classic` | Display font. The default is `bricolage`; others are `classic` (the original serif), `fraunces`, `outfit`, `nunito` and `grotesk`. |
| `demo` | Made-up numbers, for arranging your scene before you play. Add `moment` to see the post-game card. |

## Themes

Each look is a folder in `themes/`: `theme.css` restyles the panels (colours, fonts and chart
colours are CSS variables such as `--chart-1` and `--eval-good`), and an optional `theme.js`
(declared with `--theme-script: 1` on `body.theme-<name>`) exports
`decorate(root, { vertical })`, which runs after every update to draw extras (holo draws its
frames and places the knight). The panels and data are shared, so a new theme works in every layout.
`themes/lib/organic.js` holds the vine-drawing helpers the nature themes share.

## Session → Lichess study

**https://whirlsofblue.github.io/piece-of-mind-overlay/study.html**

Log in with Lichess, enter your chess.com username and how far back to look, and it builds a
Lichess study of the session: every game analysed with Stockfish and annotated with ?! ? ??
(Lichess's thresholds), the engine's better line as a variation, chess.com's clock times, and
a note where each game left the moves 2000+ players usually choose (from the Lichess opening
explorer). When it was you who left that path, a one-move quiz chapter is added at the end.
Quizzes also go into one private, growing study, "My openings · Piece of Mind" (then "… 2"
when it reaches Lichess's 64-chapter limit). Positions already there aren't added again.

**Critical moments:** the 2–3 moves that cost each game the most get a deeper look (Lichess's
cloud evaluation when it has the position, otherwise Stockfish searching deeper) with the
engine's top three moves as variations, marked 🔑.
**Plan maps:** for up to three openings per session, from where your game left the common path,
arrows for the routes master players' pieces usually take from there ([%cal] / [%csl] shapes,
weighted towards games that side won), the usual pawn moves, and a master game playing it out.
Uses the Lichess masters database (top games of the position and its two main moves).
**Puzzles:** wherever only one move worked (clearly better than the second best, Lichess-puzzle
style) and you missed it, a one-move interactive chapter; they also collect in "My puzzles".
The Lichess login stays in your browser and can be revoked at lichess.org/account/oauth/token.

**Repertoire leaks** (same page): looks through 1–6 months of your games for opening positions
you reach often (3+ times) and score clearly below your usual in, ranked by points lost. For
each: what you've played there and how each scored, what 2000+ players play (with a Lichess
login) and the engine's view, and the move to learn. Shown on the page; with a login, also a
private study (the move to learn as the main line, your moves as variations) and quizzes in
My openings.

## Notes

- Session stats come from chess.com's public game data and update within about 20 seconds of a game ending.
- chess.com's post-game box shows three move categories. It picks which ones (Great, Best and Excellent
  after a win, for example), so the tally only counts what was shown for each game.
- The engine review matches Lichess's own judgements exactly when given the same evaluations
  (checked move by move against Lichess-analysed games). Counts can still differ a little from
  Lichess's because the engine and depth differ.
- Everything is read and analysed after games end. Nothing runs on a game in progress.
- Stockfish is GPL v3; see `vendor/stockfish/`.
