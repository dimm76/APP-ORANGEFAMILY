/* eslint-disable react-refresh/only-export-components */
import Youtube, { getEmbedUrlFromYoutubeUrl } from "@tiptap/extension-youtube";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";

function RichTextYoutubeView({ node, editor, extension }) {
  const src = getEmbedUrlFromYoutubeUrl({
    url: node.attrs.src,
    ...extension.options,
    startAt: node.attrs.start || 0,
  });

  return (
    <NodeViewWrapper className="od-editor-block od-editor-youtube" data-youtube-video="">
      <RichTextBlockDragHandle editor={editor} label="Arrastrar vídeo de YouTube" />
      <iframe
        {...extension.options.HTMLAttributes}
        src={src || undefined}
        width={node.attrs.width}
        height={node.attrs.height}
        allowFullScreen={extension.options.allowFullscreen}
        title="Vídeo de YouTube"
      />
    </NodeViewWrapper>
  );
}

export const RichTextYoutube = Youtube.extend({
  selectable: true,
  draggable: true,

  addNodeView() {
    return ReactNodeViewRenderer(RichTextYoutubeView);
  },
});
