import { useEffect } from "react";

export const useMobileOrientation = (gameState) => {
    useEffect(() => {
        const handleOrientationChange = () => {
            if (gameState === "inGame") {
                //for mobile device ingame
                if (window.innerWidth < 768) {
                    if (screen.orientation && screen.orientation.lock()) {
                        screen.orientation.lock('landscape').catch(err => {
                            console.log('Orientation lock failed:', err);
                        });
                    }
                }
            } else {
                if (screen.orientation && screen.orientation.unlock()) {
                    screen.orientation.unlock();
                }
            }
        };
        handleOrientationChange();

        //cleanup
        return () => {
            if (screen.orientation && screen.orientation.unlock()) {
                screen.orientation.unlock();
            }
        };
    }, [gameState]);

    //force viewpoint to change
    useEffect(() => {
        if (gameState === 'inGame' && window.innerWidth < 768) {
            let viewport = document.querySelector('meta[name=viewport]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
            }
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }, [gameState]);
};