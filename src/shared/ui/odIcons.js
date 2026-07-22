import {
  addOutline,
  albumsOutline,
  appsOutline,
  businessOutline,
  chatbubblesOutline,
  checkboxOutline,
  arrowBackOutline,
  arrowForwardOutline,
  attachOutline,
  calendarOutline,
  chatbubbleOutline,
  chevronDownOutline,
  chevronUpOutline,
  closeOutline,
  cloudUploadOutline,
  codeOutline,
  codeSlashOutline,
  contractOutline,
  copyOutline,
  createOutline,
  documentOutline,
  documentTextOutline,
  downloadOutline,
  ellipsisVerticalOutline,
  gridOutline,
  imageOutline,
  listCircleOutline,
  pricetagOutline,
  readerOutline,
  expandOutline,
  eyeOffOutline,
  eyeOutline,
  linkOutline,
  listOutline,
  newspaperOutline,
  openOutline,
  playOutline,
  reorderThreeOutline,
  removeOutline,
  settingsOutline,
  stopwatchOutline,
  textOutline,
  trashOutline,
} from "ionicons/icons";

/**
 * Iconos Ionicons reutilizados en la UI compacta (catálogo de productos, estimaciones, etc.).
 * Solo referencias: los componentes siguen usando `<IonIcon icon={OD_ICONS....} />`.
 */
export const OD_ICONS = Object.freeze({
  edit: createOutline,
  /** Chevron para filas/bloques (estado “plegado” → desplegar). */
  chevronDown: chevronDownOutline,
  /** Chevron para filas/bloques (estado “desplegado” → plegar). */
  chevronUp: chevronUpOutline,
  /** Desplegar todas las secciones (toolbar catálogo). */
  expandSections: expandOutline,
  /** Contraer todas las secciones (toolbar catálogo). */
  collapseSections: contractOutline,
  menuMore: ellipsisVerticalOutline,
  /** En menús contextuales actualmente etiquetado “Duplicar” (mismo glifo que ya usaba la app). */
  duplicate: copyOutline,
  delete: trashOutline,
  /** Gestión masiva de tareas (fichas apiladas). */
  bulkTasks: albumsOutline,
  /** Cambiar categoría en selección masiva de tareas. */
  bulkCategory: pricetagOutline,
  /** Cambiar fechas en selección masiva de tareas. */
  bulkCalendar: calendarOutline,
  /** Cambiar estado en selección masiva de tareas. */
  bulkEstado: listCircleOutline,
  /** Cambiar proveedor en selección masiva de gastos. */
  bulkProveedor: businessOutline,
  /** Salir del modo gestión masiva. */
  bulkExit: closeOutline,
  add: addOutline,
  addFromCatalog: listOutline,
  reorder: reorderThreeOutline,
  copyUrl: linkOutline,
  openDetail: openOutline,
  settings: settingsOutline,
  export: downloadOutline,
  import: cloudUploadOutline,
  /** Icono lineal del temporizador en cabecera. */
  timerHeader: stopwatchOutline,
  /** Reanudar / arrancar temporizador desde un registro anterior. */
  timerRestart: playOutline,
  /** Pestaña documentos (tickets / tareas). */
  tabDocuments: documentTextOutline,
  /** Pestaña notas. */
  tabNotes: newspaperOutline,
  /** Pestaña comentarios. */
  tabComments: chatbubblesOutline,
  /** Pestaña tareas relacionadas. */
  tabTasks: listOutline,
  /** Pestaña checklist (modal de tarea). */
  tabChecklist: checkboxOutline,
  /** Pestaña timeblocks (modal de tarea). */
  tabTimeblocks: stopwatchOutline,
  /** Login: ocultar contraseña visible. */
  eyeOff: eyeOffOutline,
  /** Checklist: mostrar/ocultar ítems completados. */
  eye: eyeOutline,
  /** Kanban: columnas visibles / vacías. */
  kanbanColumns: gridOutline,
  /** Editor enriquecido: opción Párrafo. */
  richParagraph: textOutline,
  /** Editor enriquecido: títulos H1-H4 (genérico / bubble). */
  richHeading: reorderThreeOutline,
  /** Menú de bloques: niveles de encabezado. */
  richHeading1: newspaperOutline,
  richHeading2: documentTextOutline,
  richHeading3: documentOutline,
  richHeading4: readerOutline,
  /** Wiki: insertar bloque (cuadrícula de bloques). */
  blocksAdd: appsOutline,
  /** Editor enriquecido: negrita. */
  richBold: textOutline,
  /** Editor enriquecido: cursiva. */
  richItalic: contractOutline,
  /** Editor enriquecido: código inline. */
  richCodeInline: codeSlashOutline,
  /** Editor enriquecido: cita / blockquote. */
  richQuote: chatbubbleOutline,
  /** Editor enriquecido: bloque de código. */
  richCodeBlock: codeOutline,
  /** Editor enriquecido: imagen. */
  richImage: imageOutline,
  /** Editor enriquecido: vídeo embebido (YouTube). */
  richVideo: playOutline,
  /** Editor enriquecido: adjunto (reservado). */
  richAttach: attachOutline,
  /** Editor enriquecido: subrayado/enlace. */
  richUnderline: linkOutline,
  /** Editor enriquecido: tachado. */
  richStrike: removeOutline,
  /** Editor enriquecido: listas. */
  richList: listOutline,
  /** Editor enriquecido: lista numerada. */
  richListOrdered: listCircleOutline,
  /** Editor enriquecido: checklist. */
  richChecklist: checkboxOutline,
  /** Editor enriquecido: tablas. */
  richTable: gridOutline,
  /** Editor enriquecido: bloques de columnas. */
  richColumns: appsOutline,
  /** Editor enriquecido: tres columnas. */
  richColumns3: gridOutline,
  /** Editor enriquecido: indentar lista. */
  richIndent: arrowForwardOutline,
  /** Editor enriquecido: desindentar lista. */
  richOutdent: arrowBackOutline,
  /** Editor enriquecido: separador horizontal. */
  richDivider: removeOutline,
});
