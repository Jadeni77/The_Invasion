import { colors, withAlpha } from '../../../../style/tokens.js';

/**
 * The post-crop frame size of a defender sprite. AssetManifest.defenders
 * crops every animation frame down to 48x48 (see each entry's cropConfig),
 * uniformly across all defender types and animations.
 */
export const SPRITE_NATIVE_PX = 48;

/**
 * The native frame size of an enemy sprite. AssetManifest.enemies carries no
 * cropConfig at all - enemy frames are drawn at their raw imported size,
 * which is not uniform: frame width varies by enemy type from 64 to 100px
 * (e.g. Basic Zombie's attack sheet is 80x64), but frame height is 64px for
 * every enemy animation in the manifest. 64 is the one invariant across the
 * whole enemy roster, so it is the number the enemy-side integer scale is
 * built on.
 */
export const ENEMY_NATIVE_PX = 64;

/**
 * Cells never go below the larger of the two native sizes, so neither side's
 * art ever has to draw smaller than its own native frame (which would force
 * upscaling past 1x) nor overflow the cell (which a too-small floor would
 * allow for whichever side has the bigger native size). Pixel art at a
 * fractional scale gives uneven pixel rows, which is what this exists to
 * prevent.
 */
export const MIN_CELL_PX = Math.max(SPRITE_NATIVE_PX, ENEMY_NATIVE_PX);

/**
 * This class represent the grid cells of the in game board. Including
 * importance of initializing a grid and resetting a grid.
 */
export class GridManager {
    constructor(canvasWidth, canvasHeight, levelNumber = 1) {
        this.gridSize = 60;
        this.deploymentGrid = [];
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.highlightGrid = false;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.levelNumber = levelNumber;

        this.leftMargin = 80;  // Space for UI/zombies to spawn
        this.rightMargin = 60; // Space before defense line
        this.topMargin = 60;   // Space for top UI
        this.bottomMargin = 40; // Space for bottom UI
    }

    getRowsForLevel() {
        if (this.levelNumber  === 1) {
            return 1;
        } else if (this.levelNumber === 2) {
            return 2;
        } if (this.levelNumber  === 3) {
            return 3;
        } else if (this.levelNumber === 4) {
            return 4;
        } else if (this.levelNumber  === 5) {
            return 5;
        } else {
            return 6;
        }
    }

    /**
     * Initialize the grid system in the game board
     */
    initializeGrid() {
        const availableWidth = this.canvasWidth - this.leftMargin - this.rightMargin;
        const availableHeight = this.canvasHeight - this.topMargin - this.bottomMargin;

        const cols = 9;
        const rows = this.getRowsForLevel();

        // Calculate grid size based on available space
        this.gridSize = Math.min(
            Math.floor(availableWidth / cols),
            Math.floor(availableHeight / rows),
            80  // Maximum grid size cap
        );

        if (this.gridSize < MIN_CELL_PX) {
            this.gridSize = MIN_CELL_PX; // never smaller than the largest native sprite it holds
        }

        // Center the grid in the available space
        const totalGridWidth = cols * this.gridSize;
        const totalGridHeight = rows * this.gridSize;

        this.gridOffsetX = this.leftMargin + (availableWidth - totalGridWidth) / 2;
        this.gridOffsetY = this.topMargin + (availableHeight - totalGridHeight) / 2;

        this.deploymentGrid = [];

        for (let row = 0; row < rows; row++) {
            const gridRow = [];
            for (let col = 0; col < cols; col++) {
                gridRow.push({
                                 x: this.gridOffsetX + col * this.gridSize,
                                 y: this.gridOffsetY + row * this.gridSize,
                                 occupied: false,
                                 row: row,
                                 col: col,
                             });
            }
            this.deploymentGrid.push(gridRow);
        }
    }

    setLevel(levelNumber) {
        if (this.levelNumber !== levelNumber) {
            this.levelNumber = levelNumber;
            this.initializeGrid();
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
            return this.deploymentGrid[row][col];
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
                // Base grid styling
                ctx.strokeStyle = withAlpha(colors.textPrimary, 0.2);
                ctx.lineWidth = 1;

                // Different visual hints for different columns (optional)
                // Leftmost columns slightly darker to show enemy approach area
                if (cell.col < 2) {
                    ctx.fillStyle = withAlpha(colors.accentInfo, 0.05); // Slight blue tint for danger zone
                    ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                }

                // Highlight occupied cells
                if (cell.occupied) {
                    ctx.fillStyle = withAlpha(colors.accentDanger, 0.15);
                    ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                }

                // If player is selecting a card, highlight valid cells
                if (this.highlightGrid && !cell.occupied) {
                    ctx.fillStyle = withAlpha(colors.accentSuccess, 0.25);
                    ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                }

                // Draw grid lines
                ctx.strokeRect(cell.x, cell.y, this.gridSize, this.gridSize);
            }
        }

        // Draw stronger row separators (lane indicators)
        ctx.strokeStyle = withAlpha(colors.textPrimary, 0.3);
        ctx.lineWidth = 2;
        for (let row = 0; row <= this.deploymentGrid.length; row++) {
            const y = this.gridOffsetY + row * this.gridSize;
            ctx.beginPath();
            ctx.moveTo(this.gridOffsetX, y);
            ctx.lineTo(this.gridOffsetX + 9 * this.gridSize, y);
            ctx.stroke();
        }

        // Draw column separators (lighter)
        ctx.strokeStyle = withAlpha(colors.textPrimary, 0.15);
        ctx.lineWidth = 1;
        for (let col = 0; col <= 9; col++) {
            const x = this.gridOffsetX + col * this.gridSize;
            ctx.beginPath();
            ctx.moveTo(x, this.gridOffsetY);
            ctx.lineTo(x, this.gridOffsetY + this.deploymentGrid.length * this.gridSize);
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
        const randomRow = this.getRandomSpawnRow();
        // Return the center Y position of the selected row
        return this.getRowCenterY(randomRow);
    }

    /**
     * Pick a random valid row index for spawning
     */
    getRandomSpawnRow() {
        if (this.deploymentGrid.length === 0) return 0;
        return Math.floor(Math.random() * this.deploymentGrid.length);
    }

    /**
     * Return the center Y coordinate of a given row
     */
    getRowCenterY(row) {
        return this.gridOffsetY + row * this.gridSize + this.gridSize / 2;
    }

    /**
     * Get the leftmost position where enemies start (off-screen)
     * @returns {number} X position for enemy spawn
     */
    getEnemySpawnX() {
        return -100;  // Spawn off-screen to the left
    }

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

    /**
     * Check if enemies are getting close (for AI/warnings)
     * @param x X position of enemy
     * @returns {number} Column index the enemy is in, or -1
     */
    getColumnFromX(x) {
        const col = Math.floor((x - this.gridOffsetX) / this.gridSize);
        if (col >= 0 && col < 9) {
            return col;
        }
        return -1;
    }

    /**
     * Get specific cell by row and column indices
     * @param row Row index
     * @param col Column index
     * @returns {Object|null} Cell object or null if invalid
     */
    getCellByIndices(row, col) {
        if (row >= 0 && row < this.deploymentGrid.length &&
            col >= 0 && col < 9) {
            return this.deploymentGrid[row][col];
        }
        return null;
    }

}