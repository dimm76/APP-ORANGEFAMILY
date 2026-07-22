const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

const PREFIX = "scrypt$v1$";
const KEY_LEN = 64;
const SALT_LEN = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
  return `${PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith(PREFIX)) return false;

  const separator = stored.indexOf("$", PREFIX.length);
  if (separator === -1) return false;

  try {
    const salt = Buffer.from(stored.slice(PREFIX.length, separator), "base64url");
    const expected = Buffer.from(stored.slice(separator + 1), "base64url");
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;

    const actual = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
