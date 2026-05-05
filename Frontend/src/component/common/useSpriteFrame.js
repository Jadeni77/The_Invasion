import { useEffect, useState } from "react";
import { AssetManifest } from "../../assets/AssetManifest.js";

export function useSpriteFrame(category, name, spriteType = "idle") {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const asset = AssetManifest[category]?.[name];
    const spriteFn = asset?.sprites?.[spriteType];
    const cfg = asset?.config?.[spriteType];
    if (!spriteFn || !cfg) return;

    (async () => {
      try {
        const sprite = await spriteFn();
        const path = sprite?.default || sprite;
        if (!path) return;

        const img = new Image();
        img.src = path;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (cfg.cropConfig?.enabled) {
          const { cropWidth, cropHeight, offsetX, offsetY } = cfg.cropConfig;
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          ctx.drawImage(
            img,
            offsetX, offsetY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
        } else {
          canvas.width = cfg.frameWidth;
          canvas.height = cfg.frameHeight;
          ctx.drawImage(
            img,
            0, 0, cfg.frameWidth, cfg.frameHeight,
            0, 0, cfg.frameWidth, cfg.frameHeight
          );
        }

        if (!cancelled) setDataUrl(canvas.toDataURL());
      } catch (err) {
        console.warn(`Failed to extract sprite frame for ${category}/${name}:`, err);
      }
    })();

    return () => { cancelled = true; };
  }, [category, name, spriteType]);

  return dataUrl;
}
