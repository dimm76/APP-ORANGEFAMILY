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
const { handleOrangePhotosGuestRoutes } = require("./src/orangePhotosGuestHttp");
const { handleFamilyMembersRoutes } = require("./src/familyMembersHttp");
const { handleStorageUsageRoutes } = require("./src/storageUsageHttp");
const { handleAppReleaseRoutes } = require("./src/appReleasesHttp");
const { requireFamilyModule } = require("./src/moduleAccess");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use(attachAuthToRequest);

handleOrangePhotosGuestRoutes(app);

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

app.use("/api/wiki", requireFamilyModule("wiki"));
// Todos los attachments actuales pertenecen funcionalmente a Wiki.
app.use("/api/attachments", requireFamilyModule("wiki"));
app.use("/api/orange-photos", requireFamilyModule("orange_photos"));
app.use("/api/orange-photo-albums", requireFamilyModule("orange_photos"));
app.use("/api/orange-photo-tags", requireFamilyModule("orange_photos"));
app.use("/api/orange-photo-members", requireFamilyModule("orange_photos"));

handleAttachmentsRoutes(app);
handleWikiRoutes(app);
handleOrangePhotosRoutes(app);
handleFamilyMembersRoutes(app);
handleStorageUsageRoutes(app);
handleAppReleaseRoutes(app);

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
