import { useEffect, useState } from "react";
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

function normalizePathname(pathname) {
  return String((pathname || "").split("?")[0] || "").replace(/\/$/, "") || "/";
}

function isWikiDocumentWorkspacePath(pathname) {
  const path = normalizePathname(pathname);
  if (path === "/app/wiki") return false;
  if (!path.startsWith("/app/wiki/")) return false;
  const rest = decodeURIComponent(path.slice("/app/wiki/".length)).trim();
  return rest !== "" && !rest.includes("/");
}

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [routeTick, setRouteTick] = useState(0);
  void routeTick;
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const wikiWorkspaceMode = isWikiDocumentWorkspacePath(pathname);

  useEffect(() => {
    const sync = () => setRouteTick((value) => value + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(OD_NAV_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(OD_NAV_EVENT, sync);
    };
  }, []);

  return (
    <IonApp
      className={`od-app-root ${collapsed ? "od-app-root--collapsed" : ""} ${
        mobileNavOpen ? "od-app-root--mobile-nav-open" : ""
      } ${wikiWorkspaceMode ? "od-app-root--wiki-workspace" : ""}`}
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

          <div className="od-app-header-actions">
            {wikiWorkspaceMode ? (
              <span
                id="od-wiki-add-block-host"
                className="od-wiki-add-block-host"
                aria-hidden="false"
              />
            ) : null}
          </div>
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
