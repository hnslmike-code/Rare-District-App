type StreetwearSeed = {
  name: string;
  description: string;
  price: string;
  sizes: string[];
  stock: number;
  isFeatured?: boolean;
  accent: string;
  shadow: string;
  kind: "hoodie" | "tee" | "jacket" | "cargo" | "sneaker" | "cap" | "vest" | "short";
};

const sizes = ["XS", "S", "M", "L", "XL"];

export const ANIKA_STREETWEAR: StreetwearSeed[] = [
  ["Midnight Arc Hoodie", "Heavyweight brushed fleece hoodie with a sculpted arc panel.", "68000", "#18212d", "#8eafc4", "hoodie"],
  ["Ivory Signal Tee", "Boxy organic cotton tee with a raised tonal signal mark.", "32000", "#e8e2d7", "#c28b5b", "tee"],
  ["Cinder Utility Jacket", "Relaxed utility jacket with oversized pockets and a soft technical finish.", "92000", "#353535", "#db8b61", "jacket"],
  ["Studio Cargo Trouser", "Wide-leg cargo trouser cut from structured cotton twill.", "74000", "#5b6259", "#d6bd84", "cargo"],
  ["Cloud Runner Low", "Minimal low-top street sneaker with layered sole geometry.", "86000", "#f3f0e9", "#9caac0", "sneaker"],
  ["Aster Panel Cap", "Six-panel cap with a curved brim and contrast embroidery.", "24000", "#27394d", "#dfb36b", "cap"],
  ["Clayline Knit Vest", "Soft ribbed vest with an asymmetric hem for layered looks.", "51000", "#a85d43", "#e8c6a4", "vest"],
  ["Graphite Track Short", "Technical mesh short with a clean relaxed fit.", "38000", "#2b3038", "#8cc2b1", "short"],
  ["Harbor Quarter Zip", "Weatherproof quarter zip with a high sculpted collar.", "79000", "#486d77", "#d8a06e", "jacket"],
  ["Sable Box Tee", "Premium heavyweight tee with dropped shoulders and a longline cut.", "35000", "#28231f", "#d4a67d", "tee"],
  ["Terracotta Flight Bomber", "Cropped bomber with padded volume and tonal rib trim.", "99000", "#a44f3a", "#f0c18a", "jacket"],
  ["Moss Modular Cargo", "Convertible cargo trouser with removable lower panels.", "88000", "#5b6a4d", "#d7d2a8", "cargo"],
  ["Orbit Court High", "High-top court sneaker with a layered sculptural outsole.", "91000", "#d6d0c5", "#b06b53", "sneaker"],
  ["Ink Workwear Cap", "Washed cotton cap with a structured five-panel profile.", "26000", "#1c2535", "#89b5c8", "cap"],
  ["Dune Reversible Vest", "Reversible padded vest in sand and charcoal technical nylon.", "72000", "#c5aa82", "#46505a", "vest"],
  ["Rustline Sweat Short", "French terry sweat short with a considered wide leg.", "42000", "#984e3d", "#e2b27d", "short"],
  ["Paper Cut Hoodie", "Double-layer hoodie with a graphic seam construction.", "71000", "#d9d2c5", "#7e91a0", "hoodie"],
  ["Blue Hour Field Jacket", "Relaxed field jacket with oversized flap pockets.", "108000", "#345671", "#cf9d62", "jacket"],
  ["Studio Stripe Tee", "Boxy striped tee inspired by gallery work uniforms.", "34000", "#f0e9d8", "#c55c4b", "tee"],
  ["Night Market Cargo", "Tapered cargo with articulated knees and a clean ankle break.", "76000", "#25272a", "#c99563", "cargo"],
].map(([name, description, price, accent, shadow, kind]) => ({ name, description, price, accent, shadow, kind: kind as StreetwearSeed["kind"], sizes, stock: 18 }));

export const ZARA_STREETWEAR: StreetwearSeed[] = [
  ["Adire Motion Hoodie", "Indigo heavyweight hoodie with a hand-drawn motion panel.", "69000", "#1c3d58", "#a9c7d2", "hoodie"],
  ["Kente Grid Tee", "Relaxed cotton tee with a vivid woven-grid chest graphic.", "36000", "#df9b2f", "#16485a", "tee"],
  ["Lagos Transit Jacket", "Lightweight coach jacket with a crisp architectural silhouette.", "88000", "#d9623d", "#f0c26d", "jacket"],
  ["Sahara Pocket Cargo", "Utility cargo trouser in a generous street fit.", "73000", "#c29a63", "#314e5b", "cargo"],
  ["Coastline Runner", "Layered runner with a tonal mesh upper and oversized sole.", "94000", "#e8e3d8", "#e16f4d", "sneaker"],
  ["Palm Shade Cap", "Unstructured cap with an embroidered palm insignia.", "25000", "#22726d", "#d8b66a", "cap"],
  ["Mosaic Knit Vest", "Graphic knit vest with a cropped streetwear proportion.", "55000", "#7b397c", "#e0ad75", "vest"],
  ["Market Mesh Short", "Breathable mesh short with contrast binding.", "39000", "#e06d48", "#163f55", "short"],
  ["Yaba Wind Shell", "Packable wind shell with a bold color-blocked yoke.", "81000", "#237f86", "#efb85d", "jacket"],
  ["Clay Block Tee", "Soft heavyweight tee with a two-tone geometric block.", "35000", "#b9684e", "#e4c590", "tee"],
  ["Sunset Varsity Bomber", "Varsity bomber with contrast sleeves and ribbed finish.", "102000", "#d46c37", "#254d74", "jacket"],
  ["Indigo Fold Cargo", "Deep indigo cargo with fold-over utility pockets.", "82000", "#2d4774", "#d6a354", "cargo"],
  ["Cobalt Court High", "High-top sneaker with saturated cobalt paneling.", "96000", "#2864ad", "#ef8b62", "sneaker"],
  ["Kora Five Panel", "Five-panel cap with a bright woven front detail.", "27000", "#d2a23c", "#1e5760", "cap"],
  ["Lagoon Utility Vest", "Technical vest with a clean modular pocket system.", "76000", "#2d8c82", "#f0c679", "vest"],
  ["Coral Loop Short", "Relaxed loopback short with a contrast drawcord.", "41000", "#db624e", "#f4c38b", "short"],
  ["Oasis Dye Hoodie", "Oversized hoodie with a soft hand-dyed gradient effect.", "72000", "#477a83", "#dc9c66", "hoodie"],
  ["Crossroads Coach Jacket", "Minimal coach jacket with a sharp contrast back panel.", "93000", "#324f5b", "#e18b50", "jacket"],
  ["Pattern House Tee", "Boxy tee with a subtle all-over pattern and clean collar.", "37000", "#f0d9aa", "#bd5546", "tee"],
  ["Rail Line Cargo", "Relaxed cargo trouser with reflective seam accents.", "79000", "#4d5564", "#df9c55", "cargo"],
].map(([name, description, price, accent, shadow, kind]) => ({ name, description, price, accent, shadow, kind: kind as StreetwearSeed["kind"], sizes, stock: 20 }));

function garmentShape(kind: StreetwearSeed["kind"]) {
  if (kind === "sneaker") return `<path d="M56 267c28-3 52-17 76-39l38 19c17 9 29 23 54 28l48 10c13 3 19 19 6 25H72c-25 0-32-31-16-43Z"/><path d="m144 228 25 18m-69 15h155" class="line"/>`;
  if (kind === "cap") return `<path d="M76 157c6-47 37-75 82-75 48 0 76 31 79 75-39-22-97-20-161 0Z"/><path d="M78 157c-25 4-51 16-58 30 39 11 93 4 139-20" class="solid"/>`;
  if (kind === "cargo") return `<path d="M85 62h70l8 81 31 123h-47l-24-94-20 94H56l29-123Z"/><path d="M159 143h35m-94 0h35M83 180h38m-38 24h31" class="line"/>`;
  if (kind === "short") return `<path d="M82 73h107l16 116-55 5-15-53-18 53-56-5Z"/><path d="M133 74v67m-53-16h43m30 0h42" class="line"/>`;
  if (kind === "vest") return `<path d="m91 57 39 25 39-25 36 35-29 47 13 102H72l13-102-29-47Z"/><path d="m130 82 10 159m-46-99 36 18 39-18" class="line"/>`;
  if (kind === "jacket") return `<path d="m91 49 39 27 39-27 37 37-25 58 13 101H72l13-101-25-58Z"/><path d="m130 76v169m-41-94 41 17 39-17m-76 39h28m48 0h28" class="line"/>`;
  if (kind === "tee") return `<path d="m96 52 34 24 34-24 37 35-25 54-21-12v116H105V129l-21 12-25-54Z"/><path d="M114 76c8 13 24 19 32 0" class="line"/>`;
  return `<path d="m93 50 37 27 37-27 37 38-24 58v105H80V146l-24-58Z"/><path d="M108 76c6 18 38 18 44 0m-22 3v156" class="line"/>`;
}

export function streetwearImage(seed: StreetwearSeed) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${seed.accent}"/><stop offset="1" stop-color="${seed.shadow}"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="12" stdDeviation="8" flood-opacity=".2"/></filter></defs>
    <g transform="translate(30 5)" filter="url(#s)" fill="url(#g)" stroke="${seed.shadow}" stroke-width="3" stroke-linejoin="round">${garmentShape(seed.kind)}</g>
    <ellipse cx="160" cy="292" rx="92" ry="10" fill="#000" opacity=".09"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type StreetwearProduct = StreetwearSeed & { category: "streetwear"; images: string[] };

export function buildStreetwearProducts(catalog: StreetwearSeed[]) {
  return catalog.map((item) => ({
    ...item,
    category: "streetwear" as const,
    images: [streetwearImage(item)],
  }));
}