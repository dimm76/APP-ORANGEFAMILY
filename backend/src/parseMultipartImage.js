/** Parser multipart mínimo para un único archivo. */
async function parseMultipartImageUpload(req, maxBytes) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) throw new Error("Content-Type multipart no válido.");

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > maxBytes + 64 * 1024) throw new Error("La imagen supera el tamaño máximo permitido.");
    chunks.push(value);
  }

  const body = Buffer.concat(chunks);
  const delimiter = Buffer.from(`--${boundary}`);
  let start = 0;
  let file = null;
  while (start < body.length) {
    const index = body.indexOf(delimiter, start);
    if (index === -1) break;
    start = index + delimiter.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;
    const next = body.indexOf(delimiter, start);
    if (next === -1) break;
    const part = body.slice(start, next);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString("utf8");
    const disposition = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headers);
    const filename = disposition && /filename="([^"]*)"/i.exec(disposition[1]);
    if (!filename) continue;
    const name = /name="([^"]+)"/i.exec(disposition[1]);
    if (file && name?.[1] !== "file" && name?.[1] !== "image") continue;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers);
    let content = part.slice(headerEnd + 4);
    if (content.subarray(-2).equals(Buffer.from("\r\n"))) content = content.slice(0, -2);
    file = {
      buffer: content,
      mimeType: type ? type[1].trim().toLowerCase() : "application/octet-stream",
      filename: filename[1] || "upload",
    };
  }
  return { file };
}

module.exports = { parseMultipartImageUpload };
