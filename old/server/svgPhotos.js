// Generates illustrative SVG "photos" used only for seed/demo data.
// Real photos are uploaded by merchandisers and stored in the photos table.

const PALETTES = [
  ["#E27BA6", "#F2C14E", "#C9527E"],
  ["#F4A259", "#E76F51", "#BC4B51"],
  ["#B486C9", "#F7D6E0", "#8E5AA8"],
  ["#E8556D", "#F9E0A8", "#B23A55"],
];

function flower(cx, cy, r, petal, centre, droop = 0) {
  let out = "";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r + (droop ? Math.abs(Math.sin(a)) * droop : 0);
    out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.72).toFixed(1)}" ry="${(r * 0.5).toFixed(1)}" fill="${petal}" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy + droop * 0.4}" r="${(r * 0.5).toFixed(1)}" fill="${centre}"/>`;
}

export function seedPhotoSVG(kind, seed) {
  const pal = PALETTES[seed % PALETTES.length];
  const wilt = kind === "waste";
  const bg = wilt ? "#E8E4DA" : "#EEF3EA";
  const stem = wilt ? "#8A8A5A" : "#3E7C57";
  const rng = (n) => {
    const x = Math.sin(seed * 91.7 + n * 47.3) * 10000;
    return x - Math.floor(x);
  };
  let heads = "";
  const count = wilt ? 4 : 6;
  for (let i = 0; i < count; i++) {
    const cx = 40 + rng(i) * 240;
    const cy = (wilt ? 110 : 70) + rng(i + 10) * 60;
    const r = 14 + rng(i + 20) * 10;
    const petal = wilt ? (i % 2 ? "#B08968" : "#C8A27A") : pal[i % 2];
    const centre = wilt ? "#7A5C3E" : pal[2];
    heads += `<path d="M ${cx} ${cy} Q ${cx + (wilt ? 18 : 4)} ${cy + 60} ${cx + (wilt ? 30 : 6)} 210" stroke="${stem}" stroke-width="3.5" fill="none"/>`;
    heads += flower(cx, cy, r, petal, centre, wilt ? 6 : 0);
  }
  const bucket = wilt
    ? `<rect x="70" y="180" width="180" height="60" rx="8" fill="#9AA0A6"/><rect x="70" y="180" width="180" height="12" rx="6" fill="#7E848A"/>`
    : `<rect x="60" y="182" width="200" height="58" rx="6" fill="#26483A"/><rect x="60" y="182" width="200" height="10" rx="5" fill="#1B352B"/><text x="160" y="222" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#F3F5EF" letter-spacing="3">WAFEX</text>`;
  const tag = wilt
    ? `<rect x="8" y="8" width="86" height="24" rx="4" fill="#B23A3A"/><text x="51" y="25" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">WASTE</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="${bg}"/><rect y="200" width="320" height="40" fill="${wilt ? "#D6D2C6" : "#DDE6D8"}"/>${bucket}${heads}${tag}</svg>`;
}
