import { Node, mergeAttributes } from "@tiptap/core";
import { isAllowedExternalVideoEmbedSrc } from "../utils/videoEmbedUrl.js";

const ALLOWED_PROVIDERS = new Set(["google_drive", "vento"]);

export const RichTextVideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      provider: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-provider"),
        renderHTML: (attributes) => {
          if (!attributes.provider) return {};
          return { "data-provider": String(attributes.provider) };
        },
      },
      src: {
        default: null,
        parseHTML: (element) => {
          const iframe =
            element.tagName === "IFRAME" ? element : element.querySelector?.("iframe");
          return iframe?.getAttribute("src") ?? null;
        },
      },
      originalUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-original-url"),
        renderHTML: (attributes) => {
          if (!attributes.originalUrl) return {};
          return { "data-original-url": String(attributes.originalUrl) };
        },
      },
      aspectRatio: {
        default: "16/9",
        parseHTML: (element) => element.getAttribute("data-aspect-ratio") || "16/9",
        renderHTML: (attributes) => ({
          "data-aspect-ratio": String(attributes.aspectRatio || "16/9"),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-od-video-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const provider = String(node.attrs.provider ?? "");
    const src = String(node.attrs.src ?? "");
    const aspectRatio = String(node.attrs.aspectRatio || "16/9");

    if (!ALLOWED_PROVIDERS.has(provider) || !isAllowedExternalVideoEmbedSrc(src, provider)) {
      return ["div", { "data-od-video-embed": "", class: "od-video-embed" }];
    }

    const title = provider === "google_drive" ? "Vídeo Google Drive" : "Vídeo Vento";

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-od-video-embed": "",
        class: "od-video-embed",
        "data-provider": provider,
        "data-aspect-ratio": aspectRatio,
      }),
      [
        "iframe",
        {
          src,
          class: "od-video-embed__iframe",
          frameborder: "0",
          allowfullscreen: "true",
          loading: "lazy",
          referrerpolicy: "strict-origin-when-cross-origin",
          title,
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (options) =>
        ({ commands }) => {
          const provider = String(options?.provider ?? "");
          const src = String(options?.src ?? "");
          if (!ALLOWED_PROVIDERS.has(provider) || !isAllowedExternalVideoEmbedSrc(src, provider)) {
            return false;
          }
          return commands.insertContent({
            type: this.name,
            attrs: {
              provider,
              src,
              originalUrl: options?.originalUrl ?? null,
              aspectRatio: options?.aspectRatio ?? "16/9",
            },
          });
        },
    };
  },
});
