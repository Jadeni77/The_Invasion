import React from "react";
import "../../style/WorkerStatus.css";

function WorkerStatus({ worker }) {
  return (
    <div className={`worker-status ${worker.injured ? "injured" : "healthy"} `}>
      <div className="worker-icon">{worker.injured ? "🤕" : "👷"}</div>
      <div className="worker-info">
        <div className="worker-name">{worker.name}</div>
        <div className="worker-state">
          {worker.injured ? "Injured (Resting)" : "Ready to Work"}
        </div>
        {/* Add recovery timer for injured workers */}
        {worker.injured && (
          <div className="recovery-timer">
            Recovers in: {worker.recoveryTime}s
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkerStatus;
