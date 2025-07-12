import React, { useState, useEffect } from 'react';
import "../../style/EnergyBar.css";

const EnergyBar = ({ current, max, rechargeRate, lastRechargeTime }) => {
  const [timeToNextEnergy, setTimeToNextEnergy] = useState('Full');
  const [rechargeProgress, setRechargeProgress] = useState(0);
  
  useEffect(() => {
    const updateEnergyInfo = () => {
      if (current >= max) {
        setTimeToNextEnergy('Full');
        setRechargeProgress(100);
        return;
      }
      
      const now = Date.now();
      const timeSinceLast = now - lastRechargeTime;
      const timePerEnergy = (60 * 1000) / rechargeRate;
      const timeToNext = timePerEnergy - (timeSinceLast % timePerEnergy);
      
      const minutes = Math.floor(timeToNext / (1000 * 60));
      const seconds = Math.floor((timeToNext % (1000 * 60)) / 1000);
      
      setTimeToNextEnergy(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      
      // Calculate progress percentage for the current energy recharge
      const progress = (1 - (timeToNext / timePerEnergy)) * 100;
      setRechargeProgress(progress);
    };
    
    updateEnergyInfo();
    const interval = setInterval(updateEnergyInfo, 1000);
    
    return () => clearInterval(interval);
  }, [current, max, rechargeRate, lastRechargeTime]);

  return (
    <div className="energy-bar">
      <div className="energy-header">
        <div className="energy-icon">⚡</div>
        <div className="energy-text">Energy</div>
      </div>
      
      <div className="energy-info">
        <div className="energy-count">
          {current}/{max}
        </div>
        
        {current < max && (
          <div className="energy-timer">
            Next in: {timeToNextEnergy}
          </div>
        )}
      </div>
      
      <div className="energy-progress-bar">
        <div 
          className="energy-progress-fill"
          style={{ width: `${(current / max) * 100}%` }}
        />
        {current < max && (
          <div 
            className="energy-recharge-progress"
            style={{ width: `${rechargeProgress}%` }}
          />
        )}
      </div>
      
      <div className="energy-rate">
        Recharge rate: 1 energy per {Math.round(60 / rechargeRate)} minutes
      </div>
    </div>
  );
};

export default EnergyBar;