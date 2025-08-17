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
        this.animationSpeed = 4; //low = faster animation

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
                       'isRanged', 'attackRange', 'isMoving'];
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
        const wasAlive = this.enemy.isAlive;
        const died = this.enemy.takeDamage(amount, ignoreArmor);

        //play hit animation if there is one and enemy is alive
        if (wasAlive && this.enemy.isAlive && !this.isAnimationDeath) {
            const frames = this.animationManager.getFrames(this.enemy.name, 'hit');
            if (frames.length > 0) {
                this.playAnimation('hit', () => {
                    //return to move/idle after hit
                    this.currentAnimation = this.enemy.isMoving ? 'move' : 'idle';
                });
            }
        }
        return died;
    }

    attack(target, currentTime) {
        this.enemy.attack(target, currentTime);

        //play attack animation
        if (this.enemy.isAlive) {
            this.playAnimation('attack', () => {
                // Return to previous animation after attack
                this.currentAnimation = this.enemy.isMoving ? 'move' : 'idle';
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
        }
    }

    update(defenderUnits) {
        //dont update if deadAnimation is complete
        if (this.deathComplete) return;

        //update enemy logic
        this.enemy.update(defenderUnits);

        //handle deadth animation
        if (!this.enemy.isAlive && !this.isAnimationDeath) {
            this.isAnimationDeath = true;
            this.playAnimation('death', () => {
                this.deathComplete = true;
            });
            return;
        }

        // Update animation state based on enemy behavior
        if (!this.isAnimationDeath &&
            this.currentAnimation !== 'attack' &&
            this.currentAnimation !== 'hit') {

            const newAnimation = this.enemy.isMoving ? 'move' : 'idle';

            // Only change animation if it's different (prevents resetting mid-cycle)
            if (this.currentAnimation !== newAnimation) {
                this.currentAnimation = newAnimation;
                this.currentFrame = 0;
                this.frameTimer = 0;
            }
        }

        // //update animation base on enemy state
        // if (!this.isAnimationDeath &&
        //     this.currentAnimation !== 'attack' &&
        //     this.currentAnimation !== 'hit') {
        //
        //     if (this.enemy.isAttacking) {
        //         this.currentAnimation = 'attack'; //TODO: Check this later
        //     } else if (this.enemy.isMoving) {
        //         this.currentAnimation = 'move';
        //     } else {
        //         this.currentAnimation = 'idle';
        //     }
        // }
        this.updateAnimation();
    }

    updateAnimation() {
        const frames = this.animationManager.getFrames(this.enemy.name, this.currentAnimation);
        if (frames.length === 0) return;

        this.frameTimer++;
        if (this.frameTimer >= this.animationSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;

            //handle animation complete
            if (this.currentFrame >= frames.length) {
                if (this.currentAnimation === 'death' ||
                this.currentAnimation === 'attack' ||
                this.currentAnimation === 'hit') {
                    //non-looping animation
                    this.currentFrame = frames.length - 1;
                    if (this.onAnimationComplete) {
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
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.enemy.x, this.enemy.y, this.enemy.width, this.enemy.height);

        } else {
            //fallback to enemy default draw (the rectangle block)
            this.enemy.draw(ctx);
            return;
        }
        //draw UI element (health bar, name, etc)
        this.drawUI(ctx);
    }

    drawUI(ctx) {
        // Health bar
        if (this.enemy.health < this.enemy.maxHealth) {
            ctx.fillStyle = "red";
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, this.enemy.width, 5);
            ctx.fillStyle = "lime";
            const healthWidth = (this.enemy.health / this.enemy.maxHealth) * this.enemy.width;
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, healthWidth, 5);
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