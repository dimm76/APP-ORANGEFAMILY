import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { arrowBackOutline, attachOutline, cloudOutline, downloadOutline, peopleOutline } from "ionicons/icons";
import "./settings.css";

const ITEMS = [
  ["Familiares", "/app/settings/family", peopleOutline, true],
  ["Attachments", "/app/settings/attachments", attachOutline, true],
  ["Almacenamiento", "/app/settings/storage", cloudOutline, true],
  ["Descargas", "/app/settings/downloads", downloadOutline, false],
];

export default function SettingsSidebar({ pathname, onNavigate, isOwner }) {
  const navigate = (href) => { window.history.pushState({}, "", href); window.dispatchEvent(new Event("od-spa-navigate")); onNavigate?.(); };
  return <div className="od-sidebar-inner of-settings-sidebar">
    <button type="button" className="of-settings-sidebar__back" onClick={() => navigate("/")}>
      <IonIcon icon={arrowBackOutline} aria-hidden="true" />Menú principal
    </button>
    <nav className="od-sidebar-nav" aria-label="Ajustes"><IonList lines="none" className="od-sidebar-list">
      {ITEMS.filter(([, , , ownerOnly]) => !ownerOnly || isOwner).map(([label, href, icon]) => (
        <IonItem key={href} className={`od-main-item${pathname === href ? " od-item-active" : ""}`} button detail={false} lines="none" onClick={() => navigate(href)}>
          <IonIcon icon={icon} slot="start" aria-hidden="true" /><IonLabel className="od-main-label">{label}</IonLabel>
        </IonItem>
      ))}
    </IonList></nav>
  </div>;
}
