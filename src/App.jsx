import { useEffect, useState } from "react";
import AuthGate from "./app/AuthGate.jsx";
import AppLayout from "./app/AppLayout.jsx";
import AttachmentsLibraryPage from "./app/AttachmentsLibraryPage.jsx";
import WikiPage, { WikiPublicPage } from "./features/wiki/WikiPage.jsx";
import OrangePhotosPage from "./features/orange-photos/OrangePhotosPage.jsx";
import FamilyMembersPage from "./features/settings/FamilyMembersPage.jsx";
import AuthActionPage from "./app/AuthActionPage.jsx";
import { useAuth } from "./app/authContext.js";
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

function AppContent() {
  const [pathname, setPathname] = useState(currentPathname);
  const { user } = useAuth();
  const isOwner = user?.families?.some((family) => family.role === "owner");

  useEffect(() => {
    const syncPathname = () => setPathname(currentPathname());
    window.addEventListener("popstate", syncPathname);
    window.addEventListener(OD_NAV_EVENT, syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
      window.removeEventListener(OD_NAV_EVENT, syncPathname);
    };
  }, []);

  useEffect(() => {
    if (!isOwner && !pathname.startsWith("/app/orangephotos")) {
      window.history.replaceState({}, "", "/app/orangephotos");
      window.dispatchEvent(new Event(OD_NAV_EVENT));
    }
  }, [isOwner, pathname]);

  const route = ROUTES[pathname] || ROUTES["/"];

  return (
    <AppLayout>
      {pathname === "/app/settings/attachments" ? (
        <AttachmentsLibraryPage />
      ) : pathname === "/app/settings/family" ? (
        <FamilyMembersPage />
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
  if (pathname.startsWith("/public/wiki/")) {
    const token = decodeURIComponent(pathname.slice("/public/wiki/".length)).trim();
    return <WikiPublicPage token={token} />;
  }
  if (pathname === "/activate") return <AuthActionPage mode="activate" />;
  if (pathname === "/reset-password") return <AuthActionPage mode="reset" />;
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

export default App;
