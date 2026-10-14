// Shared drawing helpers for the nature themes (grove, blossom): seeded randomness and vines
// that wind along a frame, for the theme to dress with leaves, flowers and so on.

// Small deterministic random numbers, so a panel's vines don't jump around on every update.
export function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const fmt = (v) => v.toFixed(1);
export const closed = (list) => `M${list.map((p) => p.map(fmt).join(",")).join(" L")} Z`;

// A chamfered (octagonal) outline, `inset` px inside a w × h box with corners cut by `c`.
export function octagon(w, h, c, inset = 0) {
  const k = inset, kc = Math.max(0, c - inset / 3);
  return [[k + kc, k], [w - k - kc, k], [w - k, k + kc], [w - k, h - k - kc], [w - k - kc, h - k], [k + kc, h - k], [k, h - k - kc], [k, k + kc]];
}

// A smooth curve through points (Catmull-Rom as cubic Béziers).
export function smooth(p) {
  let d = `M${fmt(p[0][0])},${fmt(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += ` C${fmt(b[0] + (c[0] - a[0]) / 6)},${fmt(b[1] + (c[1] - a[1]) / 6)} ${fmt(c[0] - (e[0] - b[0]) / 6)},${fmt(c[1] - (e[1] - b[1]) / 6)} ${fmt(c[0])},${fmt(c[1])}`;
  }
  return d;
}

// A vine following a polyline for up to `length` px, wobbling across it. Returns its path and
// the points along it ([x, y, direction in radians]) for placing leaves and flowers.
export function vine(route, rand, length, step = 14) {
  const samples = [];
  let walked = 0;
  for (let i = 0; i < route.length - 1 && walked < length; i++) {
    const [x1, y1] = route[i], [x2, y2] = route[i + 1];
    const seg = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / seg, ny = (x2 - x1) / seg;
    for (let t = 0; t < seg && walked < length; t += step, walked += step) {
      const w = Math.sin(walked / 22) * 5 + (rand() - 0.5) * 2;
      samples.push([x1 + ((x2 - x1) * t) / seg + nx * w, y1 + ((y2 - y1) * t) / seg + ny * w, Math.atan2(y2 - y1, x2 - x1)]);
    }
  }
  return { d: samples.length >= 3 ? smooth(samples.map(([x, y]) => [x, y])) : "", samples };
}

// Places a symbol (by id) at a point, turned and scaled.
export const place = (id, x, y, angle, scale) =>
  `<use href="#${id}" transform="translate(${fmt(x)},${fmt(y)}) rotate(${angle.toFixed(0)}) scale(${scale.toFixed(2)})"/>`;
