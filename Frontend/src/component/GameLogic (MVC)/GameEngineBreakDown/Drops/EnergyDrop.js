export class EnergyDrop {
    constructor(x, y, amount) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.radius = 15;
        this.collected = false;
        this.lifetime = 600; // 10 seconds
        this.floatOffset = 0;
        this.floatSpeed = 0.002;
        this.opacity = 1;
        this.collectAnimation = false;
        this.targetX = 0;
        this.targetY = 0;
    }

    update() {
        if (this.collectAnimation) {
            // Move towards the energy bar position
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 5) {
                this.collected = true;
                return false;
            }

            // Move towards target
            this.x += dx * 0.1;
            this.y += dy * 0.1;
            this.opacity *= 0.95;
            return true;
        }
        this.lifetime--;
        //floating animation
        this.floatOffset = Math.sin(Date.now() * this.floatSpeed) * 3;

        //energy fade out
        if (this.lifetime <= 60) {
            this.opacity = this.lifetime / 60;
        }
        return this.lifetime > 0 && !this.collected;
    }

    draw(ctx) {
        if (this.collected) return;

        const alpha = this.lifetime <= 60 ? this.lifetime / 60 : 1;

        ctx.save();

        // Glow effect
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.floatOffset, this.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
        ctx.fill();

        // Main energy orb
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.floatOffset, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Energy amount text
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`+${this.amount}`, this.x, this.y + this.floatOffset + 4);

        ctx.restore();
    }

    checkCollection(mouseX, mouseY) {
        const distance = Math.hypot(mouseX - this.x, mouseY - this.y);
        return distance <= this.radius + 10;
    }

    startCollectionAnimation(targetX, targetY ) {
        this.collectAnimation = true;
        this.targetX = targetX;
        this.targetY = targetY;
    }
}