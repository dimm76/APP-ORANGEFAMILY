import { createContext, useContext } from "react";

export const AuthContext = createContext(null);
export function isExternalGuestOnly(user) { return !(Array.isArray(user?.families) && user.families.length > 0) && user?.external_access?.has_album_grants === true; }
export function safeInternalReturnTo(value) { if (typeof value !== "string") return null; const decoded=value.trim(); if (!decoded.startsWith("/")||decoded.startsWith("//")||decoded.includes("\\")) return null; return ["/public/orangephotos/","/guest-invitations/","/guest/orangephotos/","/guest"].some((p)=>decoded===p||decoded.startsWith(p))?decoded:null; }

export function hasFamilyModuleAccess(user, moduleKey) {
  const family = Array.isArray(user?.families) ? user.families[0] : null;
  if (family?.role === "owner") return true;
  return family?.module_access?.[moduleKey] === true;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthGate");
  }
  return ctx;
}
