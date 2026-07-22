import { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { IonIcon } from "@ionic/react";
import { lockClosedOutline, openOutline } from "ionicons/icons";
import { useRichTextEmbedFullWidthMetrics } from "../hooks/useGoogleSheetsFullWidthMetrics.js";
import {
  buildFigmaEmbedClassName,
  clampFigmaEmbedHeight,
  figmaEmbedSrcFromUrl,
  resolveFigmaModes,
} from "../utils/figmaEmbedUrl.js";

/**
 * @param {import("@tiptap/react").NodeViewProps} props
 */
export default function RichTextFigmaEmbedView({ node, selected }) {
  const rootRef = useRef(null);
  const url = String(node.attrs.url ?? "").trim();
  const height = clampFigmaEmbedHeight(node.attrs.height);
  const { widthMode } = resolveFigmaModes(node.attrs);
  const showToolbar = node.attrs.showToolbar !== false;
  const embedSrc = figmaEmbedSrcFromUrl(url);
  const [interactionLocked, setInteractionLocked] = useState(true);
  const isFullWidth = widthMode === "full";

  useRichTextEmbedFullWidthMetrics(rootRef, isFullWidth, {
    breakoutSelector: ".od-figma-embed__breakout",
    cssVarPrefix: "--od-figma",
  });

  return (
    <NodeViewWrapper
      ref={rootRef}
      className={`${buildFigmaEmbedClassName(widthMode)}${
        selected ? " is-selected" : ""
      }${!embedSrc ? " od-figma-embed--empty" : ""}${
        isFullWidth ? " od-figma-embed--has-full-metrics" : ""
      }`}
      data-od-figma-embed=""
      data-url={url || undefined}
      data-height={String(height)}
      data-width-mode={widthMode}
      data-show-toolbar={showToolbar ? "true" : "false"}
    >
      <div className="od-figma-embed__breakout">
        {showToolbar && embedSrc ? (
          <div className="od-figma-embed__toolbar" contentEditable={false}>
            <button
              type="button"
              className="od-figma-embed__toolbar-btn"
              title="Abrir en nueva pestana"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <IonIcon icon={openOutline} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={`od-figma-embed__toolbar-btn${
                interactionLocked ? " is-active" : ""
              }`}
              title={
                interactionLocked
                  ? "Desbloquear interaccion con Figma"
                  : "Bloquear interaccion con Figma"
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setInteractionLocked((value) => !value)}
            >
              <IonIcon icon={lockClosedOutline} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="od-figma-embed__frame-wrap">
          {embedSrc ? (
            <>
              <iframe
                className="od-figma-embed__iframe"
                src={embedSrc}
                title="Figma"
                loading="lazy"
                frameBorder="0"
                allowFullScreen
                style={{
                  width: "100%",
                  height: `${height}px`,
                  minHeight: `${height}px`,
                }}
              />
              {interactionLocked ? (
                <div
                  className="od-figma-embed__interaction-shield"
                  contentEditable={false}
                  aria-hidden="true"
                />
              ) : null}
            </>
          ) : (
            <div className="od-figma-embed__placeholder" contentEditable={false}>
              Introduce una URL de Figma valida.
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
