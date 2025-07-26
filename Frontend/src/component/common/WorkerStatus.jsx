import React, {useEffect, useState} from "react";
import "../../style/WorkerStatus.css";
import { useGame } from "../GameLogic (MVC)/GameContext";

function WorkerStatus({ worker }) {
  const { upgradeQueue, playerData } = useGame();
  const [timeRemaining, setTimeRemaining] = useState(0);

  //check if this worker is upgrading sth
  const currentUpgrade = upgradeQueue.find((u) => u.workerId === worker.id);
  const isUpgrading = !!currentUpgrade;

  //get card being upgrade
  const upgradingCard =
    isUpgrading && playerData
      ? playerData.cards.find((c) => c.id === currentUpgrade.cardId)
      : null;

  //calculate time remaining
  // const getTimeRemaining = () => {
  //   if (!currentUpgrade) return 0;
  //   const now = Date.now();
  //   const timeLeft = Math.max(0, currentUpgrade.endTime - now);
  //   return Math.ceil(timeLeft / 1000); //convert to seconds
  // };

  useEffect(() => {
    if (currentUpgrade) {
      const updateTimer = () => {
        const now = Date.now();
        const timeLeft = Math.max(0, currentUpgrade.endTime - now);
        setTimeRemaining(Math.ceil(timeLeft / 1000)); //convert to section and set
      };
      updateTimer();

      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [currentUpgrade]);

  return (
    <div
      className={`worker-status ${
        worker.injured ? "injured" : isUpgrading ? "upgrading" : "healthy"
      } `}
    >
      <div className="worker-icon">
        {worker.injured ? "🤕" : isUpgrading ? "🔧" : "👷"}
      </div>
      <div className="worker-info">
        <div className="worker-name">{worker.name}</div>
        <div className="worker-state">
          {worker.injured
            ? "Injured (Resting)"
            : isUpgrading
            ? `Upgrading ${upgradingCard?.name || "Card"}`
            : "Ready to Work"}
        </div>
        {/* Add recovery timer for injured workers */}
        {worker.injured && worker.recoveryTime && (
          <div className="recovery-timer">
            Recovers in: {worker.recoveryTime}s
          </div>
        )}
        {isUpgrading && (
          <div className="upgrade-timer">
            Complete in: {timeRemaining}s
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkerStatus;
