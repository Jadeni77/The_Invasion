/**
 * This class represent the grid cells of the in game board. Including
 * importance of initializing a grid and resetting a grid.
 */
export class GridManager {
    constructor(canvasWidth, canvasHeight) {
        this.gridSize = 64;
        this.deploymentGrid = [];
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.highlightGrid = false;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        this.leftMargin = 80;  // Space for UI/zombies to spawn
        this.rightMargin = 60; // Space before defense line
        this.topMargin = 60;   // Space for top UI
        this.bottomMargin = 40; // Space for bottom UI
    }

    /**
     * Initialize the grid system in the game board
     */
    initializeGrid() {
        const availableWidth = this.canvasWidth - this.leftMargin - this.rightMargin;
        const availableHeight = this.canvasHeight - this.topMargin - this.bottomMargin;

        const targetCols = 9;
        const targetRows = 6;

        // Calculate grid size based on available space
        this.gridSize = Math.min(
            Math.floor(availableWidth / targetCols),
            Math.floor(availableHeight / targetRows),
            80  // Maximum grid size cap
        );

        // Recalculate actual columns and rows based on final grid size
        const cols = Math.floor(availableWidth / this.gridSize);
        const rows = Math.min(targetRows, Math.floor(availableHeight / this.gridSize));

        // Center the grid in the available space
        const totalGridWidth = cols * this.gridSize;
        const totalGridHeight = rows * this.gridSize;

        this.gridOffsetX = this.leftMargin + (availableWidth - totalGridWidth) / 2;
        this.gridOffsetY = this.topMargin + (availableHeight - totalGridHeight) / 2;

        this.deploymentGrid = [];

        for (let row = 0; row < rows; row++) {
            const gridRow = [];
            for (let col = 0; col < cols; col++) {
                // Mark leftmost columns as "road" (where enemies walk)
           //     const isRoad = col < 2;  // First 2 columns are for enemy path

                gridRow.push({
                                 x: this.gridOffsetX + col * this.gridSize,
                                 y: this.gridOffsetY + row * this.gridSize,
                                 occupied: false,
                             //    isRoad: isRoad, //enemy path
                                 row: row,
                                 col: col,
                             });
            }
            this.deploymentGrid.push(gridRow);
        }
    }

    /**
     * Return the specific grid cell from the given x and y coordinate
     * @param x the x position of the wanted grid cell
     * @param y the y position of the wanted grid cell
     * @returns {*|null} if a grid cell is not found
     */
    getGridCell(x, y) {
        if (x < this.gridOffsetX || y < this.gridOffsetY) return null;

        //can be adjusted to cover full screen for the col
        const col = Math.floor((x - this.gridOffsetX) / this.gridSize);
        const row = Math.floor((y - this.gridOffsetY) / this.gridSize);

        if (row >= 0 && row < this.deploymentGrid.length &&
            col >= 0 && col < this.deploymentGrid[0].length) {
            const cell = this.deploymentGrid[row][col];
            // if (cell.isRoad) {
            //     console.log("Cannot deploy on road cell");
            //     return null;
            // }
            return cell;
        }
        return null;
    }

    /**
     * Reset the grid to remove all the occupied cells
     */
    resetGrid() {
        if (this.deploymentGrid.length > 0) {
            for (let row of this.deploymentGrid) {
                for (let cell of row) {
                    cell.occupied = false;
                }
            }
        }
    }

    /**
     * The rectangular grid cell drawing - PvZ style
     * @param ctx the given context to be drawn on
     */
    drawGrid(ctx) {
        ctx.save();

        // Draw all grid cells
        for (let row of this.deploymentGrid) {
            for (let cell of row) {
                // Different styling for road vs deployable cells
                if (cell.isRoad) {
                    // Road cells (enemy path) - darker/different color
                    ctx.strokeStyle = "rgba(150, 150, 150, 0.15)";
                    ctx.fillStyle = "rgba(100, 100, 100, 0.05)";
                    ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                } else {
                    // Deployable cells
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";

                    // Highlight occupied cells
                    if (cell.occupied) {
                        ctx.fillStyle = "rgba(255, 100, 100, 0.15)";
                        ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                    }

                    // If player is selecting a card, highlight valid cells
                    if (this.highlightGrid && !cell.occupied) {
                        ctx.fillStyle = "rgba(100, 255, 100, 0.25)";
                        ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                    }
                }

                // Draw grid lines
                ctx.lineWidth = 1;
                ctx.strokeRect(cell.x, cell.y, this.gridSize, this.gridSize);
            }
        }

        // Draw row separators (stronger lines between rows like PvZ)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        for (let row = 0; row <= this.deploymentGrid.length; row++) {
            const y = this.gridOffsetY + row * this.gridSize;
            ctx.beginPath();
            ctx.moveTo(this.gridOffsetX, y);
            ctx.lineTo(this.gridOffsetX + this.deploymentGrid[0].length * this.gridSize, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Logic to calculate a random row for which enemy will spawn on
     * @returns {number} the randomize row in which enemy will spawn on
     */
    getRandomSpawnY() {
        if (this.deploymentGrid.length === 0) return 100;
        const randomRow = Math.floor(Math.random() * this.deploymentGrid.length);
        return this.gridOffsetY + randomRow * this.gridSize + this.gridSize / 2;

    }

    /**
     * Get the leftmost position where enemies start (off-screen)
     * @returns {number} X position for enemy spawn
     */
    getEnemySpawnX() {
        return -100;  // Spawn off-screen to the left
    }

    /**
     * Check if a position is within a road cell (for enemy pathing)
     * @param x X position
     * @param y Y position
     * @returns {boolean} true if position is on road
     */
    // isOnRoad(x, y) {
    //     const col = Math.floor((x - this.gridOffsetX) / this.gridSize);
    //     const row = Math.floor((y - this.gridOffsetY) / this.gridSize);
    //
    //     if (row >= 0 && row < this.deploymentGrid.length &&
    //         col >= 0 && col < this.deploymentGrid[0].length) {
    //         return this.deploymentGrid[row][col].isRoad;
    //     }
    //     return false;
    // }

    /**
     * Get all cells in a specific row (for AOE effects, etc.)
     * @param rowIndex The row index
     * @returns {Array} Array of cells in that row
     */
    getRowCells(rowIndex) {
        if (rowIndex >= 0 && rowIndex < this.deploymentGrid.length) {
            return this.deploymentGrid[rowIndex];
        }
        return [];
    }

    /**
     * Get the row index for a Y position
     * @param y Y position
     * @returns {number} Row index, or -1 if not in grid
     */
    getRowFromY(y) {
        const row = Math.floor((y - this.gridOffsetY) / this.gridSize);
        if (row >= 0 && row < this.deploymentGrid.length) {
            return row;
        }
        return -1;
    }

}