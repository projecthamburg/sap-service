import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
let jwks;
export async function verifyAdminToken(token, { issuer, clientId, key }) {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer,
      algorithms: ["RS256"],
    });
    if (
      payload.token_use !== "access" ||
      payload.client_id !== clientId ||
      !Array.isArray(payload["cognito:groups"]) ||
      !payload["cognito:groups"].includes("SAPAdmins") ||
      typeof payload.sub !== "string"
    )
      return null;
    return { id: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}
export async function authenticatedAdmin(token) {
  const pool = process.env.COGNITO_POOL_ID,
    clientId = process.env.COGNITO_CLIENT_ID;
  if (!pool || !clientId || !token || token.length > 16000) return null;
  const issuer = `https://cognito-idp.${process.env.AWS_REGION || "ca-central-1"}.amazonaws.com/${pool}`;
  jwks ||= createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"));
  return verifyAdminToken(token, { issuer, clientId, key: jwks });
}

export async function revokedAdmin(db, table, id) {
  try {
    return Boolean(
      (
        await db.send(
          new GetCommand({
            TableName: table,
            Key: { pk: "ADMIN#REVOKED#" + id },
            ConsistentRead: true,
          })
        )
      ).Item?.revoked
    );
  } catch {
    return true;
  }
}
