
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

                case "rage":
                    //Berserker style - after kill
                    this.drawRageExplosion(ctx, explosion, radius, alpha);
                    break;

                case "necromancy":
                    this.drawNecromancyExplosion(ctx, explosion, radius, alpha);
                    break;
               case "slash":
                   this.drawSlashExplosion(ctx, explosion, radius, alpha);
                   break;
                case "fireball":
                    this.drawFireBallExplosion(ctx, explosion, radius, alpha);
                    break;
                case "lightning_strike":
                    this.drawLightningStrikeExplosion(ctx, explosion, radius, alpha);
                    break;
                case "earthquake":
                    //Titan style
                    this.drawEarthquakeExplosion(ctx, explosion, radius, alpha);
                    break;

                default:
                    // Standard explosion - Handles color and inner color
                    this.drawStandardExplosion(ctx, explosion, radius, alpha);
            }

            ctx.restore();
        }
    }

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

    drawRageExplosion(ctx, explosion, radius, alpha) {
        console.log("Draw Raged Effect Explosion")
        // Pulsing red aura
        const pulseRadius = radius * (1 + Math.sin(explosion.timer * 0.5) * 0.2);

        const gradient = ctx.createRadialGradient(
            explosion.x, explosion.y, 0,
            explosion.x, explosion.y, pulseRadius
        );
        gradient.addColorStop(0, `rgba(139, 0, 0, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 0, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(139, 0, 0, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Rage spikes
        const spikeCount = 6;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (Math.PI * 2 * i) / spikeCount + explosion.timer * 0.1;
            const spikeLength = radius * (0.8 + Math.sin(explosion.timer * 0.3) * 0.2);

            ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.lineWidth = 3 * alpha;
            ctx.beginPath();
            ctx.moveTo(explosion.x, explosion.y);
            ctx.lineTo(
                explosion.x + Math.cos(angle) * spikeLength,
                explosion.y + Math.sin(angle) * spikeLength
            );
            ctx.stroke();
        }
    }

    drawNecromancyExplosion(ctx, explosion, radius, alpha) {
        // Dark portal effect
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Purple energy swirl
        const swirls = 3;
        for (let i = 0; i < swirls; i++) {
            const startAngle = (Math.PI * 2 * i) / swirls + explosion.timer * 0.1;
            const endAngle = startAngle + Math.PI;

            const gradient = ctx.createLinearGradient(
                explosion.x + Math.cos(startAngle) * radius,
                explosion.y + Math.sin(startAngle) * radius,
                explosion.x + Math.cos(endAngle) * radius,
                explosion.y + Math.sin(endAngle) * radius
            );
            gradient.addColorStop(0, `rgba(148, 0, 211, 0)`);
            gradient.addColorStop(0.5, `rgba(148, 0, 211, ${alpha})`);
            gradient.addColorStop(1, `rgba(148, 0, 211, 0)`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4 * alpha;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, radius * 0.8, startAngle, endAngle);
            ctx.stroke();
        }

        // Skull symbol in center
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        ctx.font = `${20 * alpha}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💀", explosion.x, explosion.y);
    }

    drawSlashExplosion(ctx, explosion, radius, alpha) {
        // Slash marks
        const slashAngles = [-Math.PI / 4, 0, Math.PI / 4];

        for (const angle of slashAngles) {
            const startX = explosion.x - Math.cos(angle) * radius;
            const startY = explosion.y - Math.sin(angle) * radius;
            const endX = explosion.x + Math.cos(angle) * radius;
            const endY = explosion.y + Math.sin(angle) * radius;

            // Slash gradient
            const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
            gradient.addColorStop(0, `rgba(139, 0, 0, 0)`);
            gradient.addColorStop(0.3, `rgba(255, 0, 0, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
            gradient.addColorStop(0.7, `rgba(255, 0, 0, ${alpha})`);
            gradient.addColorStop(1, `rgba(139, 0, 0, 0)`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4 * alpha;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Blood splatter effect
        ctx.fillStyle = `rgba(139, 0, 0, ${alpha * 0.6})`;
        for (let i = 0; i < 5; i++) {
            const splatterX = explosion.x + (Math.random() - 0.5) * radius;
            const splatterY = explosion.y + (Math.random() - 0.5) * radius;
            const splatterSize = Math.random() * 5 * alpha;

            ctx.beginPath();
            ctx.arc(splatterX, splatterY, splatterSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawFireBallExplosion(ctx, explosion, radius, alpha) {
        // Expanding fire rings
        for (let i = 0; i < 3; i++) {
            const ringRadius = radius * (0.3 + i * 0.3);
            const ringAlpha = alpha * (1 - i * 0.3);

            const gradient = ctx.createRadialGradient(
                explosion.x, explosion.y, ringRadius * 0.8,
                explosion.x, explosion.y, ringRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 0, ${ringAlpha})`);
            gradient.addColorStop(0.5, `rgba(255, 140, 0, ${ringAlpha * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 0, 0, ${ringAlpha * 0.3})`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, ringRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Fire particles
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = radius * (0.5 + explosion.timer / 30 * 0.5);
            const px = explosion.x + Math.cos(angle) * distance;
            const py = explosion.y + Math.sin(angle) * distance - explosion.timer;

            ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 5 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawLightningStrikeExplosion(ctx, explosion, radius, alpha) {
        // Main lightning bolt from sky
        const strikeHeight = 300;
        const targetX = explosion.x;
        const targetY = explosion.y;

        // Create jagged lightning path
        ctx.save();

        // Bright core
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "rgba(138, 43, 226, 0.8)";

        ctx.beginPath();
        ctx.moveTo(targetX, targetY - strikeHeight);

        // Generate lightning path
        const segments = 8;

        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const nextY = targetY - strikeHeight + (strikeHeight * progress);
            const offsetX = (Math.random() - 0.5) * 40 * (1 - progress); // Less offset near ground

            ctx.lineTo(targetX + offsetX, nextY);
        }

        ctx.stroke();

        // Purple-blue glow
        ctx.strokeStyle = `rgba(138, 43, 226, ${alpha * 0.8})`;
        ctx.lineWidth = 8;
        ctx.stroke();

        // Outer glow
        ctx.strokeStyle = `rgba(147, 112, 219, ${alpha * 0.4})`;
        ctx.lineWidth = 16;
        ctx.stroke();

        // Impact effect at ground
        const impactGradient = ctx.createRadialGradient(
            targetX, targetY, 0,
            targetX, targetY, radius
        );
        impactGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        impactGradient.addColorStop(0.3, `rgba(138, 43, 226, ${alpha * 0.8})`);
        impactGradient.addColorStop(0.6, `rgba(147, 112, 219, ${alpha * 0.5})`);
        impactGradient.addColorStop(1, `rgba(138, 43, 226, 0)`);

        ctx.fillStyle = impactGradient;
        ctx.beginPath();
        ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Electric sparks
        const sparkCount = 6;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (Math.PI * 2 * i) / sparkCount + explosion.timer * 0.2;
            const sparkLength = radius * 0.8;

            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);

            // Small lightning branch
            const midX = targetX + Math.cos(angle) * sparkLength * 0.5;
            const midY = targetY + Math.sin(angle) * sparkLength * 0.5;
            ctx.lineTo(midX + (Math.random() - 0.5) * 20, midY + (Math.random() - 0.5) * 20);
            ctx.lineTo(
                targetX + Math.cos(angle) * sparkLength,
                targetY + Math.sin(angle) * sparkLength
            );
            ctx.stroke();
        }

        ctx.restore();
    }

    drawEarthquakeExplosion(ctx, explosion, radius, alpha) {
        // Store ground state for animation
        if (!explosion.groundCracks) {
            explosion.groundCracks = [];
            const crackCount = 12;
            for (let i = 0; i < crackCount; i++) {
                const angle = (Math.PI * 2 * i) / crackCount + Math.random() * 0.3;
                const crackLength = radius * (0.7 + Math.random() * 0.3);

                // Generate crack path
                const crack = {
                    angle: angle,
                    length: crackLength,
                    segments: []
                };

                let currentX = 0;
                let currentY = 0;
                const segmentCount = 5;

                for (let j = 0; j < segmentCount; j++) {
                    const segmentLength = crackLength / segmentCount;
                    const offsetAngle = angle + (Math.random() - 0.5) * 0.5;
                    currentX += Math.cos(offsetAngle) * segmentLength;
                    currentY += Math.sin(offsetAngle) * segmentLength;
                    crack.segments.push({ x: currentX, y: currentY });
                }

                explosion.groundCracks.push(crack);
            }
        }

        // Animation progress
        const crackProgress = Math.min(1, (30 - explosion.timer) / 10); // Cracks appear
        const healProgress = Math.max(0, (explosion.timer - 10) / 20); // Cracks heal

        // Draw ground distortion
        ctx.save();

        // Ground shake effect
        const shakeX = (Math.random() - 0.5) * 5 * alpha;
        const shakeY = (Math.random() - 0.5) * 5 * alpha;
        ctx.translate(shakeX, shakeY);

        // Draw cracks
        for (const crack of explosion.groundCracks) {
            ctx.strokeStyle = `rgba(60, 30, 0, ${alpha * (1 - healProgress)})`;
            ctx.lineWidth = (4 + Math.random() * 2) * alpha * (1 - healProgress);
            ctx.beginPath();
            ctx.moveTo(explosion.x, explosion.y);

            // Draw crack segments with animation
            for (let i = 0; i < crack.segments.length; i++) {
                const segment = crack.segments[i];
                const segmentProgress = Math.min(1, crackProgress * crack.segments.length - i);

                if (segmentProgress > 0) {
                    const x = explosion.x + segment.x * segmentProgress;
                    const y = explosion.y + segment.y * segmentProgress;
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // Dark inner crack
            ctx.strokeStyle = `rgba(20, 10, 0, ${alpha * 0.8 * (1 - healProgress)})`;
            ctx.lineWidth = 2 * alpha * (1 - healProgress);
            ctx.stroke();
        }

        // Ground ripple effect
        const rippleCount = explosion.wave + 1;
        for (let i = 0; i < rippleCount; i++) {
            const rippleRadius = radius * (0.3 + i * 0.3) * crackProgress;
            const rippleAlpha = alpha * 0.3 * (1 - i / rippleCount) * (1 - healProgress);

            ctx.strokeStyle = `rgba(139, 69, 19, ${rippleAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, rippleRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Dust and debris
        const debrisCount = 20;
        for (let i = 0; i < debrisCount; i++) {
            const angle = (Math.PI * 2 * i) / debrisCount + explosion.timer * 0.02;
            const distance = radius * (0.3 + Math.random() * 0.7) * crackProgress;
            const debrisX = explosion.x + Math.cos(angle) * distance;
            const debrisY = explosion.y + Math.sin(angle) * distance - (30 - explosion.timer) * 2;
            const size = (3 + Math.random() * 4) * alpha;

            ctx.fillStyle = `rgba(139, 69, 19, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(debrisX, debrisY, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dust cloud
        const dustGradient = ctx.createRadialGradient(
            explosion.x, explosion.y, radius * 0.2,
            explosion.x, explosion.y, radius
        );
        dustGradient.addColorStop(0, `rgba(160, 82, 45, ${alpha * 0.4})`);
        dustGradient.addColorStop(0.5, `rgba(139, 69, 19, ${alpha * 0.2})`);
        dustGradient.addColorStop(1, `rgba(160, 82, 45, 0)`);

        ctx.fillStyle = dustGradient;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}