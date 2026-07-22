export default function OrangePhotosTimeline({ groups, activePeriod, onPeriodClick }) {
  const years = new Map();

  groups.forEach((group) => {
    if (group.key === "unknown") return;
    const [year] = group.key.split("-");
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(group);
  });

  return (
    <nav className="od-orange-photos__timeline" aria-label="Navegación temporal">
      {[...years].map(([year, periods]) => (
        <div key={year}>
          <strong>{year}</strong>
          {periods.map((period) => (
            <button
              key={period.key}
              type="button"
              className={activePeriod === period.key ? "is-active" : ""}
              onClick={() => onPeriodClick(period.key)}
            >
              {period.shortLabel}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
