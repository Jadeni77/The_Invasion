import {
  DefenderUnit,
  BasicDefender,
  HealerDefender,
  GrenadeDefender,
  BarricadeDefender,
} from "./DefenderUnits";

export const defenderUnitClasses = {
  "Basic Cop": BasicDefender,
  "Healer Cop": HealerDefender,
  "Grenadier": GrenadeDefender,
  "Barricade": BarricadeDefender,
};

export const calculateCardStats = (card) => {
  const UnitClass = defenderUnitClasses[card.name];
  if (!UnitClass) return null;

  const tempUnit = new UnitClass(0, 0, card);
  return {
    ...card,
    cost: tempUnit.cost,
    damage: tempUnit.attackDamage,
    health: tempUnit.health,
    range: tempUnit.range,
    upgradeInfo: tempUnit.getUpgradeInfo(),
  };
};

export const getUpgradePreview = (card) => {
  const UnitClass = defenderUnitClasses[card.name];
  if (!UnitClass) return null;

  const currentUnit = new UnitClass(0, 0, card);
  const nextLevelUnit = new UnitClass(0, 0, {
    ...card,
    level: card.level + 1,
  });

  return {
    current: {
      damage: currentUnit.attackDamage,
      health: currentUnit.health,
      cost: currentUnit.cost,
      range: currentUnit.range,
    },
    next: {
      damage: nextLevelUnit.attackDamage,
      health: nextLevelUnit.health,
      cost: nextLevelUnit.cost,
      range: nextLevelUnit.range,
    },
    upgradeInfo: nextLevelUnit.getUpgradeInfo(),
  };
};
