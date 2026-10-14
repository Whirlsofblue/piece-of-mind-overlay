// Holo theme: draws each panel's frame (chamfered double outline, gold corner accents, glowing
// nodes, a light sweeping along the edge) and keeps the hologram knight beside the rating panel.

const KNIGHT = new URL("./knight.webp", import.meta.url).href;
const BLUE = "#7cc4ff", GOLD = "#f0bf62";

const path = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L")} Z`;
const line = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L")}`;

function frame(w, h, c) {
  const outer = [[c, 0], [w, 0], [w, h - c], [w - c, h], [0, h], [0, c]];
  const i = 5, ic = c - 1;
  const inner = [[i + ic, i], [w - i, i], [w - i, h - i - ic], [w - i - ic, h - i], [i, h - i], [i, i + ic]];
  const arm = Math.min(34, w / 6);
  const goldTL = [[0, c + arm], [0, c], [c, 0], [c + arm, 0]];
  const goldBR = [[w, h - c - arm], [w, h - c], [w - c, h], [w - c - arm, h]];
  const tab = Math.round(w * 0.58);
  return `<svg class="holo-frame" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs><filter id="holo-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#holo-glow)" fill="none">
      <path d="${path(outer)}" stroke="${BLUE}" stroke-opacity="0.75" stroke-width="1.4"/>
      <path d="${path(inner)}" stroke="${BLUE}" stroke-opacity="0.28" stroke-width="1"/>
      <path class="sweep" d="${path(outer)}" stroke="#d8eeff" stroke-width="2"/>
      <path d="${line(goldTL)}" stroke="${GOLD}" stroke-width="2.4"/>
      <path d="${line(goldBR)}" stroke="${GOLD}" stroke-width="2.4"/>
      <path d="M${tab},-4 h${Math.min(70, w / 5)} l6,4" stroke="${BLUE}" stroke-opacity="0.6" stroke-width="1.2"/>
    </g>
    <g filter="url(#holo-glow)">
      <circle class="pulse" cx="${c + arm}" cy="0" r="2.6" fill="${GOLD}"/>
      <circle class="pulse late" cx="${w - c - arm}" cy="${h}" r="2.6" fill="${GOLD}"/>
      <circle class="pulse late" cx="${tab}" cy="-4" r="2" fill="${BLUE}"/>
    </g>
  </svg>`;
}

// Rings, ticks and arcs around the knight; two groups turn slowly in opposite directions.
function rings() {
  const ticks = Array.from({ length: 48 }, (_, k) => {
    const a = (k / 48) * Math.PI * 2, r1 = 92, r2 = k % 4 ? 95 : 99;
    return `M${(100 + r1 * Math.cos(a)).toFixed(1)},${(104 + r1 * Math.sin(a)).toFixed(1)} L${(100 + r2 * Math.cos(a)).toFixed(1)},${(104 + r2 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return `<svg viewBox="0 0 200 236" width="250" height="295" aria-hidden="true">
    <g fill="none" filter="url(#holo-glow)">
      <circle cx="100" cy="104" r="86" stroke="${BLUE}" stroke-opacity="0.35" stroke-width="1"/>
      <g class="spin"><path d="${ticks}" stroke="${BLUE}" stroke-opacity="0.5" stroke-width="1"/>
        <path d="M100,6 A98,98 0 0 1 186,58" stroke="${GOLD}" stroke-width="2"/></g>
      <g class="spin back"><circle cx="100" cy="104" r="76" stroke="${BLUE}" stroke-opacity="0.3" stroke-dasharray="3 7"/>
        <path d="M30,160 A86,86 0 0 1 16,110" stroke="${GOLD}" stroke-opacity="0.8" stroke-width="1.6"/></g>
    </g>
  </svg>`;
}

let emblem = null;
function placeEmblem(root, vertical) {
  const anchor = !vertical && root.querySelector(".rating-card");
  if (!anchor) { emblem?.remove(); emblem = null; return; }
  if (!emblem) {
    emblem = document.createElement("div");
    emblem.className = "holo-emblem";
    emblem.innerHTML = rings() + `<img src="${KNIGHT}" alt="">`;
    document.body.append(emblem);
  }
  const r = anchor.getBoundingClientRect();
  // Over the top-right corner of the rating panel, standing above it like in the mockup.
  emblem.style.left = `${r.right + scrollX - 215}px`;
  emblem.style.top = `${r.top + scrollY - 118}px`;
}

export function decorate(root, { vertical }) {
  for (const panel of root.querySelectorAll(".panel")) {
    if (panel.querySelector(":scope > .holo-frame")) continue;
    const cut = parseFloat(getComputedStyle(panel).getPropertyValue("--cut")) || 16;
    panel.insertAdjacentHTML("afterbegin", frame(panel.offsetWidth, panel.offsetHeight, cut));
  }
  placeEmblem(root, vertical);
}
