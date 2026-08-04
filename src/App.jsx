import { useEffect, useState } from "react";
import AuthGate from "./app/AuthGate.jsx";
import AppLayout from "./app/AppLayout.jsx";
import AttachmentsLibraryPage from "./app/AttachmentsLibraryPage.jsx";
import WikiPage, { WikiPublicPage } from "./features/wiki/WikiPage.jsx";
import OrangePhotosPage from "./features/orange-photos/OrangePhotosPage.jsx";
import { OrangePhotoPublicPage, OrangeAlbumPublicPage } from "./features/orange-photos/OrangePhotosPublicPage.jsx";
import FamilyMembersPage from "./features/settings/FamilyMembersPage.jsx";
import StoragePage from "./features/settings/StoragePage.jsx";
import DownloadsPage from "./features/settings/DownloadsPage.jsx";
import { useAuth } from "./app/authContext.js";
import AuthActionPage from "./app/AuthActionPage.jsx";
import "./App.css";

const OD_NAV_EVENT = "od-spa-navigate";

const ROUTES = {
  "/": {
    title: "Dashboard",
    description: "Vista principal de OrangeFamily.",
  },
  "/app/personas": {
    title: "Personas",
    description: "El módulo Personas está pendiente de desarrollo.",
  },
  "/app/proyectos": {
    title: "Proyectos",
    description: "El módulo Proyectos está pendiente de desarrollo.",
  },
  "/app/finanzas": {
    title: "Finanzas",
    description: "El módulo Finanzas está pendiente de desarrollo.",
  },
  "/app/documentos": {
    title: "Documentos",
    description: "El módulo Documentos está pendiente de desarrollo.",
  },
  "/app/wiki": {
    title: "Wiki",
    description: "El módulo Wiki está pendiente de desarrollo.",
  },
  "/app/orangephotos": {
    title: "OrangePhotos",
    description: "El módulo OrangePhotos está pendiente de desarrollo.",
  },
  "/app/notas": {
    title: "Notas",
    description: "El módulo Notas está pendiente de desarrollo.",
  },
};

function currentPathname() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}
function isGuestAllowedPath(pathname) { return pathname === "/app/orangephotos" || pathname === "/app/orangephotos/albums" || /^\/app\/orangephotos\/albums\/[^/]+$/.test(pathname); }
function legacyGuestTarget(pathname) { if(pathname === "/guest") return "/app/orangephotos"; const prefix="/guest/orangephotos/albums/"; if(pathname.startsWith(prefix)){const albumId=pathname.slice(prefix.length);return albumId?`/app/orangephotos/albums/${albumId}`:"/app/orangephotos/albums";} return null; }

function ModulePlaceholder({ title, description }) {
  return (
    <div className="od-page">
      <div className="od-page-inner">
        <h1 className="od-page-title">{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function SettingsAccessDenied() {
  return <div className="od-page"><div className="od-page-inner"><h1 className="od-page-title">Acceso restringido</h1><p className="od-status-line od-status-line--error">Solo el administrador puede acceder a este apartado de Ajustes.</p></div></div>;
}

function AppContent() {
  const [pathname, setPathname] = useState(currentPathname);
  const { user } = useAuth();
  const isOwner = user?.families?.some((family) => family.role === "owner");
  const guestRole = user?.families?.[0]?.role === "guest";

  useEffect(() => {
    const syncPathname = () => setPathname(currentPathname());
    window.addEventListener("popstate", syncPathname);
    window.addEventListener(OD_NAV_EVENT, syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
      window.removeEventListener(OD_NAV_EVENT, syncPathname);
    };
  }, []);
  useEffect(() => { if(!guestRole || isGuestAllowedPath(pathname)) return; window.history.replaceState({},"","/app/orangephotos"); window.dispatchEvent(new Event(OD_NAV_EVENT)); }, [guestRole, pathname]);
  if(guestRole && !isGuestAllowedPath(pathname)) return null;

  const route = ROUTES[pathname] || ROUTES["/"];

  return (
    <AppLayout>
      {pathname === "/app/settings/downloads" ? <DownloadsPage /> : pathname.startsWith("/app/settings/") && !isOwner ? <SettingsAccessDenied /> : pathname === "/app/settings/attachments" ? (
        <AttachmentsLibraryPage />
      ) : pathname === "/app/settings/family" ? (
        <FamilyMembersPage />
      ) : pathname === "/app/settings/storage" ? (
        <StoragePage />
      ) : pathname === "/app/wiki" || pathname.startsWith("/app/wiki/") ? (
        <WikiPage />
      ) : pathname.startsWith("/app/orangephotos") || pathname === "/app/orange-photos" ? (
        <OrangePhotosPage />
      ) : (
        <ModulePlaceholder title={route.title} description={route.description} />
      )}
    </AppLayout>
  );
}
function App() {
  const pathname = currentPathname();
  const legacyTarget = legacyGuestTarget(pathname);
  if(legacyTarget){window.history.replaceState({},"",legacyTarget);return <AuthGate><AppContent /></AuthGate>;}
  if(pathname.startsWith("/guest-invitations/")) return <div className="od-page"><div className="od-page-inner"><h1 className="od-page-title">Invitación no válida</h1><p className="od-status-line od-status-line--error">Esta invitación pertenece al sistema anterior. Solicita al administrador una nueva invitación.</p></div></div>;
  if (pathname.startsWith("/public/wiki/")) {
    const token = decodeURIComponent(pathname.slice("/public/wiki/".length)).trim();
    return <WikiPublicPage token={token} />;
  }
  if (pathname.startsWith("/public/orangephotos/photo/")) return <OrangePhotoPublicPage token={decodeURIComponent(pathname.slice("/public/orangephotos/photo/".length)).trim()} />;
  if (pathname.startsWith("/public/orangephotos/album/")) return <OrangeAlbumPublicPage token={decodeURIComponent(pathname.slice("/public/orangephotos/album/".length)).trim()} />;
  if (pathname === "/activate") return <AuthActionPage mode="activate" />;
  if (pathname === "/reset-password") return <AuthActionPage mode="reset" />;
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

export default App;
