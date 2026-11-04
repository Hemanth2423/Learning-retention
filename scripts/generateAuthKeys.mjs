// Prints JWT_PRIVATE_KEY and JWKS for Convex Auth. Usage: node scripts/generateAuthKeys.mjs
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
console.log(JSON.stringify({ JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "), JWKS: jwks }));
