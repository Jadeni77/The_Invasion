
//dummy map

export const levelsMapData = [
  { id: 1, x: 100, y: 350 },
  { id: 2, x: 250, y: 250 },
  { id: 3, x: 400, y: 200 },
  { id: 4, x: 550, y: 250 },
  { id: 5, x: 700, y: 350 },
  // Add more levels as needed
];

export const connectionsData = [
  { from: 1, to: 2, hasChest: false, path: "M 100 350 L 250 250" },
  { from: 2, to: 3, hasChest: true, path: "M 250 250 L 400 200" }, // Chest between 2 and 3
  { from: 3, to: 4, hasChest: false, path: "M 400 200 L 550 250" },
  { from: 4, to: 5, hasChest: true, path: "M 550 250 L 700 350" }, // Chest between 4 and 5
];

export const chestsData = [
  // Chest for connection 2-3: (250+400)/2 = 325, (250+200)/2 = 225
  {
    id: "chest-2-3",
    x: 325,
    y: 225,
    connectedLevels: [2, 3],
    imageUrl: "link",
  },
  // Chest for connection 4-5: (550+700)/2 = 625, (250+350)/2 = 300
  {
    id: "chest-4-5",
    x: 625,
    y: 300,
    connectedLevels: [4, 5],
    imageUrl: "link",
  },
];
