/**
 * Escala global de overlays OrangeDesk.
 * Incremento por nivel de modal: +100 backdrop, +50 overlays internos.
 *
 * Nivel 1 — fichas (ticket, tarea, factura, email bandeja): backdrop 120000, overlay 120050
 * Nivel 2 — modal sobre ficha (crear tarea, nota, email desde tarea): backdrop 120100, overlay 120150
 * Nivel 3 — tercera capa: backdrop 120200, overlay 120250
 * Página — dropdowns/selects portal: 10050
 * Lightbox adjuntos: 120300
 */
export const OD_OVERLAY_Z = Object.freeze({
  DROPDOWN: 10050,
  MODAL_L1_BACKDROP: 120000,
  MODAL_L1_OVERLAY: 120050,
  MODAL_L2_BACKDROP: 120100,
  MODAL_L2_OVERLAY: 120150,
  MODAL_L3_BACKDROP: 120200,
  MODAL_L3_OVERLAY: 120250,
  LIGHTBOX: 120300,
});

/** @type {number} */
let stackDepth = 0;

export function currentModalStackDepth() {
  return stackDepth;
}

/**
 * z-index para menús portal (CommsPortalMenu, ODFilterSelect, etc.) según profundidad actual.
 * IonPopover usa inline ~20000+N; la escala en modales se aplica vía od-overlay-stack.css (!important).
 */
export function overlayZIndexForStackDepth(depth = stackDepth) {
  if (depth >= 3) return OD_OVERLAY_Z.MODAL_L3_OVERLAY;
  if (depth >= 2) return OD_OVERLAY_Z.MODAL_L2_OVERLAY;
  if (depth >= 1) return OD_OVERLAY_Z.MODAL_L1_OVERLAY;
  return OD_OVERLAY_Z.DROPDOWN;
}

function syncDom() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("od-modal-stack-1", "od-modal-stack-2", "od-modal-stack-3");
  if (stackDepth > 0) {
    html.classList.add(`od-modal-stack-${Math.min(stackDepth, 3)}`);
  }
}

/**
 * Registra una capa modal. Llamar release al desmontar/cerrar.
 * @returns {{ level: 1|2|3, release: () => void }}
 */
export function acquireModalStackLayer() {
  stackDepth = Math.min(stackDepth + 1, 3);
  /** @type {1|2|3} */
  const level = /** @type {1|2|3} */ (stackDepth);
  syncDom();
  return {
    level,
    release() {
      stackDepth = Math.max(0, stackDepth - 1);
      syncDom();
    },
  };
}
