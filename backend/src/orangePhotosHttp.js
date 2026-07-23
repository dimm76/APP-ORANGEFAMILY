/* global require, module, Buffer */
const service = require("./orangePhotosService");
const multipartService = require("./orangePhotosMultipartService");

function send(res, result, status = 200) { if (!result.ok) return res.status(result.status || 400).json({ ok:false,code:result.code||"INTERNAL_ERROR",message:result.reason||"Petición no válida.",details:result.details??null }); return res.status(status).json({ ok:true,...result.payload }); }
function requestError(code,message,status=400){return Object.assign(new Error(message),{orangePhotosCode:code,status});}

async function multipart(req, maxBytes) {
  const type = String(req.headers["content-type"] || "");
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if (!match) throw requestError("INVALID_MULTIPART","Content-Type multipart no válido.");
  const boundary = Buffer.from(`--${match[1] || match[2]}`), chunks = [];
  let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > maxBytes + 2 * 1024 * 1024 + 128 * 1024) throw requestError("FILE_TOO_LARGE","Los vídeos de más de 500 MB deben utilizar la subida para archivos grandes.",413); chunks.push(chunk); }
  const body = Buffer.concat(chunks), fields = {};
  let file = null, poster = null, start = 0;
  while (start < body.length) {
    const at = body.indexOf(boundary, start); if (at < 0) break; start = at + boundary.length;
    const next = body.indexOf(boundary, start); if (next < 0) break;
    const part = body.slice(start, next), split = part.indexOf("\r\n\r\n"); if (split < 0) continue;
    const headers = part.slice(0, split).toString("utf8");
    const disposition = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headers);
    const name = disposition && /name="([^"]+)"/i.exec(disposition[1]);
    const filename = disposition && /filename="([^"]*)"/i.exec(disposition[1]);
    if (!name) continue;
    const fieldName = name[1]; let content = part.slice(split + 4);
    if (content.subarray(-2).equals(Buffer.from("\r\n"))) content = content.slice(0, -2);
    if (filename) {
      if (fieldName !== "file" && fieldName !== "poster") throw requestError("INVALID_MULTIPART","Campo de archivo no permitido.");
      const mime = /content-type:\s*([^\r\n]+)/i.exec(headers);
      const parsed = { buffer: content, filename: filename[1] || "archivo", mimeType: mime ? mime[1].trim().toLowerCase() : "application/octet-stream" };
      if (fieldName === "poster") poster = parsed; else file = parsed;
    } else fields[fieldName] = content.toString("utf8");
  }
  if (poster && (poster.mimeType !== "image/jpeg" || poster.buffer.length > 2 * 1024 * 1024)) throw requestError("INVALID_POSTER","El póster debe ser JPEG y no superar 2 MB.");
  return { file, poster, fields };
}

function safe(handler, message, status = 200) { return async (req, res) => { try { return send(res, await handler(req), status); } catch (error) { console.error("OrangePhotos",{message:error.message}); return res.status(500).json({ok:false,code:"INTERNAL_ERROR",message,details:null}); } }; }
function attachmentName(value) { return String(value || "orange-photo").replace(/[\r\n"\\/]/g, "_").slice(0, 500); }
function handleOrangePhotosRoutes(app) {
  app.get("/api/orange-photo-members", safe(req => service.familyMembers(req), "No se pudieron cargar los miembros."));
  app.get("/api/orange-photos", safe(req => service.list(req), "No se pudo cargar la biblioteca."));
  app.get("/api/orange-photos/timeline", safe(req => service.timeline(req), "No se pudo cargar la navegación temporal."));
  app.get("/api/orange-photos/around-date", safe(req => service.aroundDate(req), "No se pudo cargar el periodo solicitado."));
  app.delete("/api/orange-photos/trash", safe(req => service.emptyTrash(req), "No se pudo vaciar la papelera."));
  app.post("/api/orange-photos/uploads/check", safe(req => service.checkUpload(req, req.body || {}), "No se pudo comprobar el archivo."));
  app.post("/api/orange-photos/uploads/multipart", safe(req => multipartService.initiate(req, req.body || {}), "No se pudo iniciar la subida.", 201));
  app.post("/api/orange-photos/uploads/:id/parts", safe(req => multipartService.signParts(req, req.params.id, req.body || {}), "No se pudieron preparar las partes."));
  app.post("/api/orange-photos/uploads/:id/complete", safe(req => multipartService.complete(req, req.params.id, req.body || {}), "No se pudo completar la subida."));
  app.delete("/api/orange-photos/uploads/:id", safe(req => multipartService.abort(req, req.params.id), "No se pudo cancelar la subida."));
  app.get("/api/orange-photos/uploads/:id", safe(req => multipartService.status(req, req.params.id), "No se pudo consultar la subida."));
  app.get("/api/orange-photos/:id", safe(req => service.detail(req, req.params.id, { allowTrash: true }), "No se pudo cargar la foto."));
  app.post("/api/orange-photos", async (req, res) => { try { if (String(req.headers["content-type"] || "").startsWith("multipart/form-data")) { const parsed = await multipart(req, service.SIMPLE_VIDEO_MAX_BYTES); return send(res, await service.upload(req, parsed.file, parsed.fields, parsed.poster), 201); } return send(res, await service.createFromExisting(req, req.body || {}), 201); } catch (error) { console.error("OrangePhotos upload",{message:error.message}); return res.status(error.status||400).json({ok:false,code:error.orangePhotosCode||"INVALID_MULTIPART",message:error.orangePhotosCode?error.message:"Subida no válida.",details:null}); } });
  app.patch("/api/orange-photos/:id", safe(req => service.update(req, req.params.id, req.body || {}), "No se pudo actualizar la foto."));
  app.delete("/api/orange-photos/:id", safe(req => service.purge(req, req.params.id), "No se pudo eliminar definitivamente la foto."));
  app.post("/api/orange-photos/:id/trash", safe(req => service.trash(req, req.params.id), "No se pudo mover a la papelera."));
  app.post("/api/orange-photos/:id/restore", safe(req => service.trash(req, req.params.id, true), "No se pudo restaurar la foto."));
  app.get("/api/orange-photos/:id/url", safe(req => service.signedUrl(req, req.params.id), "No se pudo firmar la URL."));
  app.get("/api/orange-photos/:id/original-url", safe(req => service.signedUrl(req, req.params.id, true), "No se pudo firmar la URL original."));
  app.get("/api/orange-photos/:id/download", async (req, res) => { try { const result = await service.download(req, req.params.id); if (!result.ok) return send(res, result); const { download, filename } = result.payload; res.setHeader("Content-Type", download.ContentType); if (download.ContentLength != null) res.setHeader("Content-Length", String(download.ContentLength)); res.setHeader("Content-Disposition", `attachment; filename="${attachmentName(filename)}"; filename*=UTF-8''${encodeURIComponent(attachmentName(filename))}`); download.Body.on?.("error", error => { console.error("OrangePhotos download", error); if (!res.headersSent) res.status(502).end(); else res.destroy(error); }); return download.Body.pipe(res); } catch (error) { console.error("OrangePhotos download", error); return res.status(502).json({ ok: false, message: "No se pudo descargar el archivo." }); } });
  app.post("/api/orange-photos/:id/share", safe(req => service.share(req, req.params.id, req.body || {}), "No se pudo compartir la foto."));
  app.get("/api/orange-photo-albums", safe(req => service.albums(req), "No se pudieron cargar los álbumes."));
  app.post("/api/orange-photo-albums", safe(req => service.createAlbum(req, req.body || {}), "No se pudo crear el álbum.", 201));
  app.patch("/api/orange-photo-albums/:id", safe(req => service.updateAlbum(req, req.params.id, req.body || {}), "No se pudo actualizar el álbum."));
  app.post("/api/orange-photo-albums/:id/photos", safe(req => service.addPhoto(req, req.params.id, req.body || {}), "No se pudo añadir la foto."));
  app.delete("/api/orange-photo-albums/:id/photos/:photoId", safe(req => service.addPhoto(req, req.params.id, { photo_id: req.params.photoId }, true), "No se pudo quitar la foto."));
  app.post("/api/orange-photo-albums/:id/share", safe(req => service.shareAlbum(req, req.params.id, req.body || {}), "No se pudo compartir el álbum."));
  app.get("/api/orange-photo-tags", safe(req => service.tags(req), "No se pudieron cargar las etiquetas."));
  app.post("/api/orange-photo-tags", safe(req => service.createTag(req, req.body || {}), "No se pudo crear la etiqueta.", 201));
}
module.exports = { handleOrangePhotosRoutes };
