import BasicZombieIdle from "../../../assets/enemies/Enemy3No-Move-Idle.png";
import BasicZombieMove from "../../../assets/enemies/Enemy3No-Move-Fly.png";
import BasicZombieAttack from "../../../assets/enemies/Enemy3No-Move-AttackSmashStart.png";
import BasicZombieDeath from "../../../assets/enemies/Enemy3No-Move-Die.png";

export class AnimationSources {

    enemyAnimation() {
        return {
            'Shielder': {
                idle: {
                    path: BasicZombieIdle,
                    frameCount: 1, frameWidth: 64, frameHeight: 64
                },
                move: {
                    path: BasicZombieMove,
                    frameCount: 8, frameWidth: 64, frameHeight: 64
                },
                attack: {
                    path: BasicZombieAttack,
                    frameCount: 12, frameWidth: 64, frameHeight: 64
                },
                death: {
                    path: BasicZombieDeath,
                    frameCount: 15, frameWidth: 64, frameHeight: 64
                }
            },
            'Basic Zombie': {
                idle: {
                    path: BasicZombieIdle,
                    frameCount: 1, frameWidth: 64, frameHeight: 64
                },
                move: {
                    path: BasicZombieMove,
                    frameCount: 8, frameWidth: 64, frameHeight: 64
                },
                attack: {
                    path: BasicZombieAttack,
                    frameCount: 12, frameWidth: 64, frameHeight: 64
                },
                death: {
                    path: BasicZombieDeath,
                    frameCount: 15, frameWidth: 64, frameHeight: 64
                }
            }
        };
    }
    defenderAnimation() {
        return {
            "Basic Cop": {
                idle: {
                    path: BasicZombieIdle,
                    frameCount: 1, frameWidth: 64, frameHeight: 64
                },
                attack: {
                    path: BasicZombieAttack,
                    frameCount: 12, frameWidth: 64, frameHeight: 64
                },
                death: {
                    path: BasicZombieDeath,
                    frameCount: 15, frameWidth: 64, frameHeight: 64
                }
            },

        };
    }
}