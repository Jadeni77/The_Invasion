/**
 * Wrap existing enemies with animation
 */
export class AnimatedEnemyWrapper {
    constructor(enemyClass, x, y, animationManager) {
        //create the actual enemy
        this.enemy = new enemyClass(x, y, null);
        this.animationManager = animationManager;

        //Animation states
        this.currentAnimation = 'move'; //enemy move from spawn
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animationSpeed = 8; //low = faster animation

        //state flag
        this.isAnimationAttack = false;
        this.isAnimationDeath = false;
        this.deathComplete = false;

        this.onAnimationComplete = null;

        //make the warpper to act like enemy
        this.proxyEnemyProperties();
    }

    proxyEnemyProperties() {
        //properties that game engine expect
        const props = ['x', 'y', 'width', 'height', 'isAlive', 'health', 'maxHealth',
                       'name', 'id', 'isSpawned', 'speed', 'isAttacker', 'attackDamage',
                       'isAttacking', 'gameEngine', 'shouldExplode', 'explosionRadius',
                       'isRanged', 'attackRange', 'isMoving', 'bounty'];
        props.forEach(prop => {
            Object.defineProperty(this, prop, {
                get: () => this.enemy[prop],
                set: (val) => { this.enemy[prop] = val;}
            });
        });
    }

    //delete the method to actual enemy
    setGameEngine(engine) {
        //?. can access properties that is null or undefine without causing error
        this.enemy.setGameEngine?.(engine);
    }

    takeDamage(amount, ignoreArmor) {
        const died = this.enemy.takeDamage(amount, ignoreArmor);

        if (died && !this.isAnimationDeath) {
            console.log(`💀 ${this.enemy.name} died - starting death animation`);
            this.isAnimationDeath = true;
            this.playAnimation('death', () => {
                console.log(`✓ ${this.enemy.name} death animation complete`);
                this.deathComplete = true;
            });
        }
        return died;
    }

    attack(target, currentTime) {
        if (!this.enemy.isRanged) {
            this.enemy.attack(target, currentTime);
        }
        //play attack animation
        if (this.enemy.isAlive && !this.isAnimationDeath) {
            console.log(`${this.enemy.name} is attacking - playing attack animation`);
            this.isAnimationAttack = true;
            this.playAnimation('attack', () => {
                console.log(`${this.enemy.name} attack animation complete`);
                this.isAnimationAttack = false;
            });
        }
    }

    findClosestDefender(units) {
        return this.enemy.findClosestDefender?.(units);
    }

    getDistanceTo(target) {
        return this.enemy.getDistanceTo(target);
    }

    canAttack(time) {
        return this.enemy.canAttack?.(time) || false;
    }

    playAnimation(animName, onComplete) {
        const frames = this.animationManager.getFrames(this.enemy.name, animName);
        if (frames.length > 0) {
            this.currentAnimation = animName;
            this.currentFrame = 0;
            this.frameTimer = 0;
            this.onAnimationComplete = onComplete;
            console.log(`🎬 Starting ${animName} animation for ${this.enemy.name} with ${frames.length} frames`);
        } else {
            console.warn(`No frames found for ${animName} animation of ${this.enemy.name}`);
            // If no frames, immediately complete the animation
            if (onComplete) {
                onComplete();
            }
        }
    }

    update(defenderUnits) {
        //dont update if deadAnimation is complete
        if (this.deathComplete) return;

        if (this.isAnimationDeath || this.isAnimationAttack) {
            this.updateAnimation();
            return;  // Don't update enemy logic during death
        }
        //update enemy logic
        if (this.enemy.isAlive) {
            this.enemy.update(defenderUnits);
        }
        //handle deadth animation
        if (!this.enemy.isAlive && !this.isAnimationDeath) {
            console.log(`💀 ${this.enemy.name} died during update - starting death animation`);
            this.isAnimationDeath = true;
            this.playAnimation('death', () => {
                console.log(`✓ ${this.enemy.name} death animation complete`);
                this.deathComplete = true;
            });
            this.updateAnimation();
        }

        const isCurrentlyMoving = this.enemy.isMoving;
        const isCurrentlyAttacking = this.enemy.isAttacking;

        //determine what animation to play
        let desireAnimation = 'move';
        if (isCurrentlyAttacking) {
            desireAnimation = 'attack';
        } else if (isCurrentlyMoving) {
            desireAnimation = 'move';
        }
        //animation change
        if (this.currentAnimation !== desireAnimation) {
            console.log(`${this.enemy.name} changing animation: ${this.currentAnimation} -> ${desireAnimation}`);
            this.currentAnimation = desireAnimation;
            this.currentFrame = 0;
            this.frameTimer = 0;
            this.onAnimationComplete = null;
        }

        this.updateAnimation();
    }

    updateAnimation() {
        const frames = this.animationManager.getFrames(this.enemy.name, this.currentAnimation);
        // If no frames, mark as complete if it's a death animation
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

            // Debug: Log frame progress for death animation
            if (this.currentAnimation === 'death') {
                console.log(`💀 Death frame: ${this.currentFrame}/${frames.length}`);
            }

            //handle animation complete
            if (this.currentFrame >= frames.length) {
                if (this.currentAnimation === 'death') {
                    //non-looping animation
                    this.currentFrame = frames.length - 1;
                    if (this.onAnimationComplete) {
                        console.log(`Animation ${this.currentAnimation} completed for ${this.enemy.name}`);
                        this.onAnimationComplete();
                        this.onAnimationComplete = null; // Clear callback
                    }
                } else {
                    //loop animation
                    this.currentFrame = 0;
                }
            }
        }
    }

    draw(ctx) {
        if (this.deathComplete) return;

        const frames = this.animationManager.getFrames(this.enemy.name, this.currentAnimation);

        if (frames.length > 0 && frames[this.currentFrame]) {
            //draw animate sprite
            ctx.drawImage(
                frames[this.currentFrame],
                this.enemy.x,
                this.enemy.y,
                this.enemy.width,
                this.enemy.height
            );
            //TODO: remove after bug fix
            // Debug border (remove in production)
            if (this.isAnimationDeath) {
                ctx.strokeStyle = 'yellow';  // Yellow border during death
            } else if (this.isAnimationAttack) {
                ctx.strokeStyle = 'orange';  // Orange during attack
            } else {
                ctx.strokeStyle = 'red';     // Red normally
            }
            ctx.lineWidth = 1;
            ctx.strokeRect(this.enemy.x, this.enemy.y, this.enemy.width, this.enemy.height);
        } else {
            //fallback to enemy default draw (the rectangle block)
            this.enemy.draw(ctx);
            return;
        }
        // Draw UI elements only if not dead
        if (!this.isAnimationDeath) {
            this.drawUI(ctx);
        }
    }

    drawUI(ctx) {
        // Health bar
        if (this.enemy.health < this.enemy.maxHealth) {
            ctx.fillStyle = "red";
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, this.enemy.width, 5);
            ctx.fillStyle = "lime";
            const healthWidth = (this.enemy.health / this.enemy.maxHealth) * this.enemy.width;
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, healthWidth, 5);

            // Health value (ensure it's not NaN)
            const healthValue = Math.max(0, Math.floor(this.enemy.health));
            if (!isNaN(healthValue)) {
                ctx.fillStyle = "white";
                ctx.font = "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(healthValue.toString(), this.enemy.x + this.enemy.width / 2, this.enemy.y - 15);
            }
        }

        // Name
        ctx.fillStyle = "white";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.fillText(this.enemy.name, this.enemy.x, this.enemy.y + this.enemy.height + 10);

        // Special indicators
        if (this.enemy.isSpawned) {
            ctx.save();
            ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.strokeRect(this.enemy.x - 2, this.enemy.y - 2, this.enemy.width + 4, this.enemy.height + 4);
            ctx.restore();
        }
    }
}