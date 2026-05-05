// src/component/GameRendering/CollectionPage.jsx
import React, { useState } from "react";
import { useGame } from "../../GameLogic (MVC)/GameContext.jsx";
import "../../../style/CollectionPage.css";

const CollectionPage = () => {
  const { closeCollection } = useGame();
  const [selectedTab, setSelectedTab] = useState("defenders");

  // Mock collection data - will be replaced with real data later
  const collection = {
    defenders: [
      {
        id: "basic_cop",
        name: "Shooter",
        unlocked: true,
        stats: {
          damage: 15,
          health: 120,
          range: 200,
          fireRate: 60,
          cost: 20,
        },
        description:
          "Standard defender unit with balanced stats. Gains rapid fire at level 3 and armor piercing at level 5.",
        specialAbilities: ["Rapid Fire (Lvl 3)", "Armor Piercing (Lvl 5)"],
      },
      {
        id: "healer_cop",
        name: "Healer",
        unlocked: true,
        stats: {
          damage: 5,
          health: 100,
          range: 100,
          healAmount: 10,
          cost: 30,
        },
        description:
          "Support unit that heals nearby defenders. Can heal multiple units at level 3 and resurrect at level 5.",
        specialAbilities: ["Group Heal (Lvl 3)", "Resurrection (Lvl 5)"],
      },
      {
        id: "grenadier",
        name: "Grenadier",
        unlocked: true,
        stats: {
          damage: 40,
          health: 110,
          range: 250,
          explosionRadius: 60,
          cost: 60,
        },
        description:
          "Area damage specialist. Explosions deal damage to all enemies in radius. Unlocks cluster bombs and napalm.",
        specialAbilities: ["Cluster Bomb (Lvl 3)", "Napalm Strike (Lvl 5)"],
      },
      {
        id: "barricade",
        name: "Barricade",
        unlocked: true,
        stats: {
          damage: 0,
          health: 500,
          range: 0,
          cost: 30,
        },
        description:
          "High health defensive structure. Blocks enemy movement. Can damage enemies with spikes and electric field.",
        specialAbilities: ["Spike Counter (Lvl 3)", "Electric Field (Lvl 5)"],
      },
      {
        id: "energy_generator",
        name: "E-Gen",
        unlocked: true,
        stats: {
          damage: 0,
          health: 80,
          energyDrop: 5,
          dropRate: "5 sec",
          cost: 25,
        },
        description:
          "Generates energy drops periodically. Essential for sustaining your defense. Energy burst and auto-collect at higher levels.",
        specialAbilities: ["Energy Burst (Lvl 3)", "Auto-Collect (Lvl 5)"],
      },
      {
        id: "sniper",
        name: "Sniper",
        unlocked: false,
        stats: {
          damage: 50,
          health: 80,
          range: 800,
          critChance: "20%",
          cost: 80,
        },
        description:
          "Long range specialist with high single-target damage. Critical hits deal double damage.",
        specialAbilities: ["Piercing Shot (Lvl 3)", "Headshot (Lvl 5)"],
      },
    ],
    enemies: [
      {
        id: "basic_zombie",
        name: "Basic Zombie",
        unlocked: true,
        stats: {
          health: 100,
          speed: 0.8,
          damage: 10,
          bounty: 10,
        },
        description:
          "Standard enemy unit. Slow but steady. Attacks defenders in its path.",
        abilities: ["Melee Attack"],
      },
      {
        id: "fast_zombie",
        name: "Fast Zombie",
        unlocked: true,
        stats: {
          health: 80,
          speed: 1.5,
          damage: 0,
          bounty: 15,
        },
        description:
          "Quick runner that tries to reach your base. Lower health but harder to stop.",
        abilities: ["Sprint"],
      },
      {
        id: "tank_zombie",
        name: "Tank Zombie",
        unlocked: true,
        stats: {
          health: 400,
          speed: 0.5,
          damage: 30,
          bounty: 30,
        },
        description:
          "Heavy armored enemy with high health. Becomes enraged at low health, doubling speed and damage.",
        abilities: ["Armor (50% reduction)", "Rage Mode"],
      },
      {
        id: "exploder",
        name: "Exploder",
        unlocked: true,
        stats: {
          health: 120,
          speed: 1.2,
          explosionDamage: 200,
          bounty: 20,
        },
        description:
          "Suicide bomber that explodes on death or when near defenders.",
        abilities: ["Death Explosion", "Self-Destruct"],
      },
      {
        id: "skeleton_shooter",
        name: "Skeleton Shooter",
        unlocked: false,
        stats: {
          health: 150,
          speed: 0.8,
          damage: 20,
          range: 150,
          bounty: 15,
        },
        description:
          "Ranged attacker that stops to shoot at defenders from a distance.",
        abilities: ["Ranged Attack"],
      },
      {
        id: "shielder",
        name: "Shielder",
        unlocked: false,
        stats: {
          health: 200,
          shieldHealth: 100,
          speed: 0.8,
          damage: 15,
          bounty: 25,
        },
        description:
          "Protected by a frontal shield that blocks 70% of attacks. Shield must be destroyed first.",
        abilities: ["Frontal Shield", "Shield Bash"],
      },
      {
        id: "healer",
        name: "Healer",
        unlocked: false,
        stats: {
          health: 80,
          speed: 0.7,
          healAmount: 20,
          healRange: 80,
          bounty: 25,
        },
        description:
          "Support enemy that heals nearby allies. Priority target in groups.",
        abilities: ["Area Heal"],
      },
      {
        id: "splitter",
        name: "Splitter",
        unlocked: false,
        stats: {
          health: 120,
          speed: 0.9,
          damage: 12,
          splitCount: 3,
          bounty: 15,
        },
        description:
          "Splits into 3 mini enemies upon death. Each mini is fast but fragile.",
        abilities: ["Death Split"],
      },
      {
        id: "vampire",
        name: "Vampire",
        unlocked: false,
        stats: {
          health: 90,
          speed: 1.2,
          damage: 15,
          lifeSteal: "100%",
          bounty: 30,
        },
        description:
          "Heals for 100% of damage dealt. Becomes stronger as it feeds.",
        abilities: ["Life Steal", "Blood Frenzy"],
      },
    ],
  };

  const renderDefenderCard = (defender) => (
    <div
      key={defender.id}
      className={`collection-unit-card ${!defender.unlocked ? "locked" : ""}`}
    >
      <div className="collection-unit-image">
        {defender.unlocked ? (
          <div className="unit-sprite defender">{defender.name.charAt(0)}</div>
        ) : (
          <div className="locked-icon">🔒</div>
        )}
      </div>

      <h3 className="collection-unit-name">
        {defender.unlocked ? defender.name : "???"}
      </h3>

      {defender.unlocked ? (
        <>
          <div className="collection-unit-stats">
            {defender.stats.damage > 0 && (
              <div className="collection-stat">
                DMG: {defender.stats.damage}
              </div>
            )}
            <div className="collection-stat">HP: {defender.stats.health}</div>
            {defender.stats.range > 0 && (
              <div className="collection-stat">RNG: {defender.stats.range}</div>
            )}
            {defender.stats.healAmount && (
              <div className="collection-stat">
                HEAL: {defender.stats.healAmount}
              </div>
            )}
            {defender.stats.energyDrop && (
              <div className="collection-stat">
                ENG: +{defender.stats.energyDrop}
              </div>
            )}
            <div className="collection-stat cost">
              COST: {defender.stats.cost}
            </div>
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

          <div className="collection-unit-status">✓ Unlocked</div>
        </>
      ) : (
        <div className="locked-message">
          Complete more levels to unlock this defender!
        </div>
      )}
    </div>
  );

  const renderEnemyCard = (enemy) => (
    <div
      key={enemy.id}
      className={`collection-unit-card enemy-card ${!enemy.unlocked ? "locked" : ""}`}
    >
      <div className="collection-unit-image">
        {enemy.unlocked ? (
          <div className="unit-sprite enemy">{enemy.name.charAt(0)}</div>
        ) : (
          <div className="locked-icon">🔒</div>
        )}
      </div>

      <h3 className="collection-unit-name">
        {enemy.unlocked ? enemy.name : "???"}
      </h3>

      {enemy.unlocked ? (
        <>
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

          <div className="collection-unit-status encountered">
            ⚔️ Encountered
          </div>
        </>
      ) : (
        <div className="locked-message">
          Encounter this enemy in battle to unlock!
        </div>
      )}
    </div>
  );

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
            ? collection.defenders.map(renderDefenderCard)
            : collection.enemies.map(renderEnemyCard)}
        </div>
      </div>

      <button className="back-button" onClick={closeCollection}>
        Back to Lobby
      </button>
    </div>
  );
};

export default CollectionPage;
