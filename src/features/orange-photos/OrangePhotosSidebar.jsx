import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { albumsOutline, arrowBackOutline, heartOutline, imagesOutline, trashOutline } from "ionicons/icons";

const OD_NAV_EVENT = "od-spa-navigate";

function navigate(href, onNavigate) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(OD_NAV_EVENT));
  onNavigate?.();
}

export default function OrangePhotosSidebar({ pathname, onNavigate }) {
  const items = [
    { label: "Fotos", href: "/app/orangephotos", icon: imagesOutline, active: pathname === "/app/orangephotos" },
    { label: "Favoritas", href: "/app/orangephotos/favorites", icon: heartOutline, active: pathname === "/app/orangephotos/favorites" },
    { label: "Ãlbumes", href: "/app/orangephotos/albums", icon: albumsOutline, active: pathname.startsWith("/app/orangephotos/albums") },
    { label: "Papelera", href: "/app/orangephotos/trash", icon: trashOutline, active: pathname === "/app/orangephotos/trash" },
  ];
  return <div className="od-sidebar-inner od-orangephotos-sidebar"><button type="button" className="od-orangephotos-sidebar__back" onClick={() => navigate("/", onNavigate)}><IonIcon icon={arrowBackOutline} aria-hidden="true" /> Biblioteca</button><nav className="od-sidebar-nav" aria-label="OrangePhotos"><IonList lines="none" className="od-sidebar-list">{items.map(item => <IonItem key={item.href} className={`od-main-item${item.active ? " od-item-active" : ""}`} button detail={false} lines="none" onClick={() => navigate(item.href, onNavigate)}><IonIcon icon={item.icon} slot="start" aria-hidden="true"/><IonLabel className="od-main-label">{item.label}</IonLabel></IonItem>)}</IonList></nav></div>;
}
