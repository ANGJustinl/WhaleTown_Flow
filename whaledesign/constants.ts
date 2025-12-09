
// The Datawhale mascot - base avatar
export const DEFAULT_WHALE_IMAGE = "./assets/avater/avatar.png";

// Facial expression overlays
export const EXPRESSION_OVERLAYS = {
  'Smile': './assets/avater/facial_emotion/Smile.png',
  'Focused': './assets/avater/facial_emotion/Focused.png',
  'Sleepy': './assets/avater/facial_emotion/Sleepy.png',
  'Relaxed': './assets/avater/facial_emotion/Relaxed.png',
  'Joyful': './assets/avater/facial_emotion/Joyful.png'
};

// Pre-generated pixel art accessories to get started
export const DEFAULT_ACCESSORIES = [
  {
    id: 'glasses_1',
    name: 'Glasses',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/black-glasses.png',
  },
  {
    id: 'crown_1',
    name: 'Crown',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/kings-rock.png',
  },
  {
    id: 'book_1',
    name: 'Book',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/town-map.png',
  },
  {
    id: 'laptop_1',
    name: 'Laptop',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/dubious-disc.png',
  },
  {
    id: 'trophy_1',
    name: 'Trophy',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/rare-candy.png', // Placeholder for trophy
  },
  {
    id: 'party_hat',
    name: 'Party Hat',
    src: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/exp-share.png', // Placeholder
  }
];

export const COLOR_PALETTES = [
    { name: 'Default Blue', hue: 0, color: '#60A5FA' },
    { name: 'Purple', hue: 60, color: '#A78BFA' },
    { name: 'Green', hue: 140, color: '#4ADE80' },
    { name: 'Pink', hue: 300, color: '#F472B6' },
    { name: 'Orange', hue: 180, color: '#FB923C' }, // Approximating hue rotate values
];

export const CANVAS_SIZE = 500;
