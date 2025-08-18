import {DrawNegativeEffect} from "../GameEngineBreakDown/Draws/DrawNegativeEffect.js";

/**
 * Wrap existing defenders with animation.
 */
export class AnimatedDefenderWrapper {
    constructor(defenderClass, x, y, cardData, animationManager) {
        this.defender = new defenderClass(x, y, cardData);
        this.animationManager = animationManager;

        //animation state
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animationSpeed = 8;

        //state flag
        this.isAnimationAttack = false;
        this.isAnimationDeath = false;
        this.deathComplete = false;

        this.onAnimationComplete = null;

        this.drawNegativeEffect = new DrawNegativeEffect(this.defender);

        this.proxyDefenderProperties();
    }

    proxyDefenderProperties() {
        const props = ['x', 'y', 'width', 'height', 'isAlive', 'health', 'maxHealth',
                       'name', 'id', 'range', 'attackDamage', 'fireRate', 'cost',
                       'isRanged', 'gameEngine', 'disabled', 'disabledDuration',
                       'lastAttackTime', 'level'];
        props.forEach(prop => {
            Object.defineProperty(this, prop, {
                get: () => this.defender[prop],
                set: (val) => {
                    this.defender[prop] = val;
                }
            });
        });
    }

    setGameEngine(engine) {
        this.defender.setGameEngine?.(engine);
    }

    takeDamage(amount) {
        const died = this.defender.takeDamage(amount);

        if (died && !this.isAnimationDeath) {
            this.isAnimationDeath = true;
            this.playAnimation('death', () => {
                console.log(`✓ ${this.defender.name} death animation complete`);
                this.deathComplete = true;
            })
        }
        return died;
    }

    attack(target, currentTime) {
        if (!this.defender.isRanged || this.defender.useProjectile === false) {
            this.defender.attack(target, currentTime);
        }
        //play attack animation
        if (this.defender.isAlive && !this.isAnimationDeath && !this.isAnimationAttack) {
            this.isAnimationAttack = true;
            this.playAnimation('attack', () => {
                console.log(`${this.defender.name} attack animation complete`);
                this.isAnimationAttack = false;
                this.currentAnimation = 'idle';
                this.currentFrame = 0;
                this.frameTimer = 0;
            });
        }
        this.defender.lastAttackTime = currentTime;
    }

    canAttack(currentTime) {
        return this.defender.canAttack(currentTime);
    }

    applyLevelUpgrades() {
        this.defender.applyLevelUpgrades();
    }

    getUpgradeInfo() {
        this.defender.getUpgradeInfo();
    }

    playAnimation(animName, onComplete) {
        const frames = this.animationManager.getFrames(this.defender.name, animName);
        if (frames.length > 0) {
            this.currentAnimation = animName;
            this.currentFrame = 0;
            this.frameTimer = 0;
            this.onAnimationComplete = onComplete;
        } else {
            if (onComplete) {
                onComplete();
            }
        }
    }

    update(enemies, defenderUnits) {
        if (this.deathComplete) {
            return;
        }

        this.defender.update(enemies, defenderUnits);

        //handle death animation
        if (!this.defender.isAlive && !this.isAnimationDeath) {
            this.isAnimationDeath = true;
            this.playAnimation('death', () => {
                console.log(`Death Animation for ${this.defender.name} is complete`);
                this.deathComplete = true;
            });
        }

        // Don't change animation state if death or attack animation is playing
        if (this.isAnimationDeath || this.isAnimationAttack) {
            this.updateAnimation();
            return;
        }

        //defender are idling or attacking
        if (!this.isAnimationDeath && this.currentAnimation !== 'attack') {
            this.currentAnimation = 'idle';
        }
        //update animation frames
        this.updateAnimation();
    }

    updateAnimation() {
        const frames = this.animationManager.getFrames(this.defender.name, this.currentAnimation);
        if (frames.length === 0) {
            if (this.currentAnimation === 'death' && this.onAnimationComplete) {
                this.onAnimationComplete();
                this.onAnimationComplete = null;
                console.log("UpdateAnimation() with no frame");
            }
            return;
        }
        this.frameTimer++;
        if (this.frameTimer >= this.animationSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;

            //handle animation complete
            if (this.currentFrame >= frames.length) {
                if (this.currentAnimation === 'death') {
                    //non-looping animation
                    this.currentFrame = frames.length - 1;
                    this.onAnimationComplete();
                    this.onAnimationComplete = null;
                } else {
                    this.currentFrame = 0;
                }
            }
        }
    }


    draw(ctx) {
        if (this.deathComplete) return;

        const frames = this.animationManager.getFrames(this.defender.name, this.currentAnimation);

        if (frames.length > 0 && frames[this.currentFrame]) {
            // Draw animated sprite
            ctx.drawImage(
                frames[this.currentFrame],
                this.defender.x,
                this.defender.y,
                this.defender.width,
                this.defender.height
            );
        } else {
            // Fallback to defender's default draw
            this.defender.draw(ctx);
            return;
        }

        // Draw UI elements (health bar, etc)
        if (!this.isAnimationDeath) {
            this.drawUI(ctx);
        }
        // Draw special effects that aren't animated (disabled, burning, etc)
        this.drawNegativeEffect.drawAllEffect(ctx);
    }

    drawUI(ctx) {
        // Unit name
        ctx.fillStyle = "black";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
            this.defender.name.substring(0, 8),
            this.defender.x + 2,
            this.defender.y + this.defender.height + 15
        );

        // Health bar
        if (this.defender.health < this.defender.maxHealth) {
            ctx.fillStyle = "red";
            ctx.fillRect(this.defender.x, this.defender.y - 10, this.defender.width, 5);
            ctx.fillStyle = "lime";
            const healthWidth = (this.defender.health / this.defender.maxHealth) * this.defender.width;
            ctx.fillRect(this.defender.x, this.defender.y - 10, healthWidth, 5);

            // Health value (ensure it's not NaN)
            const healthValue = Math.max(0, Math.floor(this.defender.health));
            if (!isNaN(healthValue)) {
                ctx.fillStyle = "white";
                ctx.font = "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(healthValue.toString(), this.defender.x + this.defender.width / 2, this.defender.y - 15);
            }
        }
    }
}