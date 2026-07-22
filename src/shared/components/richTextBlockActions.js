import { OD_ICONS } from "../ui/odIcons.js";
import { GOOGLE_SHEETS_ICON_SRC } from "../ui/googleSheetsIcon.js";
import { RICH_TEXT_GLYPH } from "./richTextMenuGlyphs.js";

/**
 * Ejecuta un comando Tiptap sobre el bloque/cursor actual.
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {(chain: import("@tiptap/core").ChainedCommands) => import("@tiptap/core").ChainedCommands} fn
 */
export function runRichTextBlockCommand(editor, fn) {
  if (!editor) return;
  fn(editor.chain().focus()).run();
}

function getEditorBlockCaps(editor) {
  return {
    canTaskList: typeof editor.commands.toggleTaskList === "function",
    canTable:
      typeof editor.commands.insertTable === "function" &&
      editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    canColumns: typeof editor.commands.insertColumns === "function",
    canOdContainer: typeof editor.commands.insertOdContainer === "function",
    canBlockquote: typeof editor.commands.toggleBlockquote === "function",
    canCodeBlock: typeof editor.commands.toggleCodeBlock === "function",
    canImage: typeof editor.commands.setImage === "function",
    canYoutube: typeof editor.commands.setYoutubeVideo === "function",
    canVideoEmbed: typeof editor.commands.setVideoEmbed === "function",
    canGoogleSheetsEmbed: typeof editor.commands.setGoogleSheetsEmbed === "function",
    canFigmaEmbed: typeof editor.commands.setFigmaEmbed === "function",
    canOdTabs: typeof editor.commands.insertOdTabs === "function",
    canOdDisclosure: typeof editor.commands.insertOdDisclosure === "function",
  };
}

/**
 * Grupos de acciones de bloque reutilizables (menú Wiki, futuro comando "/").
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {{ onPickImage?: () => void, onPickYoutube?: () => void, onPickGoogleDriveVideo?: () => void, onPickVentoVideo?: () => void, onPickGoogleSheets?: () => void, onPickFigma?: () => void }} [handlers]
 * @returns {{ title: string, items: Array<{ id: string, icon: string, label: string, title: string, disabled?: boolean, onClick: () => void }> }[]}
 */
export function getRichTextBlockMenuGroups(editor, handlers = {}) {
  if (!editor) return [];

  const caps = getEditorBlockCaps(editor);
  const run = (fn) => () => runRichTextBlockCommand(editor, fn);

  const groups = [
    {
      title: "Texto",
      items: [
        {
          id: "paragraph",
          glyph: RICH_TEXT_GLYPH.paragraph,
          glyphVariant: "paragraph",
          label: "Párrafo",
          title: "Convertir bloque actual en párrafo",
          onClick: run((chain) => chain.setParagraph()),
        },
        {
          id: "h1",
          glyph: RICH_TEXT_GLYPH.h1,
          glyphVariant: "heading",
          label: "Título H1",
          title: "Convertir bloque actual en título 1",
          onClick: run((chain) => chain.setHeading({ level: 1 })),
        },
        {
          id: "h2",
          glyph: RICH_TEXT_GLYPH.h2,
          glyphVariant: "heading",
          label: "Subtítulo H2",
          title: "Convertir bloque actual en título 2",
          onClick: run((chain) => chain.setHeading({ level: 2 })),
        },
        {
          id: "h3",
          glyph: RICH_TEXT_GLYPH.h3,
          glyphVariant: "heading",
          label: "Título pequeño H3",
          title: "Convertir bloque actual en título 3",
          onClick: run((chain) => chain.setHeading({ level: 3 })),
        },
        {
          id: "h4",
          glyph: RICH_TEXT_GLYPH.h4,
          glyphVariant: "heading",
          label: "Título H4",
          title: "Convertir bloque actual en título 4",
          onClick: run((chain) => chain.setHeading({ level: 4 })),
        },
      ],
    },
    {
      title: "Listas",
      items: [
        {
          id: "bullet-list",
          icon: OD_ICONS.richList,
          label: "Lista con viñetas",
          title: "Iniciar lista con viñetas en el cursor",
          onClick: run((chain) => chain.toggleBulletList()),
        },
        {
          id: "ordered-list",
          icon: OD_ICONS.richListOrdered,
          label: "Lista numerada",
          title: "Iniciar lista numerada en el cursor",
          onClick: run((chain) => chain.toggleOrderedList()),
        },
        caps.canTaskList
          ? {
              id: "task-list",
              icon: OD_ICONS.richChecklist,
              label: "Lista de comprobación",
              title: "Iniciar checklist en el cursor",
              onClick: run((chain) => chain.toggleTaskList()),
            }
          : null,
      ].filter(Boolean),
    },
    {
      title: "Bloques",
      items: [
        caps.canBlockquote
          ? {
              id: "blockquote",
              icon: OD_ICONS.richQuote,
              label: "Cita",
              title: "Convertir bloque actual en cita",
              onClick: run((chain) => chain.toggleBlockquote()),
            }
          : null,
        caps.canCodeBlock
          ? {
              id: "code-block",
              icon: OD_ICONS.richCodeBlock,
              label: "Bloque de código",
              title: "Convertir bloque actual en bloque de código",
              onClick: run((chain) => chain.toggleCodeBlock()),
            }
          : null,
        {
          id: "divider",
          icon: OD_ICONS.richDivider,
          label: "Separador horizontal",
          title: "Insertar línea horizontal en el cursor",
          onClick: run((chain) => chain.setHorizontalRule()),
        },
        caps.canOdContainer
          ? {
              id: "container",
              icon: OD_ICONS.richColumns,
              label: "Contenedor",
              title: "Insertar bloque contenedor configurable",
              slashAliases: ["container", "contenedor", "box"],
              onClick: run((chain) => chain.insertOdContainer()),
            }
          : null,
        caps.canOdTabs
          ? {
              id: "od-tabs",
              icon: OD_ICONS.addFromCatalog,
              label: "Pestañas",
              title: "Crea un bloque con pestañas y contenido independiente.",
              slashAliases: ["tabs", "pestañas", "tab", "bloque pestañas"],
              onClick: run((chain) => chain.insertOdTabs()),
            }
          : null,
        caps.canOdDisclosure
          ? {
              id: "od-disclosure",
              icon: OD_ICONS.chevronDown,
              label: "Desplegable",
              title: "Crea un bloque plegable con título y contenido ocultable.",
              slashAliases: ["desplegable", "accordion", "acordeon", "toggle", "plegable"],
              onClick: run((chain) => chain.insertOdDisclosure()),
            }
          : null,
      ].filter(Boolean),
    },
    {
      title: "Embeds",
      items: [
        caps.canImage && typeof handlers.onPickImage === "function"
          ? {
              id: "image",
              icon: OD_ICONS.richImage,
              label: "Imagen",
              title: "Subir imagen desde archivo (adjunto; también puedes pegar imagen en el editor)",
              onClick: handlers.onPickImage,
            }
          : null,
        caps.canGoogleSheetsEmbed && typeof handlers.onPickGoogleSheets === "function"
          ? {
              id: "google-sheets",
              imageSrc: GOOGLE_SHEETS_ICON_SRC,
              label: "Google Sheets",
              title: "Insertar hoja de Google Sheets desde URL",
              slashAliases: ["sheets", "google sheets", "hoja", "spreadsheet"],
              onClick: handlers.onPickGoogleSheets,
            }
          : null,
        caps.canFigmaEmbed && typeof handlers.onPickFigma === "function"
          ? {
              id: "figma",
              glyph: "F",
              glyphVariant: "heading",
              label: "Figma",
              title: "Insertar diseno o prototipo de Figma desde URL",
              slashAliases: ["figma", "diseno", "design", "prototype", "prototipo"],
              onClick: handlers.onPickFigma,
            }
          : null,
        caps.canYoutube && typeof handlers.onPickYoutube === "function"
          ? {
              id: "youtube",
              icon: OD_ICONS.richVideo,
              label: "Vídeo YouTube",
              title: "Insertar vídeo de YouTube desde URL",
              slashAliases: ["youtube"],
              onClick: handlers.onPickYoutube,
            }
          : null,
        caps.canVideoEmbed && typeof handlers.onPickGoogleDriveVideo === "function"
          ? {
              id: "google-drive-video",
              icon: OD_ICONS.import,
              label: "Vídeo Google Drive",
              title: "Insertar vídeo de Google Drive desde URL compartida",
              slashAliases: ["drive", "gdrive", "google drive", "video drive", "vídeo drive"],
              onClick: handlers.onPickGoogleDriveVideo,
            }
          : null,
        caps.canVideoEmbed && typeof handlers.onPickVentoVideo === "function"
          ? {
              id: "vento-video",
              icon: OD_ICONS.richVideo,
              label: "Vídeo Vento",
              title: "Insertar vídeo de Vento desde URL compartida",
              slashAliases: ["vento", "video vento", "vídeo vento", "loom"],
              onClick: handlers.onPickVentoVideo,
            }
          : null,
      ].filter(Boolean),
    },
    {
      title: "Estructura",
      items: [
        caps.canTable
          ? {
              id: "table",
              icon: OD_ICONS.richTable,
              label: "Tabla",
              title: "Insertar tabla 3×3 en el cursor",
              onClick: run((chain) =>
                chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              ),
            }
          : null,
        caps.canColumns
          ? {
              id: "columns-2",
              icon: OD_ICONS.richColumns,
              label: "2 columnas",
              title: "Insertar bloque de dos columnas",
              onClick: run((chain) => chain.insertColumns(2)),
            }
          : null,
        caps.canColumns
          ? {
              id: "columns-3",
              icon: OD_ICONS.richColumns3,
              label: "3 columnas",
              title: "Insertar bloque de tres columnas",
              onClick: run((chain) => chain.insertColumns(3)),
            }
          : null,
      ].filter(Boolean),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

/**
 * Estado del disparador "/" en el bloque de texto actual.
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {{ query: string, from: number, to: number } | null}
 */
export function getSlashTriggerState(editor) {
  if (!editor || !editor.isEditable) return null;
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return null;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = textBefore.match(/(^|\s)\/([\w\u00C0-\u024F-]*)$/iu);
  if (!match) return null;
  const slashPart = match[0].slice(match[1].length);
  const from = $from.pos - slashPart.length;
  const to = $from.pos;
  return { query: String(match[2] ?? "").toLowerCase(), from, to };
}

/**
 * Elimina el "/" (y filtro parcial) antes de aplicar una acción de bloque.
 * @param {import("@tiptap/core").Editor | null} editor
 */
export function clearSlashTrigger(editor) {
  const state = getSlashTriggerState(editor);
  if (!state) return;
  editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
}

/**
 * @param {ReturnType<typeof getRichTextBlockMenuGroups>} groups
 * @param {import("@tiptap/core").Editor | null} editor
 */
export function wrapBlockMenuGroupsForSlash(editor, groups) {
  return groups.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      onClick: () => {
        clearSlashTrigger(editor);
        item.onClick();
      },
    })),
  }));
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {{ onPickImage?: () => void, onPickYoutube?: () => void, onPickGoogleDriveVideo?: () => void, onPickVentoVideo?: () => void, onPickGoogleSheets?: () => void, onPickFigma?: () => void }} [handlers]
 * @param {string} [query]
 */
export function getFilteredRichTextBlockMenuGroups(editor, handlers = {}, query = "") {
  const groups = getRichTextBlockMenuGroups(editor, handlers);
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const aliases = Array.isArray(item.slashAliases) ? item.slashAliases : [];
        return (
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          String(item.title ?? "").toLowerCase().includes(q) ||
          aliases.some((alias) => String(alias).toLowerCase().includes(q))
        );
      }),
    }))
    .filter((section) => section.items.length > 0);
}
