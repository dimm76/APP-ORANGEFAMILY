import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import RichTextFigmaEmbedView from "./RichTextFigmaEmbedView.jsx";
import {
  buildFigmaEmbedClassName,
  clampFigmaEmbedHeight,
  figmaEmbedSrcFromUrl,
  parseFigmaUrl,
  resolveFigmaModes,
} from "../utils/figmaEmbedUrl.js";

export const RichTextFigmaEmbed = Node.create({
  name: "figmaEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-url"),
        renderHTML: (attributes) => {
          if (!attributes.url) return {};
          return { "data-url": String(attributes.url) };
        },
      },
      height: {
        default: 640,
        parseHTML: (element) =>
          clampFigmaEmbedHeight(element.getAttribute("data-height")),
        renderHTML: (attributes) => ({
          "data-height": String(clampFigmaEmbedHeight(attributes.height)),
        }),
      },
      widthMode: {
        default: "normal",
        parseHTML: (element) =>
          resolveFigmaModes({
            widthMode: element.getAttribute("data-width-mode"),
          }).widthMode,
        renderHTML: (attributes) => ({
          "data-width-mode": resolveFigmaModes(attributes).widthMode,
        }),
      },
      showToolbar: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-toolbar") !== "false",
        renderHTML: (attributes) => ({
          "data-show-toolbar": attributes.showToolbar === false ? "false" : "true",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-od-figma-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = String(node.attrs.url ?? "").trim();
    const height = clampFigmaEmbedHeight(node.attrs.height);
    const { widthMode } = resolveFigmaModes(node.attrs);
    const showToolbar = node.attrs.showToolbar !== false;
    const embedSrc = figmaEmbedSrcFromUrl(url);
    const className = `${buildFigmaEmbedClassName(widthMode)}${
      embedSrc ? "" : " od-figma-embed--empty"
    }`;

    const baseAttrs = mergeAttributes(HTMLAttributes, {
      "data-od-figma-embed": "",
      class: className,
      "data-url": url || "",
      "data-height": String(height),
      "data-width-mode": widthMode,
      "data-show-toolbar": showToolbar ? "true" : "false",
    });

    if (!embedSrc) {
      return ["div", baseAttrs];
    }

    return [
      "div",
      baseAttrs,
      [
        "iframe",
        {
          src: embedSrc,
          class: "od-figma-embed__iframe",
          width: "100%",
          height: String(height),
          loading: "lazy",
          frameborder: "0",
          allowfullscreen: "true",
          title: "Figma",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextFigmaEmbedView);
  },

  addCommands() {
    return {
      setFigmaEmbed:
        (options) =>
        ({ commands }) => {
          const parsed = parseFigmaUrl(options?.url);
          if (!parsed.ok) return false;
          const { widthMode } = resolveFigmaModes({
            widthMode: options?.widthMode,
          });

          return commands.insertContent({
            type: this.name,
            attrs: {
              url: parsed.url,
              height: clampFigmaEmbedHeight(options?.height),
              widthMode,
              showToolbar: options?.showToolbar !== false,
            },
          });
        },

      updateFigmaEmbed:
        (options) =>
        ({ commands }) => {
          const next = { ...options };

          if (options?.url != null) {
            const parsed = parseFigmaUrl(options.url);
            if (!parsed.ok) return false;
            next.url = parsed.url;
          }

          if (options?.height != null) {
            next.height = clampFigmaEmbedHeight(options.height);
          }

          if (options?.widthMode != null) {
            next.widthMode = resolveFigmaModes({
              widthMode: options.widthMode,
            }).widthMode;
          }

          return commands.updateAttributes(this.name, next);
        },
    };
  },
});
