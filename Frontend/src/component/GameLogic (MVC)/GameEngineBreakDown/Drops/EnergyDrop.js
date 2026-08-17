import { frameScale } from "../../Animation/FrameTime.js";
import { canvasFont, colors, withAlpha } from '../../../../style/tokens.js';

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
            //
            // Deliberately NOT scaled by frameScale(), unlike the lifetime
            // countdown below. These are geometric decays, not linear steps: the
            // rate-correct form is `1 - Math.pow(1 - 0.1, frameScale())`, and
            // that is 0.09999999999999998 at 60fps rather than 0.1, so it would
            // fail the identity property the rest of this change is built on.
            // Nothing turns on the difference - the orb's energy is credited
            // when the animation starts, so this is the flight of an already
            // collected pickup toward the HUD. It runs about twice as fast on a
            // 120Hz display and always has.
            this.x += dx * 0.1;
            this.y += dy * 0.1;
            this.opacity *= 0.95;
            return true;
        }
        this.lifetime -= frameScale();
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
        ctx.fillStyle = withAlpha(colors.accentEnergy, alpha * 0.3);
        ctx.fill();

        // Main energy orb
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.floatOffset, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(colors.accentEnergy, alpha);
        ctx.fill();
        ctx.strokeStyle = withAlpha(colors.textPrimary, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Energy amount text
        ctx.fillStyle = withAlpha(colors.edgeOutline, alpha);
        ctx.font = canvasFont(12, "bold");
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