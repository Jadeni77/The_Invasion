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

        //track to detect state
        this.wasAttacking = false;
        this.wasMoving = true;

        //make the wrapper to act like enemy
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

    //delegate the method to actual enemy
    setGameEngine(engine) {
        this.enemy.setGameEngine?.(engine);
    }

    takeDamage(amount, ignoreArmor) {
        const died = this.enemy.takeDamage(amount, ignoreArmor);

        if (died && !this.isAnimationDeath) {
            console.log(`💀 ${this.enemy.name} died from damage - starting death animation`);
            this.isAnimationDeath = true;

            // Handle game effects immediately (score, drops, etc.)
            // Comment this out temporarily to test if it's causing issues
            if (this.enemy.gameEngine) {
                this.enemy.gameEngine.handleEnemyDeath(this);
            }

            this.playAnimation('death', () => {
                console.log(`✓ ${this.enemy.name} death animation complete`);
                this.deathComplete = true;
            });
        }
        return died;
    }

    attack(target, currentTime) {
        this.enemy.attack(target, currentTime);

        //play attack animation
        if (this.enemy.isAlive && !this.isAnimationDeath) {
            console.log(`${this.enemy.name} is attacking - playing attack animation`);
            this.isAnimationAttack = true;
            this.playAnimation('attack', () => {
                console.log(`${this.enemy.name} attack animation complete`);
                this.isAnimationAttack = false;
                // Return to move animation after attack
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
            console.log(`🎬 Starting ${animName} animation for ${this.enemy.name} with ${frames.length} frames`);
        } else {
            console.warn(`❌ No frames found for ${animName} animation of ${this.enemy.name}`);
            // If no frames, immediately complete the animation
            if (onComplete) {
                onComplete();
            }
        }
    }

    update(defenderUnits) {
        // Don't update if death animation is complete
        if (this.deathComplete) {
            return;
        }

        // PRIORITY 1: Handle death animation if it's playing
        if (this.isAnimationDeath) {
            console.log(`🎬 Death animation playing for ${this.enemy.name}, updating animation`);
            this.updateAnimation();
            return;  // Don't update enemy logic during death
        }

        // PRIORITY 2: Update enemy logic only if alive
        if (this.enemy.isAlive) {
            this.enemy.update(defenderUnits);
        }

        // PRIORITY 3: Check if enemy just died (and death animation hasn't started)
        if (!this.enemy.isAlive && !this.isAnimationDeath) {
            console.log(`💀 ${this.enemy.name} died during update - starting death animation NOW`);
            this.isAnimationDeath = true;

            // Handle game effects
            if (this.enemy.gameEngine) {
                this.enemy.gameEngine.handleEnemyDeath(this);
            }

            this.playAnimation('death', () => {
                console.log(`✓ ${this.enemy.name} death animation complete`);
                this.deathComplete = true;
            });
            return; // Important: return here so we don't update other animations
        }

        // PRIORITY 4: Handle attack animations
        if (this.isAnimationAttack) {
            this.updateAnimation();
            return;
        }

        // PRIORITY 5: Handle movement/idle animations only if alive and not dying
        if (this.enemy.isAlive && !this.isAnimationDeath) {
            const isCurrentlyMoving = this.enemy.isMoving !== false;
            const isCurrentlyAttacking = this.enemy.isAttacking === true;

            // Determine what animation to play
            let desiredAnimation = 'move';
            if (isCurrentlyAttacking) {
                desiredAnimation = 'attack';
            } else if (isCurrentlyMoving) {
                desiredAnimation = 'move';
            } else {
                desiredAnimation = 'idle';
            }

            // Change animation if needed
            if (this.currentAnimation !== desiredAnimation) {
                console.log(`${this.enemy.name} changing animation: ${this.currentAnimation} -> ${desiredAnimation}`);
                this.currentAnimation = desiredAnimation;
                this.currentFrame = 0;
                this.frameTimer = 0;
                this.onAnimationComplete = null;
            }

            // Update the current animation
            this.updateAnimation();
        }
    }

    updateAnimation() {
        const frames = this.animationManager.getFrames(this.enemy.name, this.currentAnimation);

        // Log every frame update for death animation
        if (this.currentAnimation === 'death') {
            console.log(`⏱️ Death animation update - Frame: ${this.currentFrame}/${frames.length}, Timer: ${this.frameTimer}/${this.animationSpeed}`);
        }

        // If no frames, mark as complete if it's a death animation
        if (frames.length === 0) {
            console.warn(`⚠️ No frames for ${this.currentAnimation} animation of ${this.enemy.name}`);
            if (this.currentAnimation === 'death' && this.onAnimationComplete) {
                this.onAnimationComplete();
                this.onAnimationComplete = null;
            }
            return;
        }

        this.frameTimer++;

        if (this.frameTimer >= this.animationSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;

            // Log frame progress for death animation
            if (this.currentAnimation === 'death') {
                console.log(`💀 ${this.enemy.name} death frame advanced to: ${this.currentFrame}/${frames.length}`);
            }

            // Handle animation completion
            if (this.currentFrame >= frames.length) {
                if (this.currentAnimation === 'death' || this.currentAnimation === 'attack') {
                    // Non-looping animations
                    this.currentFrame = frames.length - 1;  // Stay on last frame
                    if (this.onAnimationComplete) {
                        console.log(`✅ ${this.currentAnimation} animation completed for ${this.enemy.name}`);
                        this.onAnimationComplete();
                        this.onAnimationComplete = null;
                    }
                } else {
                    // Looping animations (move, idle)
                    this.currentFrame = 0;
                }
            }
        }
    }

    draw(ctx) {
        if (this.deathComplete) {
            return;
        }

        const frames = this.animationManager.getFrames(this.enemy.name, this.currentAnimation);

        if (frames.length > 0 && frames[this.currentFrame]) {
            // Draw animated sprite
            ctx.drawImage(
                frames[this.currentFrame],
                this.enemy.x,
                this.enemy.y,
                this.enemy.width,
                this.enemy.height
            );

            // Debug info for death animation
            if (this.isAnimationDeath) {
                ctx.fillStyle = 'yellow';
                ctx.font = '12px Arial';
                ctx.fillText(`Death: ${this.currentFrame}/${frames.length}`, this.enemy.x, this.enemy.y - 20);
            }
        } else {
            // Fallback to enemy default draw
            this.enemy.draw(ctx);
            return;
        }

        // Draw UI elements only if not dead
        if (!this.isAnimationDeath) {
            this.drawUI(ctx);
        }
    }

    drawUI(ctx) {
        // Health bar - only show if damaged and alive
        if (this.enemy.health < this.enemy.maxHealth && this.enemy.health > 0) {
            ctx.fillStyle = "red";
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, this.enemy.width, 5);
            ctx.fillStyle = "lime";
            const healthWidth = Math.max(0, (this.enemy.health / this.enemy.maxHealth) * this.enemy.width);
            ctx.fillRect(this.enemy.x, this.enemy.y - 10, healthWidth, 5);

            // Health value
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