const { getAttachmentsConfig } = require("./attachmentsConfig");
const { parseMultipartImageUpload } = require("./parseMultipartImage");
const service = require("./attachmentsService");

function send(res, result, successStatus = 200) {
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.reason || "Petición no válida." });
  return res.status(successStatus).json({ ok: true, ...result.payload });
}

function handleAttachmentsRoutes(app) {
  app.post("/api/attachments/upload", async (req, res) => {
    try { const { file } = await parseMultipartImageUpload(req, getAttachmentsConfig().maxImageBytes); return send(res, await service.uploadImageAttachment(req, file), 201); }
    catch (error) { return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Carga no válida." }); }
  });
  app.get("/api/attachments", async (req, res) => { try { return send(res, await service.listAttachmentsFromDb(req)); } catch { return res.status(500).json({ ok: false, message: "No se pudo listar attachments." }); } });
  app.get("/api/attachments/images", async (req, res) => { try { return send(res, await service.listImageAttachmentsFromDb(req)); } catch { return res.status(500).json({ ok: false, message: "No se pudieron listar las imágenes." }); } });
  app.get("/api/attachments/:id/signed-url", async (req, res) => { try { return send(res, await service.getSignedAttachmentUrl(req, req.params.id)); } catch { return res.status(500).json({ ok: false, message: "No se pudo obtener la URL." }); } });
  app.post("/api/attachments/:id/link", async (req, res) => { try { return send(res, await service.linkAttachmentToEntity(req, req.params.id, req.body || {})); } catch { return res.status(500).json({ ok: false, message: "No se pudo registrar el vínculo." }); } });
  app.delete("/api/attachments/:id", async (req, res) => { try { return send(res, await service.deleteAttachmentIfUnused(req, req.params.id)); } catch { return res.status(500).json({ ok: false, message: "No se pudo borrar el attachment." }); } });
}

module.exports = { handleAttachmentsRoutes };
