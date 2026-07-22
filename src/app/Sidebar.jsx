import { useEffect, useState } from "react";
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import {
  bookOutline,
  chevronBackOutline,
  chevronForwardOutline,
  documentTextOutline,
  folderOpenOutline,
  folderOutline,
  homeOutline,
  imagesOutline,
  attachOutline,
  logOutOutline,
  peopleOutline,
  walletOutline,
} from "ionicons/icons";
import { useAuth } from "./authContext.js";

const OD_NAV_EVENT = "od-spa-navigate";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: homeOutline },
  { label: "Personas", href: "/app/personas", icon: peopleOutline },
  { label: "Proyectos", href: "/app/proyectos", icon: folderOpenOutline },
  { label: "Finanzas", href: "/app/finanzas", icon: walletOutline },
  { label: "Documentos", href: "/app/documentos", icon: folderOutline },
  { label: "Wiki", href: "/app/wiki", icon: bookOutline },
  { label: "OrangePhotos", href: "/app/orange-photos", icon: imagesOutline },
  { label: "Notas", href: "/app/notas", icon: documentTextOutline },
  { label: "Attachments", href: "/app/settings/attachments", icon: attachOutline },
];

function currentPathname() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

function spaNavigate(href) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(OD_NAV_EVENT));
}

export default function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const { logout } = useAuth();
  const [pathname, setPathname] = useState(currentPathname);

  useEffect(() => {
    const syncPathname = () => setPathname(currentPathname());
    window.addEventListener("popstate", syncPathname);
    window.addEventListener(OD_NAV_EVENT, syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
      window.removeEventListener(OD_NAV_EVENT, syncPathname);
    };
  }, []);

  function navigate(href) {
    spaNavigate(href);
    onNavigate?.();
  }

  return (
    <div className="od-sidebar-inner">
      <nav className="od-sidebar-nav" aria-label="Secciones">
        <IonList lines="none" className="od-sidebar-list">
          {NAV_ITEMS.map((item) => (
            <IonItem
              key={item.href}
              className={`od-main-item ${pathname === item.href || (item.href === "/app/wiki" && pathname.startsWith("/app/wiki/")) ? "od-item-active" : ""}`}
              button
              detail={false}
              lines="none"
              onClick={() => navigate(item.href)}
            >
              <IonIcon icon={item.icon} slot="start" aria-hidden="true" />
              <IonLabel className="od-main-label">{item.label}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      </nav>

      <div className="od-sidebar-footer">
        <IonButton
          className="od-sidebar-footer-btn od-sidebar-footer-btn--collapse"
          fill="clear"
          expand="block"
          size="small"
          aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
          onClick={onToggleCollapse}
        >
          <IonIcon
            slot="start"
            icon={collapsed ? chevronForwardOutline : chevronBackOutline}
            aria-hidden="true"
          />
          {!collapsed ? <span className="od-sidebar-footer-text">CONTRAER</span> : null}
        </IonButton>

        <IonButton
          className="od-sidebar-footer-btn od-sidebar-footer-btn--exit"
          fill="clear"
          expand="block"
          size="small"
          aria-label="Salir"
          type="button"
          onClick={() => {
            void logout();
            onNavigate?.();
          }}
        >
          <IonIcon slot="start" icon={logOutOutline} aria-hidden="true" />
          {!collapsed ? <span className="od-sidebar-footer-text">SALIR</span> : null}
        </IonButton>
      </div>
    </div>
  );
}
