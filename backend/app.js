require("dotenv").config();

const express = require("express");
const pool = require("./db");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());

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