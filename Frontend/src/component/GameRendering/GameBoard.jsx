import React, {useRef, useEffect, useState} from "react";
import {useGame} from "../GameLogic (MVC)/GameContext";
import Card from "../common/Card";
import {GameEngine} from "../GameLogic (MVC)/GameEngine";
import {calculateCardStats} from "../GameLogic (MVC)/DefenderClassUtils";
import Gold from "../../Icons/Gold.png";
import Iron from "../../Icons/Iron.png";
import {useMobileOrientation} from "./UseMobileOrientation.js";

const GameBoard = () => {
    const canvasRef = useRef(null);
    const {
        gameState,
        playerData,
        selectedLevel,
        inGameEnergy,
        inGameScore,
        gameOver,
        gameWon,
        removeDefender,
        endGame,
        updateEnergyCb,
        updateScoreCb,
        onWinCb,
        onLoseCb,
        startLevel,
        selectedCardsForGame,
        setGameEngine,
        updateEndlessWave,
        addCollectedPieces,
        collectedCardPieces,
        currentEndlessWave,
    } = useGame();

    const gameEngineRef = useRef(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [shovelMode, setShovelMode] = useState(false);

    const [cardSlots, setCardSlots] = useState([]);
    const [cardCooldown, setCardCooldown] = useState({});

    const [baseHealth, setBaseHealth] = useState(100);
    const [_resetTrigger, setResetTrigger] = useState(0);
    const [showQuitDialog, setShowQuitDialog] = useState(false);

    useMobileOrientation(gameState);

    // canvas sizing
    useEffect(() => {
        const resizeCanvas = () => {
            if (canvasRef.current) {
                const container = canvasRef.current.parentElement;
                canvasRef.current.width = container.clientWidth;
                canvasRef.current.height = container.clientHeight - 60 - 250; // Account for top
                                                                              // bar (60px) AND
                                                                              // bottom bar (120)

                // Update game engine if exists
                if (gameEngineRef.current) {
                    gameEngineRef.current.canvasWidth = container.clientWidth;
                    gameEngineRef.current.canvasHeight = container.clientHeight - 60 - 250; // Account
                                                                                            // for
                                                                                            // both
                                                                                            // bars
                    gameEngineRef.current.defenseLineX = container.clientWidth * 0.9;
                }
            }
        };

        // Initial resize
        resizeCanvas();
        // Add resize listener
        window.addEventListener("resize", resizeCanvas);
        // Cleanup
        return () => window.removeEventListener("resize", resizeCanvas);
    }, []);

    // Initialize card slots
    useEffect(() => {
        if (selectedCardsForGame?.length > 0) {
            const cardsWithStats = selectedCardsForGame
                .map(calculateCardStats)
                .filter(Boolean);
            setCardSlots(cardsWithStats);

            //initialize cooldown (all the start will be start ready)
            const initialCooldown = {};
            cardsWithStats.forEach((card) => {
                initialCooldown[card.id] = 0;
            });
            setCardCooldown(initialCooldown);
        } else if (playerData?.cards?.length > 0) {
            const cardsWithStats = playerData.cards
                .map(calculateCardStats)
                .filter(Boolean);
            setCardSlots(cardsWithStats);

            const initialCooldown = {};
            cardsWithStats.forEach((card) => {
                initialCooldown[card.id] = 0;
            });
            setCardCooldown(initialCooldown);
        }
    }, [selectedCardsForGame, playerData]);

    //update cooldowns
    useEffect(() => {
        const cooldownInterval = setInterval(() => {
            setCardCooldown((prev) => {
                const updated = {...prev};
                Object.keys(updated).forEach((cardId) => {
                    if (updated[cardId] > 0 && !showQuitDialog) {
                        updated[cardId] = Math.max(0, updated[cardId] - 100); //deacrease by 100ms
                    }
                });
                return updated;
            });
        }, 100);
        return () => clearInterval(cooldownInterval);
    }, [showQuitDialog]);

    //TODO: Game Engine reinitialize itself causing the game to reset (the resetGame method is
    // called) Initialize game engine
    useEffect(() => {
        if (gameState === "inGame" && canvasRef.current && selectedLevel !== null) {
            // Use a flag to prevent double initialization
            let isCancelled = false;

            // Small delay to let React's double-render complete
            //TODO: The setTimeout prohibit double engine in the background
            const initTimeout = setTimeout(() => {
                if (isCancelled) {
                    return;
                }

                // Clean up any existing engine
                if (gameEngineRef.current) {
                    gameEngineRef.current.stopLoop();
                    gameEngineRef.current.cleanup();
                    gameEngineRef.current = null;
                }

                // Create new game engine
                const engine = new GameEngine(
                    updateEnergyCb,
                    updateScoreCb,
                    onWinCb,
                    onLoseCb,
                    (health) => setBaseHealth(health),
                    updateEndlessWave,
                );

                //set card pieces collection callback
                engine.onCardPieceCollected = (cardName) => {
                    addCollectedPieces(cardName); //context call
                }

                gameEngineRef.current = engine;
                setGameEngine(engine);

                // Pass selected cards to the engine
                if (selectedCardsForGame && selectedCardsForGame.length > 0) {
                    engine.setPlayerSelectedCards(selectedCardsForGame);
                } else if (cardSlots && cardSlots.length > 0) {
                    engine.setPlayerSelectedCards(cardSlots);
                }

                // Initialize game
                gameEngineRef.current.initialize(
                    canvasRef.current,
                    canvasRef.current.width,
                    canvasRef.current.height,
                    selectedLevel
                );

                // Start game loop
                gameEngineRef.current.startLoop();

                setSelectedCard(null);
                setShovelMode(false); //reset shovel mode on new game
            }, 50); // 50ms delay

            // Cleanup
            return () => {
                isCancelled = true;
                clearTimeout(initTimeout);

                if (gameEngineRef.current) {
                    gameEngineRef.current.stopLoop();
                    gameEngineRef.current.cleanup();
                    if (window.gameEngineInstance === gameEngineRef.current) {
                        window.gameEngineInstance = null;
                    }
                    gameEngineRef.current = null;
                }
            };
        }
    }, [gameState, selectedLevel, updateEnergyCb,
        updateScoreCb, onWinCb, onLoseCb, updateEndlessWave, setGameEngine,
        selectedCardsForGame, addCollectedPieces]);

    const handleCardSelection = (card) => {
        //check if a card is on cooldown
        if (cardCooldown[card.id] > 0 || inGameEnergy < card.cost) {
            return;
        }
        //disable shovel when seleting card
        setShovelMode(false);

        if (selectedCard?.id === card.id) {
            setSelectedCard(null);
        } else {
            setSelectedCard(card);
        }
    };

    const handleShovelToggle = () => {
        setShovelMode(!shovelMode);
        setSelectedCard(null);
    }

    const handleCanvasClick = (event) => {
        console.log("Canvas Click");
        if (gameOver || !gameEngineRef.current) {
            console.log(("Gme"))
            return;
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        //try to remove defender if shovelmode active
        if (shovelMode) {
            const removed = removeDefender(x, y);
            setShovelMode(false);
            if (removed) {
                console.log("Defender removed successfully");
                //Can add refund mechanism here
            }
            return;
        }

        //try to collect energy first when overlap
        if (gameEngineRef.current.collectEnergy(x, y)) {
            console.log("Energy collection successful");
            return;
        }

        if (gameEngineRef.current.collectCardPieces(x, y)) {
            console.log("CardPiece collection successful");
            return;
        }

        //if selected a card and no energy to collect, then deploy
        if (selectedCard) {
            if (gameEngineRef.current.deployDefenderUnit(selectedCard, x, y)) {
                const cooldownDuration = getCooldownDuration(selectedCard);
                setCardCooldown((prev) => ({
                    ...prev,
                    [selectedCard.id]: cooldownDuration,
                }));
                setSelectedCard(null);
            }
        }
    };

    //get the cooldown duration for a card type
    const getCooldownDuration = (card) => {
        const cooldowns = {
            "Basic Cop": 5000, //5 second
            "Healer Cop": 8000,
            "Grenadier": 10000,
            "Barricade": 1000,
            "Energy Generator": 5000,
            "Sniper": 1000,
            "Frost Archer": 1000,
            "Fire Blast": 1000,
            "Ice Bomb": 1000
        };
        return cooldowns[card.name] || 5000; //default at 5 seconds
    };

    const handleQuitClick = () => {
        //pause the game
        if (gameEngineRef.current) {
            gameEngineRef.current.pauseGame();
        }
        setShowQuitDialog(true);
    };

    const handleQuitConfirm = () => {
        if (gameEngineRef.current) {
            gameEngineRef.current.stopLoop(); // Stop the game loop first
            gameEngineRef.current.gameOver = true; // Mark as game over
            gameEngineRef.current.gameWon = false; // Mark as loss
        }
        setShowQuitDialog(false);
        endGame("quit"); // Use "quit" instead of "loss"
    };

    const handleQuitCancel = () => {
        if (gameEngineRef.current) {
            gameEngineRef.current.resumeGame();
        }
        setShowQuitDialog(false);
    };

    // Render game over screen
    if (gameOver) {
        const isEndless = selectedLevel === 999;

      // Calculate stars (same logic as GameContext)
      const calculateStars = (score, level) => {
        const baseThreshold = 100 * level;
        if (score >= baseThreshold * 1.5) return 3;
        if (score >= baseThreshold) return 2;
        if (score >= baseThreshold * 0.5) return 1;
        return 0;
      };

      const getLevelMultiplier = (level) => {
        if (level <= 3) return 1.0;
        if (level <= 7) return 1.5;
        if (level <= 12) return 2.0;
        if (level <= 17) return 3.0;
        if (level <= 20) return 4.0;
        return 1.0;
      };

      const stars = calculateStars(inGameScore, selectedLevel);
      const gemBonus = stars === 3 ? Math.ceil(getLevelMultiplier(selectedLevel)) : 0;

      // Calculate rewards/losses
      const rewards = isEndless ? {
        gold: Math.floor(currentEndlessWave * 25),
        iron: Math.floor(currentEndlessWave * 10),
        grain: Math.floor(currentEndlessWave * 10),
        water: Math.floor(currentEndlessWave * 8),
        gem: Math.floor(currentEndlessWave / 10)
      } : gameWon ? {
        gold: Math.floor(inGameScore * 0.2),
        iron: Math.floor(inGameScore * 0.1),
        grain: Math.floor(inGameScore * 0.2),
        water: Math.floor(inGameScore * 0.2),
        gem: gemBonus
      } : {
        gold: -50, iron: -10, grain: -10, water: -50, gem: -1
      };

      const isReward = isEndless || gameWon;

        return (
            <div className="game-over-screen">
                <h2>
                    {isEndless ? "ENDLESS RUN COMPLETE!" : gameWon ? "MISSION ACCOMPLISHED!"
                                                                   : "MISSION FAILED!"}
                </h2>
                <div className="result-details">
                    <div className="score-section">
                        {isEndless &&
                         <p>Waves Survived:
                             <span className="score-value">{currentEndlessWave}</span>
                         </p>}

                        <p>Final Score:
                            <span className="score-value">{inGameScore}</span>
                        </p>
                        {!isEndless &&
                         <p>Level:
                             <span className="level-value">{selectedLevel}</span>
                         </p>}

                        {gameWon && !isEndless && (
                            <p>Stars Earned: <span className="stars-value">{"⭐".repeat(
                                stars)}</span></p>
                        )}
                    </div>

                    <div className="rewards-section">
                        <h3>{isReward ? "Rewards Earned:" : "Resources Lost:"}</h3>

                        {[
                            {
                                key: "gold",
                                icon: <img src={Gold} alt="💰" className="resource-image"/>
                            },
                            {
                                key: "iron",
                                icon: <img src={Iron} alt="⛓️" className="resource-image"/>
                            },
                            {key: "grain", icon: "🌾"},
                            {key: "water", icon: "💧"},
                            {key: "gem", icon: "💎"}
                        ].map(({key, icon}) => {
                            const value = rewards[key];
                            if (value === 0) {
                                return null;
                            }
                            return (
                                <div key={key}
                                     className={`resource-line ${!isReward ? "loss" : ""}`}>
                                    <span className="resource-icon">{icon}</span>
                                    <span className="resource-text">
                  {key.charAt(0).toUpperCase() + key.slice(1)} {value > 0 ? "+" : ""}{value}
                </span>
                                </div>
                            );
                        })}

                        {/*   Added card pieces section */}
                        {collectedCardPieces.length > 0 && (
                            <div className="card-pieces-section">
                                <h4>Card Pieces Collected:</h4>
                                {Object.entries(
                                    collectedCardPieces.reduce(
                                        (acc, piece) => ({...acc, [piece]: (acc[piece] || 0) + 1}),
                                        {})
                                ).map(([cardName, count]) => (
                                    <div key={cardName} className="resource-line">
                                        <span className="pieces-icon">⬟</span>
                                        <span className="resource-text">{cardName} x{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isEndless && !gameWon && (
                        <div className="defeat-message"><p>The evil creatures reached your
                            garden!</p></div>
                    )}

                </div>


                <div className="action-buttons">
                    <button className="lobby-button"
                            onClick={() => endGame(gameWon ? "win" : "loss")}>
                        RETURN TO LOBBY
                    </button>
                    <button className="replay-button" onClick={() => {
                        endGame("replay");
                        setBaseHealth(100);
                        setSelectedCard(null);
                        setShovelMode(false);
                        setCardCooldown(Object.fromEntries(cardSlots.map(c => [c.id, 0])));
                        setResetTrigger(prev => prev + 1);
                        setTimeout(() => selectedLevel && startLevel(selectedLevel), 100);
                    }}>
                        PLAY AGAIN
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="game-board-container">
            {/* Top UI Bar */}
            <div className="game-top-bar">
                <button
                    className="settings-button"
                    onClick={handleQuitClick}
                    title="Return to Lobby"
                >
                    ⚙️
                </button>
                <div className="energy-container">
                    <div className="energy-icon">⚡</div>
                    <div className="energy-value">{inGameEnergy}</div>
                </div>

                <div className="score-container">
                    <div className="score-label">SCORE:</div>
                    <div className="score-value">{inGameScore}</div>
                </div>

                <div className="base-health-container">
                    <div className="base-icon">🏢</div>
                    <div className="health-bar">
                        <div className="health-fill" style={{width: `${baseHealth}%`}}/>
                    </div>
                    <div className="health-value">{baseHealth}%</div>
                </div>
            </div>

            {/* Game Canvas */}
            <canvas
                ref={canvasRef}
                width={800}
                height={450}
                onClick={handleCanvasClick}
                className="game-canvas"
                style={{cursor: shovelMode ? 'crosshair' : 'default'}}
            />

            {/* Card slots in bottom bar */}
            <div className="game-bottom-bar">
                <div className="card-slots-container">
                    {/* Shovel Tool Button */}
                    <div className="tool-slot">
                        <button
                            className={`shovel-button ${shovelMode ? 'active' : ''}`}
                            onClick={handleShovelToggle}
                            title="Remove Defender">
                            🔨
                        </button>
                    </div>
                    {cardSlots.map((card) => {
                        const cooldown = cardCooldown[card.id] || 0;
                        const cooldownPercent =
                            cooldown > 0 ? (cooldown / getCooldownDuration(card)) * 100 : 0;
                        const isDisabled = cooldown > 0 || inGameEnergy < card.cost;

                        return (
                            <div key={card.id} className="card-slot-wrapper">
                                <Card
                                    card={card}
                                    onClick={() => handleCardSelection(card)}
                                    selected={selectedCard?.id === card.id && !shovelMode}
                                    disabled={isDisabled}
                                />

                                {cooldown > 0 && (
                                    <div className="cooldown-overlay">
                                        <div
                                            className="cooldown-progress"
                                            style={{height: `${cooldownPercent}%`}}
                                        />
                                        <div className="cooldown-text">
                                            {Math.ceil(cooldown / 1000)}s
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Deployment/Removing Indicator */}
            {(selectedCard || shovelMode) && (
                <div className="deployment-indicator">
                    <div className="indicator-icon">{shovelMode ? '🔨' : '+'}</div>
                    <div className="indicator-text">
                        {shovelMode ? "REMOVE DEFENDER"
                                    : `DEPLOY ${selectedCard.name.toUpperCase()}`}
                    </div>
                </div>
            )}

            {/* Quit Confirmation Dialog */}
            {showQuitDialog && (
                <div className="quit-dialog-overlay">
                    <div className="quit-dialog">
                        <h3>Return to Lobby?</h3>
                        <p>
                            Warning: Quitting will remove all resources gain from this level!
                        </p>
                        <div className="quit-dialog-buttons">
                            <button
                                className="quit-confirm-button"
                                onClick={handleQuitConfirm}
                            >
                                QUIT GAME
                            </button>
                            <button className="quit-cancel-button" onClick={handleQuitCancel}>
                                CONTINUE PLAYING
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
