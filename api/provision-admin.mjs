import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  CreateUserPoolClientCommand,
  CreateGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { writeFile, mkdir } from "node:fs/promises";
try {
  process.loadEnvFile(".env");
} catch {}
const region = "ca-central-1",
  credentials = {
    accessKeyId: process.env.AWS_BUSINESS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_BUSINESS_SECRET_ACCESS_KEY,
  };
const c = new CognitoIdentityProviderClient({ region, credentials });
const list = await c.send(new ListUserPoolsCommand({ MaxResults: 60 }));
let pool = list.UserPools.find((p) => p.Name === "sap-service-admin");
if (!pool)
  pool = (
    await c.send(
      new CreateUserPoolCommand({
        PoolName: "sap-service-admin",
        UsernameAttributes: ["email"],
        AutoVerifiedAttributes: ["email"],
        AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
        Policies: {
          PasswordPolicy: {
            MinimumLength: 14,
            RequireUppercase: true,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
            TemporaryPasswordValidityDays: 7,
          },
        },
        AccountRecoverySetting: {
          RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }],
        },
        MfaConfiguration: "OFF",
        UserPoolTags: { Project: "sap-service" },
      })
    )
  ).UserPool;
let clients = await c.send(
  new ListUserPoolClientsCommand({ UserPoolId: pool.Id, MaxResults: 60 })
);
let client = clients.UserPoolClients.find(
  (p) => p.ClientName === "sap-service-admin-browser"
);
if (!client)
  client = (
    await c.send(
      new CreateUserPoolClientCommand({
        UserPoolId: pool.Id,
        ClientName: "sap-service-admin-browser",
        GenerateSecret: false,
        ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
        PreventUserExistenceErrors: "ENABLED",
        AccessTokenValidity: 15,
        IdTokenValidity: 15,
        RefreshTokenValidity: 1,
        TokenValidityUnits: {
          AccessToken: "minutes",
          IdToken: "minutes",
          RefreshToken: "days",
        },
        EnableTokenRevocation: true,
      })
    )
  ).UserPoolClient;
try {
  await c.send(
    new CreateGroupCommand({
      UserPoolId: pool.Id,
      GroupName: "SAPAdmins",
      Description: "Invited SAP Service administrators",
    })
  );
} catch (e) {
  if (e.name !== "GroupExistsException") throw e;
}
await mkdir("public", { recursive: true });
await writeFile(
  "public/admin-auth.json",
  JSON.stringify(
    { region, userPoolId: pool.Id, clientId: client.ClientId },
    null,
    2
  ) + "\n"
);
console.log("SAP invitation-only admin pool and public client configured.");
