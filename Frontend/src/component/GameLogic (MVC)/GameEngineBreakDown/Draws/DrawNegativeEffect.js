export class DrawNegativeEffect {
    constructor(unit) {
        this.unit = unit;
    }


    drawAllEffect(ctx) {
        if (this.unit.disabled) {
            this.drawDisabledEffect(ctx);
        }
        if (this.unit.burning) {
            this.drawBurningEffect(ctx);
        }
        if (this.unit.isSpawned) {
            this.drawSpawnedEffect(ctx);
        }
        if (this.unit.frozen) {
            this.drawFrozenEffect(ctx);
        }
        if (this.unit.slowed) {
            this.drawSlowedEffect(ctx);
        }
    }

    drawBurningEffect(ctx) {
        ctx.save();

        //  Fire glow aura around the unit
        const glowRadius = Math.max(this.unit.width, this.unit.height) * 0.8;
        const glowGradient = ctx.createRadialGradient(
            this.unit.x + this.unit.width / 2,
            this.unit.y + this.unit.height / 2,
            0,
            this.unit.x + this.unit.width / 2,
            this.unit.y + this.unit.height / 2,
            glowRadius
        );
        glowGradient.addColorStop(0, "rgba(255, 100, 0, 0.4)");
        glowGradient.addColorStop(0.5, "rgba(255, 69, 0, 0.3)");
        glowGradient.addColorStop(1, "rgba(255, 0, 0, 0)");

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(
            this.unit.x + this.unit.width / 2,
            this.unit.y + this.unit.height / 2,
            glowRadius,
            0,
            Math.PI * 2
        );
        ctx.fill();

        //  Animated flame sprites at the bottom of the unit
        const flameCount = 3;
        const time = Date.now() / 100;

        for (let i = 0; i < flameCount; i++) {
            const flameX = this.unit.x + (this.unit.width / (flameCount + 1)) * (i + 1);
            const flameBaseY = this.unit.y + this.unit.height;

            // Flame shape with animation
            const flameHeight = 15 + Math.sin(time + i * 2) * 5;
            const flameWidth = 8 + Math.sin(time + i * 1.5) * 2;

            // Flame gradient
            const flameGradient = ctx.createLinearGradient(
                flameX,
                flameBaseY,
                flameX,
                flameBaseY - flameHeight
            );
            flameGradient.addColorStop(0, "rgba(255, 200, 0, 0.8)");
            flameGradient.addColorStop(0.3, "rgba(255, 100, 0, 0.8)");
            flameGradient.addColorStop(0.6, "rgba(255, 0, 0, 0.6)");
            flameGradient.addColorStop(1, "rgba(255, 0, 0, 0)");

            ctx.fillStyle = flameGradient;
            ctx.beginPath();

            // Draw teardrop-shaped flame
            ctx.moveTo(flameX, flameBaseY);
            ctx.quadraticCurveTo(
                flameX - flameWidth,
                flameBaseY - flameHeight * 0.5,
                flameX,
                flameBaseY - flameHeight
            );
            ctx.quadraticCurveTo(
                flameX + flameWidth,
                flameBaseY - flameHeight * 0.5,
                flameX,
                flameBaseY
            );
            ctx.fill();
        }

        // Ember particles floating upward
        const emberCount = 5;
        for (let i = 0; i < emberCount; i++) {
            const emberTime = (time * 2 + i * 3) % 30;
            const emberProgress = emberTime / 30;

            if (emberProgress < 1) {
                const emberX = this.unit.x + Math.random() * this.unit.width;
                const emberY = this.unit.y + this.unit.height - emberProgress * (this.unit.height + 20);
                const emberSize = 2 + Math.random() * 2;
                const emberAlpha = 1 - emberProgress;

                // Ember glow
                ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${emberAlpha})`;
                ctx.beginPath();
                ctx.arc(emberX, emberY, emberSize, 0, Math.PI * 2);
                ctx.fill();

                // Bright center
                ctx.fillStyle = `rgba(255, 255, 200, ${emberAlpha})`;
                ctx.beginPath();
                ctx.arc(emberX, emberY, emberSize * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        //  Unit overlay effect - makes the unit appear slightly reddish
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(255, 100, 50, 0.3)";
        ctx.fillRect(this.unit.x, this.unit.y, this.unit.width, this.unit.height);

        ctx.restore();
    }

    drawDisabledEffect(ctx) {
        console.log(`The unt is disabled: ${this.unit.disabled}`)
        ctx.save();

        // 1. Static/interference effect
        const staticSize = 2;
        for (let x = this.unit.x; x < this.unit.x + this.unit.width; x += staticSize * 2) {
            for (let y = this.unit.y; y < this.unit.y + this.unit.height; y += staticSize * 2) {
                if (Math.random() > 0.5) {
                    ctx.fillStyle = `rgba(150, 150, 150, ${Math.random() * 0.4 + 0.2})`;
                    ctx.fillRect(x, y, staticSize, staticSize);
                }
            }
        }

        // 2. Electric shock waves (for EMP effect)
        const shockTime = Date.now() / 100;
        ctx.strokeStyle = "rgba(0, 200, 255, 0.6)";
        ctx.lineWidth = 2;

        // Draw electric arcs
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(this.unit.x, this.unit.y + Math.random() * this.unit.height);

            let currentX = this.unit.x;
            for (let j = 0; j < 5; j++) {
                currentX += this.unit.width / 5;
                const currentY = this.unit.y + Math.random() * this.unit.height;
                ctx.lineTo(currentX, currentY);
            }

            ctx.globalAlpha = Math.random() * 0.5 + 0.3;
            ctx.stroke();
        }

        // 3. Glitch effect - displaced color channels
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.6;

        // Red channel offset
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fillRect(this.unit.x - 2, this.unit.y - 1, this.unit.width, this.unit.height);

        // Blue channel offset
        ctx.fillStyle = "rgba(0, 0, 255, 0.3)";
        ctx.fillRect(this.unit.x + 2, this.unit.y + 1, this.unit.width, this.unit.height);

        ctx.globalCompositeOperation = "source-over";

        // 4. Warning symbol
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "yellow";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;

        // Draw warning triangle
        const centerX = this.unit.x + this.unit.width / 2;
        const centerY = this.unit.y + this.unit.height / 2;
        const size = Math.min(this.unit.width, this.unit.height) * 0.3;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX - size * 0.866, centerY + size * 0.5);
        ctx.lineTo(centerX + size * 0.866, centerY + size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Exclamation mark
        ctx.fillStyle = "black";
        ctx.font = `bold ${size}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", centerX, centerY);

        // 5. Pulsing border
        const pulseAlpha = (Math.sin(shockTime) + 1) / 2 * 0.6 + 0.2;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = shockTime * 2;
        ctx.strokeRect(this.unit.x - 2, this.unit.y - 2, this.unit.width + 4, this.unit.height + 4);

        // 6. "DISABLED" text (optional - only for larger units)
        if (this.unit.width > 40) {
            ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("DISABLED", centerX, this.unit.y + this.unit.height + 20);
        }

        ctx.restore();
    }

    drawSpawnedEffect(ctx) {
        ctx.save();
        // Pulsing purple diamond above the enemy's head — no bounding rectangle
        const pulse = 0.6 + Math.sin(Date.now() / 200) * 0.2;
        ctx.fillStyle = `rgba(200, 60, 255, ${pulse})`;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("◈", this.unit.x + this.unit.width / 2, this.unit.y );
        ctx.strokeText("◈", this.unit.x + this.unit.width / 2, this.unit.y );
        ctx.restore();
    }

    drawFrozenEffect(ctx) {
        ctx.save();
        ctx.strokeStyle = "lightblue";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        ctx.strokeRect(this.unit.x - 2, this.unit.y - 2, this.unit.width + 4, this.unit.height + 4);

        // Ice crystals
        ctx.fillStyle = "rgba(173, 216, 230, 0.8)";
        for (let i = 0; i < 3; i++) {
            const x = this.unit.x + Math.random() * this.unit.width;
            const y = this.unit.y + Math.random() * this.unit.height;
            ctx.fillRect(x, y, 4, 4);
        }
        ctx.restore();
    }

    drawSlowedEffect(ctx) {
        ctx.save();
        ctx.fillStyle = "rgba(173, 216, 230, 0.3)";
        ctx.fillRect(this.unit.x, this.unit.y, this.unit.width, this.unit.height);

        // Snowflake icon above
        ctx.fillStyle = "lightblue";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("❄", this.unit.x + this.unit.width / 2, this.unit.y - 5);
        ctx.restore();
    }
}