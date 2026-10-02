/** Illustration keys for service items (rendered by the web app's GarmentIcon). */
export const GARMENT_ICON_LABEL = {
  shirt: 'Shirt',
  tshirt: 'T-shirt',
  trouser: 'Trouser',
  jeans: 'Jeans',
  suit: 'Suit / blazer',
  jacket: 'Jacket',
  hoodie: 'Hoodie / sweater',
  dress: 'Dress',
  saree: 'Saree',
  kurta: 'Kurta',
  skirt: 'Skirt',
  shorts: 'Shorts',
  scarf: 'Scarf / dupatta',
  tie: 'Tie',
  blanket: 'Blanket / quilt',
  bedsheet: 'Bedsheet',
  pillow: 'Pillow / cushion',
  towel: 'Towel',
  curtain: 'Curtains',
  carpet: 'Carpet / rug',
  shoes: 'Shoes',
  sneakers: 'Sneakers',
  bag: 'Bag',
  gloves: 'Gloves',
  socks: 'Socks',
  cap: 'Cap',
  basket: 'Laundry (by weight)',
  sewing: 'Alteration',
  generic: 'Other',
} as const;

export type GarmentIconKey = keyof typeof GARMENT_ICON_LABEL;
export const GARMENT_ICON_KEYS = Object.keys(GARMENT_ICON_LABEL) as GarmentIconKey[];

const KEYWORDS: Array<[RegExp, GarmentIconKey]> = [
  [/t-?shirt|tee|polo/i, 'tshirt'],
  [/jean|denim/i, 'jeans'],
  [/shirt|blouse|top/i, 'shirt'],
  [/trouser|pant|chino|slack/i, 'trouser'],
  [/suit|blazer|coat|sherwani/i, 'suit'],
  [/jacket|parka/i, 'jacket'],
  [/hoodie|sweater|sweatshirt|cardigan|pullover|woollen/i, 'hoodie'],
  [/dress|gown|lehenga|frock/i, 'dress'],
  [/saree|sari/i, 'saree'],
  [/kurta|kurti|salwar/i, 'kurta'],
  [/skirt/i, 'skirt'],
  [/short/i, 'shorts'],
  [/scarf|dupatta|stole|shawl/i, 'scarf'],
  [/tie/i, 'tie'],
  [/blanket|quilt|comforter|duvet|razai/i, 'blanket'],
  [/bed ?sheet|sheet|linen/i, 'bedsheet'],
  [/pillow|cushion/i, 'pillow'],
  [/towel/i, 'towel'],
  [/curtain|drape/i, 'curtain'],
  [/carpet|rug|mat/i, 'carpet'],
  [/sneaker|sports shoe/i, 'sneakers'],
  [/shoe|boot|sandal|heel/i, 'shoes'],
  [/bag|purse|backpack/i, 'bag'],
  [/glove/i, 'gloves'],
  [/sock/i, 'socks'],
  [/cap|hat/i, 'cap'],
  [/kg|weight|load|laundry/i, 'basket'],
  [/alter|hem|stitch|zip|button/i, 'sewing'],
];

/** Picks an illustration from the stored key, else from the item name. */
export function garmentIconFor(name: string, icon?: string | null): GarmentIconKey {
  if (icon && icon in GARMENT_ICON_LABEL) return icon as GarmentIconKey;
  return KEYWORDS.find(([re]) => re.test(name))?.[1] ?? 'generic';
}
