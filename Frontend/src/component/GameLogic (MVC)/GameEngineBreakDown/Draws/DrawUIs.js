import { frameScale } from "../../Animation/FrameTime.js";
import { colors, withAlpha } from '../../../../style/tokens.js';

export class DrawUIs {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;

        //  Wave announcement system
        this.waveAnnouncement = null;
        this.announcementTimer = 0;
        this.announcementAlpha = 0;

        //  Wave countdown display
        this.waveCountdown = 0;

        //  Endless mode UI
        this.endlessWaveDisplay = 0;
        this.milestoneAnimation = null;
    }

    drawBackground(ctx) {
        // Draw sky
        ctx.fillStyle = colors.surfaceBase;
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight);

        // Draw grass (top and bottom)
        ctx.fillStyle = colors.surfacePanel;
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight * 0.4); // Top grass
        ctx.fillRect(
            0,
            this.gameEngine.canvasHeight * 0.6,
            this.gameEngine.canvasWidth,
            this.gameEngine.canvasHeight * 0.4
        ); // Bottom grass

        // Draw road
        ctx.fillStyle = colors.surfaceRaised;
        ctx.fillRect(
            0,
            this.gameEngine.canvasHeight * 0.4,
            this.gameEngine.canvasWidth,
            this.gameEngine.canvasHeight * 0.2
        );

        // Draw road markings
        ctx.fillStyle = colors.textPrimary;
        ctx.strokeStyle = colors.textPrimary;
        ctx.lineWidth = 2;
        for (let i = 20; i < this.gameEngine.canvasWidth; i += 40) {
            ctx.beginPath();
            ctx.moveTo(i, this.gameEngine.canvasHeight * 0.5 - 5);
            ctx.lineTo(i + 20, this.gameEngine.canvasHeight * 0.5 - 5);
            ctx.stroke();
        }

        // Draw defense line (right edge)
        ctx.strokeStyle = colors.accentDanger;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.gameEngine.defenseLineX - 1, 0);
        ctx.lineTo(this.gameEngine.defenseLineX - 1, this.gameEngine.canvasHeight);
        ctx.stroke();

        // Draw base building: a structure sized to the actual playfield (the
        // grid's own row count and cell size) rather than a fixed fraction of
        // canvas height, so it meets the grid exactly at every level instead
        // of drifting from it as the row count changes.
        const grid = this.gameEngine.gridManager;
        if (grid) {
            const baseX = this.gameEngine.defenseLineX;
            const baseY = grid.gridOffsetY;
            const baseWidth = this.gameEngine.canvasWidth - baseX;
            const baseHeight = grid.getRowsForLevel() * grid.gridSize;

            if (baseWidth > 0 && baseHeight > 0) {
                ctx.save();

                // Body
                ctx.fillStyle = colors.surfacePanel;
                ctx.fillRect(baseX, baseY, baseWidth, baseHeight);

                // Inner highlight on the playfield-facing edge, so the wall
                // reads as lit from the side the enemies approach from.
                ctx.fillStyle = colors.edgeHighlight;
                ctx.fillRect(baseX, baseY, 6, baseHeight);

                ctx.strokeStyle = colors.edgeOutline;
                ctx.lineWidth = 5;
                ctx.strokeRect(baseX, baseY, baseWidth, baseHeight);

                // Windows, evenly spaced down the wall regardless of how tall
                // the wall ends up being for the level's row count.
                ctx.fillStyle = colors.accentEnergy;
                const windowCount = 3;
                for (let i = 0; i < windowCount; i++) {
                    const windowY = baseY + ((i + 1) * baseHeight) / (windowCount + 1) - 10;
                    ctx.fillRect(baseX + baseWidth / 2 - 5, windowY, 10, 20);
                }

                ctx.restore();
            }
        }
    }

    /** Draws the in-game UI (energy, score, wave). */
    drawUI(ctx) {
        ctx.save();

        // Enhanced wave display for normal and endless modes
        if (this.gameEngine.currentLevelConfig?.isEndless) {
            this.drawEndlessWaveInfo(ctx);
        } else {
            this.drawNormalWaveInfo(ctx);
        }

        // Draw defense line indicator
        ctx.strokeStyle = colors.accentDanger;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.gameEngine.defenseLineX, 0);
        ctx.lineTo(this.gameEngine.defenseLineX, this.gameEngine.canvasHeight);
        ctx.stroke();

        this.drawNextWaveTimer(ctx);
        //  Draw wave announcement if active
        this.drawWaveAnnouncement(ctx);

        ctx.restore();
    }

    drawNextWaveTimer(ctx) {
        const waveManager = this.gameEngine.waveManager;
        if (!waveManager || !waveManager.getTimeUntilNextWave) return;

        const secondsUntilNext = waveManager.getTimeUntilNextWave();

        // Only show if there's time remaining and not all waves complete
        if (secondsUntilNext > 0 && !waveManager.allWavesComplete) {
            ctx.save();

            // Position in top-right corner
            const x = this.gameEngine.canvasWidth - 150;
            const y = 50;

            // Background box
            ctx.fillStyle = withAlpha(colors.edgeOutline, 0.7);
            ctx.fillRect(x - 60, y - 20, 120, 40);

            // Timer text
            ctx.font = "16px Arial";
            ctx.fillStyle = secondsUntilNext <= 5 ? colors.accentDanger : colors.textPrimary;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Next Wave: ${secondsUntilNext}s`, x, y);

            // Progress bar
            const barWidth = 100;
            const barHeight = 4;
            const barX = x - barWidth / 2;
            const barY = y + 12;

            ctx.fillStyle = withAlpha(colors.textPrimary, 0.2);
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const progress = secondsUntilNext / 30; // Assuming 30 second intervals
            ctx.fillStyle = secondsUntilNext <= 5 ? colors.accentDanger : colors.accentSuccess;
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            ctx.restore();
        }
    }

    // Fix: Draw normal mode wave info
    drawNormalWaveInfo(ctx) {
        ctx.save();

        ctx.fillStyle = colors.textPrimary;
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const waveManager = this.gameEngine.waveManager;
        if (waveManager) {
            const currentWave = waveManager.currentWave;
            const totalWaves = this.gameEngine.currentLevelConfig.waves;

            ctx.fillText(
                `Wave: ${currentWave}/${totalWaves}`,
                this.gameEngine.canvasWidth / 2,
                20
            );

            // Draw wave progress bar
            const progressWidth = 200;
            const progressX = (this.gameEngine.canvasWidth - progressWidth) / 2;
            const progressY = 35;

            ctx.fillStyle = colors.surfaceSunken;
            ctx.fillRect(progressX, progressY, progressWidth, 8);

            const progress = waveManager.waveEnemiesSpawned /
                             (this.gameEngine.currentLevelConfig.totalEnemiesToSpawn / totalWaves);
            ctx.fillStyle = colors.accentSuccess;
            ctx.fillRect(progressX, progressY, progressWidth * Math.min(1, progress), 8);
        }

        ctx.restore();
    }

    // Fix: Draw endless mode wave info
    drawEndlessWaveInfo(ctx) {
        const waveManager = this.gameEngine.waveManager;
        if (!waveManager) return;

        // Main wave counter - larger and centered
        ctx.save();
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.accentEnergy; // Gold color for endless
        ctx.strokeStyle = colors.edgeOutline;
        ctx.lineWidth = 3;

        const waveText = `ENDLESS WAVE ${waveManager.currentWave}`;
        ctx.strokeText(waveText, this.gameEngine.canvasWidth / 2, 25);
        ctx.fillText(waveText, this.gameEngine.canvasWidth / 2, 25);

        // Sub-info
        ctx.font = "14px Arial";
        ctx.fillStyle = colors.textPrimary;
        const enemiesActive = this.gameEngine.enemies.length;
        const killCount = waveManager.totalEnemiesKilled;
        ctx.fillText(
            `Enemies Active: ${enemiesActive} | Total Kills: ${killCount}`,
            this.gameEngine.canvasWidth / 2,
            45
        );

        // Milestone indicator
        if (waveManager.currentWave % 10 === 0 && waveManager.currentWave > 0) {
            this.drawMilestoneIndicator(ctx, waveManager.currentWave);
        }

        ctx.restore();
    }

    //  Add wave announcement display
    drawWaveAnnouncement(ctx) {
        if (!this.waveAnnouncement || this.announcementTimer <= 0) return;

        ctx.save();

        // Update animation
        this.announcementTimer -= frameScale();
        if (this.announcementTimer > 120) {
            // Fade in
            this.announcementAlpha = Math.min(1, this.announcementAlpha + 0.05 * frameScale());
        } else if (this.announcementTimer < 60) {
            // Fade out
            this.announcementAlpha = Math.max(0, this.announcementAlpha - 0.02 * frameScale());
        }

        ctx.globalAlpha = this.announcementAlpha;

        // Background box
        const boxWidth = 400;
        const boxHeight = 100;
        const boxX = (this.gameEngine.canvasWidth - boxWidth) / 2;
        const boxY = this.gameEngine.canvasHeight / 2 - 50;

        // Draw background with gradient
        const gradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
        if (this.waveAnnouncement.isBoss) {
            gradient.addColorStop(0, withAlpha(colors.edgeOutline, 0.9));
            gradient.addColorStop(1, withAlpha(colors.accentDanger, 0.9));
        } else {
            gradient.addColorStop(0, withAlpha(colors.edgeOutline, 0.8));
            gradient.addColorStop(1, withAlpha(colors.surfaceSunken, 0.8));
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Border
        ctx.strokeStyle = this.waveAnnouncement.isBoss ? colors.accentEnergy : colors.textPrimary;
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Text
        ctx.fillStyle = this.waveAnnouncement.isBoss ? colors.accentEnergy : colors.textPrimary;
        ctx.font = this.waveAnnouncement.isBoss ? "bold 32px Arial" : "bold 28px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            this.waveAnnouncement.title,
            this.gameEngine.canvasWidth / 2,
            boxY + 35
        );

        if (this.waveAnnouncement.subtitle) {
            ctx.font = "18px Arial";
            ctx.fillStyle = colors.textMuted;
            ctx.fillText(
                this.waveAnnouncement.subtitle,
                this.gameEngine.canvasWidth / 2,
                boxY + 65
            );
        }

        ctx.restore();

        // Clear announcement when timer expires
        if (this.announcementTimer <= 0) {
            this.waveAnnouncement = null;
            this.announcementAlpha = 0;
        }
    }

    // Fix: Draw milestone indicator for endless mode
    drawMilestoneIndicator(ctx, wave) {
        if (!this.milestoneAnimation) {
            this.milestoneAnimation = { timer: 180, pulse: 0 };
        }

        if (this.milestoneAnimation.timer > 0) {
            this.milestoneAnimation.timer -= frameScale();
            this.milestoneAnimation.pulse = Math.sin(this.milestoneAnimation.timer * 0.1) * 0.3 + 0.7;

            ctx.save();
            ctx.globalAlpha = this.milestoneAnimation.pulse;
            ctx.font = "bold 36px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = colors.accentEnergy;
            ctx.strokeStyle = colors.edgeOutline;
            ctx.lineWidth = 3;

            const text = `MILESTONE WAVE ${wave}!`;
            ctx.strokeText(text, this.gameEngine.canvasWidth / 2, 100);
            ctx.fillText(text, this.gameEngine.canvasWidth / 2, 100);
            ctx.restore();
        } else {
            this.milestoneAnimation = null;
        }
    }

    // Fix: Method to show wave announcements (called by GameEngine)
    showWaveAnnouncement(waveNumber, isBoss = false, config = {}) {
        let title = `WAVE ${waveNumber}`;
        let subtitle = "";

        if (this.gameEngine.currentLevelConfig?.isEndless) {
            title = `ENDLESS WAVE ${waveNumber}`;
            if (isBoss) {
                subtitle = "BOSS INCOMING!";
            } else if (waveNumber % 5 === 0) {
                subtitle = "Difficulty Increased!";
            }
        } else {
            if (isBoss) {
                title = `BOSS WAVE ${waveNumber}`;
                subtitle = "Defeat the boss!";
            } else if (waveNumber === 1) {
                subtitle = "Defend your base!";
            } else if (waveNumber === this.gameEngine.currentLevelConfig?.waves) {
                subtitle = "Final Wave!";
            }
        }

        this.waveAnnouncement = {
            title,
            subtitle,
            isBoss,
            ...config
        };

        this.announcementTimer = 180; // 3 seconds at 60fps
        this.announcementAlpha = 0;
    }

    // Fix: Update method to be called each frame
    update() {
        // Any per-frame UI updates can go here
        if (this.announcementTimer > 0) {
            this.announcementTimer -= frameScale();
        }

        if (this.milestoneAnimation) {
            this.milestoneAnimation.timer -= frameScale();
        }
    }

    /** Draws floating damage numbers. State-neutral. */
    drawDamageNumbers(ctx, numbers) {
        if (!numbers.length) return;
        ctx.save();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const number of numbers) {
            ctx.fillStyle = withAlpha(colors.accentDanger, number.alpha);
            ctx.strokeStyle = withAlpha(colors.edgeOutline, number.alpha);
            ctx.lineWidth = 3;
            ctx.strokeText(String(number.damage), number.x, number.y);
            ctx.fillText(String(number.damage), number.x, number.y);
        }
        ctx.restore();
    }

    /** Draws a full-screen colour flash. State-neutral. */
    drawFlash(ctx, flash) {
        if (!flash) return;
        ctx.save();
        ctx.globalAlpha = flash.alpha * 0.35;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight);
        ctx.restore();
    }
}