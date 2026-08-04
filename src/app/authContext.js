import { createContext, useContext } from "react";

export const AuthContext = createContext(null);
export function safeInternalReturnTo(value) { if (typeof value !== "string") return null; const decoded=value.trim(); if (!decoded.startsWith("/")||decoded.startsWith("//")||decoded.includes("\\")) return null; const allowedPrefixes=["/public/orangephotos/","/app/orangephotos"]; return allowedPrefixes.some(prefix=>decoded===prefix||decoded.startsWith(prefix))?decoded:null; }

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
