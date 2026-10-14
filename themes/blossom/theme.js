// Blossom theme: each panel gets a pearl frame with a rose-gold sheen and a fine gold inner line,
// and blossoming vines (leaves, white and pink flowers, buds) over two of its corners, with a few
// twinkling sparkles. The marble knight stands on the rating panel inside a gold ring.

import { rng, closed, octagon, vine, place } from "../lib/organic.js";

const KNIGHT = new URL("./knight.webp", import.meta.url).href;
const GOLD = "#c99a45";

// Four-pointed sparkle centred on (x, y).
const sparkle = (x, y, r, cls) =>
  `<path class="twinkle ${cls}" d="M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z" fill="#fff6d8"/>`;

// A vine dressed with leaves, blossoms and buds.
function bloomingVine(route, rand, length) {
  const { d, samples } = vine(route, rand, length, 13);
  if (!d) return "";
  const dress = samples.slice(1, -1).map(([x, y, a], i) => {
    const deg = (a * 180) / Math.PI, side = i % 2 ? 1 : -1;
    if (i % 5 === 2) return place(rand() < 0.5 ? "bl-flower-white" : "bl-flower-pink", x, y, rand() * 72, 0.75 + rand() * 0.5);
    if (i % 5 === 4) return place("bl-bud", x, y, deg + side * 55, 0.8 + rand() * 0.4);
    return place("bl-leaf", x, y, deg + side * (40 + rand() * 30), 0.6 + rand() * 0.5);
  }).join("");
  return `<path d="${d}" stroke="#7a5236" stroke-width="3.6" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="${d}" stroke="#c4935e" stroke-width="1.6" fill="none" stroke-linecap="round"/>${dress}`;
}

const petals = (fill) => [0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-5.6" rx="3.9" ry="5.6" transform="rotate(${r})" fill="${fill}" stroke="#e7a9b9" stroke-width="0.4"/>`).join("");

const DEFS = `<defs>
  <linearGradient id="bl-pearl" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fffaf4"/><stop offset="0.35" stop-color="#f6d9e2"/><stop offset="0.55" stop-color="#fff3df"/>
    <stop offset="0.75" stop-color="#ead8f0"/><stop offset="1" stop-color="#fbe3d0"/>
  </linearGradient>
  <radialGradient id="bl-white" cx="0.5" cy="0.9" r="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#fbe5ec"/></radialGradient>
  <radialGradient id="bl-pink" cx="0.5" cy="0.9" r="1"><stop offset="0" stop-color="#fbd6e0"/><stop offset="1" stop-color="#f19cb5"/></radialGradient>
  <linearGradient id="bl-leaf-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f8f3e"/><stop offset="1" stop-color="#b8d97a"/></linearGradient>
  <g id="bl-leaf"><path d="M0,0 C4,-6 12,-6 17,0 C12,6 4,6 0,0 Z" fill="url(#bl-leaf-fill)" stroke="#47702c" stroke-width="0.5"/><path d="M1,0 L15,0" stroke="#47702c" stroke-width="0.5" opacity="0.6"/></g>
  <g id="bl-flower-white">${petals("url(#bl-white)")}<circle r="2.2" fill="#f2c45a"/><circle r="1" fill="#d9952e"/></g>
  <g id="bl-flower-pink">${petals("url(#bl-pink)")}<circle r="2.2" fill="#f6d36e"/><circle r="1" fill="#d9952e"/></g>
  <g id="bl-bud"><path d="M0,0 C3,-3 8,-3 9,0 C8,3 3,3 0,0 Z" fill="#f3a8bd" stroke="#d47f99" stroke-width="0.5"/><path d="M0,0 L-4,0" stroke="#6f9a46" stroke-width="1.2"/></g>
</defs>`;

function frame(w, h, c, seed) {
  const rand = rng(seed);
  const outer = octagon(w, h, c), inner = octagon(w, h, c, 8);
  const tl = bloomingVine([[c * 0.4, h * 0.6], [0, c + 4], [c, 0], [w * 0.38, -1]], rand, Math.min(w * 0.42 + h * 0.55, 420));
  const br = bloomingVine([[w - c * 0.4, h * 0.3], [w, h - c - 4], [w - c, h], [w * 0.64, h + 1]], rand, Math.min(w * 0.32 + h * 0.5, 340));
  return `<svg class="blossom-frame" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${DEFS}
    <path d="${closed(outer)}" fill="none" stroke="#9c6f74" stroke-opacity="0.35" stroke-width="7.5"/>
    <path d="${closed(outer)}" fill="none" stroke="url(#bl-pearl)" stroke-width="5.5"/>
    <path d="${closed(outer)}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1" transform="translate(-0.8,-0.8)"/>
    <path d="${closed(inner)}" fill="none" stroke="${GOLD}" stroke-opacity="0.7" stroke-width="1"/>
    <path d="M${(w / 2 - 6).toFixed(1)},-1 l6,-7 l6,7 l-6,7 Z" fill="${GOLD}" stroke="#8a6526" stroke-width="0.6"/>
    ${tl}${br}
    ${sparkle(Math.round(w * 0.3), 2, 5, "")}${sparkle(w - 4, Math.round(h * 0.55), 4, "late")}
  </svg>`;
}

function emblemSvg() {
  return `<svg viewBox="0 0 230 260" width="230" height="260" aria-hidden="true">
    <circle cx="115" cy="120" r="104" fill="none" stroke="${GOLD}" stroke-opacity="0.8" stroke-width="1.4"/>
    <circle cx="115" cy="120" r="97" fill="none" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="0.8"/>
    ${sparkle(115, 14, 9, "")}${sparkle(214, 150, 7, "late")}${sparkle(30, 70, 5, "late")}
  </svg>`;
}
const petal = () => `<svg class="petal" width="16" height="12" viewBox="-8 -6 16 12" aria-hidden="true"><path d="M-7,0 C-4,-6 4,-6 7,-1 C4,5 -4,5 -7,0 Z" fill="#f5b5c6"/></svg>`;

let emblem = null;
function placeEmblem(root, vertical) {
  const anchor = !vertical && root.querySelector(".rating-card");
  if (!anchor) { emblem?.remove(); emblem = null; return; }
  if (!emblem) {
    emblem = document.createElement("div");
    emblem.className = "blossom-emblem";
    emblem.innerHTML = emblemSvg() + `<img src="${KNIGHT}" alt="">` + petal() + petal() + petal() + petal() + petal();
    document.body.append(emblem);
  }
  // Standing on the rating panel's top edge, near its right end.
  const r = anchor.getBoundingClientRect();
  emblem.style.left = `${r.right + scrollX - 232}px`;
  emblem.style.top = `${r.top + scrollY - 256}px`;
}

export function decorate(root, { vertical }) {
  [...root.querySelectorAll(".panel")].forEach((panel, i) => {
    if (panel.querySelector(":scope > .blossom-frame")) return;
    const cut = parseFloat(getComputedStyle(panel).getPropertyValue("--cut")) || 16;
    const seed = 53 + i * 151 + Math.round(panel.offsetWidth) * 11;
    panel.insertAdjacentHTML("afterbegin", frame(panel.offsetWidth, panel.offsetHeight, cut, seed));
  });
  placeEmblem(root, vertical);
}
