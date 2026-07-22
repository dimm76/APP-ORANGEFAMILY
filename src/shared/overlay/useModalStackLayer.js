import { useLayoutEffect, useState } from "react";
import { acquireModalStackLayer } from "./odModalStack.js";

/**
 * Registra la modal en la pila global y devuelve su nivel (1–3).
 * @param {boolean} [active]
 * @returns {1|2|3}
 */
export function useModalStackLayer(active = true) {
  const [level, setLevel] = useState(/** @type {1|2|3} */ (1));

  useLayoutEffect(() => {
    if (!active) {
      setLevel(1);
      return undefined;
    }
    const { level: acquired, release } = acquireModalStackLayer();
    setLevel(acquired);
    return () => {
      release();
      setLevel(1);
    };
  }, [active]);

  return level;
}

/**
 * @param {1|2|3} level
 */
export function modalBackdropLevelClass(level) {
  return `od-modal-level-${level}`;
}
