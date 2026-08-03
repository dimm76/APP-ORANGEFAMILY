const {
  listAlbumRecipients,
  syncAlbumRecipients,
} = require("./orangePhotoAlbumAccessService");

function sendResult(res, result) {
  if (result.ok) {
    return res.status(200).json({ ok: true, ...result.payload });
  }

  return res.status(result.status || 400).json({
    ok: false,
    code: result.code,
    message: result.reason,
  });
}

function safe(handler) {
  return async (req, res) => {
    try {
      return sendResult(res, await handler(req));
    } catch (error) {
      console.error("Orange album access", { message: error.message });
      return res.status(500).json({
        ok: false,
        code: "INTERNAL_ERROR",
        message: "No se pudo completar la operación.",
      });
    }
  };
}

function handleOrangePhotoAlbumAccessRoutes(app) {
  app.get(
    "/api/orange-photo-albums/:albumId/recipients",
    safe((req) => listAlbumRecipients(req, req.params.albumId)),
  );
  app.put(
    "/api/orange-photo-albums/:albumId/recipients",
    safe((req) => syncAlbumRecipients(req, req.params.albumId, req.body || {})),
  );
}

module.exports = { handleOrangePhotoAlbumAccessRoutes };
