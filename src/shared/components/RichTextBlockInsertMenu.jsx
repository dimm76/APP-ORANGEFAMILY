import { useEffect, useMemo, useState } from "react";
import { IonButton, IonIcon } from "@ionic/react";
import RichTextBlockMenu from "./RichTextBlockMenu.jsx";
import { OD_ICONS } from "../ui/odIcons.js";

/**
 * Panel lateral de inserción de bloques para editores internos (RichTextEditor).
 * @param {{
 *   editor: import("@tiptap/core").Editor | null,
 *   onPickImage?: () => void,
 *   onPickGoogleSheets?: () => void,
 *   onPickFigma?: () => void,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function RichTextBlockInsertMenu({
  editor,
  onPickImage,
  onPickGoogleSheets,
  onPickFigma,
  children,
}) {
  const [open, setOpen] = useState(false);

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
      onPickGoogleSheets: () => {
        setOpen(false);
        onPickGoogleSheets?.();
      },
      onPickFigma: () => {
        setOpen(false);
        onPickFigma?.();
      },
    }),
    [onPickImage, onPickGoogleSheets, onPickFigma]
  );

  if (!editor) return children;

  return (
    <div className={`od-rich-text-editor__with-blocks${open ? " is-block-panel-open" : ""}`}>
      <div className="od-rich-text-editor__blocks-bar">
        <IonButton
          type="button"
          fill="clear"
          aria-label="Añadir bloque"
          aria-expanded={open}
          title="Añadir bloque"
          className={`od-rich-text-add-block-btn${open ? " is-active" : ""}`}
          onClick={() => setOpen((value) => !value)}
        >
          <IonIcon icon={OD_ICONS.blocksAdd} aria-hidden="true" />
        </IonButton>
      </div>
      <div className="od-rich-text-editor__workspace">
        <div className="od-rich-text-editor__main">{children}</div>
        {open ? (
          <aside className="od-rich-text-block-insert-panel" role="region" aria-label="Añadir bloque">
            <div className="od-rich-text-block-insert-panel__header">
              <h2 className="od-rich-text-block-insert-panel__title">Añadir bloque</h2>
              <button
                type="button"
                className="od-rich-text-block-insert-panel__close"
                aria-label="Cerrar panel de inserción"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <RichTextBlockMenu
              editor={editor}
              handlers={handlers}
              className="od-rich-text-add-block-menu od-rich-text-block-menu-scroll"
              ariaLabel="Añadir bloque"
              onItemSelect={() => setOpen(false)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
