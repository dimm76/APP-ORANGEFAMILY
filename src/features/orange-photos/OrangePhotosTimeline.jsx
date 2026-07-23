const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });
const monthLabel = (year, month) => monthFormatter.format(new Date(Date.UTC(year, month - 1, 1))).replace(".", "");

export default function OrangePhotosTimeline({ items, activePeriod, onPeriodClick }) {
  const [activeYearText] = String(activePeriod || "").split("-");
  const activeYear = Number(activeYearText) || items.find(item => item.year != null)?.year;
  return <nav className="od-orange-photos__timeline" aria-label="Navegación temporal">{items.filter(item => item.year != null).map(item => <div className={item.year === activeYear ? "is-active-year" : ""} key={item.year}><button type="button" className={item.year === activeYear ? "is-active" : ""} onClick={() => onPeriodClick({ ...item.months[0], year: item.year })}><strong>{item.year}</strong></button>{item.year === activeYear ? item.months.map(period => <button key={`${item.year}-${period.month}`} type="button" className={activePeriod === `${item.year}-${String(period.month).padStart(2, "0")}` ? "is-active" : ""} onClick={() => onPeriodClick({ ...period, year: item.year })}>{monthLabel(item.year, period.month)}</button>) : null}</div>)}</nav>;
}
