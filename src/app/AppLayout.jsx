import { useState } from "react";
import { IonApp, IonContent, IonIcon } from "@ionic/react";
import { menuOutline } from "ionicons/icons";
import GlobalSearch from "../shared/components/GlobalSearch.jsx";
import Sidebar from "./Sidebar.jsx";
import "./app-layout.css";

const OD_NAV_EVENT = "od-spa-navigate";

function navigateToDashboard(event) {
  event.preventDefault();
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new Event(OD_NAV_EVENT));
}

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <IonApp
      className={`od-app-root ${collapsed ? "od-app-root--collapsed" : ""} ${
        mobileNavOpen ? "od-app-root--mobile-nav-open" : ""
      }`}
    >
      <div className="od-app-shell">
        <header className="od-app-header">
          <button
            type="button"
            className="od-app-header-menu-toggle"
            aria-label="Abrir menú de navegación"
            onClick={() => setMobileNavOpen(true)}
          >
            <IonIcon icon={menuOutline} aria-hidden="true" />
          </button>

          <a
            className="od-app-header-brand-link"
            href="/"
            onClick={navigateToDashboard}
          >
            <img
              className="od-app-header-brand"
              src="/favicon.svg"
              alt="OrangeFamily"
              width="33"
              height="32"
            />
          </a>

          <div className="od-app-header-search" aria-label="Búsqueda global">
            <GlobalSearch />
          </div>

          <div className="od-app-header-actions" aria-hidden="true" />
        </header>

        <div className="od-app-body">
          <aside
            className={`od-sidebar ${collapsed ? "od-sidebar--collapsed" : ""}`}
            aria-label="Navegación principal"
          >
            <Sidebar
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed((current) => !current)}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>

          {mobileNavOpen ? (
            <button
              type="button"
              className="od-sidebar-backdrop"
              aria-label="Cerrar menú"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}

          <main className="od-main">
            <IonContent className="od-main-ion-content">{children}</IonContent>
          </main>
        </div>
      </div>
    </IonApp>
  );
}
