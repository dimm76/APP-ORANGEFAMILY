const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeModuleAccess, requireFamilyModule } = require("../src/moduleAccess.js");
test("guest solo recibe acceso a orange_photos", () => assert.deepEqual(normalizeModuleAccess({ orange_photos: true, notes: true }, "guest"), { orange_photos: true, wiki: false, notes: false, documents: false, finances: false }));
test("guest no obtiene orange_photos si llega desactivado", () => assert.equal(normalizeModuleAccess({}, "guest").orange_photos, false));
test("owner conserva todos los módulos", () => assert.equal(Object.values(normalizeModuleAccess({}, "owner")).every(Boolean), true));
test("member normaliza módulos enviados", () => assert.equal(normalizeModuleAccess({ notes: true }, "member").notes, true));
test("middleware permite guest en orange_photos", () => { let next = false; const res = { status() { return this; }, json() { return this; } }; requireFamilyModule("orange_photos")({ user: { id: "u", families: [{ id: "f", role: "guest", module_access: { orange_photos: true } }] } }, res, () => { next = true; }); assert.equal(next, true); });
test("middleware deniega guest en notes", () => { let status; const res = { status(value) { status = value; return this; }, json() { return this; } }; requireFamilyModule("notes")({ user: { id: "u", families: [{ id: "f", role: "guest", module_access: { orange_photos: true } }] } }, res, () => {}); assert.equal(status, 403); });
