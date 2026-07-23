import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { albumsOutline, cloudUploadOutline } from "ionicons/icons";
import { overlayZIndexForStackDepth } from "../../shared/overlay/odModalStack.js";

export function OrangePhotosAnchoredPortal({ anchorRef, width = 280, onClose, label, children }) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => { const place = () => { const rect = anchorRef.current?.getBoundingClientRect(); if (!rect) return; const actual = Math.min(width, window.innerWidth - 24); setStyle({ position: "fixed", width: actual, top: Math.min(rect.bottom + 6, window.innerHeight - 12), left: Math.max(12, Math.min(rect.right - actual, window.innerWidth - actual - 12)), zIndex: overlayZIndexForStackDepth() }); }; place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true); return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); }; }, [anchorRef, width]);
  useEffect(() => { const key = event => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  if (!style || typeof document === "undefined") return null;
  return createPortal(<><button type="button" className="od-orangephotos-popover-shield" aria-label={label} onClick={onClose} />{children(style)}</>, document.body);
}

export default function OrangePhotosCreateMenu({ open, anchorRef, onClose, onCreateAlbum, onImport }) {
  if (!open) return null;
  return <OrangePhotosAnchoredPortal anchorRef={anchorRef} onClose={onClose} label="Cerrar menú">{style => <div className="od-action-menu od-orangephotos-create-menu" style={style} role="menu"><p>Crear</p><button className="od-action-menu-item" type="button" role="menuitem" onClick={onCreateAlbum}><IonIcon icon={albumsOutline} />Crear álbum</button><hr /><p>Añadir fotos</p><button className="od-action-menu-item" type="button" role="menuitem" onClick={onImport}><IonIcon icon={cloudUploadOutline} />Importar fotos y vídeos</button></div>}</OrangePhotosAnchoredPortal>;
}
