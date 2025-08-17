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
        const loadedAnimations = {};

        //load each animation file
        for (const [animName, fileData] of Object.entries(animationFiles)) {
            console.log(`🔄 Attempting to load: ${fileData.path}`);

            const img = new Image();
            img.src = fileData.path;

            const imageLoaded = await new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log(`✓ Loaded: ${fileData.path}`);
                    resolve(true);
                }
                img.onerror = (error) => {
                    console.warn(`Failed to load ${fileData.path}`);
                    console.error(`   - Error:`, error);
                    console.error(`   - Image src:`, img.src);
                    console.error(`   - Current URL:`, window.location.href);

                    resolve(false); //not continueing
                };
            });

            // Only process if image actually loaded
            if (imageLoaded && img.complete && img.naturalWidth > 0) {
                //extract frame from this sprite sheet
                const frames = this.extractFrames(img, fileData);
                this.frameCache.set(`${unitType}_${animName}`, frames);

                loadedAnimations[animName] = {
                    frames: frames,
                    frameCount: fileData.frameCount
                };
            } else {
                console.warn(`Skipping ${animName} for ${unitType} - image failed to load`);
                // Set empty frames for failed animations
                this.frameCache.set(`${unitType}_${animName}`, []);
                loadedAnimations[animName] = {
                    frames: [],
                    frameCount: 0
                };
            }
        }
        this.animations.set(unitType, loadedAnimations);
    }


    extractFrames(image, config) {
        const frames = [];
        const { frameCount, frameWidth, frameHeight } = config;

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
        return frames;
    }

    getFrames(unitType, animationName) {
        return this.frameCache.get(`${unitType}_${animationName}`) || [];
    }

    hasAnimation(unitType) {
        return this.animations.has(unitType);
    }
}