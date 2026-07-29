import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import {
  arrowBackOutline,
  attachOutline,
  cloudOutline,
  peopleOutline,
} from "ionicons/icons";
import "./settings.css";

const OD_NAV_EVENT = "od-spa-navigate";

const ITEMS = [
  {
    label: "Familiares",
    href: "/app/settings/family",
    icon: peopleOutline,
  },
  {
    label: "Attachments",
    href: "/app/settings/attachments",
    icon: attachOutline,
  },
  {
    label: "Almacenamiento",
    href: "/app/settings/storage",
    icon: cloudOutline,
  },
];

function normalizePathname(pathname) {
  return String(pathname || "").replace(/\/$/, "") || "/";
}

function navigate(href, onNavigate) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(OD_NAV_EVENT));
  onNavigate?.();
}

export default function SettingsSidebar({ pathname, onNavigate }) {
  const currentPathname = normalizePathname(pathname);

  return (
    <div className="od-sidebar-inner of-settings-sidebar">
      <button
        type="button"
        className="of-settings-sidebar__back"
        onClick={() => navigate("/", onNavigate)}
      >
        <IonIcon icon={arrowBackOutline} aria-hidden="true" />
        Menú principal
      </button>

      <nav className="od-sidebar-nav" aria-label="Ajustes">
        <IonList lines="none" className="od-sidebar-list">
          {ITEMS.map((item) => (
            <IonItem
              key={item.href}
              className={`od-main-item${
                currentPathname === item.href ? " od-item-active" : ""
              }`}
              button
              detail={false}
              lines="none"
              onClick={() => navigate(item.href, onNavigate)}
            >
              <IonIcon icon={item.icon} slot="start" aria-hidden="true" />
              <IonLabel className="od-main-label">{item.label}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      </nav>
    </div>
  );
}
