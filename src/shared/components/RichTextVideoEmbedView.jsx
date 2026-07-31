import { NodeViewWrapper } from "@tiptap/react";
import { isAllowedExternalVideoEmbedSrc } from "../utils/videoEmbedUrl.js";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";
import RichTextBlockSelectionHandle from "./RichTextBlockSelectionHandle.jsx";

const ALLOWED_PROVIDERS = new Set(["google_drive", "vento"]);

export default function RichTextVideoEmbedView({ node, editor, selected, getPos }) {
  const provider = String(node.attrs.provider ?? "");
  const src = String(node.attrs.src ?? "");
  const valid = ALLOWED_PROVIDERS.has(provider) && isAllowedExternalVideoEmbedSrc(src, provider);
  const title = provider === "google_drive" ? "Vídeo Google Drive" : "Vídeo Vento";

  return (
    <NodeViewWrapper className={`od-editor-block od-editor-selectable-block od-video-embed${selected ? " is-selected" : ""}`} data-od-video-embed="">
      <RichTextBlockSelectionHandle editor={editor} getPos={getPos} nodeName="videoEmbed" label={`Seleccionar ${title}`} />
      <RichTextBlockDragHandle editor={editor} label={`Arrastrar ${title}`} />
      {valid ? (
        <iframe
          src={src}
          className="od-video-embed__iframe"
          frameBorder="0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title={title}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
