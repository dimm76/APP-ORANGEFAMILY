import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  buildOdRichColumnsClassName,
  defaultColumnLayout,
  readColumnLayoutFromElement,
  resolveColumnLayout,
} from "../utils/odColumnsLayout.js";

export const OdRichColumn = Node.create({
  name: "odRichColumn",
  group: "odRichColumn",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div.od-rich-column" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "od-rich-column" }), 0];
  },
});

export const OdRichColumns = Node.create({
  name: "odRichColumns",
  group: "block",
  content: "(odRichColumn odRichColumn)|(odRichColumn odRichColumn odRichColumn)",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (el) => {
          const raw = el.getAttribute?.("data-columns");
          const n = parseInt(String(raw ?? ""), 10);
          return n === 3 ? 3 : 2;
        },
        renderHTML: (attrs) => ({
          "data-columns": String(attrs.columns === 3 ? 3 : 2),
        }),
      },
      columnLayout: {
        default: null,
        parseHTML: (el) => {
          const columns = parseInt(String(el.getAttribute?.("data-columns") ?? ""), 10) === 3 ? 3 : 2;
          return resolveColumnLayout(columns, readColumnLayoutFromElement(el));
        },
        renderHTML: (attrs) => {
          const columns = attrs.columns === 3 ? 3 : 2;
          const columnLayout = resolveColumnLayout(columns, attrs.columnLayout);
          return { "data-column-layout": columnLayout };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[class*="od-rich-columns"]',
        getAttrs: (el) => {
          const dc = el.getAttribute?.("data-columns");
          const n = parseInt(String(dc ?? ""), 10);
          const columns = n === 3 || String(el.className || "").includes("od-rich-columns--3") ? 3 : 2;
          return {
            columns,
            columnLayout: resolveColumnLayout(columns, readColumnLayoutFromElement(el)),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const columns = node.attrs.columns === 3 ? 3 : 2;
    const columnLayout = resolveColumnLayout(columns, node.attrs.columnLayout);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: buildOdRichColumnsClassName(columns, columnLayout),
        "data-columns": String(columns),
        "data-column-layout": columnLayout,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertColumns:
        (countRaw) =>
        ({ chain, editor }) => {
          const count = Number(countRaw) === 3 ? 3 : 2;
          const payload = {
            type: this.name,
            attrs: {
              columns: count,
              columnLayout: defaultColumnLayout(count),
            },
            content: Array.from({ length: count }, () => ({
              type: "odRichColumn",
              content: [{ type: "paragraph" }],
            })),
          };
          const ok = chain().focus().insertContent(payload).run();
          if (!ok) return false;

          queueMicrotask(() => {
            let lastColsPos = -1;
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === "odRichColumns") lastColsPos = pos;
              return true;
            });
            if (lastColsPos < 0) return;
            const $after = editor.state.doc.resolve(lastColsPos + 1);
            const cols = $after.nodeAfter;
            if (!cols || cols.type.name !== "odRichColumns") return;
            const firstCol = cols.child(0);
            if (!firstCol || firstCol.type.name !== "odRichColumn") return;
            const firstP = firstCol.child(0);
            if (!firstP || firstP.type.name !== "paragraph") return;
            const innerPos = lastColsPos + 1 + 1 + 1;
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

/** Extensiones de bloques de columnas para RichTextEditor / WikiTiptapEditor */
export const odRichColumnsExtensions = [OdRichColumn, OdRichColumns];
