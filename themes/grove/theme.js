// Grove theme: each panel gets a stone frame (textured with SVG turbulence) with a fine gold inner
// line, and vines with leaves winding over two of its corners. The stone knight stands on the
// rating panel inside a gold ring, with a few leaves drifting down.

import { rng, closed, octagon, vine, place } from "../lib/organic.js";

const KNIGHT = new URL("./knight.webp", import.meta.url).href;
const GOLD = "#e7c26a";

// A vine (themes/lib/organic.js) dressed with leaves on alternating sides.
function leafyVine(route, rand, length) {
  const { d, samples } = vine(route, rand, length);
  if (!d) return "";
  const leaves = samples.filter((_, i) => i % 2 === 1 && i < samples.length - 1).map(([x, y, a], i) => {
    const side = i % 2 ? 1 : -1;
    return place("grove-leaf", x, y, (a * 180) / Math.PI + side * (40 + rand() * 30), 0.65 + rand() * 0.55);
  }).join("");
  return `<path d="${d}" stroke="#3a2412" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="${d}" stroke="url(#grove-wood)" stroke-width="3.2" fill="none" stroke-linecap="round"/>${leaves}`;
}

function frame(w, h, c, seed) {
  const rand = rng(seed);
  const outer = octagon(w, h, c), inner = octagon(w, h, c, 9);
  // Vines over the top-left and bottom-right corners, like the mockup.
  const tl = leafyVine([[c * 0.4, h * 0.55], [0, c + 4], [c, 0], [w * 0.4, -1]], rand, Math.min(w * 0.45 + h * 0.5, 420));
  const br = leafyVine([[w - c * 0.4, h * 0.3], [w, h - c - 4], [w - c, h], [w * 0.62, h + 1]], rand, Math.min(w * 0.35 + h * 0.5, 360));
  return `<svg class="grove-frame" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs>
      <filter id="grove-stone" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09 0.35" numOctaves="3" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.80  0 0 0 0 0.68  0 0 0 -0.9 1.15" result="tint"/>
        <feComposite in="tint" in2="SourceAlpha" operator="in" result="stone"/>
        <feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#fff4dc" result="lit"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>
        <feComposite in="lit" in2="stone" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="shaded"/>
        <feComposite in="shaded" in2="SourceAlpha" operator="in"/>
      </filter>
      <linearGradient id="grove-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a6a3c"/><stop offset="0.5" stop-color="#6b4424"/><stop offset="1" stop-color="#a87444"/></linearGradient>
      <linearGradient id="grove-leaf-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4f8a2c"/><stop offset="1" stop-color="#c6e56a"/></linearGradient>
      <g id="grove-leaf"><path d="M0,0 C4,-6 12,-6 17,0 C12,6 4,6 0,0 Z" fill="url(#grove-leaf-fill)" stroke="#2f5a1c" stroke-width="0.6"/><path d="M1,0 L15,0" stroke="#2f5a1c" stroke-width="0.6" opacity="0.6"/></g>
    </defs>
    <path d="${closed(outer)}" fill="none" stroke="#1b140c" stroke-opacity="0.55" stroke-width="9"/>
    <path d="${closed(outer)}" fill="none" stroke="#000" stroke-width="7" filter="url(#grove-stone)"/>
    <path d="${closed(outer)}" fill="none" stroke="#fff4d6" stroke-opacity="0.35" stroke-width="1" transform="translate(-1,-1)"/>
    <path d="${closed(inner)}" fill="none" stroke="${GOLD}" stroke-opacity="0.75" stroke-width="1"/>
    <path d="M${(w / 2 - 6).toFixed(1)},-1 l6,-7 l6,7 l-6,7 Z" fill="${GOLD}" stroke="#7a5a1c" stroke-width="0.8"/>
    ${tl}${br}
  </svg>`;
}

function emblemSvg() {
  return `<svg viewBox="0 0 230 260" width="230" height="260" aria-hidden="true">
    <circle cx="115" cy="120" r="104" fill="none" stroke="${GOLD}" stroke-opacity="0.75" stroke-width="1.6"/>
    <circle cx="115" cy="120" r="96" fill="none" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="1"/>
    <g class="orb"><circle cx="219" cy="120" r="5" fill="#f6dc8e"/><circle cx="219" cy="120" r="9" fill="#f6dc8e" opacity="0.3"/></g>
    <path d="M115,10 l5,-8 l5,8 l-5,8 Z" fill="${GOLD}"/>
  </svg>`;
}
const fallingLeaf = () => `<svg class="fall" width="18" height="12" viewBox="-1 -7 19 14" aria-hidden="true"><path d="M0,0 C4,-6 12,-6 17,0 C12,6 4,6 0,0 Z" fill="#d9e07a"/></svg>`;

let emblem = null;
function placeEmblem(root, vertical) {
  const anchor = !vertical && root.querySelector(".rating-card");
  if (!anchor) { emblem?.remove(); emblem = null; return; }
  if (!emblem) {
    emblem = document.createElement("div");
    emblem.className = "grove-emblem";
    emblem.innerHTML = emblemSvg() + `<img src="${KNIGHT}" alt="">` + fallingLeaf() + fallingLeaf() + fallingLeaf();
    document.body.append(emblem);
  }
  // Standing on the rating panel's top edge, near its right end.
  const r = anchor.getBoundingClientRect();
  emblem.style.left = `${r.right + scrollX - 232}px`;
  emblem.style.top = `${r.top + scrollY - 254}px`;
}

export function decorate(root, { vertical }) {
  [...root.querySelectorAll(".panel")].forEach((panel, i) => {
    if (panel.querySelector(":scope > .grove-frame")) return;
    const cut = parseFloat(getComputedStyle(panel).getPropertyValue("--cut")) || 18;
    const seed = 97 + i * 131 + Math.round(panel.offsetWidth) * 7;
    panel.insertAdjacentHTML("afterbegin", frame(panel.offsetWidth, panel.offsetHeight, cut, seed));
  });
  placeEmblem(root, vertical);
}
