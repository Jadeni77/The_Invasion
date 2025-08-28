// src/assets/AssetManifest.js
import BasicZombieIdle from "../assets/enemies/Enemy3No-Move-Idle.png";
import BasicZombieMove from "../assets/enemies/Enemy3No-Move-Fly.png";
import BasicZombieAttack from "../assets/enemies/Enemy3No-Move-AttackSmashStart.png";
import BasicZombieDeath from "../assets/enemies/Enemy3No-Move-Die.png";
import BasicDefenderIdle from "../assets/defender/basic-defender-idle.png"
import BasicDefenderAttack from "../assets/defender/basic-defender-attack.png"
import BasicDefenderDeath from "../assets/defender/basic-defender-death.png"
import BarricadeIdle from "../assets/defender/barricade-idle.png"
import BarricadeAttack from "../assets/defender/barricade-attack.png"
import BarricadeDeath from "../assets/defender/barricade-death.png"
import EnergyDefenderIdle from "../assets/defender/energy-defender-idle.png"
import EnergyDefenderAttack from "../assets/defender/energy-defender-attack.png"
import EnergyDeath from "../assets/defender/energy-defender-death.png"
import HealerDefenderIdle from "../assets/defender/healer-defender-idle.png"
import HealerDefenderAttack from "../assets/defender/healer-defender-attack.png"
import HealerDefenderDeath from "../assets/defender/healer-defender-death.png"
import MortarIdle from "../assets/defender/mortar-idle.png"
import MortarAttack from "../assets/defender/mortar-attack.png"
import MortarDeath from "../assets/defender/mortar-death.png"
import SniperIdle from "./defender/sniper-idle.png"
import SniperAttack from "./defender/sniper-attack.png"
import SniperDeath from "./defender/sniper-death.png"
import GrenadeIdle from "./defender/grenade-idle.png"
import GrenadeAttack from "./defender/grenade-attack.png"
import GrenadeDeath from "./defender/grenade-death.png"
import FrozenIdle from "./defender/frozen-defender-idle.png"
import FrozenAttack from "./defender/frozen-defender-attack.png"
import FrozenDeath from "./defender/frozen-defender-death.png"
import FireIdle from "./defender/fire-idle.png"
import FireAttack from "./defender/fire-attack.png"
import IceIdle from "./defender/ice-idle.png"
import IceAttack from "./defender/ice-attack.png"

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
                idle: () => BasicDefenderIdle,
                attack: () => BasicDefenderAttack,
                death: () => BasicDefenderDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 7, frameWidth: 64, frameHeight: 64, fps: 14,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 5, frameWidth: 64, frameHeight: 64, fps: 10, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Healer Cop': {
            sprites: {
                idle: () => HealerDefenderIdle,
                attack: () => HealerDefenderAttack,  // Will play when healing
                death: () => HealerDefenderDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 9, frameWidth: 64, frameHeight: 64, fps: 18,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 9, frameWidth: 64, frameHeight: 64, fps: 18, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Grenadier': {
            sprites: {
                idle: () => GrenadeIdle,
                attack: () => GrenadeAttack,
                death: () => GrenadeDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 11, frameWidth: 64, frameHeight: 64, fps: 11,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Barricade': {
            sprites: {
                idle: () => BarricadeIdle,
                attack: () => BarricadeAttack,  // Barricade doesn't attack, use idle
                death: () => BarricadeDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 6, frameWidth: 64, frameHeight: 64, fps: 6,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Energy Generator': {
            sprites: {
                idle: () => EnergyDefenderIdle,
                attack: () => EnergyDefenderAttack,  // Doesn't attack, use idle
                death: () => EnergyDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 5, frameWidth: 64, frameHeight: 64, fps: 10,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 6, frameWidth: 64, frameHeight: 64, fps: 12, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Sniper': {
            sprites: {
                idle: () => SniperIdle,
                attack: () => SniperAttack,
                death: () => SniperDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 10, frameWidth: 64, frameHeight: 64, fps: 20,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Mortar': {
            sprites: {
                idle: () => MortarIdle,
                attack: () => MortarAttack,
                death: () => MortarDeath
            },
            config: {
                idle: { frameCount: 8, frameWidth: 64, frameHeight: 64, fps: 16,
                    ropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 3, frameWidth: 64, frameHeight: 64, fps: 6 ,
                    ropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 6, frameWidth: 64, frameHeight: 64, fps: 12, loop: false,
                    ropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Frost Archer': {
            sprites: {
                idle: () => FrozenIdle,
                attack: () => FrozenAttack,
                death: () => FrozenDeath
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 9, frameWidth: 64, frameHeight: 64, fps: 18,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 9, frameWidth: 64, frameHeight: 64, fps: 18, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Fire Blast': {
            sprites: {
                idle: () => FireIdle,
                attack: () => FireAttack,  // Will play when healing
                death: () => FireAttack
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 5, frameWidth: 64, frameHeight: 64, fps: 5,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 5, frameWidth: 64, frameHeight: 64, fps: 5, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        'Ice Bomb': {
            sprites: {
                idle: () => IceIdle,
                attack: () => IceAttack,  // Will play when healing
                death: () => IceAttack
            },
            config: {
                idle: { frameCount: 4, frameWidth: 64, frameHeight: 64, fps: 8,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                attack: { frameCount: 3, frameWidth: 64, frameHeight: 64, fps: 3,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }},
                death: { frameCount: 3, frameWidth: 64, frameHeight: 64, fps: 3, loop: false,
                    cropConfig: {
                        enabled: true,
                        cropWidth: 48,   // Actual sprite size
                        cropHeight: 48,
                        offsetX: 8,      // Center offset
                        offsetY: 8
                    }}
            }
        },
        // ... more defenders
    }
};