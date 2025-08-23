// src/assets/AssetManifest.js
import BasicZombieIdle from "../assets/enemies/Enemy3No-Move-Idle.png";
import BasicZombieMove from "../assets/enemies/Enemy3No-Move-Fly.png";
import BasicZombieAttack from "../assets/enemies/Enemy3No-Move-AttackSmashStart.png";
import BasicZombieDeath from "../assets/enemies/Enemy3No-Move-Die.png";

export const AssetManifest = {
    enemies: {
        'Basic Zombie': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 10, loop: false }
            }
        },
        'Fast Zombie': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 10, loop: false }
            }
        },
        'Tank Zombie': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Exploder': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Skeleton Shooter': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Shielder': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Healer': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Splitter': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Mini': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Swarm Witch': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'EMP': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Vampire': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Ghost': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Berserker': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Necromancer': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Assassin': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },
        'Mage': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 10, loop: false }
            }
        },
        'Titan': {
            sprites: {
                idle: () => BasicZombieIdle,
                move: () => BasicZombieMove,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                move: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 18 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20, loop: false }
            }
        },



        // ... more enemies
    },
    defenders: {
        'Basic Cop': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8 },
                attack: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 20 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Healer Cop': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,  // Will play when healing
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 6 },
                attack: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 10 },
                death: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Grenadier': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15 },
                death: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Barricade': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,  // Barricade doesn't attack, use idle
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                attack: { frameCount: 1, frameWidth: 64, frameHeight: 64, fps: 1 },
                death: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 12, loop: false }
            }
        },
        'Energy Generator': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,  // Doesn't attack, use idle
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 10 },
                attack: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 10 },
                death: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Sniper': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 6 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 20 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Mortar': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 4 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 10 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        'Frost Archer': {
            sprites: {
                idle: () => BasicZombieIdle,
                attack: () => BasicZombieAttack,
                death: () => BasicZombieDeath
            },
            config: {
                idle: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 4 },
                attack: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 10 },
                death: { frameCount: 15, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        }
        // ... more defenders
    }
};