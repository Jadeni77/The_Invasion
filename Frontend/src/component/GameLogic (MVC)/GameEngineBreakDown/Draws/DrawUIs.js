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
        ctx.fillStyle = "#1a3a5a";
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight);

        // Draw grass (top and bottom)
        ctx.fillStyle = "#2a5a3a";
        ctx.fillRect(0, 0, this.gameEngine.canvasWidth, this.gameEngine.canvasHeight * 0.4); // Top grass
        ctx.fillRect(
            0,
            this.gameEngine.canvasHeight * 0.6,
            this.gameEngine.canvasWidth,
            this.gameEngine.canvasHeight * 0.4
        ); // Bottom grass

        // Draw road
        ctx.fillStyle = "#5a5a5a";
        ctx.fillRect(
            0,
            this.gameEngine.canvasHeight * 0.4,
            this.gameEngine.canvasWidth,
            this.gameEngine.canvasHeight * 0.2
        );

        // Draw road markings
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        for (let i = 20; i < this.gameEngine.canvasWidth; i += 40) {
            ctx.beginPath();
            ctx.moveTo(i, this.gameEngine.canvasHeight * 0.5 - 5);
            ctx.lineTo(i + 20, this.gameEngine.canvasHeight * 0.5 - 5);
            ctx.stroke();
        }

        // Draw defense line (right edge)
        ctx.strokeStyle = "#ff3300";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.gameEngine.defenseLineX - 1, 0);
        ctx.lineTo(this.gameEngine.defenseLineX - 1, this.gameEngine.canvasHeight);
        ctx.stroke();

        // Draw base building
        ctx.fillStyle = "#8b6f4b";
        ctx.fillRect(
            this.gameEngine.defenseLineX - 30,
            this.gameEngine.canvasHeight * 0.3,
            30,
            this.gameEngine.canvasHeight * 0.4
        );

        // Draw windows
        ctx.fillStyle = "#ffcc00";
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(
                this.gameEngine.defenseLineX - 25,
                this.gameEngine.canvasHeight * 0.35 + i * 40,
                10,
                20
            );
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
        ctx.strokeStyle = "#FF0000";
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
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(x - 60, y - 20, 120, 40);

            // Timer text
            ctx.font = "16px Arial";
            ctx.fillStyle = secondsUntilNext <= 5 ? "#FF6B6B" : "#FFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Next Wave: ${secondsUntilNext}s`, x, y);

            // Progress bar
            const barWidth = 100;
            const barHeight = 4;
            const barX = x - barWidth / 2;
            const barY = y + 12;

            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const progress = secondsUntilNext / 30; // Assuming 30 second intervals
            ctx.fillStyle = secondsUntilNext <= 5 ? "#FF6B6B" : "#4CAF50";
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            ctx.restore();
        }
    }

    // Fix: Draw normal mode wave info
    drawNormalWaveInfo(ctx) {
        ctx.fillStyle = "#FFF";
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

            ctx.fillStyle = "#333";
            ctx.fillRect(progressX, progressY, progressWidth, 8);

            const progress = waveManager.waveEnemiesSpawned /
                             (this.gameEngine.currentLevelConfig.totalEnemiesToSpawn / totalWaves);
            ctx.fillStyle = "#4CAF50";
            ctx.fillRect(progressX, progressY, progressWidth * Math.min(1, progress), 8);
        }
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
        ctx.fillStyle = "#FFD700"; // Gold color for endless
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;

        const waveText = `ENDLESS WAVE ${waveManager.currentWave}`;
        ctx.strokeText(waveText, this.gameEngine.canvasWidth / 2, 25);
        ctx.fillText(waveText, this.gameEngine.canvasWidth / 2, 25);

        // Sub-info
        ctx.font = "14px Arial";
        ctx.fillStyle = "#FFF";
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
        this.announcementTimer--;
        if (this.announcementTimer > 120) {
            // Fade in
            this.announcementAlpha = Math.min(1, this.announcementAlpha + 0.05);
        } else if (this.announcementTimer < 60) {
            // Fade out
            this.announcementAlpha = Math.max(0, this.announcementAlpha - 0.02);
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
            gradient.addColorStop(0, "rgba(139, 0, 0, 0.9)");
            gradient.addColorStop(1, "rgba(255, 0, 0, 0.9)");
        } else {
            gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
            gradient.addColorStop(1, "rgba(50, 50, 50, 0.8)");
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Border
        ctx.strokeStyle = this.waveAnnouncement.isBoss ? "#FFD700" : "#FFF";
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Text
        ctx.fillStyle = this.waveAnnouncement.isBoss ? "#FFD700" : "#FFF";
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
            ctx.fillStyle = "#CCC";
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
            this.milestoneAnimation.timer--;
            this.milestoneAnimation.pulse = Math.sin(this.milestoneAnimation.timer * 0.1) * 0.3 + 0.7;

            ctx.save();
            ctx.globalAlpha = this.milestoneAnimation.pulse;
            ctx.font = "bold 36px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#000";
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
            this.announcementTimer--;
        }

        if (this.milestoneAnimation) {
            this.milestoneAnimation.timer--;
        }
    }
}