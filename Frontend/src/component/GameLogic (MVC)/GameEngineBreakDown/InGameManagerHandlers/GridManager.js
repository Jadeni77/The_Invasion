/**
 * This class represent the grid cells of the in game board. Including
 * importance of initializing a grid and resetting a grid.
 */
export class GridManager {
    constructor(canvasWidth, canvasHeight) {
        this.gridSize = 60;
        this.deploymentGrid = [];
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.highlightGrid = false;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    /**
     * Initialize the grid system in the game board
     */
    initializeGrid() {
        const cols = Math.floor((this.canvasWidth * 0.5) / this.gridSize); //the right half for deploment
        const maxRow = 6;

        const totalGridHeight = maxRow * this.gridSize;
        this.gridOffsetX = this.canvasWidth * 0.5; //from the middle of the screen
        this.gridOffsetY = (this.canvasHeight - totalGridHeight) / 2;

        this.deploymentGrid = [];

        for (let row = 0; row < maxRow; row++) {
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

    /**
     * Return the specific grid cell from the given x and y coordinate
     * @param x the x position of the wanted grid cell
     * @param y the y position of the wanted grid cell
     * @returns {*|null} if a grid cell is not found
     */
    getGridCell(x, y) {
        if (x < this.gridOffsetX) return null;

        //can be adjusted to cover full screen for the col
        const col = Math.floor((x - this.gridOffsetX) / this.gridSize);
        const row = Math.floor((y - this.gridOffsetY) / this.gridSize);

        if (row >= 0 && row < this.deploymentGrid.length &&
            col >= 0 && col < this.deploymentGrid[0].length
        ) {
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
     * The rectangular grid cell drawing
     * @param ctx the given context to be drawn on
     */
    drawGrid(ctx) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;

        for (let row of this.deploymentGrid) {
            for (let cell of row) {
                //draw grid cell
                ctx.strokeRect(cell.x, cell.y, this.gridSize, this.gridSize);

                //highlight occupied cells
                if (cell.occupied) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
                    ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                }
            }
        }
        // If player is selecting a card, highlight valid cells
        if (this.highlightGrid) {
            for (let row of this.deploymentGrid) {
                for (let cell of row) {
                    if (!cell.occupied) {
                        ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
                        ctx.fillRect(cell.x, cell.y, this.gridSize, this.gridSize);
                    }
                }
            }
        }
    }

    /**
     * Logic to calculate a random row for which enemy will spawn on
     * @returns {number} the randomize row in which enemy will spawn on
     */
    getRandomSpawnY() {
        if (this.deploymentGrid.length === 0) return 100;
        const randomRow = Math.floor(Math.random() * this.deploymentGrid.length);
        return this.gridOffsetY + randomRow * this.gridSize + this.gridSize / 2 - 15;

    }

}