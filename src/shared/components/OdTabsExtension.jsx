import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

function createTabId() {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPanelPositionById(tabsPos, tabsNode, panelId) {
  let childPos = tabsPos + 1;

  for (let index = 0; index < tabsNode.childCount; index += 1) {
    const child = tabsNode.child(index);

    if (child.type.name === "odTabPanel" && child.attrs.id === panelId) {
      return childPos;
    }

    childPos += child.nodeSize;
  }

  return null;
}

function getNextTabTitle(node) {
  const count = node.childCount || 0;
  return `Pestaña ${count + 1}`;
}

function getFirstTextblockStartPos(node, nodePos) {
  let found = null;

  node.descendants((child, offset) => {
    if (found !== null) return false;

    if (child.isTextblock) {
      found = nodePos + 1 + offset + 1;
      return false;
    }

    return true;
  });

  return found;
}

function getActiveTabIndex(tabs, activeTabId) {
  const index = tabs.findIndex((tab) => tab.id === activeTabId);
  return index >= 0 ? index : 0;
}

function isPanelActiveInParent(editor, getPos, panelId) {
  if (!editor || typeof getPos !== "function" || !panelId) return false;

  let pos;
  try {
    pos = getPos();
  } catch (_err) {
    return false;
  }

  const { doc } = editor.state;

  if (typeof pos !== "number" || pos < 0 || pos > doc.content.size) {
    return false;
  }

  let $pos;
  try {
    $pos = doc.resolve(pos);
  } catch (_err) {
    return false;
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const parent = $pos.node(depth);

    if (parent.type.name !== "odTabs") continue;

    const fallbackId =
      parent.childCount > 0 && parent.child(0).type.name === "odTabPanel"
        ? parent.child(0).attrs.id
        : null;

    return (parent.attrs.activeTabId || fallbackId) === panelId;
  }

  return false;
}

function findCurrentOdTabs(state) {
  const { $from } = state.selection;

  if ($from.nodeAfter?.type?.name === "odTabs") {
    return {
      pos: $from.pos,
      node: $from.nodeAfter,
    };
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "odTabs") {
      return {
        pos: $from.before(depth),
        node,
      };
    }
  }

  return null;
}

function createDefaultTabPanel(schema, id, title) {
  return schema.nodes.odTabPanel.create(
    {
      id,
      title,
    },
    schema.nodes.paragraph.create()
  );
}

function TabTitleInput({ title, onCommit }) {
  const [draft, setDraft] = useState(title || "Pestaña");

  useEffect(() => {
    setDraft(title || "Pestaña");
  }, [title]);

  function commit() {
    const nextTitle = String(draft || "").trim() || "Pestaña";
    onCommit(nextTitle);
  }

  return (
    <input
      className="od-editor-tabs__tab-input"
      value={draft}
      aria-label="Título de pestaña"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(title || "Pestaña");
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function OdTabsNodeView({ editor, node, getPos, updateAttributes }) {
  const tabs = [];

  node.forEach((child) => {
    if (child.type.name === "odTabPanel") {
      tabs.push({
        id: child.attrs.id,
        title: child.attrs.title || "Pestaña",
      });
    }
  });

  const activeTabId = node.attrs.activeTabId || tabs[0]?.id || null;
  const activeTabIndex = getActiveTabIndex(tabs, activeTabId);

  function setActiveTab(tabId) {
    updateAttributes({ activeTabId: tabId });

    window.setTimeout(() => {
      focusPanel(tabId);
    }, 0);
  }

  function renameTab(tabId, title) {
    const safeTitle = String(title || "").trim() || "Pestaña";
    const tabsPos = getPos();
    const panelPos = getPanelPositionById(tabsPos, node, tabId);

    if (panelPos === null) return;

    const { state, view } = editor;
    const tr = state.tr;
    const panelNode = tr.doc.nodeAt(panelPos);

    if (!panelNode) return;

    tr.setNodeMarkup(panelPos, undefined, {
      ...panelNode.attrs,
      title: safeTitle,
    });

    view.dispatch(tr);
  }

  function focusPanel(tabId) {
    const tabsPos = getPos();
    const currentTabsNode = editor.state.doc.nodeAt(tabsPos);
    if (!currentTabsNode) return;

    const panelPos = getPanelPositionById(tabsPos, currentTabsNode, tabId);
    if (panelPos === null) return;

    let tr = editor.state.tr;
    let panelNode = tr.doc.nodeAt(panelPos);
    if (!panelNode) return;

    if (!panelNode.childCount && editor.state.schema.nodes.paragraph) {
      tr = tr.insert(panelPos + 1, editor.state.schema.nodes.paragraph.create());
      panelNode = tr.doc.nodeAt(panelPos);
    }

    const targetPos =
      getFirstTextblockStartPos(panelNode, panelPos) ??
      Math.min(panelPos + 1, tr.doc.content.size);

    const safePos = Math.max(1, Math.min(targetPos, tr.doc.content.size));

    try {
      tr = tr.setSelection(TextSelection.create(tr.doc, safePos));
    } catch (_err) {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(safePos), 1));
    }

    editor.view.dispatch(tr.scrollIntoView());

    window.requestAnimationFrame(() => {
      editor.view.focus();
    });
  }

  function addTabFromNodeView() {
    const tabsPos = getPos();
    const currentTabsNode = editor.state.doc.nodeAt(tabsPos);
    if (!currentTabsNode) return;

    const newId = createTabId();
    const newPanel = createDefaultTabPanel(
      editor.state.schema,
      newId,
      getNextTabTitle(currentTabsNode)
    );
    const insertPos = tabsPos + currentTabsNode.nodeSize - 1;

    let tr = editor.state.tr.insert(insertPos, newPanel);
    const mappedTabsPos = tr.mapping.map(tabsPos);
    const mappedTabsNode = tr.doc.nodeAt(mappedTabsPos);

    if (mappedTabsNode) {
      tr = tr.setNodeMarkup(mappedTabsPos, undefined, {
        ...mappedTabsNode.attrs,
        activeTabId: newId,
      });
    }

    const mappedInsertPos = tr.mapping.map(insertPos);
    const targetPos = Math.min(mappedInsertPos + 2, tr.doc.content.size);
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos), 1));

    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  }

  function deleteTabsBlock() {
    let tabsPos;

    try {
      tabsPos = getPos();
    } catch (_err) {
      return;
    }

    if (typeof tabsPos !== "number") return;

    const currentTabsNode = editor.state.doc.nodeAt(tabsPos);
    if (!currentTabsNode || currentTabsNode.type.name !== "odTabs") return;

    const from = tabsPos;
    const to = tabsPos + currentTabsNode.nodeSize;

    const tr = editor.state.tr.deleteRange(from, to);
    const nextPos = Math.max(0, Math.min(from, tr.doc.content.size));

    try {
      tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos), -1));
    } catch (_err) {
      // Keep the delete even if the selection cannot be restored.
    }

    editor.view.dispatch(tr.scrollIntoView());

    window.requestAnimationFrame(() => {
      editor.view.focus();
    });
  }

  function handlePanelsClick(event) {
    if (!activeTabId) return;

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    const clickedPanelShell =
      target.classList.contains("od-editor-tabs__panels") ||
      target.classList.contains("od-editor-tabs__panel");

    if (!clickedPanelShell) return;

    focusPanel(activeTabId);
  }

  return (
    <NodeViewWrapper
      className="od-editor-block od-editor-tabs"
      data-od-node="tabs"
      data-active-tab-id={activeTabId || ""}
      data-active-tab-index={String(activeTabIndex)}
    >
      <div className="od-editor-tabs__bubble" contentEditable={false}>
        <button
          type="button"
          className="od-rich-text-editor__button od-editor-tabs__bubble-add"
          title="Añadir pestaña"
          aria-label="Añadir pestaña"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            addTabFromNodeView();
          }}
        >
          <IonIcon icon={OD_ICONS.add} aria-hidden="true" />
          <span>Añadir pestaña</span>
        </button>
        <button
          type="button"
          className="od-rich-text-editor__button od-editor-tabs__bubble-delete"
          title="Eliminar bloque de pestañas"
          aria-label="Eliminar bloque de pestañas"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            deleteTabsBlock();
          }}
        >
          <IonIcon icon={OD_ICONS.delete} aria-hidden="true" />
          <span>Eliminar bloque</span>
        </button>
      </div>

      <div className="od-editor-tabs__header" contentEditable={false}>
        <div className="od-editor-tabs__list" role="tablist" aria-label="Pestañas">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                className={`od-editor-tabs__tab${isActive ? " is-active" : ""}`}
                role="tab"
                tabIndex={0}
                aria-selected={isActive ? "true" : "false"}
                onMouseDown={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest(".od-editor-tabs__tab-input")
                  ) {
                    return;
                  }
                  event.preventDefault();
                }}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveTab(tab.id);
                  }
                }}
              >
                {isActive ? (
                  <TabTitleInput
                    title={tab.title}
                    onCommit={(nextTitle) => renameTab(tab.id, nextTitle)}
                  />
                ) : (
                  <span className="od-editor-tabs__tab-label">{tab.title}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <NodeViewContent
        className="od-editor-tabs__panels"
        onClick={handlePanelsClick}
      />
    </NodeViewWrapper>
  );
}

function OdTabPanelNodeView({ editor, node, getPos }) {
  const [isActive, setIsActive] = useState(() =>
    isPanelActiveInParent(editor, getPos, node.attrs.id)
  );

  useEffect(() => {
    if (!editor) return undefined;

    const refresh = () => {
      setIsActive(isPanelActiveInParent(editor, getPos, node.attrs.id));
    };

    refresh();

    editor.on("transaction", refresh);
    editor.on("selectionUpdate", refresh);

    return () => {
      editor.off("transaction", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor, getPos, node.attrs.id]);

  return (
    <NodeViewWrapper
      as="section"
      className={`od-editor-tabs__panel${isActive ? " is-active" : ""}`}
      data-od-node="tab-panel"
      data-tab-id={node.attrs.id || ""}
      data-tab-title={node.attrs.title || "Pestaña"}
      aria-hidden={isActive ? "false" : "true"}
    >
      <NodeViewContent
        as="div"
        className="od-editor-tabs__panel-content"
      />
    </NodeViewWrapper>
  );
}

export const OdTabs = Node.create({
  name: "odTabs",

  group: "block",

  content: "odTabPanel+",

  defining: true,

  isolating: false,

  selectable: true,

  addAttributes() {
    return {
      activeTabId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-active-tab-id"),
        renderHTML: (attributes) => {
          if (!attributes.activeTabId) return {};
          return { "data-active-tab-id": attributes.activeTabId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-od-node="tabs"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-od-node": "tabs",
        class: "od-editor-tabs",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(OdTabsNodeView);
  },

  addCommands() {
    return {
      insertOdTabs:
        () =>
        ({ commands }) => {
          const firstId = createTabId();

          return commands.insertContent({
            type: this.name,
            attrs: {
              activeTabId: firstId,
            },
            content: [
              {
                type: "odTabPanel",
                attrs: {
                  id: firstId,
                  title: "Pestaña 1",
                },
                content: [
                  {
                    type: "paragraph",
                  },
                ],
              },
            ],
          });
        },
      addOdTab:
        () =>
        ({ state, dispatch }) => {
          const current = findCurrentOdTabs(state);
          const panelType = state.schema.nodes.odTabPanel;

          if (!current || !panelType) return false;

          const newId = createTabId();
          const newPanel = createDefaultTabPanel(state.schema, newId, getNextTabTitle(current.node));
          const insertPos = current.pos + current.node.nodeSize - 1;

          if (dispatch) {
            let tr = state.tr.insert(insertPos, newPanel);
            const mappedTabsPos = tr.mapping.map(current.pos);
            const mappedTabsNode = tr.doc.nodeAt(mappedTabsPos);

            if (mappedTabsNode) {
              tr = tr.setNodeMarkup(mappedTabsPos, undefined, {
                ...mappedTabsNode.attrs,
                activeTabId: newId,
              });
            }

            const nextSelectionPos = tr.mapping.map(insertPos + 1);
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(nextSelectionPos)));
            dispatch(tr.scrollIntoView());
          }

          return true;
        },
    };
  },
});

export const OdTabPanel = Node.create({
  name: "odTabPanel",

  group: "block",

  content: "block+",

  defining: true,

  isolating: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tab-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { "data-tab-id": attributes.id };
        },
      },
      title: {
        default: "Pestaña",
        parseHTML: (element) => element.getAttribute("data-tab-title") || "Pestaña",
        renderHTML: (attributes) => ({
          "data-tab-title": attributes.title || "Pestaña",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'section[data-od-node="tab-panel"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-od-node": "tab-panel",
        class: "od-editor-tabs__panel",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(OdTabPanelNodeView);
  },
});
