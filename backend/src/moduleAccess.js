const FAMILY_MODULES = Object.freeze([
  "orange_photos",
  "wiki",
  "notes",
  "documents",
  "finances",
]);

function normalizeModuleAccess(value, role) {
  if (role === "owner") {
    return Object.fromEntries(FAMILY_MODULES.map((key) => [key, true]));
  }

  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return Object.fromEntries(
    FAMILY_MODULES.map((key) => [key, source[key] === true])
  );
}

function requireFamilyModule(moduleKey) {
  if (!FAMILY_MODULES.includes(moduleKey)) {
    throw new Error(`Unknown family module: ${moduleKey}`);
  }

  return function familyModuleMiddleware(req, res, next) {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        message: "No autenticado.",
      });
    }

    const family = Array.isArray(req.user.families)
      ? req.user.families[0]
      : null;

    if (!family?.id) {
      return res.status(403).json({
        ok: false,
        message: "El usuario no pertenece a una familia activa.",
      });
    }

    const access = normalizeModuleAccess(
      family.module_access,
      family.role
    );

    if (!access[moduleKey]) {
      return res.status(403).json({
        ok: false,
        code: "MODULE_ACCESS_DENIED",
        message: "No tienes acceso a este módulo.",
      });
    }

    return next();
  };
}

module.exports = {
  FAMILY_MODULES,
  normalizeModuleAccess,
  requireFamilyModule,
};
