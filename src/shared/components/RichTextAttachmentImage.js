import Image from "@tiptap/extension-image";

/** Imagen embebida con `attachmentId`; seleccionable; sin deformar por atributos fijos. */
export const RichTextAttachmentImage = Image.extend({
  name: "image",

  group: "block",

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-attachment-id") ||
          element.getAttribute("attachmentid"),
        renderHTML: (attributes) => {
          if (!attributes.attachmentId) return {};
          return { "data-attachment-id": String(attributes.attachmentId) };
        },
      },
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => {
          if (!attributes.src) return {};
          return { src: String(attributes.src) };
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => {
          if (!attributes.alt) return {};
          return { alt: String(attributes.alt) };
        },
      },
      title: { default: null },
      /** Ancho de visualización en % del editor (no píxeles nativos). */
      displayWidth: {
        default: 100,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-display-width");
          if (raw == null || raw === "") return 100;
          const n = Number(raw);
          return Number.isFinite(n) ? Math.min(100, Math.max(25, n)) : 100;
        },
        renderHTML: (attributes) => {
          const n = Number(attributes.displayWidth);
          const pct = Number.isFinite(n) ? Math.min(100, Math.max(25, n)) : 100;
          return { "data-display-width": String(pct) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-attachment-id]" }, { tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      {
        ...HTMLAttributes,
        class: "od-rich-attachment-image",
      },
    ];
  },
});
