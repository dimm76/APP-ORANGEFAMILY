/**
 * @param {{
 *   page: number,
 *   maxPages: number,
 *   total: number,
 *   perPage: number,
 *   disabled?: boolean,
 *   onPrev: () => void,
 *   onNext: () => void,
 * }} props
 */
export default function TaskPagination({
  page,
  maxPages,
  total,
  perPage,
  disabled = false,
  onPrev,
  onNext,
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePage = Math.max(1, Number(page) || 1);
  const safeMax = Math.max(1, Number(maxPages) || 1);
  const safePer = Math.max(1, Number(perPage) || 20);

  let rangeLabel = "Sin resultados";
  if (safeTotal > 0) {
    const start = (safePage - 1) * safePer + 1;
    const end = Math.min(safePage * safePer, safeTotal);
    rangeLabel = `Mostrando ${start}–${end} de ${safeTotal}`;
  }

  const prevDisabled = disabled || safePage <= 1;
  const nextDisabled = disabled || safePage >= safeMax;

  return (
    <div className="od-pagination" aria-label="Paginación">
      <p className="od-pagination__summary">{rangeLabel}</p>
      <div className="od-pagination__controls">
        <span className="od-pagination__meta">
          Página {safePage} de {safeMax}
        </span>
        <button
          type="button"
          className="od-pagination__btn"
          onClick={onPrev}
          disabled={prevDisabled}
        >
          Anterior
        </button>
        <button
          type="button"
          className="od-pagination__btn"
          onClick={onNext}
          disabled={nextDisabled}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
