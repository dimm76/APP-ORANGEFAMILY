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
  settingsOutline,
  logOutOutline,
  peopleOutline,
  walletOutline,
} from "ionicons/icons";
import { useAuth } from "./authContext.js";
import OrangePhotosSidebar from "../features/orange-photos/OrangePhotosSidebar.jsx";
import SettingsSidebar from "../features/settings/SettingsSidebar.jsx";

const OD_NAV_EVENT = "od-spa-navigate";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: homeOutline },
  { label: "Personas", href: "/app/personas", icon: peopleOutline, ownerOnly: true },
  { label: "Proyectos", href: "/app/proyectos", icon: folderOpenOutline, ownerOnly: true },
  { label: "Finanzas", href: "/app/finanzas", icon: walletOutline, moduleKey: "finances" },
  { label: "Documentos", href: "/app/documentos", icon: folderOutline, moduleKey: "documents" },
  { label: "Wiki", href: "/app/wiki", icon: bookOutline, moduleKey: "wiki" },
  { label: "OrangePhotos", href: "/app/orangephotos", icon: imagesOutline, moduleKey: "orange_photos" },
  { label: "Notas", href: "/app/notas", icon: documentTextOutline, moduleKey: "notes" },
  {
    label: "Ajustes",
    href: "/app/settings/family",
    icon: settingsOutline,
    settingsItem: true,
  },
];

function currentPathname() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

function spaNavigate(href) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(OD_NAV_EVENT));
}

export default function Sidebar({ collapsed, onToggleCollapse, onNavigate, orangePhotosGuestMode = false }) {
  const { user, hasModuleAccess, logout } = useAuth();
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

  if (orangePhotosGuestMode) {
    return <OrangePhotosSidebar pathname={pathname} onNavigate={onNavigate} guestMode />;
  }

  const isOwner = user?.families?.some((family) => family.role === "owner");
  const settingsHref = isOwner ? "/app/settings/family" : "/app/settings/downloads";
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.ownerOnly || isOwner) &&
      (!item.moduleKey || hasModuleAccess(item.moduleKey))
  ).map((item) => item.settingsItem ? { ...item, href: settingsHref } : item);

  if (hasModuleAccess("orange_photos") && pathname.startsWith("/app/orangephotos")) {
    return <OrangePhotosSidebar pathname={pathname} onNavigate={onNavigate} />;
  }

  if (pathname.startsWith("/app/settings/")) {
    return <SettingsSidebar pathname={pathname} onNavigate={onNavigate} isOwner={isOwner} />;
  }

  return (
    <div className="od-sidebar-inner">
      <nav className="od-sidebar-nav" aria-label="Secciones">
        <IonList lines="none" className="od-sidebar-list">
          {visibleItems.map((item) => (
            <IonItem
              key={item.href}
              className={`od-main-item ${pathname === item.href || (item.href === "/app/wiki" && pathname.startsWith("/app/wiki/")) || (item.settingsItem && pathname.startsWith("/app/settings/")) ? "od-item-active" : ""}`}
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
