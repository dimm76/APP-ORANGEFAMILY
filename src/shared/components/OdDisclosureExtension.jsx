import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";
import RichTextBlockSelectionHandle from "./RichTextBlockSelectionHandle.jsx";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";

// eslint-disable-next-line react-refresh/only-export-components
function OdDisclosureNodeView({ node, updateAttributes, editor, getPos, selected }) {
  const title = node.attrs.title || "Título del desplegable";
  const open = Boolean(node.attrs.open);
  const titleLevel =
    node.attrs.titleLevel === "paragraph"
      ? "paragraph"
      : [2, 3, 4].includes(Number(node.attrs.titleLevel))
        ? Number(node.attrs.titleLevel)
        : 2;
  const TitleTag = titleLevel === "paragraph" ? "p" : `h${titleLevel}`;

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
      className={`od-editor-block od-editor-selectable-block od-editor-disclosure${open ? " is-open" : ""}${selected ? " is-selected" : ""}`}
      data-od-node="disclosure"
      data-open={open ? "true" : "false"}
      data-node-pos={typeof getPos === "function" ? getPos() : undefined}
    >
      <RichTextBlockSelectionHandle editor={editor} getPos={getPos} nodeName="odDisclosure" label="Seleccionar desplegable" />
      <div className="od-editor-disclosure__summary" contentEditable={false}>
        <RichTextBlockDragHandle
          editor={editor}
          label="Arrastrar desplegable"
        />

        <button
          type="button"
          className="od-editor-disclosure__toggle od-editor-icon-button"
          aria-label={open ? "Plegar contenido" : "Desplegar contenido"}
          aria-expanded={open ? "true" : "false"}
          onClick={toggleOpen}
        >
          <IonIcon icon={open ? OD_ICONS.chevronUp : OD_ICONS.chevronDown} aria-hidden="true" />
        </button>

        <TitleTag
          className={`od-editor-disclosure__heading od-editor-disclosure__heading--${titleLevel === "paragraph" ? "paragraph" : `h${titleLevel}`}`}
        >
          <input
            className="od-editor-disclosure__title"
            value={title}
            aria-label="Título del desplegable"
            placeholder="Título del desplegable"
            onChange={updateTitle}
          />
        </TitleTag>
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

  draggable: true,

  selectable: true,

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
        default: false,
        parseHTML: (element) => element.hasAttribute("open") || element.getAttribute("data-open") === "true",
        renderHTML: (attributes) => {
          if (!attributes.open) return { "data-open": "false" };
          return {
            open: "",
            "data-open": "true",
          };
        },
      },
      titleLevel: {
        default: 2,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-title-level");
          if (raw === "paragraph") return "paragraph";
          const value = Number(raw);
          return [2, 3, 4].includes(value) ? value : 2;
        },
        renderHTML: (attributes) => ({
          "data-title-level":
            attributes.titleLevel === "paragraph"
              ? "paragraph"
              : [2, 3, 4].includes(Number(attributes.titleLevel))
                ? String(attributes.titleLevel)
                : "2",
        }),
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
    const validLevel =
      node.attrs.titleLevel === "paragraph"
        ? "paragraph"
        : [2, 3, 4].includes(Number(node.attrs.titleLevel))
          ? Number(node.attrs.titleLevel)
          : 2;
    const titleTag = validLevel === "paragraph" ? "p" : `h${validLevel}`;
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        "data-od-node": "disclosure",
        class: "od-editor-disclosure",
      }),
      [
        "summary",
        { class: "od-editor-disclosure__summary" },
        [
          titleTag,
          {
            class: `od-editor-disclosure__heading od-editor-disclosure__heading--${validLevel === "paragraph" ? "paragraph" : `h${validLevel}`}`,
          },
          node.attrs.title || "Título del desplegable",
        ],
      ],
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
              open: false,
              titleLevel: 2,
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
