import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { loadOperations } from "../scripts/configuration.mjs";
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  UpdateAssumeRolePolicyCommand,
  PutRolePolicyCommand,
  ListOpenIDConnectProvidersCommand,
  CreateOpenIDConnectProviderCommand,
} from "@aws-sdk/client-iam";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketOwnershipControlsCommand,
  PutBucketEncryptionCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  UpdateTimeToLiveCommand,
  DescribeTimeToLiveCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  LambdaClient,
  CreateFunctionCommand,
  GetFunctionConfigurationCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionUrlConfigCommand,
  AddPermissionCommand,
  PutFunctionConcurrencyCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";

try {
  process.loadEnvFile(".env");
} catch {}
const operations = await loadOperations();
const existingOnly = process.env.SAP_DEPLOY_EXISTING === "true";
const region = process.env.SAP_AWS_REGION || "ca-central-1";
const credentials = process.env.AWS_BUSINESS_ACCESS_KEY_ID
  ? {
      accessKeyId: process.env.AWS_BUSINESS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_BUSINESS_SECRET_ACCESS_KEY,
    }
  : undefined;
const options = { region, ...(credentials ? { credentials } : {}) };
const account = (
  await new STSClient(options).send(new GetCallerIdentityCommand({}))
).Account;
const functionName = "sap-service-api",
  table = "sap-service-submissions",
  bucket = `sap-service-private-${account}-${region}`;
const executionRoleName = "sap-service-api-execution",
  executionRoleArn = `arn:aws:iam::${account}:role/${executionRoleName}`;
const deployRoleName = "sap-service-github-deploy",
  deployRoleArn = `arn:aws:iam::${account}:role/${deployRoleName}`;
const siteUrl = operations.siteUrl;
const origins = `${new URL(siteUrl).origin},http://127.0.0.1:4173`;
const lambda = new LambdaClient(options),
  s3 = new S3Client(options),
  dynamo = new DynamoDBClient(options),
  iam = new IAMClient(options),
  logs = new CloudWatchLogsClient(options);
const policy = (statements) =>
  JSON.stringify({ Version: "2012-10-17", Statement: statements });
async function ensureRole(name, trust) {
  try {
    const role = (await iam.send(new GetRoleCommand({ RoleName: name }))).Role;
    await iam.send(
      new UpdateAssumeRolePolicyCommand({
        RoleName: name,
        PolicyDocument: JSON.stringify(trust),
      })
    );
    return role;
  } catch (error) {
    if (error.name !== "NoSuchEntityException") throw error;
    return (
      await iam.send(
        new CreateRoleCommand({
          RoleName: name,
          AssumeRolePolicyDocument: JSON.stringify(trust),
          Description: "Dedicated SAP Service website role",
          Tags: [{ Key: "Application", Value: "sap-service" }],
        })
      )
    ).Role;
  }
}
if (!existingOnly) {
  console.log(
    "Preparing private Canadian storage and a dedicated execution role…"
  );
  await ensureRole(executionRoleName, {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  });
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: executionRoleName,
      PolicyName: "SAPPrivateSubmissions",
      PolicyDocument: policy([
        {
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          Resource: [`arn:aws:s3:::${bucket}/submissions/*`,`arn:aws:s3:::${bucket}/admin/maps/*`],
        },
        {
          Effect: "Allow",
          Action: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Query",
          ],
          Resource: [
            `arn:aws:dynamodb:${region}:${account}:table/${table}`,
            `arn:aws:dynamodb:${region}:${account}:table/${table}/index/*`,
          ],
        },
        {
          Effect: "Allow",
          Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
          Resource: [functionName, "sap-service-plan-review"].map(
            (name) =>
              `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/${name}:*`
          ),
        },
      ]),
    })
  );
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (
      ![404, 301].includes(error.$metadata?.httpStatusCode) &&
      error.name !== "NotFound"
    )
      throw error;
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucket,
        CreateBucketConfiguration: { LocationConstraint: region },
      })
    );
  }
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    })
  );
  await s3.send(
    new PutBucketOwnershipControlsCommand({
      Bucket: bucket,
      OwnershipControls: {
        Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
      },
    })
  );
  await s3.send(
    new PutBucketEncryptionCommand({
      Bucket: bucket,
      ServerSideEncryptionConfiguration: {
        Rules: [
          { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
    })
  );
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins.split(","),
            AllowedMethods: ["POST", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 600,
          },
        ],
      },
    })
  );
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "Expire-private-submissions",
            Status: "Enabled",
            Filter: { Prefix: "submissions/" },
            Expiration: { Days: 90 },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
          {
            ID: "Expire-plan-review-tiles",
            Status: "Enabled",
            Filter: { Prefix: "submissions/reviews/" },
            Expiration: { Days: 7 },
          },
        ],
      },
    })
  );
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: table }));
  } catch (error) {
    if (error.name !== "ResourceNotFoundException") throw error;
    await dynamo.send(
      new CreateTableCommand({
        TableName: table,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "recordType", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "received",
            KeySchema: [
              { AttributeName: "recordType", KeyType: "HASH" },
              { AttributeName: "createdAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
        SSESpecification: { Enabled: true },
        Tags: [{ Key: "Application", Value: "sap-service" }],
      })
    );
    await waitUntilTableExists(
      { client: dynamo, maxWaitTime: 180 },
      { TableName: table }
    );
  }
  const ttl = await dynamo.send(
    new DescribeTimeToLiveCommand({ TableName: table })
  );
  if (ttl.TimeToLiveDescription.TimeToLiveStatus === "DISABLED")
    await dynamo.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
      })
    );
  try {
    await logs.send(
      new CreateLogGroupCommand({
        logGroupName: `/aws/lambda/${functionName}`,
        tags: { Application: "sap-service" },
      })
    );
  } catch (error) {
    if (error.name !== "ResourceAlreadyExistsException") throw error;
  }
  await logs.send(
    new PutRetentionPolicyCommand({
      logGroupName: `/aws/lambda/${functionName}`,
      retentionInDays: 14,
    })
  );
}

await mkdir(".local", { recursive: true });
let secrets = {};
if (!process.env.CI)
  try {
    secrets = JSON.parse(
      await readFile(".local/aws-service-secrets.json", "utf8")
    );
  } catch {}
const adminToken =
  process.env.SAP_ADMIN_TOKEN ||
  secrets.adminToken ||
  (process.env.CI ? "" : randomBytes(32).toString("hex"));
const rateSalt =
  process.env.SAP_RATE_SALT ||
  secrets.rateSalt ||
  (process.env.CI ? "" : randomBytes(32).toString("hex"));
if (adminToken.length < 32 || rateSalt.length < 32)
  throw new Error(
    "Durable SAP_ADMIN_TOKEN and SAP_RATE_SALT secrets are required."
  );
if (!process.env.CI)
  await writeFile(
    ".local/aws-service-secrets.json",
    JSON.stringify({ adminToken, rateSalt }) + "\n",
    { mode: 0o600 }
  );
const adminAuth=JSON.parse(await readFile("public/admin-auth.json","utf8"));
const variables = {
  COGNITO_POOL_ID:adminAuth.userPoolId,
  COGNITO_CLIENT_ID:adminAuth.clientId,
  SAP_MAPS_BROWSER_KEY:process.env.SAP_MAPS_BROWSER_KEY || "",
  TABLE_NAME: table,
  BUCKET_NAME: bucket,
  ADMIN_TOKEN: adminToken,
  RATE_SALT: rateSalt,
  ALLOWED_ORIGINS: origins,
  SITE_URL: siteUrl,
  PLAN_REVIEW_ENABLED: "true",
  PLAN_DAILY_TILE_LIMIT: "256",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPERATING_STAGE: operations.stage,
  OPERATOR_NAME:
    operations.stage === "proposal"
      ? operations.operator.name
      : operations.contact.name,
  NOTIFICATION_FROM:
    process.env.SAP_NOTIFICATION_FROM || operations.notifications.from,
  NOTIFICATION_TO:
    process.env.SAP_NOTIFICATION_TO || operations.notifications.to,
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  NOTIFICATIONS_ENABLED:
    process.env.SAP_NOTIFICATIONS_ENABLED ||
    String(operations.notifications.enabled),
};
console.log("Building and deploying the private form service…");
await mkdir("api/dist", { recursive: true });
await build({
  entryPoints: ["api/lambda.mjs"],
  bundle: true,
  outfile: "api/dist/index.mjs",
  platform: "node",
  target: "node22",
  format: "esm",
  minify: true,
  banner: {
    js: 'import { createRequire } from "node:module";const require=createRequire(import.meta.url);',
  },
});
execFileSync("python3", [
  "-c",
  'import zipfile;z=zipfile.ZipFile(".local/sap-lambda.zip","w",zipfile.ZIP_DEFLATED);z.write("api/dist/index.mjs","index.mjs");z.close()',
]);
const zip = await readFile(".local/sap-lambda.zip");
let exists = true;
try {
  await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName })
  );
} catch (error) {
  if (error.name !== "ResourceNotFoundException") throw error;
  exists = false;
}
if (exists) {
  await lambda.send(
    new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zip })
  );
  await waitUntilFunctionUpdatedV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: functionName }
  );
  await lambda.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: functionName,
      Role: executionRoleArn,
      Runtime: "nodejs22.x",
      Handler: "index.handler",
      MemorySize: 256,
      Timeout: 30,
      Environment: { Variables: variables },
    })
  );
  await waitUntilFunctionUpdatedV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: functionName }
  );
} else {
  let created = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await lambda.send(
        new CreateFunctionCommand({
          FunctionName: functionName,
          Role: executionRoleArn,
          Runtime: "nodejs22.x",
          Handler: "index.handler",
          Architectures: ["arm64"],
          MemorySize: 256,
          Timeout: 30,
          Code: { ZipFile: zip },
          Environment: { Variables: variables },
          Description: "SAP Service private quotation and careers submissions",
          Tags: { Application: "sap-service" },
        })
      );
      created = true;
      break;
    } catch (error) {
      if (!String(error.message).includes("cannot be assumed") || attempt === 5)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
  if (!created) throw new Error("Could not initialize the dedicated function.");
  await waitUntilFunctionActiveV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: functionName }
  );
}
let functionUrl;
try {
  functionUrl = (
    await lambda.send(
      new GetFunctionUrlConfigCommand({ FunctionName: functionName })
    )
  ).FunctionUrl;
} catch (error) {
  if (error.name !== "ResourceNotFoundException") throw error;
  functionUrl = (
    await lambda.send(
      new CreateFunctionUrlConfigCommand({
        FunctionName: functionName,
        AuthType: "NONE",
        InvokeMode: "BUFFERED",
      })
    )
  ).FunctionUrl;
}
if (!existingOnly) {
  for (const permission of [
    {
      StatementId: "SAPWebsiteFunctionUrl",
      Action: "lambda:InvokeFunctionUrl",
      FunctionUrlAuthType: "NONE",
    },
    {
      StatementId: "SAPWebsiteUrlInvocation",
      Action: "lambda:InvokeFunction",
      InvokedViaFunctionUrl: true,
    },
  ]) {
    try {
      await lambda.send(
        new AddPermissionCommand({
          FunctionName: functionName,
          Principal: "*",
          ...permission,
        })
      );
    } catch (error) {
      if (error.name !== "ResourceConflictException") throw error;
    }
  }
  try {
    await lambda.send(
      new PutFunctionConcurrencyCommand({
        FunctionName: functionName,
        ReservedConcurrentExecutions: 2,
      })
    );
  } catch (error) {
    console.log("Concurrency reservation not changed:", error.name);
  }
  const providers = await iam.send(new ListOpenIDConnectProvidersCommand({}));
  let providerArn = providers.OpenIDConnectProviderList.find((p) =>
    p.Arn.endsWith("/token.actions.githubusercontent.com")
  )?.Arn;
  if (!providerArn)
    providerArn = (
      await iam.send(
        new CreateOpenIDConnectProviderCommand({
          Url: "https://token.actions.githubusercontent.com",
          ClientIDList: ["sts.amazonaws.com"],
          Tags: [{ Key: "Application", Value: "sap-service" }],
        })
      )
    ).OpenIDConnectProviderArn;
  await ensureRole(deployRoleName, {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Federated: providerArn },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub":
              // GitHub's immutable subject includes the owner and repository IDs.
              "repo:projecthamburg@79866271/sap-service@1440106954:environment:production-api",
          },
        },
      },
    ],
  });
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: deployRoleName,
      PolicyName: "DeployOnlySAPService",
      PolicyDocument: policy([
        {
          Effect: "Allow",
          Action: [
            "lambda:GetFunction",
            "lambda:GetFunctionConfiguration",
            "lambda:UpdateFunctionCode",
            "lambda:UpdateFunctionConfiguration",
            "lambda:GetFunctionUrlConfig",
          ],
          Resource: [functionName, "sap-service-plan-review"].map(
            (name) => `arn:aws:lambda:${region}:${account}:function:${name}`
          ),
        },
        {
          Effect: "Allow",
          Action: "iam:PassRole",
          Resource: executionRoleArn,
          Condition: {
            StringEquals: { "iam:PassedToService": "lambda.amazonaws.com" },
          },
        },
      ]),
    })
  );
}
const notificationScheduleArn = `arn:aws:events:${region}:${account}:rule/sap-service-email-outbox`;
if (!existingOnly) {
  const events = new EventBridgeClient(options);
  await events.send(
    new PutRuleCommand({
      Name: "sap-service-email-outbox",
      ScheduleExpression: "rate(1 minute)",
      State: "ENABLED",
      Description: "Retry only SAP Service's private notification outbox",
      Tags: [{ Key: "Application", Value: "sap-service" }],
    })
  );
  try {
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: "SAPNotificationSchedule",
        Action: "lambda:InvokeFunction",
        Principal: "events.amazonaws.com",
        SourceArn: notificationScheduleArn,
      })
    );
  } catch (error) {
    if (error.name !== "ResourceConflictException") throw error;
  }
  const targets = await events.send(
    new PutTargetsCommand({
      Rule: "sap-service-email-outbox",
      Targets: [
        {
          Id: "sap-email-outbox",
          Arn: `arn:aws:lambda:${region}:${account}:function:${functionName}`,
          RetryPolicy: {
            MaximumEventAgeInSeconds: 3600,
            MaximumRetryAttempts: 3,
          },
        },
      ],
    })
  );
  if (targets.FailedEntryCount)
    throw Error("Could not connect SAP email retry schedule.");
}
// Long vision requests have their own function/concurrency; intake and email
// receipts retain their shorter timeout and independent capacity.
const planFunctionName = "sap-service-plan-review";
if (!existingOnly) {
  try {
    await logs.send(
      new CreateLogGroupCommand({
        logGroupName: "/aws/lambda/" + planFunctionName,
      })
    );
  } catch (e) {
    if (e.name !== "ResourceAlreadyExistsException") throw e;
  }
  await logs.send(
    new PutRetentionPolicyCommand({
      logGroupName: "/aws/lambda/" + planFunctionName,
      retentionInDays: 14,
    })
  );
}
const planVariables = { ...variables, SERVICE_MODE: "plan-review" };
let planExists = true;
try {
  await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: planFunctionName })
  );
} catch (e) {
  if (e.name !== "ResourceNotFoundException") throw e;
  planExists = false;
}
if (planExists) {
  await lambda.send(
    new UpdateFunctionCodeCommand({
      FunctionName: planFunctionName,
      ZipFile: zip,
    })
  );
  await waitUntilFunctionUpdatedV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: planFunctionName }
  );
  await lambda.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: planFunctionName,
      Role: executionRoleArn,
      Runtime: "nodejs22.x",
      Handler: "index.handler",
      MemorySize: 256,
      Timeout: 120,
      Environment: { Variables: planVariables },
    })
  );
  await waitUntilFunctionUpdatedV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: planFunctionName }
  );
} else {
  if (existingOnly)
    throw Error(
      "Plan-review function requires initial provisioning before CI deployment."
    );
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: planFunctionName,
      Role: executionRoleArn,
      Runtime: "nodejs22.x",
      Handler: "index.handler",
      Architectures: ["arm64"],
      MemorySize: 256,
      Timeout: 120,
      Code: { ZipFile: zip },
      Environment: { Variables: planVariables },
      Description: "Isolated SAP optional floor-plan review",
    })
  );
  await waitUntilFunctionActiveV2(
    { client: lambda, maxWaitTime: 180 },
    { FunctionName: planFunctionName }
  );
}
let planUrl;
try {
  planUrl = (
    await lambda.send(
      new GetFunctionUrlConfigCommand({ FunctionName: planFunctionName })
    )
  ).FunctionUrl;
} catch (e) {
  if (e.name !== "ResourceNotFoundException") throw e;
  planUrl = (
    await lambda.send(
      new CreateFunctionUrlConfigCommand({
        FunctionName: planFunctionName,
        AuthType: "NONE",
      })
    )
  ).FunctionUrl;
}
if (!existingOnly) {
  for (const permission of [
    {
      StatementId: "SAPPlanUrl",
      Action: "lambda:InvokeFunctionUrl",
      FunctionUrlAuthType: "NONE",
    },
    {
      StatementId: "SAPPlanInvocation",
      Action: "lambda:InvokeFunction",
      InvokedViaFunctionUrl: true,
    },
  ])
    try {
      await lambda.send(
        new AddPermissionCommand({
          FunctionName: planFunctionName,
          Principal: "*",
          ...permission,
        })
      );
    } catch (e) {
      if (e.name !== "ResourceConflictException") throw e;
    }
  await lambda.send(
    new PutFunctionConcurrencyCommand({
      FunctionName: planFunctionName,
      ReservedConcurrentExecutions: 2,
    })
  );
}
const planReviewApiUrl = planUrl.replace(/\/$/, "");
const planHealthResponse = await fetch(planReviewApiUrl + "/health", {
    signal: AbortSignal.timeout(20000),
  }),
  planHealth = await planHealthResponse.json();
if (!planHealthResponse.ok || !planHealth.planReview?.enabled)
  throw Error("Plan-review service is not configured.");
const apiUrl = functionUrl.replace(/\/$/, "");
const response = await fetch(`${apiUrl}/health`, {
  signal: AbortSignal.timeout(20000),
});
const health = await response.json();
if (!response.ok || !health.forms)
  throw new Error("Deployed form service did not pass its health check.");
const config = JSON.parse(await readFile("public/site-config.json", "utf8"));
config.apiUrl = apiUrl;
config.uploadMode = "direct";
config.planReviewEnabled = Boolean(process.env.OPENAI_API_KEY);
config.planReviewApiUrl = planReviewApiUrl;
await writeFile(
  "public/site-config.json",
  JSON.stringify(config, null, 2) + "\n"
);
await writeFile(
  "api/deployment.json",
  JSON.stringify(
    {
      region,
      functionName,
      table,
      bucket,
      executionRoleArn,
      deployRoleArn,
      apiUrl,
      notificationScheduleArn,
      planFunctionName,
      planReviewApiUrl,
    },
    null,
    2
  ) + "\n"
);
console.log(`Private service verified: ${apiUrl}`);
console.log(
  "Uploads are private; public website configuration contains no credentials."
);
