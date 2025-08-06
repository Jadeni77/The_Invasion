export class DrawUIs {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
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
        // Fix: Save the current context state
        ctx.save();

        // Draw energy bar
        const energyPercent =
            this.gameEngine.inGameEnergy / this.gameEngine.currentLevelConfig.initialEnergy;
        ctx.fillStyle = "#333"; // Background
        ctx.fillRect(10, 10, 200, 20);
        ctx.fillStyle = energyPercent > 0.3 ? "#4CAF50" : "#FF5722"; // Green or orange based on energy level
        ctx.fillRect(10, 10, 200 * energyPercent, 20);
        ctx.fillStyle = "#FFF"; // Text color
        ctx.font = "16px Arial";
        ctx.textAlign = "left"; // Set text alignment
        ctx.textBaseline = "middle"; // Fix text baseline
        ctx.fillText(`Energy: ${Math.floor(this.gameEngine.inGameEnergy)}`, 15, 26);

        // Draw score
        ctx.fillStyle = "#FFF";
        ctx.font = "16px Arial";
        ctx.textAlign = "right"; // Fix: Set text alignment
        ctx.textBaseline = "middle"; // Fix text baseline
        ctx.fillText(`Score: ${this.gameEngine.inGameScore}`,
                     this.gameEngine.canvasWidth - 150, 26);

        // Draw wave info
        ctx.textAlign = "center"; // Fix: Set text alignment
        ctx.textBaseline = "middle"; // Fix text baseline
        ctx.fillText(
            //  `Total Enemy Left: ${this.currentLevelConfig.totalEnemiesToSpawn}`,
            `Wave: ${this.gameEngine.waveManager.currentWave}/${this.gameEngine.currentLevelConfig.waves}`,
            this.gameEngine.canvasWidth / 2 - 50,
            20
        );

        // Draw defense line indicator
        ctx.strokeStyle = "#FF0000"; // Red line
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.gameEngine.defenseLineX, 0);
        ctx.lineTo(this.gameEngine.defenseLineX, this.gameEngine.canvasHeight);
        ctx.stroke();
        //Restore the context state
        ctx.restore();
    }
}