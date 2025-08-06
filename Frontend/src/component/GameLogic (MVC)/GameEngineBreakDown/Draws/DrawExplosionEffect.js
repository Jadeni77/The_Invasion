export class DrawExplosionEffect {
    constructor(engine) {
        this.gameEngine = engine;
    }

    drawExplosions(ctx) {
        for (const explosion of this.gameEngine.explosions) {
            const progress = explosion.timer / 30;
            const radius = explosion.radius * progress;
            const alpha = progress;

            ctx.save();

            // Different drawing styles based on explosion type
            switch (explosion.style) {
                case "burst":
                    // Grenadier style - fiery burst with particles
                    this.drawBurstExplosion(ctx, explosion, radius, alpha);
                    break;

                case "piercing":
                    // Sniper style - focused energy blast
                    this.drawPiercingExplosion(ctx, explosion, radius, alpha);
                    break;

                case "shockwave":
                    // Exploder style - expanding shockwave rings
                    this.drawShockwaveExplosion(ctx, explosion, radius, alpha);
                    break;

                case "electric":
                    // EMP style - electric discharge
                    this.drawElectricExplosion(ctx, explosion, radius, alpha);
                    break;

                default:
                    // Standard explosion
                    this.drawStandardExplosion(ctx, explosion, radius, alpha);
            }

            ctx.restore();
        }
    }

// Helper methods for different explosion styles:
    drawBurstExplosion(ctx, explosion, radius, alpha) {
        // Outer glow
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(0.3, explosion.particleColor.replace('0.8', alpha * 0.8));
        gradient.addColorStop(0.7, explosion.color.replace(')', `, ${alpha * 0.5})`).replace('rgb', 'rgba'));
        gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Particle effects
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const particleDistance = radius * 0.8;
            const px = explosion.x + Math.cos(angle) * particleDistance;
            const py = explosion.y + Math.sin(angle) * particleDistance;

            ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 3 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawPiercingExplosion(ctx, explosion, radius, alpha) {
        // Central bright core
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Energy ring
        ctx.strokeStyle = explosion.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.lineWidth = 3 * alpha;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Outer fade
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, radius * 0.3,
            explosion.x, explosion.y, radius
        );
        gradient.addColorStop(0, `rgba(220, 20, 60, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(220, 20, 60, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawShockwaveExplosion(ctx, explosion, radius, alpha) {
        // Multiple expanding rings
        for (let i = 0; i < 3; i++) {
            const ringRadius = radius * (1 - i * 0.3);
            const ringAlpha = alpha * (1 - i * 0.3);

            ctx.strokeStyle = explosion.particleColor.replace('0.9', ringAlpha);
            ctx.lineWidth = 4 * ringAlpha;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Central explosion
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, radius * 0.5
        );
        gradient.addColorStop(0, `rgba(255, 0, 255, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(148, 0, 211, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(148, 0, 211, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawElectricExplosion(ctx, explosion, radius, alpha) {
        // Electric core
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Lightning bolts
        ctx.strokeStyle = explosion.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.lineWidth = 2;

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 + (explosion.timer * 0.1);
            const endX = explosion.x + Math.cos(angle) * radius;
            const endY = explosion.y + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(explosion.x, explosion.y);

            // Create jagged lightning effect
            const segments = 4;
            for (let j = 1; j <= segments; j++) {
                const t = j / segments;
                const jx = explosion.x + (endX - explosion.x) * t + (Math.random() - 0.5) * 20 * alpha;
                const jy = explosion.y + (endY - explosion.y) * t + (Math.random() - 0.5) * 20 * alpha;
                ctx.lineTo(jx, jy);
            }

            ctx.stroke();
        }

        // Electric field
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, radius
        );
        gradient.addColorStop(0, `rgba(0, 255, 255, ${alpha * 0.4})`);
        gradient.addColorStop(0.5, `rgba(0, 200, 255, ${alpha * 0.2})`);
        gradient.addColorStop(1, `rgba(0, 255, 255, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawStandardExplosion(ctx, explosion, radius, alpha) {
        // Standard explosion with two-tone effect
        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, radius
        );

        if (explosion.innerColor) {
            gradient.addColorStop(0, explosion.innerColor.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
            gradient.addColorStop(0.4, explosion.color.replace(')', `, ${alpha * 0.8})`).replace('rgb', 'rgba'));
            gradient.addColorStop(1, explosion.color.replace(')', `, 0)`).replace('rgb', 'rgba'));
        } else {
            gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            gradient.addColorStop(0.5, explosion.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
            gradient.addColorStop(1, explosion.color.replace(')', `, 0)`).replace('rgb', 'rgba'));
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Add a bright ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
    }
}