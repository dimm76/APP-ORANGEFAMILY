/* global require, process, console, Buffer, __dirname */
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../db");
const exifr = require("exifr");
const { getAttachmentsConfig } = require("../src/attachmentsConfig");
const { listOrangePhotosObjects, headOrangePhotoObject, getOrangePhotoObjectBuffer } = require("../src/wasabiClient");

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const SUPPORTED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const MIME_BY_EXTENSION = Object.freeze({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" });
const REPORT_PATH = path.resolve(__dirname, "../tmp/orange-photos-import-report.json");
const CLEANUP_PATH = path.resolve(__dirname, "../tmp/orange-photos-wordpress-cleanup-candidates.json");
const POSTGRES_TIMEOUT_MS = 15000;
let poolClosePromise = null;
let interrupted = false;

function closePool() {
  if (!poolClosePromise) poolClosePromise = pool.end().catch(() => {});
  return poolClosePromise;
}

async function pgQuery(text, values = []) {
  try {
    return await pool.query({ text, values, query_timeout: POSTGRES_TIMEOUT_MS });
  } catch (error) {
    if (/timeout|terminating connection/i.test(String(error?.message || ""))) {
      throw new Error(`Timeout en consulta PostgreSQL: ${error.message}`);
    }
    throw error;
  }
}

process.on("SIGINT", async () => {
  if (interrupted) return;
  interrupted = true;
  console.error("Importación interrumpida por el usuario");
  await closePool();
  process.exit(130);
});

function normalizeExtension(key) { const match = /\.([^.\/]+)$/.exec(String(key || "")); return match ? match[1].toLowerCase() : ""; }
function mimeTypeFromExtension(extension) { return MIME_BY_EXTENSION[String(extension || "").toLowerCase()] || null; }
function mediaTypeFromExtension(extension) { const value = String(extension || "").toLowerCase(); return IMAGE_EXTENSIONS.has(value) ? "image" : VIDEO_EXTENSIONS.has(value) ? "video" : null; }
function splitKey(key) { const normalized = String(key || "").replace(/^\/+/, ""), slash = normalized.lastIndexOf("/"); return { directory: slash >= 0 ? normalized.slice(0, slash) : "", filename: slash >= 0 ? normalized.slice(slash + 1) : normalized }; }
function withoutExtension(filename) { return filename.slice(0, filename.length - (normalizeExtension(filename).length + 1)); }
function parseWordPressVariant(key) { const { directory, filename } = splitKey(key), extension = normalizeExtension(filename), stem = withoutExtension(filename), match = /-(\d{2,5})x(\d{2,5})$/i.exec(stem); if (!match) return null; const originalStem = stem.slice(0, match.index); return { width: Number(match[1]), height: Number(match[2]), original_candidate_key: `${directory}/${originalStem}.${extension}`, base_identity: originalStem.toLowerCase() }; }
function parseLegacyFilenameDate(filename) { const stem = withoutExtension(splitKey(filename).filename); const match = /(?:^|[^0-9])(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:_|$)/.exec(stem) || /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/.exec(stem); if (!match) return null; const parts = match.slice(1).map(Number), date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])); return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2] && date.getUTCHours() === parts[3] && date.getUTCMinutes() === parts[4] && date.getUTCSeconds() === parts[5] ? date.toISOString() : null; }
function classifyObjectKey(key) {
  const value = String(key || ""), { directory, filename } = splitKey(value), extension = normalizeExtension(filename), stem = extension ? withoutExtension(filename) : filename, lowerFilename = filename.toLowerCase(), segments = directory.toLowerCase().split("/");
  let role = "original", originalCandidateKey = null, baseIdentity = stem.toLowerCase(), width = null, height = null;
  if (!value || value.endsWith("/") || !filename || filename.startsWith(".") || lowerFilename === ".ds_store" || lowerFilename === "thumbs.db" || ["tmp", "part"].includes(extension)) role = "ignored";
  else if (!SUPPORTED_EXTENSIONS.has(extension)) role = "unsupported";
  else { const wordpress = parseWordPressVariant(value); if (wordpress) { role = "wordpress_variant"; width = wordpress.width; height = wordpress.height; originalCandidateKey = wordpress.original_candidate_key; baseIdentity = wordpress.base_identity; } else if (segments.includes("thumbnails") || segments.includes("thumbs")) role = "thumbnail"; else if (segments.includes("previews")) role = "preview"; else if (segments.includes("posters") || /__(?:thumb|poster)\.jpe?g$/i.test(filename)) { role = "poster"; baseIdentity = stem.replace(/__(?:thumb|poster)$/i, "").toLowerCase(); } }
  return { key: value, role, extension, media_type: mediaTypeFromExtension(extension), basename: filename, directory, base_identity: baseIdentity, width_from_filename: width, height_from_filename: height, original_candidate_key: originalCandidateKey };
}
function imageDimensions(buffer, mime) { try { if (mime === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }; if (mime === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 12, 16) === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }; if (mime === "image/jpeg") { let offset = 2; while (offset + 9 < buffer.length) { if (buffer[offset] !== 255) { offset += 1; continue; } const marker = buffer[offset + 1], length = buffer.readUInt16BE(offset + 2); if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }; if (length < 2) break; offset += 2 + length; } } } catch { /* optional dimensions */ } return { width: null, height: null }; }
function safeNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function safeText(value, max = 200) { return value == null ? null : String(value).trim().slice(0, max) || null; }
function parsePositiveInteger(raw, name, fallback = null) { if (raw == null || String(raw).trim() === "") return fallback; const number = Number(raw); if (!Number.isInteger(number) || number < 1) throw new Error(`${name} debe ser un entero positivo.`); return number; }
function validatePrefix(prefix) { if (!prefix.startsWith("family_photos/") || prefix === "family_photos" || prefix.includes("..") || prefix.includes("\\")) throw new Error("ORANGE_PHOTOS_IMPORT_PREFIX no válido."); return prefix; }
function derivativeDirectory(classified) { const parts = classified.directory.split("/"); if (["thumbnails", "thumbs", "previews", "posters"].includes((parts.at(-1) || "").toLowerCase())) parts.pop(); return parts.join("/"); }
function candidateIdentity(directory, basename) { return `${directory}\u0000${basename.toLowerCase()}`; }
function sanitizeExif(raw) { const selected = {}; for (const key of ["DateTimeOriginal", "CreateDate", "ModifyDate", "Orientation", "Make", "Model", "LensModel", "GPSLatitude", "GPSLongitude", "GPSAltitude", "latitude", "longitude", "ImageWidth", "ImageHeight", "ExifImageWidth", "ExifImageHeight"]) { const value = raw?.[key]; if (value == null || Buffer.isBuffer(value) || ArrayBuffer.isView(value)) continue; selected[key] = value instanceof Date ? value.toISOString() : typeof value === "string" ? value.slice(0, 1000) : value; } return selected; }

async function limitedMap(items, concurrency, worker) { const results = new Array(items.length); let cursor = 0; async function consume() { while (true) { const index = cursor++; if (index >= items.length) return; try { results[index] = await worker(items[index], index); } catch (error) { results[index] = { item: items[index], error }; } } } await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, consume)); return results; }
async function resolveOwner(email) { const result = await pgQuery(`SELECT au.id AS owner_user_id, au.person_id, fm.family_id FROM public.auth_users au JOIN public.family_memberships fm ON fm.person_id=au.person_id AND fm.status='active' WHERE lower(btrim(au.email))=lower($1) AND au.status='active'`, [email]); if (result.rows.length !== 1) throw new Error("El email debe resolver exactamente un usuario y una familia activos."); return result.rows[0]; }
async function existingObjects(bucket) { const result = await pgQuery(`SELECT provider,bucket,object_key,photo_id,variant FROM public.orange_photo_files WHERE provider='wasabi' AND bucket=$1 AND object_key LIKE 'family_photos/%'`, [bucket]); return new Map(result.rows.map(row => [`${row.provider}|${row.bucket}|${row.object_key}`, row])); }
async function listInventory(prefix) { const objects = []; let token = null, pageNumber = 0; do { pageNumber += 1; console.log(`Listando Wasabi, página ${pageNumber}...`); const page = await listOrangePhotosObjects({ prefix, continuationToken: token, maxKeys: 1000 }); console.log(`Página ${pageNumber} recibida: ${page.objects.length} objetos.`); objects.push(...page.objects); token = page.is_truncated ? page.next_token : null; if (page.is_truncated && !token) throw new Error("Wasabi indicó más páginas sin continuation token."); } while (token); console.log(`Inventario completado: ${objects.length} objetos.`); return objects; }

function groupInventory(objects) {
  const classified = objects.map(object => ({ ...object, classification: classifyObjectKey(object.key) })), byKey = new Map(classified.map(item => [item.key, item])), originals = classified.filter(item => item.classification.role === "original" && item.size > 0), groups = new Map(), originalsByIdentity = new Map();
  for (const original of originals) { const c = original.classification, stem = withoutExtension(c.basename).toLowerCase(), identity = candidateIdentity(c.directory, stem); if (!originalsByIdentity.has(identity)) originalsByIdentity.set(identity, []); originalsByIdentity.get(identity).push(original); groups.set(original.key, { original, wordpress_variants: [], thumbnails: [], previews: [], posters: [], orphan_variants: [], ambiguous_derivatives: [] }); }
  const orphanVariants = [], ambiguous = [];
  for (const item of classified) { const c = item.classification; if (c.role === "wordpress_variant") { const exact = byKey.get(c.original_candidate_key); if (exact?.classification.role === "original") groups.get(exact.key).wordpress_variants.push(item); else { item.final_role = "orphan_variant"; orphanVariants.push(item); } continue; } if (!["thumbnail", "preview", "poster"].includes(c.role)) continue; const candidates = originalsByIdentity.get(candidateIdentity(derivativeDirectory(c), c.base_identity)) || [], compatible = c.role === "poster" ? candidates.filter(candidate => candidate.classification.media_type === "video") : candidates.filter(candidate => candidate.classification.media_type === "image"); if (compatible.length === 1) groups.get(compatible[0].key)[`${c.role}s`].push(item); else { item.final_role = compatible.length ? "ambiguous_derivative" : "orphan_derivative"; if (compatible.length) ambiguous.push(item); } }
  return { classified, groups: [...groups.values()], orphanVariants, ambiguous };
}
function chooseThumbnail(group, width, height) { if (!width || !height) return null; const ratio = width / height, suitable = group.wordpress_variants.filter(item => { const w = item.classification.width_from_filename, h = item.classification.height_from_filename; return w && h && Math.abs(w / h - ratio) / ratio <= 0.1 && !(w === h && Math.abs(ratio - 1) > 0.1); }); const preferred = suitable.filter(item => item.classification.width_from_filename >= 300 && item.classification.width_from_filename <= 600).sort((a, b) => b.classification.width_from_filename * b.classification.height_from_filename - a.classification.width_from_filename * a.classification.height_from_filename); if (preferred.length) return preferred[0]; return suitable.filter(item => item.classification.width_from_filename >= 200 && item.classification.width_from_filename <= 800).sort((a, b) => b.classification.width_from_filename * b.classification.height_from_filename - a.classification.width_from_filename * a.classification.height_from_filename)[0] || null; }
function choosePoster(group) { return group.posters.length === 1 ? group.posters[0] : null; }

async function readOriginal(group) {
  const original = group.original, c = original.classification, inferredMime = mimeTypeFromExtension(c.extension), head = await headOrangePhotoObject(original.key), validHeadMime = head.content_type && head.content_type !== "application/octet-stream" && head.content_type.split("/")[0] === c.media_type ? head.content_type : null, mimeType = validHeadMime || inferredMime, filenameDate = parseLegacyFilenameDate(c.basename), metadata = { captured_at: filenameDate || head.last_modified || original.last_modified, captured_at_source: filenameDate ? "filename" : "file_mtime", width: null, height: null, orientation: null, camera_make: null, camera_model: null, lens_model: null, latitude: null, longitude: null, altitude_meters: null, exif_json: {} }, warnings = [];
  if (!mimeType) throw new Error("No se pudo determinar un MIME permitido.");
  if (c.media_type === "image") { const buffer = await getOrangePhotoObjectBuffer(original.key); const dimensions = imageDimensions(buffer, mimeType); let raw = null; try { raw = await exifr.parse(buffer, { tiff: true, exif: true, gps: true, ifd0: true, ifd1: false, icc: false, iptc: false, jfif: false, xmp: false, translateValues: false, reviveValues: true, sanitize: true }); } catch { warnings.push("exif_unreadable"); } const captured = raw?.DateTimeOriginal || raw?.CreateDate; if (captured instanceof Date && !Number.isNaN(captured.getTime())) { metadata.captured_at = captured.toISOString(); metadata.captured_at_source = "exif"; } metadata.orientation = safeNumber(raw?.Orientation); metadata.camera_make = safeText(raw?.Make); metadata.camera_model = safeText(raw?.Model); metadata.lens_model = safeText(raw?.LensModel); metadata.latitude = safeNumber(raw?.latitude ?? raw?.GPSLatitude); metadata.longitude = safeNumber(raw?.longitude ?? raw?.GPSLongitude); metadata.altitude_meters = safeNumber(raw?.GPSAltitude); let width = safeNumber(raw?.ExifImageWidth ?? raw?.ImageWidth) || dimensions.width, height = safeNumber(raw?.ExifImageHeight ?? raw?.ImageHeight) || dimensions.height; if (width && height && [5, 6, 7, 8].includes(metadata.orientation)) [width, height] = [height, width]; metadata.width = width; metadata.height = height; metadata.exif_json = sanitizeExif(raw); if (Buffer.byteLength(JSON.stringify(metadata.exif_json)) > 64 * 1024) { metadata.exif_json = sanitizeExif(raw); warnings.push("exif_json_reduced"); } }
  return { head, mimeType, metadata, warnings };
}

async function insertOriginal(context) {
  const { owner, bucket, group, prepared, thumbnail, poster } = context, client = await pool.connect();
  try { await client.query("BEGIN"); const m = prepared.metadata, c = group.original.classification; const photo = await client.query(`INSERT INTO public.orange_photos(family_id,owner_user_id,media_type,title,description,original_filename,mime_type,extension,captured_at,captured_at_source,timezone,width,height,duration_seconds,orientation,camera_make,camera_model,lens_model,latitude,longitude,altitude_meters,location_name,location_country,location_region,location_locality,location_source,exif_json,visibility,is_favorite,is_trashed,legacy_wp_attachment_id,legacy_source,legacy_imported_at,created_by,updated_by) VALUES($1,$2,$3,NULL,NULL,$4,$5,$6,$7,$8,NULL,$9,$10,NULL,$11,$12,$13,$14,$15,$16,$17,NULL,NULL,NULL,NULL,$18,$19,'private',false,false,NULL,'wasabi_family_photos',now(),$2,$2) RETURNING id`, [owner.family_id, owner.owner_user_id, c.media_type, c.basename, prepared.mimeType, c.extension, m.captured_at, m.captured_at_source, m.width, m.height, m.orientation, m.camera_make, m.camera_model, m.lens_model, m.latitude, m.longitude, m.altitude_meters, m.latitude != null && m.longitude != null ? "exif" : null, m.exif_json]); const photoId = photo.rows[0].id; const addFile = async (item, variant, mime, width, height) => { const head = item === group.original ? prepared.head : await headOrangePhotoObject(item.key); await client.query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,$3,'wasabi',$4,$5,$6,$7,$8,$9,NULL,$10)`, [owner.family_id, photoId, variant, bucket, item.key, mime, width, height, head.content_length || item.size, head.etag || item.etag]); }; await addFile(group.original, "original", prepared.mimeType, m.width, m.height); if (thumbnail) await addFile(thumbnail, "thumbnail", mimeTypeFromExtension(thumbnail.classification.extension), thumbnail.classification.width_from_filename, thumbnail.classification.height_from_filename); if (poster) await addFile(poster, "poster", mimeTypeFromExtension(poster.classification.extension), null, null); await client.query("COMMIT"); return photoId; } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }
}

async function main() {
  const startedAt = new Date().toISOString(), ownerEmail = String(process.env.ORANGE_PHOTOS_IMPORT_OWNER_EMAIL || "").trim().toLowerCase(), prefix = validatePrefix(String(process.env.ORANGE_PHOTOS_IMPORT_PREFIX || "family_photos/")), dryRun = String(process.env.ORANGE_PHOTOS_IMPORT_DRY_RUN || "true") !== "false", limit = parsePositiveInteger(process.env.ORANGE_PHOTOS_IMPORT_LIMIT, "ORANGE_PHOTOS_IMPORT_LIMIT"), concurrency = parsePositiveInteger(process.env.ORANGE_PHOTOS_IMPORT_CONCURRENCY, "ORANGE_PHOTOS_IMPORT_CONCURRENCY", 2);
  if (!ownerEmail || !ownerEmail.includes("@")) throw new Error("ORANGE_PHOTOS_IMPORT_OWNER_EMAIL es obligatorio."); if (concurrency > 4) throw new Error("ORANGE_PHOTOS_IMPORT_CONCURRENCY no puede superar 4.");
  const config = getAttachmentsConfig(); if (!config.configured) throw new Error(`Wasabi no configurado. Faltan: ${config.missing.join(", ")}`); if (config.bucket !== "orangedesk") throw new Error("El bucket configurado debe ser orangedesk.");
  console.log(dryRun ? "MODO DRY-RUN\nNo se modificará PostgreSQL.\nNo se modificará Wasabi." : "MODO ESCRITURA\nSe crearán registros en PostgreSQL.\nNo se modificará Wasabi.");
  console.log("Resolviendo usuario propietario...");
  const owner = await resolveOwner(ownerEmail);
  console.log("Usuario y familia resueltos.");
  console.log("Consultando objetos ya registrados...");
  const existing = await existingObjects(config.bucket);
  console.log(`Objetos registrados cargados: ${existing.size}.`);
  const objects = await listInventory(prefix);
  console.log("Clasificando objetos...");
  const inventory = groupInventory(objects);
  const wordpressCount = inventory.classified.filter(item => item.classification.role === "wordpress_variant").length;
  const videoCount = inventory.groups.filter(group => group.original.classification.media_type === "video").length;
  console.log(`Clasificación completada:\n- originales ${inventory.groups.length};\n- variantes WordPress ${wordpressCount};\n- vídeos ${videoCount}.`);
  const unregisteredGroups = inventory.groups.filter(group => !existing.has(`wasabi|${config.bucket}|${group.original.key}`));
  const groups = limit ? unregisteredGroups.slice(0, limit) : inventory.groups;
  const pending = groups.filter(group => !existing.has(`wasabi|${config.bucket}|${group.original.key}`));
  const preparedResults = await limitedMap(pending, concurrency, async (group, index) => {
    console.log(`Analizando metadatos: ${index + 1}/${pending.length} — ${group.original.key}.`);
    return { group, prepared: await readOriginal(group) };
  });
  const preparedByKey = new Map(preparedResults.filter(result => !result.error).map(result => [result.group.original.key, result.prepared]));
  const preparationErrors = new Map(preparedResults.filter(result => result.error).map(result => [result.item.original.key, result.error]));
  const totals = { objects_scanned: objects.length, supported_objects: inventory.classified.filter(item => item.classification.media_type).length, originals_detected: inventory.groups.length, wordpress_variants_detected: inventory.classified.filter(item => item.classification.role === "wordpress_variant").length, thumbnails_detected: inventory.classified.filter(item => item.classification.role === "thumbnail").length, previews_detected: inventory.classified.filter(item => item.classification.role === "preview").length, posters_detected: inventory.classified.filter(item => item.classification.role === "poster").length, orphan_variants: inventory.orphanVariants.length, ambiguous_derivatives: inventory.ambiguous.length, would_import: 0, imported: 0, already_registered: 0, ignored: inventory.classified.filter(item => ["ignored", "unsupported"].includes(item.classification.role)).length, failed: 0, thumbnails_selected: 0, posters_selected: 0 }, items = [], selections = new Map();
  for (const group of groups) { const original = group.original, duplicate = existing.get(`wasabi|${config.bucket}|${original.key}`), prepared = preparedByKey.get(original.key), failure = preparationErrors.get(original.key); if (duplicate) { totals.already_registered += 1; items.push({ object_key: original.key, result: "already_registered", media_type: original.classification.media_type, mime_type: mimeTypeFromExtension(original.classification.extension), size_bytes: original.size, captured_at: null, captured_at_source: null, width: null, height: null, orientation: null, thumbnail_selected: null, poster_selected: null, wordpress_variants: group.wordpress_variants.map(item => item.key), warnings: [], error: null, photo_id: duplicate.photo_id }); continue; } if (failure || !prepared) { totals.failed += 1; items.push({ object_key: original.key, result: "failed", media_type: original.classification.media_type, mime_type: mimeTypeFromExtension(original.classification.extension), size_bytes: original.size, captured_at: null, captured_at_source: null, width: null, height: null, orientation: null, thumbnail_selected: null, poster_selected: null, wordpress_variants: group.wordpress_variants.map(item => item.key), warnings: [], error: (failure || new Error("Metadata no disponible.")).message, photo_id: null }); continue; } const thumbnail = original.classification.media_type === "image" ? chooseThumbnail(group, prepared.metadata.width, prepared.metadata.height) : null, poster = original.classification.media_type === "video" ? choosePoster(group) : null, warnings = [...prepared.warnings]; if (original.classification.media_type === "image" && !thumbnail) warnings.push("no_suitable_thumbnail"); if (original.classification.media_type === "video" && group.posters.length > 1) warnings.push("ambiguous_poster"); if (thumbnail) totals.thumbnails_selected += 1; if (poster) totals.posters_selected += 1; let result = "would_import", photoId = null, error = null; if (dryRun) totals.would_import += 1; else { try { photoId = await insertOriginal({ owner, bucket: config.bucket, group, prepared, thumbnail, poster }); result = "imported"; totals.imported += 1; } catch (insertError) { result = "failed"; error = insertError.message; totals.failed += 1; } } selections.set(original.key, { thumbnail, poster }); items.push({ object_key: original.key, result, media_type: original.classification.media_type, mime_type: prepared.mimeType, size_bytes: prepared.head.content_length || original.size, captured_at: prepared.metadata.captured_at, captured_at_source: prepared.metadata.captured_at_source, width: prepared.metadata.width, height: prepared.metadata.height, orientation: prepared.metadata.orientation, thumbnail_selected: thumbnail?.key || null, poster_selected: poster?.key || null, wordpress_variants: group.wordpress_variants.map(item => item.key), warnings, error, photo_id: photoId }); }
  if (interrupted) return;
  console.log("Generando informes...");
  const cleanup = { generated_at: new Date().toISOString(), bucket: config.bucket, prefix, dry_run: dryRun, groups: groups.filter(group => group.wordpress_variants.length).map(group => { const selected = selections.get(group.original.key)?.thumbnail?.key; return { original: group.original.key, original_registered: existing.has(`wasabi|${config.bucket}|${group.original.key}`), variants: group.wordpress_variants.filter(item => item.key !== selected).map(item => ({ key: item.key, width_from_filename: item.classification.width_from_filename, height_from_filename: item.classification.height_from_filename, used_as_thumbnail: false, safe_delete_candidate: !existing.has(`wasabi|${config.bucket}|${item.key}`), reason: "unused_wordpress_variant" })) }; }) };
  const report = { started_at: startedAt, finished_at: new Date().toISOString(), bucket: config.bucket, prefix, dry_run: dryRun, owner_email: ownerEmail, family_id: owner.family_id, owner_user_id: owner.owner_user_id, totals, items };
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true }); await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8"); await fs.writeFile(CLEANUP_PATH, `${JSON.stringify(cleanup, null, 2)}\n`, "utf8");
  console.log("Informes generados.");
  const resultSummary = dryRun ? `Would import: ${totals.would_import}` : `Imported: ${totals.imported}`;
  console.log(`\nOrangePhotos Wasabi import\n\nBucket: ${config.bucket}\nPrefix: ${prefix}\nMode: ${dryRun ? "DRY-RUN" : "WRITE"}\nOwner: ${ownerEmail}\nFamily: ${owner.family_id}\n\nObjects scanned: ${totals.objects_scanned}\nOriginals: ${totals.originals_detected}\nWordPress variants: ${totals.wordpress_variants_detected}\nThumbnails selected: ${totals.thumbnails_selected}\nPosters selected: ${totals.posters_selected}\n${resultSummary}\nAlready registered: ${totals.already_registered}\nOrphan variants: ${totals.orphan_variants}\nAmbiguous derivatives: ${totals.ambiguous_derivatives}\nFailed: ${totals.failed}\n\nReport:\nbackend/tmp/orange-photos-import-report.json\n\nCleanup candidates:\nbackend/tmp/orange-photos-wordpress-cleanup-candidates.json`);
}

main().catch(error => { if (!interrupted) { console.error("OrangePhotos Wasabi import:", error.message); process.exitCode = 1; } }).finally(() => closePool());
