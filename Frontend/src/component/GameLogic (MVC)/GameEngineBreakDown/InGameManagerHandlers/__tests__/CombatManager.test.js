import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatManager } from '../CombatManager.js';

// Helper to create mock defender
function createDefender(overrides = {}) {
    return {
        x: 200, y: 200, width: 40, height: 40,
        range: 150, attackDamage: 10, fireRate: 60,
        isAlive: true, disabled: false,
        isRanged: false, useProjectile: false,
        hasArmorPiercing: false,
        lastAttackTime: 0,
        canAttack: vi.fn(() => true),
        attack: vi.fn(),
        ...overrides,
    };
}

// Helper to create mock enemy
function createEnemy(overrides = {}) {
    return {
        x: 250, y: 200, width: 30, height: 30,
        isAlive: true, frozen: false,
        isAttacker: true, isRanged: false,
        attackDamage: 5, attackRange: 50,
        lastAttackTime: 0,
        canAttack: vi.fn(() => true),
        attack: vi.fn(),
        ...overrides,
    };
}

describe('CombatManager', () => {
    let combatManager;
    let mockGameEngine;

    beforeEach(() => {
        mockGameEngine = {
            canvasWidth: 800,
            projectiles: [],
            enemyProjectiles: [],
        };
        combatManager = new CombatManager(mockGameEngine);
    });

    describe('findTargetForDefender', () => {
        it('should find the closest enemy in range', () => {
            const enemies = [
                createEnemy({ x: 400, y: 200 }), // farther
                createEnemy({ x: 250, y: 200 }), // closer
            ];
            const defender = createDefender({ x: 200, y: 200, range: 150 });
            const target = combatManager.findTargetForDefender(defender, enemies);
            expect(target).toBe(enemies[1]);
        });

        it('should return null when no enemies in range', () => {
            const enemies = [createEnemy({ x: 600, y: 600 })];
            const defender = createDefender({ range: 50 });
            const target = combatManager.findTargetForDefender(defender, enemies);
            expect(target).toBeNull();
        });

        it('should skip dead enemies', () => {
            const enemies = [
                createEnemy({ x: 210, y: 200, isAlive: false }),
                createEnemy({ x: 300, y: 200, isAlive: true }),
            ];
            const defender = createDefender({ range: 200 });
            const target = combatManager.findTargetForDefender(defender, enemies);
            expect(target).toBe(enemies[1]);
        });

        it('should skip enemies that are off-screen left', () => {
            const enemies = [createEnemy({ x: -100, y: 200 })];
            const defender = createDefender({ range: 9999 });
            const target = combatManager.findTargetForDefender(defender, enemies);
            expect(target).toBeNull();
        });

        it('should skip enemies that are off-screen right', () => {
            const enemies = [createEnemy({ x: 900, y: 200 })];
            const defender = createDefender({ range: 9999 });
            const target = combatManager.findTargetForDefender(defender, enemies);
            expect(target).toBeNull();
        });

        it('should return null for empty enemies array', () => {
            const defender = createDefender({ range: 200 });
            expect(combatManager.findTargetForDefender(defender, [])).toBeNull();
        });
    });

    describe('findTargetForEnemy', () => {
        it('should find the closest defender in attack range', () => {
            const defenders = [
                createDefender({ x: 300, y: 200 }), // farther
                createDefender({ x: 220, y: 200 }), // closer
            ];
            const enemy = createEnemy({ x: 200, y: 200, attackRange: 100 });
            const target = combatManager.findTargetForEnemy(enemy, defenders);
            expect(target).toBe(defenders[1]);
        });

        it('should return null when no defenders in range', () => {
            const defenders = [createDefender({ x: 600, y: 600 })];
            const enemy = createEnemy({ attackRange: 30 });
            expect(combatManager.findTargetForEnemy(enemy, defenders)).toBeNull();
        });

        it('should skip dead defenders', () => {
            const defenders = [
                createDefender({ x: 210, y: 200, isAlive: false }),
                createDefender({ x: 230, y: 200, isAlive: true }),
            ];
            const enemy = createEnemy({ x: 200, y: 200, attackRange: 100 });
            const target = combatManager.findTargetForEnemy(enemy, defenders);
            expect(target).toBe(defenders[1]);
        });
    });

    describe('updateDefenderCombat', () => {
        it('should call attack for melee defender with target in range', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ range: 150, attackDamage: 10, isRanged: false });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).toHaveBeenCalledWith(enemy, 1000);
        });

        it('should create projectile for ranged defender with useProjectile', () => {
            const enemy = createEnemy({ x: 250, y: 200 });
            const defender = createDefender({
                range: 150, attackDamage: 15,
                isRanged: true, useProjectile: true,
            });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(mockGameEngine.projectiles.length).toBe(1);
            expect(mockGameEngine.projectiles[0].damage).toBe(15);
            expect(defender.lastAttackTime).toBe(1000);
        });

        it('should call attack directly for ranged defender without useProjectile', () => {
            const enemy = createEnemy({ x: 250, y: 200 });
            const defender = createDefender({
                range: 150, attackDamage: 10,
                isRanged: true, useProjectile: false,
            });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).toHaveBeenCalledWith(enemy, 1000);
        });

        it('should skip dead defenders', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ isAlive: false });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).not.toHaveBeenCalled();
        });

        it('should skip disabled defenders', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ disabled: true });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).not.toHaveBeenCalled();
        });

        it('should skip defenders that cannot attack yet', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ canAttack: vi.fn(() => false) });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).not.toHaveBeenCalled();
        });

        it('should skip defenders with 0 attack damage', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ attackDamage: 0 });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).not.toHaveBeenCalled();
        });

        it('should skip defenders with 0 range', () => {
            const enemy = createEnemy({ x: 220, y: 200 });
            const defender = createDefender({ range: 0 });
            combatManager.updateDefenderCombat([defender], [enemy], 1000);
            expect(defender.attack).not.toHaveBeenCalled();
        });
    });

    describe('updateEnemyCombat', () => {
        it('should call attack for melee enemy with target in range', () => {
            const defender = createDefender({ x: 220, y: 200 });
            const enemy = createEnemy({ x: 200, y: 200, attackRange: 100, isRanged: false });
            combatManager.updateEnemyCombat([defender], [enemy], 1000);
            expect(enemy.attack).toHaveBeenCalledWith(defender, 1000);
        });

        it('should create enemy projectile for ranged enemy', () => {
            const defender = createDefender({ x: 220, y: 200 });
            const enemy = createEnemy({
                x: 200, y: 200, attackRange: 100,
                isRanged: true, attackDamage: 8,
            });
            combatManager.updateEnemyCombat([defender], [enemy], 1000);
            expect(mockGameEngine.enemyProjectiles.length).toBe(1);
            expect(mockGameEngine.enemyProjectiles[0].damage).toBe(8);
            expect(enemy.lastAttackTime).toBe(1000);
        });

        it('should skip non-attacker enemies', () => {
            const defender = createDefender({ x: 220, y: 200 });
            const enemy = createEnemy({ isAttacker: false });
            combatManager.updateEnemyCombat([defender], [enemy], 1000);
            expect(enemy.attack).not.toHaveBeenCalled();
        });

        it('should skip dead enemies', () => {
            const defender = createDefender({ x: 220, y: 200 });
            const enemy = createEnemy({ isAlive: false });
            combatManager.updateEnemyCombat([defender], [enemy], 1000);
            expect(enemy.attack).not.toHaveBeenCalled();
        });

        it('should skip frozen enemies', () => {
            const defender = createDefender({ x: 220, y: 200 });
            const enemy = createEnemy({ frozen: true });
            combatManager.updateEnemyCombat([defender], [enemy], 1000);
            expect(enemy.attack).not.toHaveBeenCalled();
        });
    });
});
