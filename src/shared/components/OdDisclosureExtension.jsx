import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

function OdDisclosureNodeView({ node, updateAttributes }) {
  const title = node.attrs.title || "Título del desplegable";
  const open = Boolean(node.attrs.open);

  function toggleOpen() {
    updateAttributes({ open: !open });
  }

  function updateTitle(event) {
    updateAttributes({
      title: event.target.value,
    });
  }

  return (
    <NodeViewWrapper
      className={`od-editor-block od-editor-disclosure${open ? " is-open" : ""}`}
      data-od-node="disclosure"
      data-open={open ? "true" : "false"}
    >
      <div className="od-editor-disclosure__summary" contentEditable={false}>
        <button
          type="button"
          className="od-editor-disclosure__toggle od-editor-icon-button"
          aria-label={open ? "Plegar contenido" : "Desplegar contenido"}
          aria-expanded={open ? "true" : "false"}
          onClick={toggleOpen}
        >
          <IonIcon icon={open ? OD_ICONS.chevronUp : OD_ICONS.chevronDown} aria-hidden="true" />
        </button>

        <input
          className="od-editor-disclosure__title"
          value={title}
          aria-label="Título del desplegable"
          placeholder="Título del desplegable"
          onChange={updateTitle}
        />
      </div>

      <NodeViewContent className="od-editor-disclosure__content" />
    </NodeViewWrapper>
  );
}

export const OdDisclosure = Node.create({
  name: "odDisclosure",

  group: "block",

  content: "block+",

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      title: {
        default: "Título del desplegable",
        parseHTML: (element) => {
          const summary = element.querySelector("summary");
          return summary?.textContent?.trim() || element.getAttribute("data-title") || "Título del desplegable";
        },
        renderHTML: (attributes) => ({
          "data-title": attributes.title || "Título del desplegable",
        }),
      },
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute("open") || element.getAttribute("data-open") === "true",
        renderHTML: (attributes) => {
          if (!attributes.open) return { "data-open": "false" };
          return {
            open: "",
            "data-open": "true",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'details[data-od-node="disclosure"]',
      },
      {
        tag: 'div[data-od-node="disclosure"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        "data-od-node": "disclosure",
        class: "od-editor-disclosure",
      }),
      ["summary", { class: "od-editor-disclosure__summary" }, node.attrs.title || "Título del desplegable"],
      ["div", { class: "od-editor-disclosure__content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(OdDisclosureNodeView);
  },

  addCommands() {
    return {
      insertOdDisclosure:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: "Título del desplegable",
              open: true,
            },
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Contenido desplegable...",
                  },
                ],
              },
            ],
          });
        },
    };
  },
});
