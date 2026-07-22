# OrangeFamily — Guía obligatoria de estilos UI

Este documento define el sistema visual de OrangeFamily.

OrangeFamily reutilizará el estilo visual consolidado de OrangeDesk, pero seguirá siendo un producto independiente.

La reutilización afecta a patrones visuales, tokens, componentes compartidos e infraestructura CSS. No implica reutilizar lógica funcional del CRM.

Este documento es una referencia obligatoria para ChatGPT, Cursor, Codex y cualquier agente que modifique la interfaz.

No se deben inventar estilos nuevos cuando ya exista un patrón definido en esta guía.

---

## 1. Fuentes de verdad

Durante la creación de la base técnica de OrangeFamily se revisarán los estilos y componentes compartidos de OrangeDesk para identificar cuáles pueden reutilizarse.

Las rutas definitivas de los archivos CSS, tokens, iconos y componentes se documentarán cuando la infraestructura haya sido incorporada al repositorio.

Hasta entonces, los valores y patrones definidos en esta guía constituyen la referencia visual del proyecto.

Antes de crear CSS nuevo deberá comprobarse:

1. si el patrón ya existe en OrangeFamily;
2. si existe una solución reutilizable procedente de la infraestructura de OrangeDesk;
3. si el patrón está definido en esta guía.

---

## 2. Convención provisional de nombres

Esta guía conserva provisionalmente las clases `od-*` utilizadas en OrangeDesk porque representan la infraestructura visual que se prevé reutilizar.

La decisión de mantener estas clases o migrarlas a un prefijo propio de OrangeFamily se tomará después de revisar el código reutilizable.

No se realizarán renombrados masivos únicamente por motivos nominales.

Cuando se incorporen los estilos al repositorio, deberán documentarse las rutas reales de:

- tokens globales;
- estilos compactos compartidos;
- gestión de overlays;
- sistema de iconos;
- componentes UI reutilizables.

---

## 3. Tokens globales de marca

Usar siempre estos tokens o sus valores exactos.

### Colores principales

```css
--od-color-primary: #fc4200;
--od-color-primary-hover: #e03a00;
--od-color-primary-soft: rgba(252, 66, 0, 0.12);
```

Uso:

- acción principal;
- estado activo;
- hover corporativo;
- bordes activos;
- foco suave;
- botones principales;
- elementos seleccionados.

### Texto

```css
--od-color-text: #37374b;
--od-color-text-muted: #64748b;
--od-color-text-strong: #111229;
```

Uso:

- texto normal: `#37374b`;
- texto secundario: `#64748b`;
- títulos o texto fuerte: `#111229` o `#0f172a` en componentes compactos.

### Bordes

```css
--od-color-border: #e4e4e8;
--od-color-border-soft: #dce3f5;
--od-color-border-muted: #dce3f5;
```

Uso:

- borde estándar: `#dce3f5`;
- borde neutro: `#e4e4e8`;
- borde hover suave: `#cbd5e1`.

### Fondos

```css
--od-color-bg: #f4f5f7;
--od-color-surface: #ffffff;
--od-panel-surface: #ffffff;
--od-table-surface: #ffffff;
```

Uso:

- superficies de paneles, modales y tablas: `#ffffff`;
- fondos suaves: `#f8fafc`, `#fafbff` o `#f1f5f9`;
- no heredar un tema oscuro del sistema en paneles de la aplicación.

### Estados

```css
--od-color-danger: #c62828;
--od-color-success: #15803d;
```

Complementos:

- error text: `#7f1d1d`;
- error background: `#fff7f7`;
- danger action: `#a63a3a`;
- success green badge: `#047857`.

---

## 4. Tipografía

Fuente global:

```css
Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

Reglas:

- no introducir otra tipografía;
- no usar fuentes serif;
- no definir `font-family` en cada componente salvo para usar `inherit`;
- tablas y UI compacta usan `13px`;
- badges usan `11.5px`;
- labels de filtros usan `11px`;
- títulos de página usan `1.25rem` y peso `600`.

---

## 5. Layout de página

Patrón previsto:

```jsx
<div className="od-page">
  <div className="od-page-inner">
    ...
  </div>
</div>
```

Para páginas de ancho completo:

```jsx
<div className="od-page-inner od-page-inner--full od-page-inner--align-stretch">
```

Valores de referencia:

```css
.od-page {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 100%;
}

.od-page-inner {
  max-width: 940px;
  width: 100%;
  gap: 8px;
}
```

No crear wrappers nuevos si los patrones globales de página, contenido, cabecera y título ya cubren la necesidad.

---

## 6. Títulos

Título de página:

```jsx
<h1 className="od-page-title">Título</h1>
```

Estilo:

```css
font-size: 1.25rem;
font-weight: 600;
color: #0f172a;
```

Reglas:

- mantener jerarquía visual consistente;
- no usar títulos blancos, transparentes o heredados de librerías externas dentro de modales o paneles;
- no crear tamaños diferentes por módulo sin una necesidad justificada.

---

## 7. Estados, mensajes y errores

Estado normal o vacío:

```jsx
<p className="od-status-line">Sin resultados.</p>
```

Error:

```jsx
<p className="od-status-line od-status-line--error">Error...</p>
```

Mensaje inline:

```jsx
<p className="od-inline-msg">Mensaje</p>
```

Valores de referencia:

- fondo normal: `#fafbff`;
- borde dashed: `#dce3f5`;
- texto normal: `#334155`;
- fondo de error: `#fff7f7`;
- texto de error: `#7f1d1d`.

---

## 8. Tablas

Patrón:

```jsx
<div className="od-table-wrap">
  <table className="od-table od-table--fill">
    ...
  </table>
</div>
```

Para listados amplios:

```jsx
<table className="od-table od-table--fill od-table--listing-wide">
```

Valores globales:

```css
--od-table-font-size: 13px;
--od-table-line-height: 1.28;
--od-table-cell-padding-y: 4px;
--od-table-cell-padding-x: 6px;
--od-table-row-height: 36px;
--od-table-text: #1e293b;
--od-table-text-muted: #64748b;
--od-table-border-color: #e8edf7;
--od-table-header-bg: #f1f5ff;
--od-table-header-fg: #3d4a63;
--od-table-wrap-radius: 10px;
--od-table-row-hover-bg: #f8fafc;
```

Reglas:

- no crear estilos de tabla desde cero;
- no introducir un `border-collapse` distinto sin necesidad;
- no añadir colores de cabecera propios por módulo;
- no modificar paddings por feature salvo necesidad concreta;
- para la columna principal usar el patrón de columna de título;
- para acciones usar el patrón global de acciones.

No aplicar `display: flex` directamente sobre un `td`.

Cuando una celda necesite un layout flex, envolver su contenido:

```jsx
<td className="od-table-col--actions">
  <span className="od-table-inline-actions">
    ...
  </span>
</td>
```

---

## 9. Acciones en tabla

Patrón preferente:

```jsx
<td className="od-table-col--actions">
  <span className="od-table-inline-actions">
    <IonButton
      fill="clear"
      size="small"
      type="button"
      className="od-icon-button od-action-ion"
      aria-label="Acción"
    >
      <IonIcon icon={OD_ICONS.menuMore} aria-hidden="true" />
    </IonButton>
  </span>
</td>
```

Colores:

```css
--od-action-icon-color: #475569;
--od-action-icon-color-hover: #fc4200;
--od-action-icon-muted: #52525b;
```

Reglas:

- iconos normales: `#475569`;
- hover: naranja corporativo;
- tamaño visual: entre `16px` y `18px`;
- no usar iconos sobredimensionados;
- no crear SVG inline si existe un icono reutilizable.

---

## 10. Iconos

La aplicación deberá disponer de una fuente centralizada de iconos.

Cuando se incorpore la infraestructura reutilizable, se documentará la ruta real del sistema de iconos.

Reglas:

- usar el sistema centralizado de iconos;
- no hacer imports dispersos si el icono ya existe en la fuente global;
- no inventar SVG inline innecesarios;
- mantener significado y aspecto coherentes entre módulos;
- usar tamaños compactos en tablas, menús y acciones.

Tamaños orientativos:

- acción de tabla: `16–18px`;
- popover: patrón global;
- no usar iconos de `24–25px` en menús compactos salvo decisión visual expresa.

---

## 11. Inputs compactos

Input de filtro:

```jsx
<input className="od-filter-input" />
```

Input de búsqueda:

```jsx
<input className="od-filter-search-input" />
```

Input inline de tabla:

```jsx
<input className="od-inline-input" />
```

Estilos base:

```css
font-size: 13px;
border-radius: 8px;
border: 1px solid #dce3f5;
background: #ffffff;
color: #1e293b;
min-height: 32px;
```

Focus:

```css
border-color: #cbd5e1;
box-shadow: 0 0 0 2px rgba(226, 232, 240, 0.75);
```

Reglas:

- no dejar inputs nativos oscuros;
- no usar el naranja corporativo con sombra como foco por defecto;
- mantener fondo blanco y contraste correcto;
- no crear variantes distintas por módulo sin necesidad.

Para `date` o `datetime-local`:

```css
background: #ffffff;
color: #37374b;
color-scheme: light;
```

---

## 12. Selects y dropdowns

Selector compacto previsto:

```jsx
<ODFilterSelect
  mode="single"
  options={options}
  value={value}
  onChange={onChange}
  panelPortal
/>
```

No usar `<select>` nativo salvo casos simples ya aceptados por el sistema.

Trigger:

```css
.od-filter-dropdown__trigger.od-filter-select-like
```

Base:

```css
font-size: 13px;
border-radius: 8px;
border: 1px solid #dce3f5;
background-color: #ffffff;
color: #1e293b;
min-height: 32px;
```

Panel:

```css
border-radius: 8px;
border: 1px solid #dce3f5;
background: #ffffff;
box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
padding: 6px;
```

Opciones:

```css
padding: 7px 8px;
border-radius: 6px;
font-size: 13px;
```

Estados:

```css
hover background: #f1f5f9;
selected background: rgba(226, 232, 240, 0.45);
```

Regla crítica:

- no usar un selector como badge;
- no disfrazar un selector como badge;
- si en reposo debe parecer un badge, usar un botón con aspecto de badge y un popover propio.

---

## 13. Badges

Patrón:

```jsx
<IonBadge className="od-badge od-badge--style-6">
  Borrador
</IonBadge>
```

Versión compacta:

```jsx
<IonBadge className="od-badge-compact od-badge--style-6">
  Borrador
</IonBadge>
```

CSS global:

```css
ion-badge.od-badge,
ion-badge.od-badge-compact {
  font-size: var(--od-badge-font-size);
  font-weight: 600;
  border-radius: 999px;
  --padding-start: var(--od-badge-padding-x);
  --padding-end: var(--od-badge-padding-x);
  --padding-top: var(--od-badge-padding-y);
  --padding-bottom: var(--od-badge-padding-y);
}
```

Tokens:

```css
--od-badge-font-size: 11.5px;
--od-badge-padding-y: 2px;
--od-badge-padding-x: 6px;
```

Variantes:

```css
.od-badge--style-1 {
  --background: #fff4ed;
  --color: #9a3412;
  border: 1px solid #fed7aa;
}

.od-badge--style-2 {
  --background: #eff6ff;
  --color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.od-badge--style-3 {
  --background: #ecfdf5;
  --color: #047857;
  border: 1px solid #a7f3d0;
}

.od-badge--style-4 {
  --background: #fffbeb;
  --color: #b45309;
  border: 1px solid #fde68a;
}

.od-badge--style-5 {
  --background: #fff1f2;
  --color: #9f1239;
  border: 1px solid #fecdd3;
}

.od-badge--style-6 {
  --background: #f4f4f5;
  --color: #52525b;
  border: 1px solid #e4e4e7;
}

.od-badge--style-7 {
  --background: #ffedd5;
  --color: #c2410c;
  border: 1px solid #fb923c;
}

.od-badge--style-8 {
  --background: #f5f3ff;
  --color: #6d28d9;
  border: 1px solid #ddd6fe;
}

.od-badge--style-9 {
  --background: #ecfeff;
  --color: #0e7490;
  border: 1px solid #a5f3fc;
}
```

Mapa recomendado:

- `style-1`: naranja suave, propuesta o pendiente;
- `style-2`: azul, información;
- `style-3`: verde, activo, validado o completado;
- `style-4`: amarillo, aviso o procedimiento;
- `style-5`: rojo, error, bloqueo o peligro;
- `style-6`: gris, neutro, documento, borrador o nota;
- `style-7`: naranja fuerte, atención;
- `style-8`: morado, categoría especial;
- `style-9`: cyan, manual o recurso técnico.

No crear colores específicos por feature cuando una variante global ya cubra el significado.

---

## 14. Badge editable o interactivo

Cuando un badge deba abrir un menú:

- no usar un selector;
- usar un botón nativo accesible;
- conservar tamaño, padding y radio del badge;
- no usar un badge interactivo si complica la accesibilidad.

Patrón:

```jsx
<button
  type="button"
  className="od-badge-clickable od-badge--style-9"
  onClick={handleClick}
>
  <span className="od-badge-clickable__label">Etiqueta</span>
  <IonIcon icon={OD_ICONS.chevronDown} aria-hidden="true" />
</button>
```

CSS base:

```css
.od-badge-clickable {
  min-height: 22px;
  height: 22px;
  max-width: 100%;
  border-radius: 999px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  font-family: inherit;
}

.od-badge-clickable ion-icon {
  width: 12px;
  height: 12px;
  font-size: 12px;
  opacity: 0.72;
}
```

Reglas:

- la clase estructural define tamaño, alineación e interacción;
- la variante `od-badge--style-X` define color, fondo y borde;
- no crear alturas o paddings diferentes por módulo.

---

## 15. Botones

### Botón principal

```jsx
<button type="button" className="od-modal-primary">
  Guardar
</button>
```

Estilo:

```css
padding: 10px 14px;
border-radius: 8px;
border: 1px solid #fc4200;
background: #fc4200;
color: #ffffff;
font-size: 13px;
font-weight: 600;
```

Hover:

```css
filter: brightness(0.95);
```

El ancho debe responder al contexto.

No debe utilizarse `width: 100%` automáticamente cuando el diseño requiera botones compactos o varias acciones en línea.

### Botón principal tipo enlace

```jsx
<a className="od-modal-primary-link">Abrir</a>
```

Estilo:

```css
border: 1px solid #fc4200;
background: #fff8f5;
color: #fc4200;
border-radius: 8px;
font-size: 13px;
font-weight: 600;
```

### Botón de filtro

```jsx
<button type="button" className="od-filter-button">
  Filtros
</button>
```

Activo:

```jsx
<button type="button" className="od-filter-button od-filter-button--active">
  Filtros
</button>
```

Estilos:

```css
height: 32px;
padding: 0 10px;
border-radius: 8px;
border: 1px solid #dce3f5;
background: #ffffff;
color: #334155;
font-size: 12px;
font-weight: 600;
```

Activo:

```css
border-color: #fc4200;
color: #fc4200;
background: #fff8f5;
```

### Botón secundario

```css
.od-button-secondary {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid #dce3f5;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.od-button-secondary:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
```

### Botón peligro

```css
.od-button-danger {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fff7f7;
  color: #a63a3a;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.od-button-danger:hover {
  background: #fff1f1;
  border-color: #fca5a5;
  color: #8b2e2e;
}
```

Antes de crear una clase nueva, comprobar si ya existe una equivalente.

---

## 16. Menús contextuales

### DOM nativo

```jsx
<ul className="od-action-menu">
  <li>
    <button className="od-action-menu-item">Duplicar</button>
  </li>
</ul>
```

Item peligro:

```jsx
<button className="od-action-menu-item od-action-menu-item--danger">
  Borrar
</button>
```

Contenedor:

```css
background: #ffffff;
border: 1px solid #dce3f5;
border-radius: 8px;
box-shadow:
  0 4px 12px rgba(17, 18, 41, 0.08),
  0 1px 2px rgba(17, 18, 41, 0.06);
```

Item:

```css
padding: 8px 12px;
font-size: 13px;
line-height: 1.3;
color: #334155;
```

Hover:

```css
background: rgba(252, 66, 0, 0.12);
color: #0f172a;
```

### Popover Ionic

```jsx
<IonPopover ...>
  <IonContent className="od-action-popover-content">
    <IonList lines="none">
      <IonItem button detail={false}>
        <span className="od-popover-menu-label">
          <IonIcon
            icon={OD_ICONS.copyUrl}
            className="od-popover-menu-icon"
            aria-hidden="true"
          />
          Copiar URL
        </span>
      </IonItem>
    </IonList>
  </IonContent>
</IonPopover>
```

Reglas:

- usar listas sin líneas internas;
- mantener alineación de icono y texto;
- usar el patrón danger global para acciones destructivas;
- no añadir separadores visuales innecesarios;
- no utilizar `slot="start"` cuando rompa la alineación.

---

## 17. Modales

Patrón:

```jsx
<div className="od-modal-backdrop">
  <section className="od-modal">
    <header className="od-modal-header">
      <h2 className="od-modal-title">Título</h2>

      <button
        type="button"
        className="od-modal-close"
        aria-label="Cerrar"
      >
        ×
      </button>
    </header>

    <div className="od-modal-body">
      ...
    </div>
  </section>
</div>
```

Estilos globales:

```css
.od-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 11000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
}

.od-modal {
  width: 100%;
  max-width: 420px;
  max-height: min(90vh, 560px);
  overflow: auto;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #dce3f5;
  box-shadow:
    0 20px 40px rgba(15, 23, 42, 0.12),
    0 4px 12px rgba(15, 23, 42, 0.06);
  font-size: 13px;
  color: #334155;
  color-scheme: light;
}
```

Reglas:

- no crear modales sin el patrón global;
- respetar paddings interiores;
- no usar botones nativos sin clase;
- no heredar colores blancos o transparentes en títulos;
- no dejar inputs oscuros;
- organizar acciones con el patrón global;
- mantener botones alineados según el diseño;
- no forzar el botón principal a ancho completo en todos los casos;
- cerrar con un control accesible.

---

## 18. Cards

Patrón:

```jsx
<section className="od-card">
  <h3 className="od-card-title">Título</h3>
</section>
```

Estilo:

```css
border: 1px solid #dce3f5;
background: #ffffff;
border-radius: 8px;
padding: 10px;
```

No crear estilos de card diferentes por módulo cuando el patrón global sea suficiente.

---

## 19. Tabs

Patrón:

```jsx
<div className="od-tabs od-section-tabs">
  <button className="od-section-tabs__item is-active">
    Tab
  </button>
</div>
```

Alternativa:

```jsx
<button className="od-tab-btn is-active">
  Tab
</button>
```

Activo:

```css
border-color: #fc4200;
color: #fc4200;
background: #fff8f5;
```

---

## 20. Scrollbars

Patrón:

```css
scrollbar-width: thin;
scrollbar-color: #cbd5e1 transparent;
```

WebKit:

```css
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
```

---

## 21. Formularios y labels

Label de filtro:

```jsx
<label className="od-filter-label">
  Persona
</label>
```

Estilo:

```css
font-size: 11px;
font-weight: 600;
color: #64748b;
letter-spacing: 0.02em;
text-transform: uppercase;
```

Patrón de campo:

```css
.od-form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.od-form-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

Reglas:

- mantener separación consistente entre label y campo;
- no usar estilos de label propios por formulario;
- no usar texto excesivamente grande;
- no omitir labels cuando sean necesarios para accesibilidad.

---

## 22. Overlays y z-index

No inventar valores altos de `z-index`.

Reglas:

- usar el patrón global de modal;
- usar el sistema compartido de overlays cuando existan capas apiladas;
- usar portal cuando un dropdown pueda quedar cortado;
- no utilizar valores arbitrarios como `999999`;
- documentar cualquier nueva capa global.

---

## 23. Colores por tipo de elemento

### Acción principal

- fondo: `#fc4200`;
- hover: `#e03a00` o `filter: brightness(0.95)`;
- texto: `#ffffff`;
- borde: `#fc4200`.

### Acción secundaria

- fondo: `#ffffff`;
- hover: `#f8fafc`;
- texto: `#334155`;
- borde: `#dce3f5`;
- borde hover: `#cbd5e1`.

### Acción activa

- fondo: `#fff8f5`;
- texto: `#fc4200`;
- borde: `#fc4200`.

### Acción danger

- fondo: `#fff7f7`;
- texto: `#a63a3a`;
- borde: `#fecaca`;
- texto hover: `#8b2e2e`.

### Panel, modal o tabla

- fondo: `#ffffff`;
- borde: `#dce3f5`;
- texto: `#334155`;
- título: `#0f172a`.

### Cabecera de tabla

- fondo: `#f1f5ff`;
- texto: `#3d4a63`.

### Hover de fila

- fondo: `#f8fafc`.

---

## 24. Radios

Valores:

- badge: `999px`;
- input, select, botón y card: `8px`;
- wrapper de tabla: `10px`;
- modal: `12px`;
- opción de menú o dropdown: `6px`;
- botón de cierre de modal: `8px`.

No mezclar radios arbitrarios.

---

## 25. Sombras

Tabla:

```css
box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
```

Dropdown:

```css
box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
```

Menú:

```css
box-shadow:
  0 4px 12px rgba(17, 18, 41, 0.08),
  0 1px 2px rgba(17, 18, 41, 0.06);
```

Modal:

```css
box-shadow:
  0 20px 40px rgba(15, 23, 42, 0.12),
  0 4px 12px rgba(15, 23, 42, 0.06);
```

No crear sombras más intensas sin una razón visual justificada.

---

## 26. Prohibiciones

No hacer:

- no crear modales sin el patrón global;
- no usar inputs nativos oscuros;
- no usar un selector como badge;
- no crear colores nuevos sin justificación;
- no usar azul de navegador por defecto;
- no usar botones nativos sin clase;
- no usar iconos dispersos cuando exista un sistema global;
- no inventar `z-index`;
- no introducir CSS global en archivos de módulo salvo que sea realmente global;
- no duplicar patrones existentes;
- no crear variantes visuales por feature cuando una variante global sea suficiente;
- no modificar estilos de otros módulos para resolver un problema local;
- no renombrar masivamente clases sin una decisión arquitectónica;
- no reutilizar lógica funcional de OrangeDesk junto con los estilos.

---

## 27. Instrucción para agentes de IA antes de tocar UI

Cuando ChatGPT, Cursor o Codex trabajen sobre interfaz deben:

1. revisar esta guía;
2. revisar el código real actualizado;
3. identificar si el patrón ya existe;
4. reutilizar clases y componentes globales;
5. aplicar CAMBIO MÍNIMO;
6. evitar inventar colores, paddings, radios, sombras o tamaños;
7. evitar modificar archivos no relacionados;
8. ejecutar las validaciones disponibles;
9. no hacer commit ni push salvo instrucción explícita.

Cuando la infraestructura del proyecto esté disponible, las validaciones concretas deberán actualizarse aquí.

Como referencia inicial:

```powershell
npm.cmd run build
git diff --check
```

---

## 28. Checklist visual

Antes de cerrar una tarea UI comprobar:

- ¿Se ha reutilizado un patrón global?
- ¿La modal sigue el estilo de OrangeFamily?
- ¿Los paddings interiores son coherentes?
- ¿Los botones tienen tamaño y alineación correctos?
- ¿El botón principal ocupa solo el ancho necesario?
- ¿Los inputs son claros?
- ¿El foco es discreto y consistente?
- ¿Los badges son compactos?
- ¿Los badges interactivos son botones accesibles?
- ¿Los popovers mantienen alineación e iconografía coherentes?
- ¿Los iconos tienen tamaño correcto?
- ¿El hover utiliza naranja o gris suave según el contexto?
- ¿El responsive continúa funcionando?
- ¿Se han evitado colores nuevos?
- ¿Se ha evitado duplicar CSS?
- ¿Se han limitado los cambios a los archivos necesarios?

---

## 29. Patrones globales previstos

Cuando la infraestructura visual se incorpore al repositorio, deberán revisarse y documentarse estos patrones.

### Tablas

```text
.od-table-wrap
.od-table
.od-table--fill
.od-table--listing-wide
.od-table-col--title
.od-table-col--actions
.od-table-inline-actions
```

### Inputs

```text
.od-filter-input
.od-filter-search-input
.od-inline-input
.od-inline-select
.od-inline-date
.od-select-compact
```

### Badges

```text
ion-badge.od-badge
ion-badge.od-badge-compact
.od-badge--style-1
.od-badge--style-2
.od-badge--style-3
.od-badge--style-4
.od-badge--style-5
.od-badge--style-6
.od-badge--style-7
.od-badge--style-8
.od-badge--style-9
```

### Badge interactivo

```text
.od-badge-clickable
.od-badge-clickable__label
```

### Menús y popovers

```text
.od-action-menu
.od-action-menu-item
.od-action-popover-content
.od-popover-menu-label
.od-popover-menu-icon
.od-popover-menu-label--danger
```

### Modales

```text
.od-modal-backdrop
.od-modal
.od-modal-header
.od-modal-title
.od-modal-close
.od-modal-body
.od-modal-actions
.od-modal-primary
.od-modal-primary-link
```

### Cards y tabs

```text
.od-card
.od-card-title
.od-tabs
.od-section-tabs
.od-tab-btn
```

Estas clases son provisionales hasta revisar la infraestructura reutilizada.

No deben considerarse implementadas en OrangeFamily únicamente por aparecer en esta guía.