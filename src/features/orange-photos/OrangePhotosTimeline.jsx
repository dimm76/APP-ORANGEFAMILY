/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";

const MIN_PERIOD_WEIGHT = 1;
const SCRUB_DELAY_MS = 140;

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
function periodLabel(year, month) {
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "");
}

function normalizeTimeline(items) {
  const periods = [];
  for (const yearItem of items || []) {
    const year = Number(yearItem.year);
    if (!Number.isInteger(year)) continue;
    const months = Array.isArray(yearItem.months) ? yearItem.months : [];
    for (const monthItem of months) {
      const month = Number(monthItem.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) continue;
      const rawCount = Number(
        monthItem.count ?? monthItem.total ?? monthItem.items_count ?? monthItem.photo_count ?? 1,
      );
      periods.push({
        ...monthItem,
        year,
        month,
        key: periodKey(year, month),
        label: periodLabel(year, month),
        weight: Math.max(MIN_PERIOD_WEIGHT, Number.isFinite(rawCount) ? rawCount : 1),
      });
    }
  }
  return periods;
}

function buildWeightedPositions(periods) {
  if (!periods.length) return [];
  const totalWeight = periods.reduce((sum, period) => sum + period.weight, 0);
  let accumulated = 0;
  return periods.map((period, index) => {
    const start = accumulated / totalWeight;
    accumulated += period.weight;
    const end = accumulated / totalWeight;
    return { ...period, index, start, end, center: (start + end) / 2 };
  });
}

function nearestPeriod(periods, progress) {
  if (!periods.length) return null;
  let nearest = periods[0];
  let distance = Math.abs(progress - nearest.center);
  for (let index = 1; index < periods.length; index += 1) {
    const candidate = periods[index];
    const candidateDistance = Math.abs(progress - candidate.center);
    if (candidateDistance < distance) {
      nearest = candidate;
      distance = candidateDistance;
    }
  }
  return nearest;
}

export default function OrangePhotosTimeline({
  items,
  activePeriod,
  progress,
  visible,
  onScrub,
}) {
  const trackRef = useRef(null);
  const scrubTimerRef = useRef(null);
  const lastRequestedKeyRef = useRef("");
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(progress || 0);
  const [previewPeriod, setPreviewPeriod] = useState(null);
  const periods = useMemo(
    () => buildWeightedPositions(normalizeTimeline(items)),
    [items],
  );
  const years = useMemo(() => {
    const result = [];
    for (const period of periods) {
      const existing = result.find((item) => item.year === period.year);
      if (existing) {
        existing.start = Math.min(existing.start, period.start);
        existing.end = Math.max(existing.end, period.end);
        existing.count += period.weight;
      } else {
        result.push({
          year: period.year,
          start: period.start,
          end: period.end,
          count: period.weight,
        });
      }
    }
    return result.map((year) => ({ ...year, center: (year.start + year.end) / 2 }));
  }, [periods]);

  useEffect(() => {
    if (draggingRef.current) return;

    const physicalProgress = Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : 0;

    const activeTimelinePeriod = periods.find(
      (period) => period.key === activePeriod,
    );

    const current =
      activeTimelinePeriod ||
      nearestPeriod(periods, physicalProgress);

    /*
     * El scroll del contenido y el timeline usan escalas diferentes.
     * Cuando conocemos el periodo visible, el tirador debe colocarse
     * en el centro ponderado de ese periodo, no en el porcentaje físico
     * de scroll del contenedor.
     *
     * physicalProgress se conserva únicamente como fallback inicial,
     * antes de que IntersectionObserver determine activePeriod.
     */
    const timelineProgress = current
      ? current.center
      : physicalProgress;

    setScrubProgress(timelineProgress);
    setPreviewPeriod(current || null);
  }, [activePeriod, periods, progress]);

  useEffect(() => {
    if (draggingRef.current) return;
    lastRequestedKeyRef.current = activePeriod || "";
  }, [activePeriod]);

  useEffect(
    () => () => {
      window.clearTimeout(scrubTimerRef.current);
    },
    [],
  );

  function requestPeriod(period, immediate = false) {
    if (!period || period.key === lastRequestedKeyRef.current) return;
    const execute = () => {
      lastRequestedKeyRef.current = period.key;
      onScrub?.(period);
    };
    window.clearTimeout(scrubTimerRef.current);
    if (immediate) {
      execute();
      return;
    }
    scrubTimerRef.current = window.setTimeout(execute, SCRUB_DELAY_MS);
  }

  function updateFromPointer(clientY, immediate = false) {
    const track = trackRef.current;
    if (!track || !periods.length) return;
    const rect = track.getBoundingClientRect();
    if (!rect.height) return;
    const nextProgress = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const period = nearestPeriod(periods, nextProgress);
    setScrubProgress(nextProgress);
    setPreviewPeriod(period);
    requestPeriod(period, immediate);
  }

  function handlePointerDown(event) {
    if (!periods.length) return;
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromPointer(event.clientY, true);
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) return;
    event.preventDefault();
    updateFromPointer(event.clientY);
  }

  function finishPointer(event) {
    if (!draggingRef.current) return;
    event.preventDefault();
    updateFromPointer(event.clientY, true);
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!periods.length) return null;

  return (
    <nav
      className={`od-orange-photos__timeline${visible ? " is-visible" : ""}${
        dragging ? " is-dragging" : ""
      }`}
      aria-label="Navegación temporal"
    >
      <div
        ref={trackRef}
        className="od-orange-photos__timeline-track"
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(scrubProgress * 100)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={(event) => {
          event.preventDefault();
          const viewport = event.currentTarget.closest(".od-orange-photos__viewport");
          const scroller = viewport?.querySelector(".od-orange-photos__scroller");
          scroller?.scrollBy({ top: event.deltaY, behavior: "auto" });
        }}
      >
        <div className="od-orange-photos__timeline-years">
          {years.map((year) => (
            <span
              className={`od-orange-photos__timeline-year${
                String(activePeriod).startsWith(`${year.year}-`) ? " is-active" : ""
              }`}
              style={{ top: `${year.center * 100}%` }}
              key={year.year}
            >
              {year.year}
            </span>
          ))}
        </div>
        <div className="od-orange-photos__timeline-dots" aria-hidden="true">
          {periods.map((period) => (
            <span
              className={`od-orange-photos__timeline-dot${
                period.key === activePeriod ? " is-active" : ""
              }`}
              style={{ top: `${period.center * 100}%` }}
              key={period.key}
            />
          ))}
        </div>
        <div
          className="od-orange-photos__timeline-thumb"
          style={{ top: `${scrubProgress * 100}%` }}
          aria-hidden="true"
        >
          <span className="od-orange-photos__timeline-thumb-grip" />
        </div>
        {previewPeriod ? (
          <output
            className="od-orange-photos__timeline-label"
            style={{ top: `${scrubProgress * 100}%` }}
          >
            {previewPeriod.label}
          </output>
        ) : null}
      </div>
    </nav>
  );
}
