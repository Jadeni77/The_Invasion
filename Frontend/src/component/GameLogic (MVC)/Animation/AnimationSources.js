// src/component/GameLogic/Animation/AnimationSources.js
import { AssetManifest } from "../../../assets/AssetManifest.js";

export class AnimationSources {
    constructor() {
        this.loadedAssets = new Map();
        this.loadingPromises = new Map();
    }

    async loadAssetForUnit(unitType, category = 'enemies') {
        const cacheKey = `${category}_${unitType}`;

        // Return cached if already loaded
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }

        // Return existing promise if already loading
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }

        // Start loading
        const loadPromise = this._loadUnitAssets(unitType, category);
        this.loadingPromises.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.loadedAssets.set(cacheKey, result);
            this.loadingPromises.delete(cacheKey);
            return result;
        } catch (error) {
            this.loadingPromises.delete(cacheKey);
            throw error;
        }
    }

    async _loadUnitAssets(unitType, category) {
        const manifest = AssetManifest[category]?.[unitType];
        if (!manifest) {
            console.warn(`No assets defined for ${category}/${unitType}`);
            return null;
        }

        const loadedSprites = {};

        for (const [animName, loader] of Object.entries(manifest.sprites)) {
            try {
                // Call the loader function
                const result = await loader();

                // Handle both module format and direct path format
                const path = result?.default || result;

                loadedSprites[animName] = {
                    path: path,
                    ...manifest.config[animName]
                };
            } catch (error) {
                console.error(`Failed to load ${animName} for ${unitType}:`, error);
                // Provide fallback
                loadedSprites[animName] = {
                    path: null,
                    frameCount: 0,
                    frameWidth: 64,
                    frameHeight: 64
                };
            }
        }

        return loadedSprites;
    }

    async getEnemyAnimations(enemyTypes) {
        const animations = {};

        for (const enemyType of enemyTypes) {
            animations[enemyType] = await this.loadAssetForUnit(enemyType, 'enemies');
        }

        return animations;
    }

    async getDefenderAnimations(defenderTypes) {
        const animations = {};

        for (const defenderType of defenderTypes) {
            animations[defenderType] = await this.loadAssetForUnit(defenderType, 'defenders');
        }

        return animations;
    }
}