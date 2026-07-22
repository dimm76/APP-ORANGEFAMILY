import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import RichTextOdContainerView from "./RichTextOdContainerView.jsx";
import {
  DEFAULT_OD_CONTAINER_ATTRS,
  buildOdContainerClassName,
  buildOdContainerInnerStyle,
  readOdContainerAttrsFromElement,
  renderOdContainerDataAttributes,
  resolveOdContainerAttrs,
} from "../utils/odContainerAttrs.js";

export const RichTextOdContainer = Node.create({
  name: "odContainer",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      widthMode: {
        default: DEFAULT_OD_CONTAINER_ATTRS.widthMode,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).widthMode,
        renderHTML: (attributes) => ({
          "data-width-mode": resolveOdContainerAttrs(attributes).widthMode,
        }),
      },
      backgroundType: {
        default: DEFAULT_OD_CONTAINER_ATTRS.backgroundType,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).backgroundType,
        renderHTML: (attributes) => ({
          "data-background-type": resolveOdContainerAttrs(attributes).backgroundType,
        }),
      },
      backgroundColorKey: {
        default: null,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).backgroundColorKey,
        renderHTML: (attributes) => {
          const key = resolveOdContainerAttrs(attributes).backgroundColorKey;
          return key ? { "data-background-color-key": key } : {};
        },
      },
      backgroundImageId: {
        default: null,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).backgroundImageId,
        renderHTML: (attributes) => {
          const id = resolveOdContainerAttrs(attributes).backgroundImageId;
          return id ? { "data-background-image-id": id } : {};
        },
      },
      backgroundImageUrl: {
        default: null,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).backgroundImageUrl,
        renderHTML: () => ({}),
      },
      borderEnabled: {
        default: DEFAULT_OD_CONTAINER_ATTRS.borderEnabled,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).borderEnabled,
        renderHTML: (attributes) => ({
          "data-border-enabled": resolveOdContainerAttrs(attributes).borderEnabled ? "true" : "false",
        }),
      },
      borderColorKey: {
        default: DEFAULT_OD_CONTAINER_ATTRS.borderColorKey,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).borderColorKey,
        renderHTML: (attributes) => {
          const key = resolveOdContainerAttrs(attributes).borderColorKey;
          return key ? { "data-border-color-key": key } : {};
        },
      },
      borderWidth: {
        default: DEFAULT_OD_CONTAINER_ATTRS.borderWidth,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).borderWidth,
        renderHTML: (attributes) => ({
          "data-border-width": String(resolveOdContainerAttrs(attributes).borderWidth),
        }),
      },
      borderRadius: {
        default: DEFAULT_OD_CONTAINER_ATTRS.borderRadius,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).borderRadius,
        renderHTML: (attributes) => ({
          "data-border-radius": String(resolveOdContainerAttrs(attributes).borderRadius),
        }),
      },
      paddingTop: {
        default: DEFAULT_OD_CONTAINER_ATTRS.paddingTop,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).paddingTop,
        renderHTML: (attributes) => ({
          "data-padding-top": String(resolveOdContainerAttrs(attributes).paddingTop),
        }),
      },
      paddingRight: {
        default: DEFAULT_OD_CONTAINER_ATTRS.paddingRight,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).paddingRight,
        renderHTML: (attributes) => ({
          "data-padding-right": String(resolveOdContainerAttrs(attributes).paddingRight),
        }),
      },
      paddingBottom: {
        default: DEFAULT_OD_CONTAINER_ATTRS.paddingBottom,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).paddingBottom,
        renderHTML: (attributes) => ({
          "data-padding-bottom": String(resolveOdContainerAttrs(attributes).paddingBottom),
        }),
      },
      paddingLeft: {
        default: DEFAULT_OD_CONTAINER_ATTRS.paddingLeft,
        parseHTML: (element) => readOdContainerAttrsFromElement(element).paddingLeft,
        renderHTML: (attributes) => ({
          "data-padding-left": String(resolveOdContainerAttrs(attributes).paddingLeft),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="od-container"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const resolved = resolveOdContainerAttrs(node.attrs);
    const innerStyle = buildOdContainerInnerStyle(resolved);
    const styleString = Object.entries(innerStyle)
      .map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return `${cssKey}:${value}`;
      })
      .join(";");

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: buildOdContainerClassName(resolved.widthMode),
        ...renderOdContainerDataAttributes(resolved),
      }),
      ["div", { class: "od-tiptap-container__inner", style: styleString }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextOdContainerView);
  },

  addCommands() {
    return {
      insertOdContainer:
        () =>
        ({ chain, editor }) => {
          const payload = {
            type: this.name,
            attrs: { ...DEFAULT_OD_CONTAINER_ATTRS },
            content: [{ type: "paragraph" }],
          };
          const ok = chain().focus().insertContent(payload).run();
          if (!ok) return false;

          queueMicrotask(() => {
            let lastPos = -1;
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === "odContainer") lastPos = pos;
              return true;
            });
            if (lastPos < 0) return;
            const innerPos = lastPos + 1 + 1;
            try {
              editor.commands.setTextSelection(TextSelection.create(editor.state.doc, innerPos));
            } catch (_e) {
              /* noop */
            }
          });
          return true;
        },
    };
  },
});
