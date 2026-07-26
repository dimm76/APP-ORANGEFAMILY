/* global require */
const test = require("node:test");
const assert = require("node:assert/strict");
const { clientContext } = require("../src/orangePhotosClientContext");

test("clientContext valida el cliente Android y el installation ID", () => {
  assert.deepEqual(clientContext({ headers:{"x-orange-client":"android_sync","x-orange-installation-id":"install_1.test"} }),{clientType:"android_sync",installationId:"install_1.test"});
});

test("clientContext degrada cabeceras no válidas a web y null", () => {
  assert.deepEqual(clientContext({ headers:{"x-orange-client":"owner","x-orange-installation-id":"bad value"} }),{clientType:"web",installationId:null});
});

test("clientContext no obtiene actor, familia ni propietario de cabeceras", () => {
  const context=clientContext({headers:{"x-orange-client":"android_sync","x-orange-installation-id":"device-1","x-orange-user-id":"attacker","x-orange-family-id":"family","x-orange-owner-user-id":"owner"}});
  assert.deepEqual(Object.keys(context).sort(),["clientType","installationId"]);
});
