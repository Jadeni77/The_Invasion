/**
 * Handle loading and extracting frames
 */
export class AnimationManager {
    constructor() {
        this.animations = new Map(); // store animation data by type
        this.frameCache = new Map(); // store extracted frames
    }

    /**
     * Load multiple sprite sheets for one unit type
     */
    async loadUnitAnimation(unitType, animationFiles) {
        console.log(`📦 Loading animations for ${unitType}`);
        const loadedAnimations = {};

        //load each animation file
        for (const [animName, fileData] of Object.entries(animationFiles)) {
            console.log(`🔄 Attempting to load ${animName}: ${fileData.path}`);

            const img = new Image();
            img.src = fileData.path;

            const imageLoaded = await new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log(`✓ Loaded ${animName} for ${unitType}: ${fileData.path}`);
                    console.log(`  Image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
                    console.log(`  Expected frames: ${fileData.frameCount} (${fileData.frameWidth}x${fileData.frameHeight} each)`);
                    resolve(true);
                }
                img.onerror = (error) => {
                    console.error(`❌ Failed to load ${animName} for ${unitType}: ${fileData.path}`);
                    console.error(`   Error:`, error);
                    resolve(false);
                };
            });

            // Only process if image actually loaded
            if (imageLoaded && img.complete && img.naturalWidth > 0) {
                //extract frame from this sprite sheet
                const frames = this.extractFrames(img, fileData);
                const cacheKey = `${unitType}_${animName}`;
                this.frameCache.set(cacheKey, frames);
                console.log(`📌 Cached ${frames.length} frames with key: ${cacheKey}`);

                loadedAnimations[animName] = {
                    frames: frames,
                    frameCount: fileData.frameCount
                };
            } else {
                console.warn(`⚠️ Skipping ${animName} for ${unitType} - image failed to load`);
                // Set empty frames for failed animations
                const cacheKey = `${unitType}_${animName}`;
                this.frameCache.set(cacheKey, []);
                loadedAnimations[animName] = {
                    frames: [],
                    frameCount: 0
                };
            }
        }

        this.animations.set(unitType, loadedAnimations);
        console.log(`✅ Finished loading animations for ${unitType}:`, loadedAnimations);
        this.debugAnimations();
    }

    extractFrames(image, config) {
        const frames = [];
        const { frameCount, frameWidth, frameHeight } = config;

        console.log(`🖼️ Extracting ${frameCount} frames (${frameWidth}x${frameHeight} each) from image ${image.naturalWidth}x${image.naturalHeight}`);

        for (let i = 0; i < frameCount; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            const ctx = canvas.getContext('2d');

            //extract each frame here
            ctx.drawImage(
                image,
                i * frameWidth, 0, frameWidth, frameHeight, //source
                0, 0, frameWidth, frameHeight, //destination
            );

            frames.push(canvas);
        }

        console.log(`✅ Extracted ${frames.length} frames successfully`);
        return frames;
    }

    getFrames(unitType, animationName) {
        const cacheKey = `${unitType}_${animationName}`;
        const frames = this.frameCache.get(cacheKey);

        if (!frames) {
            console.warn(`🔍 No frames found for key: ${cacheKey}`);
            console.warn(`   Available keys:`, Array.from(this.frameCache.keys()));
        }

        return frames || [];
    }

    hasAnimation(unitType) {
        return this.animations.has(unitType);
    }

    // Debug method to check what's loaded
    debugAnimations() {
        console.log('📊 Animation Manager State:');
        console.log('  Loaded unit types:', Array.from(this.animations.keys()));
        console.log('  Cached frame keys:', Array.from(this.frameCache.keys()));

        for (const [unitType, anims] of this.animations.entries()) {
            console.log(`  ${unitType}:`);
            for (const [animName, data] of Object.entries(anims)) {
                console.log(`    - ${animName}: ${data.frameCount} frames`);
            }
        }
    }
}