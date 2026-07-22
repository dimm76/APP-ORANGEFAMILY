import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IonButton, IonIcon } from "@ionic/react";
import RichTextBlockMenu from "./RichTextBlockMenu.jsx";
import { OD_ICONS } from "../ui/odIcons.js";

const WIKI_ADD_BLOCK_HOST_ID = "od-wiki-add-block-host";
const WIKI_BLOCK_PANEL_HOST_ID = "od-wiki-block-panel-host";

function WikiBlockInsertMenu({
  editor,
  insertId,
  onPickImage,
  onPickYoutube,
  onPickGoogleDriveVideo,
  onPickVentoVideo,
  onPickGoogleSheets,
  onPickFigma,
}) {
  const [btnHostEl, setBtnHostEl] = useState(null);
  const [panelHostEl, setPanelHostEl] = useState(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    setBtnHostEl(document.getElementById(WIKI_ADD_BLOCK_HOST_ID));
    setPanelHostEl(document.getElementById(WIKI_BLOCK_PANEL_HOST_ID));
  }, [insertId]);

  useEffect(() => {
    if (!panelHostEl) return undefined;
    panelHostEl.classList.toggle("is-open", open);
    panelHostEl.setAttribute("aria-hidden", open ? "false" : "true");
    return () => {
      panelHostEl.classList.remove("is-open");
      panelHostEl.setAttribute("aria-hidden", "true");
    };
  }, [open, panelHostEl]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handlers = useMemo(
    () => ({
      onPickImage: () => {
        setOpen(false);
        onPickImage?.();
      },
      onPickYoutube: () => {
        setOpen(false);
        onPickYoutube?.();
      },
      onPickGoogleDriveVideo: () => {
        setOpen(false);
        onPickGoogleDriveVideo?.();
      },
      onPickVentoVideo: () => {
        setOpen(false);
        onPickVentoVideo?.();
      },
      onPickGoogleSheets: () => {
        setOpen(false);
        onPickGoogleSheets?.();
      },
      onPickFigma: () => {
        setOpen(false);
        onPickFigma?.();
      },
    }),
    [
      onPickImage,
      onPickYoutube,
      onPickGoogleDriveVideo,
      onPickVentoVideo,
      onPickGoogleSheets,
      onPickFigma,
    ]
  );

  if (!editor || !btnHostEl) return null;

  const btnPortal = (
    <span className="od-wiki-add-block-btn-wrap">
      <IonButton
        type="button"
        fill="clear"
        aria-label="Añadir bloque"
        aria-expanded={open}
        title="Añadir bloque"
        className={`od-wiki-add-block-btn${open ? " is-active" : ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        <IonIcon icon={OD_ICONS.blocksAdd} aria-hidden="true" />
      </IonButton>
    </span>
  );

  const panelPortal =
    open && panelHostEl
      ? createPortal(
          <div ref={panelRef} className="od-wiki-block-insert-panel" role="region" aria-label="Añadir bloque">
            <div className="od-wiki-block-insert-panel__header">
              <h2 className="od-wiki-block-insert-panel__title">Añadir bloque</h2>
              <button
                type="button"
                className="od-wiki-block-insert-panel__close"
                aria-label="Cerrar panel de inserción"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <RichTextBlockMenu
              editor={editor}
              handlers={handlers}
              className="od-wiki-add-block-menu od-wiki-block-menu-scroll"
              ariaLabel="Añadir bloque"
              onItemSelect={() => setOpen(false)}
            />
          </div>,
          panelHostEl
        )
      : null;

  return (
    <>
      {createPortal(btnPortal, btnHostEl)}
      {panelPortal}
    </>
  );
}

export { WIKI_ADD_BLOCK_HOST_ID, WikiBlockInsertMenu };
