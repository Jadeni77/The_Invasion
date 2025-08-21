// src/assets/AssetManifest.js
import BasicZombieIdle from "../assets/enemies/Enemy3No-Move-Idle.png";
import BasicZombieMove from "../assets/enemies/Enemy3No-Move-Fly.png";
import BasicZombieAttack from "../assets/enemies/Enemy3No-Move-AttackSmashStart.png";
import BasicZombieDeath from "../assets/enemies/Enemy3No-Move-Die.png";

export const AssetManifest = {
    enemies: {
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
                idle: { frameCount: 1, frameWidth: 48, frameHeight: 48, fps: 1 },
                move: { frameCount: 10, frameWidth: 48, frameHeight: 48, fps: 18 },
                attack: { frameCount: 8, frameWidth: 48, frameHeight: 48, fps: 12 },
                death: { frameCount: 12, frameWidth: 48, frameHeight: 48, fps: 20, loop: false }
            }
        },
        // ... more enemies
    },
    defenders: {
        'Basic Cop': {
            sprites: {
                idle: () => null,
                attack: () => null,
                death: () => null
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8 },
                attack: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 12 },
                death: { frameCount: 12, frameWidth: 64, frameHeight: 64, fps: 15, loop: false }
            }
        },
        // ... more defenders
    }
};