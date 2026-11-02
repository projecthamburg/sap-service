// SAP-only account administration. Never prints temporary passwords or tokens.
import { readFile } from "node:fs/promises";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminUserGlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
try {
  process.loadEnvFile(".env");
} catch {}
const [action, email] = process.argv.slice(2);
if (
  !["invite", "revoke"].includes(action) ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")
)
  throw Error("Usage: node api/admin-account.mjs invite|revoke email");
const config = JSON.parse(await readFile("public/admin-auth.json", "utf8")),
  deployment = JSON.parse(await readFile("api/deployment.json", "utf8"));
const options = {
    region: config.region,
    ...(process.env.AWS_BUSINESS_ACCESS_KEY_ID
      ? {
          credentials: {
            accessKeyId: process.env.AWS_BUSINESS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_BUSINESS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  },
  c = new CognitoIdentityProviderClient(options),
  db = DynamoDBDocumentClient.from(new DynamoDBClient(options));
const input = { UserPoolId: config.userPoolId, Username: email };
if (action === "invite") {
  let exists = false;
  try {
    await c.send(
      new AdminCreateUserCommand({
        ...input,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
      })
    );
  } catch (e) {
    if (e.name !== "UsernameExistsException") throw e;
    exists = true;
  }
  await c.send(
    new AdminAddUserToGroupCommand({ ...input, GroupName: "SAPAdmins" })
  );
  await c.send(new AdminEnableUserCommand(input));
  const u = await c.send(new AdminGetUserCommand(input)),
    sub = u.UserAttributes.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw Error("Missing account ID.");
  await db.send(
    new DeleteCommand({
      TableName: deployment.table,
      Key: { pk: "ADMIN#REVOKED#" + sub },
    })
  );
  console.log(
    exists
      ? "Existing SAP account preserved and access granted; password unchanged."
      : "SAP invitation sent by Cognito; temporary password must be changed at first sign-in."
  );
} else {
  const u = await c.send(new AdminGetUserCommand(input)),
    sub = u.UserAttributes.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw Error("Missing account ID.");
  // Deny existing access tokens immediately, before disabling refresh/sign-in.
  await db.send(
    new PutCommand({
      TableName: deployment.table,
      Item: {
        pk: "ADMIN#REVOKED#" + sub,
        revoked: true,
        at: new Date().toISOString(),
      },
    })
  );
  await c.send(new AdminDisableUserCommand(input));
  await c.send(new AdminUserGlobalSignOutCommand(input));
  console.log("SAP account revoked, including existing API sessions.");
}
