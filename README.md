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
   - Ticker, 600 × 74, under the board: `...?user=YOURNAME&layout=vertical&show=ticker`
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
| `quality=brilliant,great,best` | Which of chess.com's tallies to show: `brilliant`, `great`, `best`, `excellent`, `good`, `book`, `inaccuracy`, `mistake`, `miss`, `blunder`. |
| `depth=18` | Engine depth per position. 18 takes about 10 seconds a game on a recent Mac; lower is quicker. |
| `engine=off` | Skip the engine review. |
| `tc=rapid` | Time control to track. The default follows your latest game. |
| `reset` | Start a new session now. Otherwise a session ends after 6 hours without games. |
| `since=2` | Count the last 2 hours as this session, if you added the overlay late. |
| `layout=vertical` | Big, phone-readable panels: `ticker` (rating, score, streak) and `card`, which rotates between your rating, the last game and the session, and shows each finished game for 12 seconds. |
| `font=classic` | Display font. The default is `bricolage`; others are `classic` (the original serif), `fraunces`, `outfit`, `nunito` and `grotesk`. |
| `demo` | Made-up numbers, for arranging your scene before you play. Add `moment` to see the post-game card. |

## Session → Lichess study

**https://whirlsofblue.github.io/piece-of-mind-overlay/study.html**

Log in with Lichess, enter your chess.com username and how far back to look, and it builds a
Lichess study of the session: every game analysed with Stockfish and annotated with ?! ? ??
(Lichess's thresholds), the engine's better line as a variation, chess.com's clock times, and
a note where each game left the moves 2000+ players usually choose (from the Lichess opening
explorer). When it was you who left that path, a one-move quiz chapter is added at the end.
Quizzes also go into one private, growing study, "My openings · Piece of Mind" (then "… 2"
when it reaches Lichess's 64-chapter limit). Positions already there aren't added again.
The Lichess login stays in your browser and can be revoked at lichess.org/account/oauth/token.

## Notes

- Session stats come from chess.com's public game data and update within about 20 seconds of a game ending.
- chess.com's post-game box shows three move categories. It picks which ones (Great, Best and Excellent
  after a win, for example), so the tally only counts what was shown for each game.
- The engine review matches Lichess's own judgements exactly when given the same evaluations
  (checked move by move against Lichess-analysed games). Counts can still differ a little from
  Lichess's because the engine and depth differ.
- Everything is read and analysed after games end. Nothing runs on a game in progress.
- Stockfish is GPL v3; see `vendor/stockfish/`.
