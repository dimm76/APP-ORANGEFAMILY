import { IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { albumsOutline, arrowBackOutline, heartOutline, imagesOutline, logOutOutline, peopleOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../../app/authContext.js";

const navigate = (href, onNavigate) => { window.history.pushState({}, "", href); window.dispatchEvent(new Event("od-spa-navigate")); onNavigate?.(); };

export default function OrangePhotosSidebar({ pathname, onNavigate, guestMode = false }) {
  const { logout } = useAuth();
  if (guestMode) return <div className="od-sidebar-inner od-orangephotos-sidebar"><nav className="od-sidebar-nav" aria-label="OrangePhotos"><IonList lines="none" className="od-sidebar-list"><IonItem className="od-main-item od-item-active" button detail={false} lines="none" onClick={() => navigate("/guest", onNavigate)}><IonIcon icon={albumsOutline} slot="start" aria-hidden="true" /><IonLabel className="od-main-label">Álbumes</IonLabel></IonItem></IonList></nav><div className="od-sidebar-footer"><IonButton className="od-sidebar-footer-btn od-sidebar-footer-btn--exit" fill="clear" expand="block" size="small" type="button" onClick={async () => { await logout(); window.history.replaceState({}, "", "/"); window.dispatchEvent(new Event("od-spa-navigate")); }}><IonIcon slot="start" icon={logOutOutline} aria-hidden="true" /><span className="od-sidebar-footer-text">SALIR</span></IonButton></div></div>;
  const primaryItems = [{ label: "Fotos", href: "/app/orangephotos", icon: imagesOutline }, { label: "Álbumes", href: "/app/orangephotos/albums", icon: albumsOutline }];
  const libraryItems = [{ label: "Compartidas conmigo", href: "/app/orangephotos/shared-with-me", icon: peopleOutline }, { label: "Favoritas", href: "/app/orangephotos/favorites", icon: heartOutline }, { label: "Papelera", href: "/app/orangephotos/trash", icon: trashOutline }];
  const render = items => items.map(item => <IonItem key={item.href} className={`od-main-item${pathname === item.href || item.href.endsWith("/albums") && pathname.startsWith(item.href) ? " od-item-active" : ""}`} button detail={false} lines="none" onClick={() => navigate(item.href, onNavigate)}><IonIcon icon={item.icon} slot="start" /><IonLabel className="od-main-label">{item.label}</IonLabel></IonItem>);
  return <div className="od-sidebar-inner od-orangephotos-sidebar"><button type="button" className="od-orangephotos-sidebar__back" onClick={() => navigate("/", onNavigate)}><IonIcon icon={arrowBackOutline} /> Biblioteca</button><nav className="od-sidebar-nav" aria-label="OrangePhotos"><IonList lines="none" className="od-sidebar-list">{render(primaryItems)}<div className="od-orangephotos-sidebar__divider" />{render(libraryItems)}</IonList></nav></div>;
}
