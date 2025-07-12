import Gold from "../../Icons/Gold.png";
import "../../style/AllImage.css"; // New: Import component-specific CSS


function ResourceIcon({ type, value }) {
  const getIcon = () => {
    switch (type) {
      case "gold":
        return <img src={Gold} alt="💰" className="resource-gold-image" />;
      case "workers":
        return "👷";
      case "iron":
        return "⛓️";
      case "grain":
        return "🌾";
      case "water":
        return "💧";
      case "gem":
        return "💎";
      default:
        return "❓";
    }
  };

  const getLabel = () => {
    switch (type) {
      case "gold":
        return "Gold";
      case "workers":
        return "Workers";
      case "iron":
        return "Iron";
      case "grain":
        return "Grain";
      case "water":
        return "Water";
      case "gem":
        return "Gems";
      default:
        return "Resource";
    }
  };

  return (
    <div className="resource-icon">
      <div className="resource-symbol">{getIcon()}</div>
      <div className="resource-info">
        <div className="resource-value">{value}</div>
        <div className="resource-label">{getLabel()}</div>
      </div>
    </div>
  );
}

export default ResourceIcon;
