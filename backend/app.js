require("dotenv").config();

const express = require("express");
const pool = require("./db");
const {
  attachAuthToRequest,
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  handleAuthActivate,
  handleAuthForgotPassword,
  handleAuthResetPassword,
} = require("./src/auth");
const { handleAttachmentsRoutes } = require("./src/attachmentsHttp");
const { handleWikiRoutes } = require("./src/wikiHttp");
const { handleOrangePhotosRoutes } = require("./src/orangePhotosHttp");
const { handleFamilyMembersRoutes } = require("./src/familyMembersHttp");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use(attachAuthToRequest);

function sendAuthResult(res, result) {
  if (result.setCookie) res.setHeader("Set-Cookie", result.setCookie);
  return res.status(result.status).json(result.body);
}

app.post("/api/auth/login", async (req, res) => {
  return sendAuthResult(res, await handleAuthLogin(req));
});

app.post("/api/auth/logout", async (req, res) => {
  return sendAuthResult(res, await handleAuthLogout(req));
});

app.get("/api/auth/me", async (req, res) => {
  return sendAuthResult(res, await handleAuthMe(req));
});

app.post("/api/auth/activate", async (req, res) => sendAuthResult(res, await handleAuthActivate(req)));
app.post("/api/auth/forgot-password", async (req, res) => sendAuthResult(res, await handleAuthForgotPassword(req)));
app.post("/api/auth/reset-password", async (req, res) => sendAuthResult(res, await handleAuthResetPassword(req)));

function requireOwnerModuleAccess(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ ok: false, message: "No autenticado." });
  if (!req.user.families?.some((family) => family.role === "owner")) return res.status(403).json({ ok: false, message: "Acceso reservado al administrador." });
  return next();
}

app.use("/api/wiki", requireOwnerModuleAccess);
app.use("/api/attachments", requireOwnerModuleAccess);

handleAttachmentsRoutes(app);
handleWikiRoutes(app);
handleOrangePhotosRoutes(app);
handleFamilyMembersRoutes(app);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      ok: true,
      service: "orangefamily-api",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      ok: false,
      service: "orangefamily-api",
      database: "unavailable",
    });
  }
});

app.listen(port, () => {
  console.log(`OrangeFamily API listening on http://localhost:${port}`);
});
