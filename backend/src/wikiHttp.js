const wiki = require("./wikiService");

function send(res, result, successStatus = 200) {
  if (!result.ok) return res.status(result.status || 500).json({ ok: false, message: result.reason || "Error de Wiki." });
  return res.status(successStatus).json(result.payload);
}
function wrap(handler, successStatus) {
  return async (req, res) => { try { return send(res, await handler(req, res), successStatus); } catch (error) { console.error("Wiki request failed:", error.message); return res.status(500).json({ ok: false, message: "No se pudo completar la operación Wiki." }); } };
}
function handleWikiRoutes(app) {
  app.get("/api/public/wiki/:token", wrap((req) => wiki.fetchPublicWikiByTokenFromDb(req.params.token)));
  app.get("/api/wiki/outline", wrap((req) => wiki.fetchWikiOutlineFromDb(req, req.query)));
  app.get("/api/wiki", wrap((req) => wiki.fetchWikiListFromDb(req, req.query)));
  app.post("/api/wiki", wrap((req) => wiki.createWikiPageInDb(req, req.body), 201));
  app.get("/api/wiki/:id", wrap((req) => wiki.fetchWikiByIdFromDb(req, req.params.id)));
  app.patch("/api/wiki/:id", wrap((req) => wiki.updateWikiPageInDb(req, req.params.id, req.body)));
  app.delete("/api/wiki/:id", wrap((req) => wiki.deleteWikiPageInDb(req, req.params.id)));
  app.post("/api/wiki/:id/duplicate", wrap((req) => wiki.duplicateWikiPageInDb(req, req.params.id), 201));
  app.patch("/api/wiki/:id/move", wrap((req) => wiki.moveWikiPageInDb(req, req.params.id, req.body)));
  app.post("/api/wiki/:id/copy-root-content", wrap((req) => wiki.copyRootContentToChildInDb(req, req.params.id), 201));
  app.post("/api/wiki/:id/public-link", wrap((req) => wiki.publishWikiPublicLinkInDb(req, req.params.id, req.body)));
  app.delete("/api/wiki/:id/public-link", wrap((req) => wiki.revokeWikiPublicLinkInDb(req, req.params.id)));
}
module.exports = { handleWikiRoutes };
