require("dotenv").config();

const process = require("node:process");
const pool = require("../db");
const { hashPassword } = require("../src/passwordCrypto");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 || index + 1 >= process.argv.length ? null : process.argv[index + 1];
}

const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || argument("email") || "")
  .trim()
  .toLowerCase();
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || argument("password") || "");
const firstName = String(
  process.env.BOOTSTRAP_ADMIN_FIRST_NAME || argument("first-name") || ""
).trim();
const lastName = String(
  process.env.BOOTSTRAP_ADMIN_LAST_NAME || argument("last-name") || ""
).trim();
const preferredName = String(
  process.env.BOOTSTRAP_ADMIN_PREFERRED_NAME || argument("preferred-name") || ""
).trim();
const familyName = String(
  process.env.BOOTSTRAP_ADMIN_FAMILY_NAME || argument("family-name") || ""
).trim();

if (!email || !email.includes("@") || password.length < 10 || !firstName || !familyName) {
  console.error(
    "Defina BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (mín. 10 caracteres), "
      + "BOOTSTRAP_ADMIN_FIRST_NAME y BOOTSTRAP_ADMIN_FAMILY_NAME."
  );
  process.exit(1);
}

async function bootstrapAdmin() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `SELECT id, person_id
       FROM public.auth_users
       WHERE lower(btrim(email)) = $1
       LIMIT 1`,
      [email]
    );

    let userId;
    let personId = existingUser.rows[0] && existingUser.rows[0].person_id;

    if (personId) {
      await client.query(
        `UPDATE public.persons
         SET first_name = $2, last_name = $3, preferred_name = $4, status = 'active'
         WHERE id = $1::uuid`,
        [personId, firstName, lastName || null, preferredName || null]
      );
    } else {
      const person = await client.query(
        `INSERT INTO public.persons (first_name, last_name, preferred_name, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id`,
        [firstName, lastName || null, preferredName || null]
      );
      personId = person.rows[0].id;
    }

    const passwordHash = hashPassword(password);
    if (existingUser.rows[0]) {
      userId = existingUser.rows[0].id;
      await client.query(
        `UPDATE public.auth_users
         SET person_id = $2::uuid, email = $3, password_hash = $4, status = 'active',
             email_verified = true, failed_login_count = 0, locked_until = NULL
         WHERE id = $1::uuid`,
        [userId, personId, email, passwordHash]
      );
    } else {
      const user = await client.query(
        `INSERT INTO public.auth_users
          (person_id, email, password_hash, status, email_verified)
         VALUES ($1::uuid, $2, $3, 'active', true)
         RETURNING id`,
        [personId, email, passwordHash]
      );
      userId = user.rows[0].id;
    }

    const existingMembership = await client.query(
      `SELECT fm.id AS membership_id, fm.family_id
       FROM public.family_memberships fm
       WHERE fm.person_id = $1::uuid
       ORDER BY (fm.role = 'owner') DESC, fm.created_at
       LIMIT 1`,
      [personId]
    );

    let familyId;
    if (existingMembership.rows[0]) {
      familyId = existingMembership.rows[0].family_id;
      await client.query(
        `UPDATE public.families SET name = $2, status = 'active' WHERE id = $1::uuid`,
        [familyId, familyName]
      );
      await client.query(
        `UPDATE public.family_memberships
         SET role = 'owner', status = 'active', left_at = NULL
         WHERE id = $1::uuid`,
        [existingMembership.rows[0].membership_id]
      );
    } else {
      const family = await client.query(
        `INSERT INTO public.families (name, status)
         VALUES ($1, 'active')
         RETURNING id`,
        [familyName]
      );
      familyId = family.rows[0].id;
      await client.query(
        `INSERT INTO public.family_memberships
          (family_id, person_id, role, status, joined_at)
         VALUES ($1::uuid, $2::uuid, 'owner', 'active', CURRENT_DATE)`,
        [familyId, personId]
      );
    }

    await client.query("COMMIT");
    console.log("Administrador, persona, familia y membership owner preparados correctamente.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("No se pudo preparar el administrador:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

bootstrapAdmin();
