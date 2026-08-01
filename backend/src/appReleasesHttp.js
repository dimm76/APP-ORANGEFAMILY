const service = require("./appReleasesService");

function send(res, result) {
  if (!result.ok) {
    return res.status(result.status || 500).json({
      ok: false,
      message:
        result.reason ||
        "No se pudo completar la operación con la aplicación.",
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
      console.error("Application release request failed", {
        method: req.method,
        url: req.originalUrl,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      return res.status(500).json({
        ok: false,
        message:
          "No se pudo completar la operación con la aplicación.",
      });
    }
  };
}

function handleAppReleaseRoutes(app) {
  app.get(
    "/api/app-releases/android/latest",
    safe((req) => service.getLatestAndroidRelease(req))
  );

  app.put(
    "/api/settings/app-releases/android/latest",
    safe((req) =>
      service.updateLatestAndroidRelease(req, req.body)
    )
  );
}

module.exports = {
  handleAppReleaseRoutes,
};
