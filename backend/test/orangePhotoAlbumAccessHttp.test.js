const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicePath = path.resolve(__dirname, "../src/orangePhotoAlbumAccessService.js");
const httpPath = path.resolve(__dirname, "../src/orangePhotoAlbumAccessHttp.js");
let listImpl = async () => ({ ok: true });
let syncImpl = async () => ({ ok: true });
const service = { listAlbumRecipients: (...args) => listImpl(...args), syncAlbumRecipients: (...args) => syncImpl(...args) };
require.cache[servicePath] = { id: servicePath, filename: servicePath, loaded: true, exports: service };
delete require.cache[httpPath];
const { handleOrangePhotoAlbumAccessRoutes } = require(httpPath);

function createFakeApp() {
  const routes = { get: new Map(), put: new Map() };
  return { routes, get(pathname, handler) { routes.get.set(pathname, handler); }, put(pathname, handler) { routes.put.set(pathname, handler); } };
}

function createResponse() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

const paths = {
  get: "/api/orange-photo-albums/:albumId/recipients",
  put: "/api/orange-photo-albums/:albumId/recipients",
};

test("registra exactamente las rutas GET y PUT", () => {
  const app = createFakeApp();
  handleOrangePhotoAlbumAccessRoutes(app);
  assert.deepEqual([...app.routes.get.keys()], [paths.get]);
  assert.deepEqual([...app.routes.put.keys()], [paths.put]);
});

test("GET delega req y albumId y devuelve payload correcto", async () => {
  const app = createFakeApp();
  const req = { params: { albumId: "album-1" } };
  listImpl = async (...args) => { assert.deepEqual(args, [req, "album-1"]); return { ok: true, payload: { recipients: [] } }; };
  handleOrangePhotoAlbumAccessRoutes(app);
  const res = createResponse();
  await app.routes.get.get(paths.get)(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, recipients: [] });
});

test("PUT delega body sin transformarlo y usa {} si falta", async () => {
  const app = createFakeApp();
  const body = { recipients: [{ user_id: "u" }] };
  const req = { params: { albumId: "album-2" }, body };
  syncImpl = async (...args) => { assert.deepEqual(args, [req, "album-2", body]); return { ok: true, payload: { recipient_count: 1 } }; };
  handleOrangePhotoAlbumAccessRoutes(app);
  let res = createResponse();
  await app.routes.put.get(paths.put)(req, res);
  assert.deepEqual(res.body, { ok: true, recipient_count: 1 });
  const reqWithoutBody = { params: req.params };
  syncImpl = async (...args) => { assert.deepEqual(args, [reqWithoutBody, "album-2", {}]); return { ok: true, payload: {} }; };
  res = createResponse();
  await app.routes.put.get(paths.put)(reqWithoutBody, res);
  assert.equal(res.statusCode, 200);
});

test("bad del servicio conserva status y convierte reason en message", async () => {
  const app = createFakeApp();
  listImpl = async () => ({ ok: false, status: 422, code: "BAD_RECIPIENTS", reason: "No válido" });
  handleOrangePhotoAlbumAccessRoutes(app);
  const res = createResponse();
  await app.routes.get.get(paths.get)({ params: { albumId: "album" } }, res);
  assert.deepEqual(res.body, { ok: false, code: "BAD_RECIPIENTS", message: "No válido" });
  assert.equal(res.statusCode, 422);
});

test("excepción inesperada devuelve error interno sin detalles", async () => {
  const app = createFakeApp();
  listImpl = async () => { throw new Error("SQL secret detail"); };
  const originalError = console.error;
  let logged;
  console.error = (...args) => { logged = args; };
  try {
    handleOrangePhotoAlbumAccessRoutes(app);
    const res = createResponse();
    await app.routes.get.get(paths.get)({ params: { albumId: "album" } }, res);
    assert.deepEqual(res.body, { ok: false, code: "INTERNAL_ERROR", message: "No se pudo completar la operación." });
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /SQL secret detail|stack/);
  } finally { console.error = originalError; }
  assert.match(JSON.stringify(logged), /Orange album access/);
});

test("app registra el middleware de álbumes antes del handler ACL", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../app.js"), "utf8");
  assert.ok(source.indexOf('app.use("/api/orange-photo-albums", requireFamilyModule("orange_photos"))') < source.indexOf("handleOrangePhotoAlbumAccessRoutes(app)"));
});
