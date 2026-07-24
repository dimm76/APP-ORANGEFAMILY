const service = require("./familyMembersService");

function send(res, result, successStatus = 200) {
  if (!result.ok) return res.status(result.status || 500).json({ ok: false, message: result.reason || "No se pudo completar la operación." });
  return res.status(result.status || successStatus).json({ ok: true, ...result.payload });
}
function safe(handler, successStatus) { return async (req, res) => { try { return send(res, await handler(req), successStatus); } catch (error) { console.error("Family members request failed:", error.message); return res.status(500).json({ ok: false, message: "No se pudo completar la operación." }); } }; }

function handleFamilyMembersRoutes(app) {
  app.get("/api/settings/family-members", safe((req) => service.list(req)));
  app.post("/api/settings/family-members", safe((req) => service.create(req, req.body), 201));
  app.patch("/api/settings/family-members/:personId", safe((req) => service.update(req, req.params.personId, req.body)));
  app.post("/api/settings/family-members/:personId/resend-invitation", safe((req) => service.resendInvitation(req, req.params.personId)));
  app.post("/api/settings/family-members/:personId/send-password-reset", safe((req) => service.sendPasswordReset(req, req.params.personId)));
}

module.exports = { handleFamilyMembersRoutes };
