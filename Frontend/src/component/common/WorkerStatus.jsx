import React from "react";

function WorkerStatus({ worker }) {
  return (
    <div className={`worker-status ${worker.injured ? "injured" : "healthy"} `}>
      <div className="worker-icon">{worker.injured ? "🤕" : "👷"}</div>
      <div className="worker-info">
        <div className="worker-name">{worker.name}</div>
        <div className="worker-state">
          {worker.injured ? "Injured (Resting)" : "Ready to Work"}
        </div>
      </div>
    </div>
  );
}

export default WorkerStatus;
