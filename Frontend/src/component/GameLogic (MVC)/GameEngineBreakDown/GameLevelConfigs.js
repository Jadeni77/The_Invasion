export class GameLevelConfigs {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
    }

    /**
     * Defines the information for every level.
     */
    initLevelConfigs() {
        const availableEnemyTypes = ["Basic Zombie", "Fast Zombie", "Tank Zombie",
                                     "Exploder", "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                     "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                     "Berserker", "Necromancer", "Assassin", "Mage", "Titan"];
        // Tutorial Levels (1-3)
        this.gameEngine.levelConfigs.set(1, {
            levelNumber: 1,
            levelName: "The Outbreak",
            description: "The infection begins. Hold the line!",
            enemySpawnInterval: 3000,
            maxActiveEnemies: 5,
            totalEnemiesToSpawn: 15,
            waves: 3,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 5,
                    spawnInterval: 3000,
                    enemyTypes: ["Basic Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 5,
                    spawnInterval: 2500,
                    enemyTypes: ["Basic Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 5,
                    spawnInterval: 2000,
                    enemyTypes: ["Basic Zombie"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 1.0
        });

        this.gameEngine.levelConfigs.set(2, {
            levelNumber: 2,
            levelName: "Swift Danger",
            description: "Faster enemies approach!",
            enemySpawnInterval: 2500,
            maxActiveEnemies: 8,
            totalEnemiesToSpawn: 25,
            waves: 4,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 5,
                    spawnInterval: 2500,
                    enemyTypes: ["Basic Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 7,
                    spawnInterval: 2200,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 6,
                    spawnInterval: 2000,
                    enemyTypes: ["Fast Zombie"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 7,
                    spawnInterval: 1800,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "surround"
                }
            ],
            rewardMultiplier: 1.2
        });

        this.gameEngine.levelConfigs.set(3, {
            levelNumber: 3,
            levelName: "Heavy Resistance",
            description: "Armored zombies join the horde!",
            enemySpawnInterval: 2200,
            maxActiveEnemies: 10,
            totalEnemiesToSpawn: 35,
            waves: 4,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 8,
                    spawnInterval: 2200,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 2000,
                    enemyTypes: ["Basic Zombie", "Tank Zombie"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 1800,
                    enemyTypes: ["Fast Zombie", "Tank Zombie"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 1600,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie"],
                    spawnPattern: "surround"
                }
            ],
            rewardMultiplier: 1.3
        });

        // Early Game (4-7)
        this.gameEngine.levelConfigs.set(4, {
            levelNumber: 4,
            levelName: "Explosive Encounter",
            description: "Watch out for exploders!",
            enemySpawnInterval: 2000,
            maxActiveEnemies: 12,
            totalEnemiesToSpawn: 45,
            waves: 5,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 8,
                    spawnInterval: 2000,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 1800,
                    enemyTypes: ["Basic Zombie", "Exploder"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 1600,
                    enemyTypes: ["Tank Zombie", "Exploder"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 10,
                    spawnInterval: 1400,
                    enemyTypes: ["Fast Zombie", "Exploder"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 9,
                    spawnInterval: 1200,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder"],
                    spawnPattern: "surround"
                }
            ],
            rewardMultiplier: 1.5
        });

        this.gameEngine.levelConfigs.set(5, {
            levelNumber: 5,
            levelName: "Ranged Assault",
            description: "Skeleton archers attack from distance!",
            enemySpawnInterval: 1800,
            maxActiveEnemies: 14,
            totalEnemiesToSpawn: 55,
            waves: 5,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 10,
                    spawnInterval: 1800,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1600,
                    enemyTypes: ["Skeleton Shooter"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1400,
                    enemyTypes: ["Tank Zombie", "Skeleton Shooter"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 1200,
                    enemyTypes: ["Fast Zombie", "Skeleton Shooter"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1000,
                    enemyTypes: ["Basic Zombie", "Tank Zombie", "Skeleton Shooter"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 1.6
        });

        this.gameEngine.levelConfigs.set(6, {
            levelNumber: 6,
            levelName: "Shield Wall",
            description: "Shielded enemies protect the horde!",
            enemySpawnInterval: 1600,
            maxActiveEnemies: 15,
            totalEnemiesToSpawn: 65,
            waves: 6,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 10,
                    spawnInterval: 1600,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1400,
                    enemyTypes: ["Shielder", "Basic Zombie"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1200,
                    enemyTypes: ["Tank Zombie", "Shielder"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 1000,
                    enemyTypes: ["Shielder", "Exploder"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 900,
                    enemyTypes: ["Fast Zombie", "Shielder", "Exploder"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 11,
                    spawnInterval: 800,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Shielder", "Exploder"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 1.7
        });

        this.gameEngine.levelConfigs.set(7, {
            levelNumber: 7,
            levelName: "Support Squadron",
            description: "Enemy healers keep their allies alive!",
            enemySpawnInterval: 1400,
            maxActiveEnemies: 16,
            totalEnemiesToSpawn: 75,
            waves: 6,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 12,
                    spawnInterval: 1400,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 1200,
                    enemyTypes: ["Healer", "Tank Zombie"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 1000,
                    enemyTypes: ["Healer", "Skeleton Shooter"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 900,
                    enemyTypes: ["Fast Zombie", "Healer"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 800,
                    enemyTypes: ["Tank Zombie", "Healer", "Skeleton Shooter"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 700,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Healer", "Skeleton Shooter"],
                    spawnPattern: "mixed"
                }
            ],
            rewardMultiplier: 1.8
        });

        // Mid Game (8-12)
        this.gameEngine.levelConfigs.set(8, {
            levelNumber: 8,
            levelName: "Multiplication Crisis",
            description: "Enemies that split on death!",
            enemySpawnInterval: 1200,
            maxActiveEnemies: 18,
            totalEnemiesToSpawn: 85,
            waves: 7,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 12,
                    spawnInterval: 1200,
                    enemyTypes: ["Basic Zombie", "Mini"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 1000,
                    enemyTypes: ["Splitter"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 900,
                    enemyTypes: ["Splitter", "Fast Zombie"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 800,
                    enemyTypes: ["Tank Zombie", "Splitter"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 700,
                    enemyTypes: ["Mini", "Splitter"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 600,
                    enemyTypes: ["Splitter", "Mini", "Fast Zombie"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 500,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Splitter", "Mini", "Tank Zombie"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 2.0
        });

        this.gameEngine.levelConfigs.set(9, {
            levelNumber: 9,
            levelName: "Swarm Tactics",
            description: "The Swarm Witch summons minions!",
            enemySpawnInterval: 1000,
            maxActiveEnemies: 20,
            totalEnemiesToSpawn: 95,
            waves: 7,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 1000,
            waveConfigurations: [
                {
                    enemyCount: 13,
                    spawnInterval: 1000,
                    enemyTypes: ["Mini", "Fast Zombie"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 900,
                    enemyTypes: ["Swarm Witch"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 800,
                    enemyTypes: ["Swarm Witch", "Mini"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 700,
                    enemyTypes: ["Basic Zombie", "Swarm Witch"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 600,
                    enemyTypes: ["Fast Zombie", "Swarm Witch", "Mini"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 500,
                    enemyTypes: ["Swarm Witch", "Mini"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 400,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Mini", "Swarm Witch"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 2.2
        });

        this.gameEngine.levelConfigs.set(10, {
            levelNumber: 10,
            levelName: "Electromagnetic Chaos",
            description: "EMP enemies disable your defenses! Boss battle!",
            enemySpawnInterval: 900,
            maxActiveEnemies: 22,
            totalEnemiesToSpawn: 100,
            waves: 8,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 12,
                    spawnInterval: 900,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 800,
                    enemyTypes: ["EMP"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 700,
                    enemyTypes: ["Tank Zombie", "EMP"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 600,
                    enemyTypes: ["EMP", "Shielder"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 500,
                    enemyTypes: ["Fast Zombie", "EMP"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 450,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "EMP", "Shielder"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 12,
                    spawnInterval: 400,
                    enemyTypes: ["EMP", "Tank Zombie", "Shielder"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 300,
                    enemyTypes: ["Vampire"],
                    spawnPattern: "boss",
                    isBossWave: true,
                    bossType: "Vampire"
                }
            ],
            rewardMultiplier: 2.5
        });

        this.gameEngine.levelConfigs.set(11, {
            levelNumber: 11,
            levelName: "Blood Hunt",
            description: "Vampires drain life from your defenders!",
            enemySpawnInterval: 800,
            maxActiveEnemies: 24,
            totalEnemiesToSpawn: 110,
            waves: 8,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 13,
                    spawnInterval: 800,
                    enemyTypes: ["Basic Zombie", "Fast Zombie"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 700,
                    enemyTypes: ["Vampire"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 600,
                    enemyTypes: ["Vampire", "Healer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 500,
                    enemyTypes: ["Tank Zombie", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 450,
                    enemyTypes: ["Fast Zombie", "Vampire", "Healer"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 400,
                    enemyTypes: ["Vampire", "Tank Zombie"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 350,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Vampire", "Tank Zombie", "Healer"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 300,
                    enemyTypes: ["Vampire", "Healer", "Tank Zombie"],
                    spawnPattern: "mixed"
                }
            ],
            rewardMultiplier: 2.6
        });

        this.gameEngine.levelConfigs.set(12, {
            levelNumber: 12,
            levelName: "Spectral Invasion",
            description: "Ghost enemies phase through defenses!",
            enemySpawnInterval: 700,
            maxActiveEnemies: 25,
            totalEnemiesToSpawn: 120,
            waves: 9,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 13,
                    spawnInterval: 700,
                    enemyTypes: ["Fast Zombie", "Tank Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 600,
                    enemyTypes: ["Ghost"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 550,
                    enemyTypes: ["Ghost", "EMP"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 500,
                    enemyTypes: ["Tank Zombie", "Ghost"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 450,
                    enemyTypes: ["Ghost", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 400,
                    enemyTypes: ["Fast Zombie", "Ghost", "EMP"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 350,
                    enemyTypes: ["Ghost", "Tank Zombie", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 300,
                    enemyTypes: ["Fast Zombie", "Ghost", "Tank Zombie", "Vampire", "EMP"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 13,
                    spawnInterval: 250,
                    enemyTypes: ["Ghost", "Vampire", "EMP"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 2.8
        });

        // Late Game (13-17)
        this.gameEngine.levelConfigs.set(13, {
            levelNumber: 13,
            levelName: "Berserker Rage",
            description: "Berserkers get stronger as they take damage!",
            enemySpawnInterval: 600,
            maxActiveEnemies: 26,
            totalEnemiesToSpawn: 130,
            waves: 9,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 14,
                    spawnInterval: 600,
                    enemyTypes: ["Tank Zombie", "Fast Zombie"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 550,
                    enemyTypes: ["Berserker"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 500,
                    enemyTypes: ["Berserker", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 450,
                    enemyTypes: ["Tank Zombie", "Berserker"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 400,
                    enemyTypes: ["Berserker", "Ghost"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 350,
                    enemyTypes: ["Fast Zombie", "Berserker", "Vampire"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 300,
                    enemyTypes: ["Berserker", "Tank Zombie", "Ghost"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 250,
                    enemyTypes: ["Tank Zombie", "Berserker", "Fast Zombie", "Vampire", "Ghost"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 200,
                    enemyTypes: ["Berserker", "Vampire", "Ghost"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 3.0
        });

        this.gameEngine.levelConfigs.set(14, {
            levelNumber: 14,
            levelName: "Death's Army",
            description: "Necromancers resurrect fallen enemies!",
            enemySpawnInterval: 550,
            maxActiveEnemies: 28,
            totalEnemiesToSpawn: 140,
            waves: 10,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 14,
                    spawnInterval: 550,
                    enemyTypes: ["Tank Zombie", "Skeleton Shooter"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 500,
                    enemyTypes: ["Necromancer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 450,
                    enemyTypes: ["Necromancer", "Ghost"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 400,
                    enemyTypes: ["Tank Zombie", "Necromancer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 350,
                    enemyTypes: ["Necromancer", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 300,
                    enemyTypes: ["Berserker", "Necromancer"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 250,
                    enemyTypes: ["Necromancer", "Ghost", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 220,
                    enemyTypes: ["Tank Zombie", "Necromancer", "Ghost", "Vampire", "Berserker", "Skeleton Shooter"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 200,
                    enemyTypes: ["Necromancer", "Berserker"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 180,
                    enemyTypes: ["Necromancer", "Ghost", "Vampire", "Berserker"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 3.2
        });

        this.gameEngine.levelConfigs.set(15, {
            levelNumber: 15,
            levelName: "Shadow Strike",
            description: "Assassins strike from the shadows!",
            enemySpawnInterval: 500,
            maxActiveEnemies: 30,
            totalEnemiesToSpawn: 150,
            waves: 10,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 15,
                    spawnInterval: 500,
                    enemyTypes: ["Fast Zombie", "Ghost"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 450,
                    enemyTypes: ["Assassin"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 400,
                    enemyTypes: ["Assassin", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 350,
                    enemyTypes: ["Berserker", "Assassin"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 300,
                    enemyTypes: ["Assassin", "Ghost"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 280,
                    enemyTypes: ["Necromancer", "Assassin"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 250,
                    enemyTypes: ["Assassin", "Vampire", "Berserker"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 220,
                    enemyTypes: ["Fast Zombie", "Assassin", "Ghost", "Vampire", "Berserker", "Necromancer"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 200,
                    enemyTypes: ["Assassin", "Ghost", "Necromancer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 180,
                    enemyTypes: ["Assassin", "Vampire", "Berserker", "Ghost"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 3.5
        });

        this.gameEngine.levelConfigs.set(16, {
            levelNumber: 16,
            levelName: "Arcane Apocalypse",
            description: "Mages unleash devastating magic!",
            enemySpawnInterval: 450,
            maxActiveEnemies: 32,
            totalEnemiesToSpawn: 160,
            waves: 11,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 14,
                    spawnInterval: 450,
                    enemyTypes: ["Tank Zombie", "Ghost"],
                    spawnPattern: "standard"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 400,
                    enemyTypes: ["Mage"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 350,
                    enemyTypes: ["Mage", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 300,
                    enemyTypes: ["Tank Zombie", "Mage"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 280,
                    enemyTypes: ["Mage", "Necromancer"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 250,
                    enemyTypes: ["Assassin", "Mage"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 220,
                    enemyTypes: ["Mage", "Ghost", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 200,
                    enemyTypes: ["Tank Zombie", "Mage", "Ghost", "Vampire", "Necromancer", "Assassin"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 180,
                    enemyTypes: ["Mage", "Necromancer", "Assassin"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 160,
                    enemyTypes: ["Mage", "Tank Zombie", "Ghost"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 14,
                    spawnInterval: 140,
                    enemyTypes: ["Mage", "Vampire", "Necromancer", "Assassin"],
                    spawnPattern: "mixed"
                }
            ],
            rewardMultiplier: 3.8
        });

        this.gameEngine.levelConfigs.set(17, {
            levelNumber: 17,
            levelName: "Total Chaos",
            description: "All enemy types attack simultaneously!",
            enemySpawnInterval: 400,
            maxActiveEnemies: 35,
            totalEnemiesToSpawn: 180,
            waves: 12,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 15,
                    spawnInterval: 400,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 350,
                    enemyTypes: ["Exploder", "Skeleton Shooter", "Shielder"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 300,
                    enemyTypes: ["Healer", "EMP", "Splitter"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 280,
                    enemyTypes: ["Mini", "Swarm Witch", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 250,
                    enemyTypes: ["Ghost", "Berserker", "Necromancer"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 220,
                    enemyTypes: ["Assassin", "Mage", "Tank Zombie"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 200,
                    enemyTypes: ["Vampire", "Ghost", "Mage"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 180,
                    enemyTypes: ["Berserker", "Necromancer", "Assassin"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 160,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder",
                                 "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                 "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                 "Berserker", "Necromancer", "Assassin", "Mage"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 140,
                    enemyTypes: ["Mage", "Necromancer", "Vampire", "Ghost"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 120,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder",
                                 "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                 "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                 "Berserker", "Necromancer", "Assassin", "Mage", ],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 100,
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder",
                                 "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                 "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                 "Berserker", "Necromancer", "Assassin", "Mage", ],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 4.0
        });

        // End Game (18-20)
        this.gameEngine.levelConfigs.set(18, {
            levelNumber: 18,
            levelName: "Titan's Wrath",
            description: "The mighty Titan approaches!",
            enemySpawnInterval: 350,
            maxActiveEnemies: 38,
            totalEnemiesToSpawn: 200,
            waves: 13,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                {
                    enemyCount: 15,
                    spawnInterval: 350,
                    enemyTypes: ["Tank Zombie", "Berserker"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 300,
                    enemyTypes: ["Mage", "Necromancer"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 280,
                    enemyTypes: ["Ghost", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 16,
                    spawnInterval: 250,
                    enemyTypes: ["Titan"],
                    spawnPattern: "boss",
                    isBossWave: true,
                    bossType: "Titan"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 220,
                    enemyTypes: ["Tank Zombie", "Mage", "Necromancer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 200,
                    enemyTypes: ["Berserker", "Ghost", "Vampire"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 16,
                    spawnInterval: 180,
                    enemyTypes: ["Titan", "Mage"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 160,
                    enemyTypes: ["Tank Zombie", "Titan", "Mage", "Necromancer", "Berserker", "Ghost", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 16,
                    spawnInterval: 140,
                    enemyTypes: ["Titan", "Necromancer"],
                    spawnPattern: "formation"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 120,
                    enemyTypes: ["Tank Zombie", "Berserker", "Mage"],
                    spawnPattern: "rush"
                },
                {
                    enemyCount: 16,
                    spawnInterval: 100,
                    enemyTypes: ["Titan", "Ghost", "Vampire"],
                    spawnPattern: "mixed"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 80,
                    enemyTypes: ["Tank Zombie", "Titan", "Mage", "Necromancer", "Berserker", "Ghost", "Vampire"],
                    spawnPattern: "surround"
                },
                {
                    enemyCount: 15,
                    spawnInterval: 60,
                    enemyTypes: ["Titan", "Mage", "Necromancer", "Berserker"],
                    spawnPattern: "rush"
                }
            ],
            rewardMultiplier: 4.5
        });

        this.gameEngine.levelConfigs.set(19, {
            levelNumber: 19,
            levelName: "Final Stand",
            description: "The ultimate test before the endless horde!",
            enemySpawnInterval: 300,
            maxActiveEnemies: 40,
            totalEnemiesToSpawn: 250,
            waves: 15,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                // 15 increasingly difficult waves with mixed patterns
                ...Array.from({ length: 15 }, (_, i) => ({
                    enemyCount: 16 + Math.floor(i / 3),
                    spawnInterval: Math.max(60, 300 - (i * 20)),
                    enemyTypes: i < 5 ? ["Basic Enemies"] :
                                i < 10 ? ["Mid Tier Enemies"] :
                                    ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder",
                                     "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                     "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                     "Berserker", "Necromancer", "Assassin", "Mage", "Titan"],
                    spawnPattern: ["standard", "rush", "formation", "mixed", "surround"][i % 5],
                    isBossWave: i === 7 || i === 14,
                    bossType: i === 7 ? "Mage" : "Titan"
                }))
            ],
            rewardMultiplier: 5.0
        });

        this.gameEngine.levelConfigs.set(20, {
            levelNumber: 20,
            levelName: "The Omega Wave",
            description: "Face the ultimate boss and complete the campaign!",
            enemySpawnInterval: 250,
            maxActiveEnemies: 45,
            totalEnemiesToSpawn: 300,
            waves: 20,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            waveConfigurations: [
                // 20 waves culminating in an epic boss battle
                ...Array.from({ length: 19 }, (_, i) => ({
                    enemyCount: 15 + Math.floor(i / 2),
                    spawnInterval: Math.max(50, 250 - (i * 10)),
                    enemyTypes: ["Basic Zombie", "Fast Zombie", "Tank Zombie", "Exploder",
                                 "Skeleton Shooter", "Shielder", "Healer", "Splitter",
                                 "Mini", "Swarm Witch", "EMP", "Vampire", "Ghost",
                                 "Berserker", "Necromancer", "Assassin", "Mage", "Titan"],
                    spawnPattern: ["rush", "formation", "mixed", "surround"][i % 4],
                    isBossWave: (i + 1) % 5 === 0,
                    bossType: ["Vampire", "Mage", "Necromancer", "Titan"][(i / 5) | 0]
                })),
                // Final boss wave
                {
                    enemyCount: 30,
                    spawnInterval: 40,
                    enemyTypes: ["Titan", "Mage", "Necromancer", "Vampire", "Berserker"],
                    spawnPattern: "boss",
                    isBossWave: true,
                    bossType: "Titan",
                    finalBoss: true
                }
            ],
            rewardMultiplier: 10.0
        });

        // Endless Mode
        this.gameEngine.levelConfigs.set(999, {
            levelNumber: 999,
            levelName: "Endless Survival",
            description: "How long can you survive the endless horde?",
            enemySpawnInterval: 1000,
            maxActiveEnemies: 50,
            totalEnemiesToSpawn: Infinity,
            waves: Infinity,
            isEndless: true,
            availableEnemyTypes: availableEnemyTypes,
            initialEnergy: 120,
            // Wave configurations will be generated dynamically by the WaveManager
            waveConfigurations: null,
            rewardMultiplier: 1.0, // Increases with each wave
            endlessConfig: {
                startingDifficulty: 1,
                difficultyIncreaseRate: 0.1,
                maxDifficulty: 10,
                waveRewardBase: 50,
                waveRewardMultiplier: 1.1
            }
        });
    }
    
    
}