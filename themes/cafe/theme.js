// Café theme: each panel gets a copper frame with riveted brackets on all four corners, a fine
// inner line, and ivy with little white flowers over two corners. The cup stands on the rating
// panel inside a copper ring wound with ivy, with steam rising from it.

import { rng, closed, octagon, vine, place } from "../lib/organic.js";

const CUP = new URL("./cup.webp", import.meta.url).href;

const DEFS = `<defs>
  <linearGradient id="cafe-copper" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#e3a46b"/><stop offset="0.35" stop-color="#a9622f"/><stop offset="0.6" stop-color="#d48e55"/><stop offset="1" stop-color="#7d4520"/>
  </linearGradient>
  <linearGradient id="cafe-plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0bb88"/><stop offset="1" stop-color="#8f5126"/></linearGradient>
  <radialGradient id="cafe-rivet" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffe2c2"/><stop offset="1" stop-color="#6e3a17"/></radialGradient>
  <linearGradient id="cafe-ivy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f6a2a"/><stop offset="1" stop-color="#7fb24a"/></linearGradient>
  <g id="cafe-leaf"><path d="M0,0 C3,-7 12,-8 16,-1 C12,6 4,6 0,0 Z" fill="url(#cafe-ivy)" stroke="#24501f" stroke-width="0.6"/><path d="M1,0 L14,-1" stroke="#24501f" stroke-width="0.5" opacity="0.6"/></g>
  <g id="cafe-flower">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-3.6" rx="2.4" ry="3.6" transform="rotate(${r})" fill="#fffaf0" stroke="#e6d9c2" stroke-width="0.4"/>`).join("")}<circle r="1.4" fill="#f0c04a"/></g>
  <filter id="cafe-steam-blur" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>`;

// A riveted copper bracket over one corner. Drawn for the top-left; mirrored for the others.
function bracket(c, transform) {
  const a = c + 22;
  const plate = [[0, a], [0, c], [c, 0], [a, 0], [a, 7], [c + 3, 7], [7, c + 3], [7, a]];
  return `<g transform="${transform}">
    <path d="${closed(plate)}" fill="url(#cafe-plate)" stroke="#5e3214" stroke-width="0.8"/>
    <circle cx="${c + 15}" cy="3.6" r="2" fill="url(#cafe-rivet)"/><circle cx="3.6" cy="${c + 15}" r="2" fill="url(#cafe-rivet)"/>
  </g>`;
}

function ivy(route, rand, length) {
  const { d, samples } = vine(route, rand, length, 13);
  if (!d) return "";
  const dress = samples.slice(1, -1).map(([x, y, a], i) => {
    const side = i % 2 ? 1 : -1;
    if (i % 6 === 3) return place("cafe-flower", x, y, rand() * 72, 0.9 + rand() * 0.4);
    return place("cafe-leaf", x, y, (a * 180) / Math.PI + side * (45 + rand() * 30), 0.7 + rand() * 0.5);
  }).join("");
  return `<path d="${d}" stroke="#4a3a1e" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.85"/>${dress}`;
}

function frame(w, h, c, seed) {
  const rand = rng(seed);
  const outer = octagon(w, h, c), inner = octagon(w, h, c, 7);
  const tl = ivy([[c * 0.4, h * 0.5], [0, c + 4], [c, 0], [w * 0.3, -1]], rand, Math.min(w * 0.3 + h * 0.45, 300));
  const br = ivy([[w - c * 0.4, h * 0.35], [w, h - c - 4], [w - c, h], [w * 0.75, h + 1]], rand, Math.min(w * 0.22 + h * 0.4, 240));
  return `<svg class="cafe-frame" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${DEFS}
    <path d="${closed(outer)}" fill="none" stroke="#4a260e" stroke-opacity="0.55" stroke-width="7.5"/>
    <path d="${closed(outer)}" fill="none" stroke="url(#cafe-copper)" stroke-width="5"/>
    <path d="${closed(outer)}" fill="none" stroke="#ffd9b0" stroke-opacity="0.55" stroke-width="0.8" transform="translate(-0.7,-0.7)"/>
    <path d="${closed(inner)}" fill="none" stroke="#6b3f1e" stroke-opacity="0.45" stroke-width="1"/>
    ${bracket(c, "")}${bracket(c, `translate(${w},0) scale(-1,1)`)}${bracket(c, `translate(0,${h}) scale(1,-1)`)}${bracket(c, `translate(${w},${h}) scale(-1,-1)`)}
    ${tl}${br}
  </svg>`;
}

function emblemSvg() {
  const rand = rng(4242);
  // Ivy climbing the ring's left side.
  const arc = Array.from({ length: 9 }, (_, k) => {
    const t = Math.PI * (0.55 + k * 0.1);
    return [120 + 104 * Math.cos(t), 118 + 104 * Math.sin(t)];
  }).reverse();
  return `<svg viewBox="0 0 240 240" width="240" height="240" aria-hidden="true">${DEFS}
    <circle cx="120" cy="118" r="104" fill="none" stroke="#4a260e" stroke-opacity="0.5" stroke-width="5"/>
    <circle cx="120" cy="118" r="104" fill="none" stroke="url(#cafe-copper)" stroke-width="3.2"/>
    <circle cx="120" cy="118" r="96" fill="none" stroke="#a9622f" stroke-opacity="0.45" stroke-width="1"/>
    ${ivy(arc, rand, 260)}
    <g class="steam">
      <path d="M104,100 C84,84 122,74 102,56 C86,42 118,34 100,14" stroke-width="9"/>
      <path d="M124,98 C146,82 106,70 128,52 C144,38 112,28 132,8" stroke-width="10"/>
      <path d="M142,100 C126,86 156,76 142,60 C132,48 152,40 144,24" stroke-width="7"/>
    </g>
  </svg>`;
}

let emblem = null;
function placeEmblem(root, vertical) {
  const anchor = !vertical && root.querySelector(".rating-card");
  if (!anchor) { emblem?.remove(); emblem = null; return; }
  if (!emblem) {
    emblem = document.createElement("div");
    emblem.className = "cafe-emblem";
    emblem.innerHTML = emblemSvg() + `<img src="${CUP}" alt="">`;
    document.body.append(emblem);
  }
  // The ring overlaps the rating panel's top-right corner; the cup sits on the panel's edge.
  const r = anchor.getBoundingClientRect();
  emblem.style.left = `${r.right + scrollX - 236}px`;
  emblem.style.top = `${r.top + scrollY - 196}px`;
}

export function decorate(root, { vertical }) {
  [...root.querySelectorAll(".panel")].forEach((panel, i) => {
    if (panel.querySelector(":scope > .cafe-frame")) return;
    const cut = parseFloat(getComputedStyle(panel).getPropertyValue("--cut")) || 14;
    const seed = 71 + i * 113 + Math.round(panel.offsetWidth) * 5;
    panel.insertAdjacentHTML("afterbegin", frame(panel.offsetWidth, panel.offsetHeight, cut, seed));
  });
  placeEmblem(root, vertical);
}
