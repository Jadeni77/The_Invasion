import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from '../GridManager.js';

describe('GridManager', () => {
    let grid;

    beforeEach(() => {
        grid = new GridManager(800, 600, 1);
        grid.initializeGrid();
    });

    describe('constructor', () => {
        it('should set default margins and grid size', () => {
            expect(grid.leftMargin).toBe(80);
            expect(grid.rightMargin).toBe(60);
            expect(grid.topMargin).toBe(60);
            expect(grid.bottomMargin).toBe(40);
        });

        it('should store canvas dimensions', () => {
            expect(grid.canvasWidth).toBe(800);
            expect(grid.canvasHeight).toBe(600);
        });
    });

    describe('getRowsForLevel', () => {
        it('should return 1 row for level 1', () => {
            const g = new GridManager(800, 600, 1);
            expect(g.getRowsForLevel()).toBe(1);
        });

        it('should return 2 rows for level 2', () => {
            const g = new GridManager(800, 600, 2);
            expect(g.getRowsForLevel()).toBe(2);
        });

        it('should return 5 rows for level 5', () => {
            const g = new GridManager(800, 600, 5);
            expect(g.getRowsForLevel()).toBe(5);
        });

        it('should return 6 rows for levels above 5', () => {
            const g = new GridManager(800, 600, 10);
            expect(g.getRowsForLevel()).toBe(6);
        });
    });

    describe('initializeGrid', () => {
        it('should create a grid with 9 columns', () => {
            expect(grid.deploymentGrid[0].length).toBe(9);
        });

        it('should create correct number of rows for level 1', () => {
            expect(grid.deploymentGrid.length).toBe(1);
        });

        it('should create 6 rows for level 6+', () => {
            const g = new GridManager(800, 600, 8);
            g.initializeGrid();
            expect(g.deploymentGrid.length).toBe(6);
        });

        it('should mark all cells as unoccupied initially', () => {
            for (const row of grid.deploymentGrid) {
                for (const cell of row) {
                    expect(cell.occupied).toBe(false);
                }
            }
        });

        it('should assign correct row and col indices to each cell', () => {
            const g = new GridManager(800, 600, 3);
            g.initializeGrid();
            for (let r = 0; r < g.deploymentGrid.length; r++) {
                for (let c = 0; c < g.deploymentGrid[r].length; c++) {
                    expect(g.deploymentGrid[r][c].row).toBe(r);
                    expect(g.deploymentGrid[r][c].col).toBe(c);
                }
            }
        });

        it('should enforce minimum grid size of 40', () => {
            const tinyGrid = new GridManager(100, 100, 6);
            tinyGrid.initializeGrid();
            expect(tinyGrid.gridSize).toBeGreaterThanOrEqual(40);
        });

        it('should cap grid size at 80', () => {
            const hugeGrid = new GridManager(2000, 2000, 1);
            hugeGrid.initializeGrid();
            expect(hugeGrid.gridSize).toBeLessThanOrEqual(80);
        });
    });

    describe('getGridCell', () => {
        it('should return a cell for valid coordinates', () => {
            const cell = grid.getGridCell(grid.gridOffsetX + 5, grid.gridOffsetY + 5);
            expect(cell).not.toBeNull();
            expect(cell.row).toBe(0);
            expect(cell.col).toBe(0);
        });

        it('should return null for coordinates before grid offset', () => {
            expect(grid.getGridCell(grid.gridOffsetX - 1, grid.gridOffsetY - 1)).toBeNull();
        });

        it('should return null for coordinates beyond grid bounds', () => {
            expect(grid.getGridCell(grid.gridOffsetX + 9 * grid.gridSize + 10, grid.gridOffsetY)).toBeNull();
        });
    });

    describe('resetGrid', () => {
        it('should mark all cells as unoccupied', () => {
            grid.deploymentGrid[0][0].occupied = true;
            grid.deploymentGrid[0][3].occupied = true;
            grid.resetGrid();
            for (const row of grid.deploymentGrid) {
                for (const cell of row) {
                    expect(cell.occupied).toBe(false);
                }
            }
        });

        it('should handle empty grid gracefully', () => {
            grid.deploymentGrid = [];
            expect(() => grid.resetGrid()).not.toThrow();
        });
    });

    describe('getRandomSpawnY', () => {
        it('should return 100 when grid is empty', () => {
            grid.deploymentGrid = [];
            expect(grid.getRandomSpawnY()).toBe(100);
        });

        it('should return a Y position within the grid area', () => {
            const g = new GridManager(800, 600, 3);
            g.initializeGrid();
            const y = g.getRandomSpawnY();
            expect(y).toBeGreaterThanOrEqual(g.gridOffsetY);
            expect(y).toBeLessThanOrEqual(g.gridOffsetY + g.deploymentGrid.length * g.gridSize);
        });
    });

    describe('getEnemySpawnX', () => {
        it('should return -100 (off-screen left)', () => {
            expect(grid.getEnemySpawnX()).toBe(-100);
        });
    });

    describe('getRowCells', () => {
        it('should return cells for a valid row index', () => {
            const g = new GridManager(800, 600, 3);
            g.initializeGrid();
            const cells = g.getRowCells(0);
            expect(cells.length).toBe(9);
        });

        it('should return empty array for invalid row index', () => {
            expect(grid.getRowCells(-1)).toEqual([]);
            expect(grid.getRowCells(100)).toEqual([]);
        });
    });

    describe('getRowFromY', () => {
        it('should return correct row index for a Y position inside the grid', () => {
            const g = new GridManager(800, 600, 3);
            g.initializeGrid();
            const row = g.getRowFromY(g.gridOffsetY + g.gridSize * 1.5);
            expect(row).toBe(1);
        });

        it('should return -1 for Y position outside grid', () => {
            expect(grid.getRowFromY(0)).toBe(-1);
        });
    });

    describe('getColumnFromX', () => {
        it('should return correct column index', () => {
            const col = grid.getColumnFromX(grid.gridOffsetX + grid.gridSize * 2.5);
            expect(col).toBe(2);
        });

        it('should return -1 for X position outside grid', () => {
            expect(grid.getColumnFromX(0)).toBe(-1);
        });
    });

    describe('getCellByIndices', () => {
        it('should return cell for valid indices', () => {
            const cell = grid.getCellByIndices(0, 0);
            expect(cell).not.toBeNull();
            expect(cell.row).toBe(0);
            expect(cell.col).toBe(0);
        });

        it('should return null for invalid indices', () => {
            expect(grid.getCellByIndices(-1, 0)).toBeNull();
            expect(grid.getCellByIndices(0, 9)).toBeNull();
        });
    });

    describe('setLevel', () => {
        it('should reinitialize grid when level changes', () => {
            grid.setLevel(4);
            expect(grid.levelNumber).toBe(4);
            expect(grid.deploymentGrid.length).toBe(4);
        });

        it('should not reinitialize when level is the same', () => {
            const originalGrid = grid.deploymentGrid;
            grid.setLevel(1);
            expect(grid.deploymentGrid).toBe(originalGrid);
        });
    });
});
