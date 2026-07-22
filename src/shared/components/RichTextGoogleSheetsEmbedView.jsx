import { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { IonIcon } from "@ionic/react";
import { lockClosedOutline, openOutline } from "ionicons/icons";
import { useGoogleSheetsFullWidthMetrics } from "../hooks/useGoogleSheetsFullWidthMetrics.js";
import {
  buildGoogleSheetsEmbedClassName,
  clampGoogleSheetsEmbedHeight,
  googleSheetsEmbedSrcFromUrl,
  legacyVisualStyleFromModes,
  resolveGoogleSheetsModes,
} from "../utils/googleSheetsEmbedUrl.js";

/**
 * @param {import("@tiptap/react").NodeViewProps} props
 */
export default function RichTextGoogleSheetsEmbedView({ node, selected }) {
  const rootRef = useRef(null);
  const url = String(node.attrs.url ?? "").trim();
  const height = clampGoogleSheetsEmbedHeight(node.attrs.height);
  const { viewMode, widthMode } = resolveGoogleSheetsModes(node.attrs);
  const showToolbar = node.attrs.showToolbar !== false;
  const embedSrc = googleSheetsEmbedSrcFromUrl(url, viewMode);
  const [interactionLocked, setInteractionLocked] = useState(true);
  const legacyStyle = legacyVisualStyleFromModes(viewMode, widthMode);
  const isFullWidth = widthMode === "full";
  useGoogleSheetsFullWidthMetrics(rootRef, isFullWidth);

  return (
    <NodeViewWrapper
      ref={rootRef}
      className={`${buildGoogleSheetsEmbedClassName(viewMode, widthMode)}${
        selected ? " is-selected" : ""
      }${!embedSrc ? " od-gsheets-embed--empty" : ""}${
        isFullWidth ? " od-gsheets-embed--has-full-metrics" : ""
      }`}
      data-od-gsheets-embed=""
      data-url={url || undefined}
      data-height={String(height)}
      data-view-mode={viewMode}
      data-width-mode={widthMode}
      data-visual-style={legacyStyle}
      data-show-toolbar={showToolbar ? "true" : "false"}
    >
      <div className="od-gsheets-embed__breakout">
        {showToolbar && embedSrc ? (
          <div className="od-gsheets-embed__toolbar" contentEditable={false}>
            <button
              type="button"
              className="od-gsheets-embed__toolbar-btn"
              title="Abrir en nueva pestaña"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <IonIcon icon={openOutline} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`od-gsheets-embed__toolbar-btn${
                interactionLocked ? " is-active" : ""
              }`}
              title={
                interactionLocked
                  ? "Desbloquear interacción con la hoja"
                  : "Bloquear interacción con la hoja"
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setInteractionLocked((value) => !value)}
            >
              <IonIcon icon={lockClosedOutline} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="od-gsheets-embed__frame-wrap">
          {embedSrc ? (
            <>
              <iframe
                className="od-gsheets-embed__iframe"
                src={embedSrc}
                title="Google Sheets"
                loading="lazy"
                frameBorder="0"
                style={{
                  width: "100%",
                  height: `${height}px`,
                  minHeight: `${height}px`,
                }}
              />
              {interactionLocked ? (
                <div
                  className="od-gsheets-embed__interaction-shield"
                  contentEditable={false}
                  aria-hidden="true"
                />
              ) : null}
            </>
          ) : (
            <div className="od-gsheets-embed__placeholder" contentEditable={false}>
              Introduce una URL de Google Sheets válida.
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
