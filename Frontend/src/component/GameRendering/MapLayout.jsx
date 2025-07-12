export const levelsMapData = [
  { id: 1, x: 200, y: 300 },
  { id: 2, x: 350, y: 250 },
  { id: 3, x: 500, y: 200 },
  { id: 4, x: 650, y: 250 },
  { id: 5, x: 800, y: 300 },
  { id: 6, x: 950, y: 350 },
  { id: 7, x: 1100, y: 300 },
  { id: 8, x: 1250, y: 250 },
  { id: 9, x: 1400, y: 200 },
  { id: 10, x: 1550, y: 250 },
  // Add more levels as needed
];

// connectionsData.js
export const connectionsData = [
  { from: 1, to: 2, x: 275, y: 275, length: 150, rotation: -20 },
  { from: 2, to: 3, x: 425, y: 225, length: 150, rotation: -10 },
  { from: 3, to: 4, x: 575, y: 225, length: 150, rotation: 15 },
  { from: 4, to: 5, x: 725, y: 275, length: 150, rotation: 25 },
  { from: 5, to: 6, x: 875, y: 325, length: 150, rotation: 30 },
  { from: 6, to: 7, x: 1025, y: 325, length: 150, rotation: -15 },
  { from: 7, to: 8, x: 1175, y: 275, length: 150, rotation: -25 },
  { from: 8, to: 9, x: 1325, y: 225, length: 150, rotation: -10 },
  { from: 9, to: 10, x: 1475, y: 225, length: 150, rotation: 15 },
  // Add more connections as needed
];

// chestsData.js
export const chestsData = [
  { id: 'chest-1', x: 350, y: 200, rewards: { gold: 100, gem: 1 }, requiresLevel: 2 },
  { id: 'chest-2', x: 800, y: 280, rewards: { iron: 15, grain: 20 }, requiresLevel: 5 },
  { id: 'chest-3', x: 1250, y: 200, rewards: { water: 30, gem: 2 }, requiresLevel: 8 },
  // Add more chests as needed
];