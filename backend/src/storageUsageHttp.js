const service = require("./storageUsageService");

function send(res, result) {
  if (!result.ok) {
    return res.status(result.status || 500).json({
      ok: false,
      message:
        result.reason || "No se pudo obtener el uso de almacenamiento.",
    });
  }

  return res.status(200).json({
    ok: true,
    ...result.payload,
  });
}

function safe(handler) {
  return async (req, res) => {
    try {
      return send(res, await handler(req));
    } catch (error) {
      console.error("Storage usage request failed", {
        method: req.method,
        url: req.originalUrl,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      return res.status(500).json({
        ok: false,
        message: "No se pudo obtener el uso de almacenamiento.",
      });
    }
  };
}

function handleStorageUsageRoutes(app) {
  app.get(
    "/api/settings/storage-usage",
    safe((req) => service.getStorageUsage(req))
  );
}

module.exports = {
  handleStorageUsageRoutes,
};
