import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import RichTextGoogleSheetsEmbedView from "./RichTextGoogleSheetsEmbedView.jsx";
import {
  buildGoogleSheetsEmbedClassName,
  clampGoogleSheetsEmbedHeight,
  googleSheetsEmbedSrcFromUrl,
  legacyVisualStyleFromModes,
  parseGoogleSheetsUrl,
  resolveGoogleSheetsModes,
} from "../utils/googleSheetsEmbedUrl.js";

function readModesFromElement(element) {
  return resolveGoogleSheetsModes({
    viewMode: element.getAttribute("data-view-mode"),
    widthMode: element.getAttribute("data-width-mode"),
    visualStyle: element.getAttribute("data-visual-style"),
  });
}

function renderModeAttributes(viewMode, widthMode) {
  return {
    "data-view-mode": viewMode,
    "data-width-mode": widthMode,
    "data-visual-style": legacyVisualStyleFromModes(viewMode, widthMode),
  };
}

export const RichTextGoogleSheetsEmbed = Node.create({
  name: "googleSheetsEmbed",
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
        default: 600,
        parseHTML: (element) =>
          clampGoogleSheetsEmbedHeight(element.getAttribute("data-height")),
        renderHTML: (attributes) => ({
          "data-height": String(clampGoogleSheetsEmbedHeight(attributes.height)),
        }),
      },
      viewMode: {
        default: "normal",
        parseHTML: (element) => readModesFromElement(element).viewMode,
        renderHTML: (attributes) => {
          const { viewMode, widthMode } = resolveGoogleSheetsModes(attributes);
          return renderModeAttributes(viewMode, widthMode);
        },
      },
      widthMode: {
        default: "normal",
        parseHTML: (element) => readModesFromElement(element).widthMode,
        renderHTML: () => ({}),
      },
      visualStyle: {
        default: "normal",
        parseHTML: (element) =>
          legacyVisualStyleFromModes(
            readModesFromElement(element).viewMode,
            readModesFromElement(element).widthMode
          ),
        renderHTML: () => ({}),
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
    return [{ tag: "div[data-od-gsheets-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = String(node.attrs.url ?? "").trim();
    const height = clampGoogleSheetsEmbedHeight(node.attrs.height);
    const { viewMode, widthMode } = resolveGoogleSheetsModes(node.attrs);
    const showToolbar = node.attrs.showToolbar !== false;
    const embedSrc = googleSheetsEmbedSrcFromUrl(url, viewMode);
    const className = `${buildGoogleSheetsEmbedClassName(viewMode, widthMode)}${
      embedSrc ? "" : " od-gsheets-embed--empty"
    }`;

    const baseAttrs = mergeAttributes(HTMLAttributes, {
      "data-od-gsheets-embed": "",
      class: className,
      "data-url": url || "",
      "data-height": String(height),
      ...renderModeAttributes(viewMode, widthMode),
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
          class: "od-gsheets-embed__iframe",
          width: "100%",
          height: String(height),
          loading: "lazy",
          frameborder: "0",
          title: "Google Sheets",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextGoogleSheetsEmbedView);
  },

  addCommands() {
    return {
      setGoogleSheetsEmbed:
        (options) =>
        ({ commands }) => {
          const parsed = parseGoogleSheetsUrl(options?.url);
          if (!parsed.ok) return false;
          const { viewMode, widthMode } = resolveGoogleSheetsModes({
            viewMode: options?.viewMode,
            widthMode: options?.widthMode,
            visualStyle: options?.visualStyle,
          });
          return commands.insertContent({
            type: this.name,
            attrs: {
              url: parsed.url,
              height: clampGoogleSheetsEmbedHeight(options?.height),
              viewMode,
              widthMode,
              visualStyle: legacyVisualStyleFromModes(viewMode, widthMode),
              showToolbar: options?.showToolbar !== false,
            },
          });
        },
      updateGoogleSheetsEmbed:
        (options) =>
        ({ commands }) => {
          const next = { ...options };
          if (options?.url != null) {
            const parsed = parseGoogleSheetsUrl(options.url);
            if (!parsed.ok) return false;
            next.url = parsed.url;
          }
          if (options?.height != null) {
            next.height = clampGoogleSheetsEmbedHeight(options.height);
          }
          if (
            options?.viewMode != null ||
            options?.widthMode != null ||
            options?.visualStyle != null
          ) {
            const current = commands.editor.getAttributes(this.name);
            const resolved = resolveGoogleSheetsModes({
              viewMode: options?.viewMode ?? current.viewMode,
              widthMode: options?.widthMode ?? current.widthMode,
              visualStyle: options?.visualStyle ?? current.visualStyle,
            });
            next.viewMode = resolved.viewMode;
            next.widthMode = resolved.widthMode;
            next.visualStyle = legacyVisualStyleFromModes(
              resolved.viewMode,
              resolved.widthMode
            );
          }
          return commands.updateAttributes(this.name, next);
        },
    };
  },
});
