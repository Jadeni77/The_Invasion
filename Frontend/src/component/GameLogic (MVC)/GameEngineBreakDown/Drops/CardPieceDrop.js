/**
 * This class represent the card pieces that will drop during the
 * game when a zombie died. The card pieces are useful for upgrading
 * cards as if the current upgrading seem pretty easy and straightforward
 */
export class CardPieceDrop {
    constructor(x, y, cardName) {
        this.x = x;
        this.y = y;
        this.cardName = cardName;
        this.radius = 12;
        this.collected = false;
        this.lifetime = 480; //8 sec
        this.floatOffset = 0;
        this.floatSpeed = 0.003;
        this.opacity = 1;
        this.collectAnimation = false;
        this.targetX = 0;
        this.targetY = 0;
    }

    update() {
        if (this.collectAnimation) {
            //move toward card collection area
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 5) {
                this.collected = true;
                return false;
            }

            //move toward target
            this.x += dx * 0.15;
            this.y += dy * 0.15;
            this.opacity *= 0.92;
            return true;
        }

        this.lifetime--;
        //floating animation
        this.floatOffset = Math.sin(Date.now() * this.floatSpeed) * 4;

        if (this.lifetime <= 60) {
            this.opacity = this.lifetime / 60;
        }
        return this.lifetime > 0 && !this.collected;
    }

    draw(ctx) {
        if (this.collected) return;

        const alpha = this.opacity;

        ctx.save();

        // Glow effect
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.floatOffset, this.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 0, 211, ${alpha * 0.3})`; // Purple glow
        ctx.fill();

        // Main card piece orb
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.floatOffset, this.radius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
            this.x, this.y + this.floatOffset, 0,
            this.x, this.y + this.floatOffset, this.radius
        );
        gradient.addColorStop(0, `rgba(186, 85, 211, ${alpha})`); // Light purple
        gradient.addColorStop(1, `rgba(138, 43, 226, ${alpha})`); // Blue violet
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Card icon/symbol
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("⬟", this.x, this.y + this.floatOffset + 3);

        ctx.restore();
    }

    checkCollection(mouseX, mouseY) {
        const distance = Math.hypot(mouseX - this.x, mouseY - this.y);
        return distance <= this.radius + 10;

    }

    startCollectionAnimation(targetX, targetY) {
        this.collectAnimation = true;
        this.targetX = targetX;
        this.targetY = targetY;
    }
}