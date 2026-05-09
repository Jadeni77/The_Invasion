// src/component/GameRendering/CollectionPage.jsx
import { useState } from "react";
import { useGame } from "../../GameLogic (MVC)/GameContext.jsx";
import { useSpriteFrame } from "../../common/useSpriteFrame.js";
import { calculateCardStats } from "../../GameLogic (MVC)/DefenderClassUtils.js";
import "../../../style/CollectionPage.css";

const DEFENDERS = [
  {
    id: "shooter",
    name: "Shooter",
    stats: { damage: 15, health: 120, range: 200, fireRate: 60, cost: 20 },
    description:
      "Standard defender unit with balanced stats. Gains rapid fire at level 3 and armor piercing at level 5.",
    specialAbilities: ["Rapid Fire (Lvl 3)", "Armor Piercing (Lvl 5)"],
  },
  {
    id: "healer",
    name: "Healer",
    stats: { damage: 5, health: 100, range: 100, healAmount: 10, cost: 30 },
    description:
      "Support unit that heals nearby defenders. Can heal multiple units at level 3 and resurrect at level 5.",
    specialAbilities: ["Group Heal (Lvl 3)", "Resurrection (Lvl 5)"],
  },
  {
    id: "grenadier",
    name: "Grenadier",
    stats: { damage: 40, health: 110, range: 250, explosionRadius: 60, cost: 60 },
    description:
      "Area damage specialist. Explosions deal damage to all enemies in radius. Unlocks cluster bombs and napalm.",
    specialAbilities: ["Cluster Bomb (Lvl 3)", "Napalm Strike (Lvl 5)"],
  },
  {
    id: "barricade",
    name: "Barricade",
    stats: { damage: 0, health: 500, range: 0, cost: 30 },
    description:
      "High health defensive structure. Blocks enemy movement. Can damage enemies with spikes and electric field.",
    specialAbilities: ["Spike Counter (Lvl 3)", "Electric Field (Lvl 5)"],
  },
  {
    id: "e-gen",
    name: "E-Gen",
    stats: { damage: 0, health: 80, energyDrop: 5, dropRate: "5 sec", cost: 25 },
    description:
      "Generates energy drops periodically. Essential for sustaining your defense. Energy burst and auto-collect at higher levels.",
    specialAbilities: ["Energy Burst (Lvl 3)", "Auto-Collect (Lvl 5)"],
  },
  {
    id: "sniper",
    name: "Sniper",
    stats: { damage: 50, health: 80, range: 800, critChance: "20%", cost: 80 },
    description:
      "Long range specialist with high single-target damage. Critical hits deal double damage.",
    specialAbilities: ["Piercing Shot (Lvl 3)", "Headshot (Lvl 5)"],
  },
  {
    id: "mortar",
    name: "Mortar",
    stats: { damage: 120, health: 100, range: 700, cost: 120 },
    description:
      "Long-range artillery that lobs explosive shells. Devastating against grouped enemies but slow to fire.",
    specialAbilities: ["Cluster Shells (Lvl 3)", "Saturation Strike (Lvl 5)"],
  },
  {
    id: "frost-archer",
    name: "Frost Archer",
    stats: { damage: 2, health: 90, range: 250, slowEffect: "30%", cost: 35 },
    description:
      "Slows enemies on hit. Slow effect stacks. Permafrost at higher levels deals bonus damage to slowed targets.",
    specialAbilities: ["Frost Stack (Lvl 3)", "Permafrost (Lvl 5)"],
  },
  {
    id: "fire-blast",
    name: "Fire Blast",
    stats: { damage: 300, health: 1000, range: 0, cost: 50 },
    description:
      "Stationary fire trap. Burns enemies that step within range. High health, big single hit.",
    specialAbilities: ["Burning Ground (Lvl 3)", "Inferno (Lvl 5)"],
  },
  {
    id: "ice-bomb",
    name: "Ice Bomb",
    stats: { damage: 200, health: 1000, range: 0, cost: 40 },
    description:
      "Freezes enemies in a wide radius. Powerful crowd control for tight choke points.",
    specialAbilities: ["Wide Freeze (Lvl 3)", "Cryo Shatter (Lvl 5)"],
  },
];

const ENEMIES = [
  {
    id: "basic_zombie",
    name: "Basic Zombie",
    stats: { health: 100, speed: 0.8, damage: 10, bounty: 10 },
    description:
      "Standard enemy unit. Slow but steady. Attacks defenders in its path.",
    abilities: ["Melee Attack"],
  },
  {
    id: "fast_zombie",
    name: "Fast Zombie",
    stats: { health: 80, speed: 1.5, damage: 0, bounty: 15 },
    description:
      "Quick runner that tries to reach your base. Lower health but harder to stop.",
    abilities: ["Sprint"],
  },
  {
    id: "tank_zombie",
    name: "Tank Zombie",
    stats: { health: 400, speed: 0.5, damage: 30, bounty: 30 },
    description:
      "Heavy armored enemy with high health. Becomes enraged at low health, doubling speed and damage.",
    abilities: ["Armor (50% reduction)", "Rage Mode"],
  },
  {
    id: "exploder",
    name: "Exploder",
    stats: { health: 120, speed: 1.2, explosionDamage: 200, bounty: 20 },
    description:
      "Suicide bomber that explodes on death or when near defenders.",
    abilities: ["Death Explosion", "Self-Destruct"],
  },
  {
    id: "skeleton_shooter",
    name: "Skeleton Shooter",
    stats: { health: 150, speed: 0.8, damage: 20, range: 150, bounty: 15 },
    description:
      "Ranged attacker that stops to shoot at defenders from a distance.",
    abilities: ["Ranged Attack"],
  },
  {
    id: "shielder",
    name: "Shielder",
    stats: { health: 200, shieldHealth: 100, speed: 0.8, damage: 15, bounty: 25 },
    description:
      "Protected by a frontal shield that blocks 70% of attacks. Shield must be destroyed first.",
    abilities: ["Frontal Shield", "Shield Bash"],
  },
  {
    id: "healer",
    name: "Healer",
    stats: { health: 80, speed: 0.7, healAmount: 20, healRange: 80, bounty: 25 },
    description:
      "Support enemy that heals nearby allies. Priority target in groups.",
    abilities: ["Area Heal"],
  },
  {
    id: "splitter",
    name: "Splitter",
    stats: { health: 120, speed: 0.9, damage: 12, splitCount: 3, bounty: 15 },
    description:
      "Splits into 3 mini enemies upon death. Each mini is fast but fragile.",
    abilities: ["Death Split"],
  },
  {
    id: "mini",
    name: "Mini",
    stats: { health: 40, speed: 1.6, damage: 5, bounty: 5 },
    description:
      "Small fragment spawned when a Splitter dies. Very fast but extremely fragile.",
    abilities: ["Swarm"],
  },
  {
    id: "swarm_witch",
    name: "Swarm Witch",
    stats: { health: 180, speed: 0.2, damage: 20, bounty: 40 },
    description:
      "Slow caster that periodically spawns waves of mini enemies. Eliminate before its swarm overwhelms you.",
    abilities: ["Summon Swarm"],
  },
  {
    id: "emp",
    name: "EMP",
    stats: { health: 180, speed: 1.0, damage: 5, bounty: 20 },
    description:
      "Releases an electric pulse that disables nearby defender abilities for a short time.",
    abilities: ["EMP Burst", "Ability Lockout"],
  },
  {
    id: "vampire",
    name: "Vampire",
    boss: true,
    stats: { health: 90, speed: 1.2, damage: 15, lifeSteal: "100%", bounty: 30 },
    description:
      "Heals for 100% of damage dealt. Becomes stronger as it feeds.",
    abilities: ["Life Steal", "Blood Frenzy"],
  },
  {
    id: "ghost",
    name: "Ghost",
    stats: { health: 80, speed: 1.0, damage: 0, bounty: 25 },
    description:
      "Phases through barricades and ignores most physical defenses.",
    abilities: ["Phase Walk", "Incorporeal"],
  },
  {
    id: "berserker",
    name: "Berserker",
    stats: { health: 200, speed: 0.6, damage: 25, bounty: 35 },
    description:
      "Becomes faster and hits harder as its health drops. Most dangerous when nearly dead.",
    abilities: ["Bloodlust", "Charge"],
  },
  {
    id: "necromancer",
    name: "Necromancer",
    boss: true,
    stats: { health: 100, speed: 0.2, damage: 10, bounty: 35 },
    description:
      "Raises fallen enemies as new units. Letting it linger lets a wave snowball.",
    abilities: ["Raise Dead"],
  },
  {
    id: "assassin",
    name: "Assassin",
    stats: { health: 70, speed: 1.3, damage: 60, bounty: 15 },
    description:
      "Stealthy striker with very high damage. Can slip past defender lines.",
    abilities: ["Stealth", "Assassinate"],
  },
  {
    id: "mage",
    name: "Mage",
    boss: true,
    stats: { health: 90, speed: 0.5, damage: 80, bounty: 15 },
    description:
      "Long-range spellcaster. Stops to channel devastating bolts at your defenders.",
    abilities: ["Arcane Bolt", "Channel"],
  },
  {
    id: "titan",
    name: "Titan",
    boss: true,
    stats: { health: 5000, speed: 0.1, damage: 50, bounty: 100 },
    description:
      "Massive elite enemy with enormous health. Slow but each hit is devastating.",
    abilities: ["Stomp", "Massive Frame"],
  },
];

const UnitImage = ({ category, name }) => {
  const sprite = useSpriteFrame(category, name);
  return (
    <div className="collection-unit-image">
      {sprite ? (
        <img
          src={sprite}
          alt={name}
          className="collection-unit-sprite-img"
        />
      ) : (
        <div className={`unit-sprite ${category === "enemies" ? "enemy" : ""}`}>
          {name.charAt(0)}
        </div>
      )}
    </div>
  );
};

const DefenderCard = ({ defender, playerCard, liveStats }) => {
  const dmg    = liveStats?.damage  ?? defender.stats.damage;
  const hp     = liveStats?.health  ?? defender.stats.health;
  const rng    = liveStats?.range   ?? defender.stats.range;
  const cost   = liveStats?.cost    ?? defender.stats.cost;

  return (
    <div className="collection-unit-card">
      <UnitImage category="defenders" name={defender.name} />
      <h3 className="collection-unit-name">{defender.name}</h3>

      {playerCard && (
        <div className="collection-card-meta">
          <span className="collection-level-badge">Lv. {playerCard.level}</span>
          <span className="collection-pieces-text">
            {playerCard.pieces}/{playerCard.piecesNeeded * playerCard.level} pieces
          </span>
        </div>
      )}

      <div className="collection-unit-stats">
        {dmg > 0 && <div className="collection-stat">DMG: {dmg}</div>}
        <div className="collection-stat">HP: {hp}</div>
        {rng > 0 && <div className="collection-stat">RNG: {rng}</div>}
        {defender.stats.healAmount && (
          <div className="collection-stat">HEAL: {defender.stats.healAmount}</div>
        )}
        {defender.stats.energyDrop && (
          <div className="collection-stat">ENG: +{defender.stats.energyDrop}</div>
        )}
        <div className="collection-stat cost">COST: {cost}</div>
      </div>

      <div className="collection-unit-description">
        <p>{defender.description}</p>
      </div>

      <div className="special-abilities">
        <strong>Special Abilities:</strong>
        <ul>
          {defender.specialAbilities.map((ability, index) => (
            <li key={index}>{ability}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const EnemyCard = ({ enemy }) => (
  <div className={`collection-unit-card enemy-card ${enemy.boss ? "boss-card" : ""}`}>
    <UnitImage category="enemies" name={enemy.name} />
    <div className="collection-unit-name-row">
      <h3 className="collection-unit-name">{enemy.name}</h3>
      {enemy.boss && <span className="boss-badge">BOSS</span>}
    </div>

    <div className="collection-unit-stats">
      <div className="collection-stat">HP: {enemy.stats.health}</div>
      <div className="collection-stat">SPD: {enemy.stats.speed}</div>
      {enemy.stats.damage > 0 && (
        <div className="collection-stat">DMG: {enemy.stats.damage}</div>
      )}
      <div className="collection-stat bounty">
        BOUNTY: {enemy.stats.bounty}
      </div>
    </div>

    <div className="collection-unit-description">
      <p>{enemy.description}</p>
    </div>

    <div className="enemy-abilities">
      <strong>Abilities:</strong>
      <ul>
        {enemy.abilities.map((ability, index) => (
          <li key={index}>{ability}</li>
        ))}
      </ul>
    </div>
  </div>
);

const CollectionPage = () => {
  const { closeCollection, playerData } = useGame();

  const [selectedTab, setSelectedTab] = useState("defenders");

  const playerCardMap = new Map((playerData?.cards || []).map((c) => [c.name, c]));

  return (
    <div className="collection-page">
      <div className="collection-header">
        <h1>COLLECTION</h1>
        <button className="close-button" onClick={closeCollection}>
          ×
        </button>
      </div>

      <div className="collection-tabs">
        <button
          className={`collection-tab ${selectedTab === "defenders" ? "active" : ""}`}
          onClick={() => setSelectedTab("defenders")}
        >
          Defenders
        </button>
        <button
          className={`collection-tab ${selectedTab === "enemies" ? "active" : ""}`}
          onClick={() => setSelectedTab("enemies")}
        >
          Enemies
        </button>
      </div>

      <div className="collection-container">
        <h2 className="section-title">
          {selectedTab === "defenders" ? "DEFENDERS" : "ENEMIES"}
        </h2>

        <div className="collection-grid">
          {selectedTab === "defenders"
            ? DEFENDERS.map((d) => {
                const playerCard = playerCardMap.get(d.name);
                const liveStats  = playerCard ? calculateCardStats(playerCard) : null;
                return (
                  <div key={d.id} className={`collection-card-wrapper ${!playerCard ? "locked" : ""}`}>
                    {!playerCard && (
                      <div className="collection-lock-overlay">
                        <span className="collection-lock-icon">🔒</span>
                        <span className="collection-lock-text">Locked</span>
                      </div>
                    )}
                    <DefenderCard defender={d} playerCard={playerCard} liveStats={liveStats} />
                  </div>
                );
              })
            : ENEMIES.map((e) => <EnemyCard key={e.id} enemy={e} />)}
        </div>
      </div>

      <button className="back-button" onClick={closeCollection}>
        Back to Lobby
      </button>
    </div>
  );
};

export default CollectionPage;
