import { IonIcon } from "@ionic/react";
import { searchOutline } from "ionicons/icons";

export default function GlobalSearch() {
  return (
    <div className="od-global-search">
      <span className="od-global-search-icon" aria-hidden="true">
        <IonIcon icon={searchOutline} />
      </span>
      <input
        type="search"
        className="od-filter-search-input od-global-search-input"
        placeholder="Buscar…"
        aria-label="Búsqueda global"
      />
    </div>
  );
}
