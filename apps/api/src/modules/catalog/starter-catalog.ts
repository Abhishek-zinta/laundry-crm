import type { GarmentIconKey, ModifierType, UnitType } from '@rinseops/shared';

/**
 * Starter catalog applied to new businesses (and the demo seed) so the POS is
 * usable immediately. Everything is editable under Services & Pricing.
 */
export const STARTER_CATEGORIES: Array<{ code: string; name: string; color: string; description: string }> = [
  { code: 'DC', name: 'Dry Cleaning', color: '#0f766e', description: 'Solvent cleaning for delicate and formal wear' },
  { code: 'WF', name: 'Wash & Fold', color: '#2563eb', description: 'Laundry: machine wash, dry and fold' },
  { code: 'WI', name: 'Wash & Iron', color: '#7c3aed', description: 'Wash, dry and press' },
  { code: 'SI', name: 'Steam Iron', color: '#ea580c', description: 'Steam pressing only' },
  { code: 'SC', name: 'Shoe Clean', color: '#be123c', description: 'Deep cleaning for shoes, sneakers and bags' },
  { code: 'ALT', name: 'Alterations', color: '#a16207', description: 'Hemming, fitting, zips and repairs' },
];

export const STARTER_ITEMS: Array<{ name: string; unitType: UnitType; icon: GarmentIconKey; piecesPerUnit?: number }> = [
  { name: 'Shirt', unitType: 'PIECE', icon: 'shirt' },
  { name: 'T-Shirt', unitType: 'PIECE', icon: 'tshirt' },
  { name: 'Trouser', unitType: 'PIECE', icon: 'trouser' },
  { name: 'Jeans', unitType: 'PIECE', icon: 'jeans' },
  { name: 'Suit (2 pc)', unitType: 'PIECE', icon: 'suit', piecesPerUnit: 2 },
  { name: 'Blazer', unitType: 'PIECE', icon: 'suit' },
  { name: 'Jacket', unitType: 'PIECE', icon: 'jacket' },
  { name: 'Sweater / Hoodie', unitType: 'PIECE', icon: 'hoodie' },
  { name: 'Dress', unitType: 'PIECE', icon: 'dress' },
  { name: 'Saree', unitType: 'PIECE', icon: 'saree' },
  { name: 'Kurta', unitType: 'PIECE', icon: 'kurta' },
  { name: 'Skirt', unitType: 'PIECE', icon: 'skirt' },
  { name: 'Scarf / Dupatta', unitType: 'PIECE', icon: 'scarf' },
  { name: 'Tie', unitType: 'PIECE', icon: 'tie' },
  { name: 'Blanket', unitType: 'PIECE', icon: 'blanket' },
  { name: 'Bedsheet', unitType: 'PIECE', icon: 'bedsheet' },
  { name: 'Pillow Cover', unitType: 'PIECE', icon: 'pillow' },
  { name: 'Towel', unitType: 'PIECE', icon: 'towel' },
  { name: 'Curtains', unitType: 'PIECE', icon: 'curtain' },
  { name: 'Carpet / Rug', unitType: 'PIECE', icon: 'carpet' },
  { name: 'Shoes', unitType: 'PAIR', icon: 'shoes' },
  { name: 'Sneakers', unitType: 'PAIR', icon: 'sneakers' },
  { name: 'Handbag', unitType: 'PIECE', icon: 'bag' },
  { name: 'Gloves', unitType: 'PAIR', icon: 'gloves' },
  { name: 'Socks', unitType: 'PAIR', icon: 'socks' },
  { name: 'Cap', unitType: 'PIECE', icon: 'cap' },
  { name: 'Laundry (by kg)', unitType: 'KG', icon: 'basket' },
];

/** Retail prices: item → category code → price. */
export const STARTER_PRICES: Record<string, Partial<Record<string, string>>> = {
  Shirt: { DC: '120', WI: '70', SI: '30', ALT: '120' },
  'T-Shirt': { DC: '100', WF: '40', WI: '60', SI: '25' },
  Trouser: { DC: '150', WI: '80', SI: '35', ALT: '150' },
  Jeans: { DC: '160', WF: '60', WI: '90', SI: '40', ALT: '150' },
  'Suit (2 pc)': { DC: '450', SI: '150', ALT: '450' },
  Blazer: { DC: '300', SI: '100', ALT: '350' },
  Jacket: { DC: '300', WI: '180', ALT: '250' },
  'Sweater / Hoodie': { DC: '200', WF: '90', WI: '120' },
  Dress: { DC: '250', WI: '140', SI: '60', ALT: '200' },
  Saree: { DC: '250', WI: '150', SI: '80', ALT: '200' },
  Kurta: { DC: '130', WI: '75', SI: '35', ALT: '120' },
  Skirt: { DC: '150', WI: '80', SI: '35', ALT: '150' },
  'Scarf / Dupatta': { DC: '90', WI: '50', SI: '25' },
  Tie: { DC: '80' },
  Blanket: { DC: '400', WF: '350' },
  Bedsheet: { DC: '150', WF: '100', WI: '120', SI: '60' },
  'Pillow Cover': { WF: '30', WI: '40', SI: '20' },
  Towel: { WF: '40', WI: '50' },
  Curtains: { DC: '250', WF: '180', ALT: '200' },
  'Carpet / Rug': { DC: '600', WF: '450' },
  Shoes: { SC: '350' },
  Sneakers: { SC: '400' },
  Handbag: { SC: '500', DC: '450' },
  Gloves: { DC: '80', WF: '30' },
  Socks: { WF: '20' },
  Cap: { WF: '50', SC: '150' },
  'Laundry (by kg)': { WF: '89', WI: '129' },
};

export const STARTER_MODIFIERS: Array<{ name: string; type: ModifierType; value: string }> = [
  { name: 'Express Service', type: 'PERCENT', value: '50' },
  { name: 'Stain Treatment', type: 'FIXED', value: '40' },
  { name: 'Delicate Fabric', type: 'PERCENT', value: '20' },
  { name: 'Starch', type: 'FIXED', value: '10' },
  { name: 'Hanger Packing', type: 'FIXED', value: '15' },
];
