/* global require */
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

test("express.json entrega checksum_sha256 al handler de preflight", async () => {
  const checksum = "a".repeat(64);
  const payload = JSON.stringify({
    original_filename: "test.jpg",
    size_bytes: 123,
    mime_type: "image/jpeg",
    checksum_sha256: checksum,
  });
  let receivedBody;
  const app = express();
  app.use(express.json());
  app.post("/api/orange-photos/uploads/check", (req, res) => {
    receivedBody = req.body;
    res.status(200).json({ ok: true });
  });
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    await new Promise((resolve, reject) => {
      const request = http.request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path: "/api/orange-photos/uploads/check",
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload),
        },
      }, response => {
        response.resume();
        response.on("end", resolve);
      });
      request.on("error", reject);
      request.end(payload, "utf8");
    });
    assert.equal(receivedBody.checksum_sha256, checksum);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
