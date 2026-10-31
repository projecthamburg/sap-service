import { randomUUID } from "node:crypto";
import {
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { notificationEmail, sendNotification } from "./notifications.mjs";
export const outboxKey = (reference) => `MAIL#${reference}`;
export function queuedNotification(record, now = Date.now()) {
  if (record.isTest || process.env.NOTIFICATIONS_ENABLED !== "true")
    return null;
  return {
    pk: outboxKey(record.pk),
    reference: record.pk,
    recordType: "notification",
    status: "pending",
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    queuedAt: new Date(now).toISOString(),
    expiresAt: record.expiresAt,
    email: notificationEmail(record),
  };
}
export function createOutbox({
  db,
  table,
  readRecord,
  send = sendNotification,
  clock = Date.now,
}) {
  async function finish(job, notification, due) {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: table,
              Key: { pk: job.pk },
              ConditionExpression: "leaseToken = :lease",
              UpdateExpression:
                "SET #status = :state, recordType = :type, createdAt = :due REMOVE leaseToken",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":lease": job.leaseToken,
                ":state": notification.state,
                ":type": due
                  ? "notification"
                  : `notification-${notification.state}`,
                ":due": due || new Date(clock()).toISOString(),
              },
            },
          },
          {
            Update: {
              TableName: table,
              Key: { pk: job.reference },
              ConditionExpression:
                "attribute_exists(pk) AND #status = :received",
              UpdateExpression: "SET notification = :notification",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":received": "received",
                ":notification": notification,
              },
            },
          },
        ],
      })
    );
  }
  async function runJob(key) {
    const time = clock(),
      now = new Date(time).toISOString();
    const { Item: item } = await db.send(
      new GetCommand({
        TableName: table,
        Key: { pk: key },
        ConsistentRead: true,
      })
    );
    if (!item || item.recordType !== "notification" || item.createdAt > now)
      return { skipped: true };
    const record = await readRecord(item.reference);
    if (
      !record ||
      record.isTest ||
      record.status !== "received" ||
      item.expiresAt <= Math.floor(time / 1000)
    ) {
      await db.send(new DeleteCommand({ TableName: table, Key: { pk: key } }));
      return { skipped: true };
    }
    if (process.env.NOTIFICATIONS_ENABLED !== "true") return { skipped: true };
    let job;
    try {
      ({ Attributes: job } = await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { pk: key },
          ConditionExpression:
            "recordType = :type AND createdAt <= :now AND expiresAt > :epoch",
          UpdateExpression:
            "SET #status = :processing, createdAt = :leaseEnd, leaseToken = :lease, firstAttemptAt = if_not_exists(firstAttemptAt, :now) ADD attempts :one",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":type": "notification",
            ":now": now,
            ":epoch": Math.floor(time / 1000),
            ":processing": "processing",
            ":leaseEnd": new Date(time + 60000).toISOString(),
            ":lease": randomUUID(),
            ":one": 1,
          },
          ReturnValues: "ALL_NEW",
        })
      ));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException")
        return { skipped: true };
      throw error;
    }
    const common = {
      attempts: job.attempts,
      recipient: job.email.to[0],
      lastAttemptAt: now,
    };
    if (
      job.attempts > 6 ||
      time - Date.parse(job.firstAttemptAt) > 20 * 60 * 60 * 1000
    ) {
      await finish(job, {
        ...common,
        state: "failed",
        error: "retry_window_expired",
      });
      return { failed: true };
    }
    let result;
    try {
      result = await send(job.email, `sap-notification-${job.reference}`);
    } catch (error) {
      const message =
        /^notification_(?:provider_\d{3}|configuration_missing|provider_invalid_response)$/.test(
          error.message
        )
          ? error.message
          : "notification_temporary_failure";
      const due =
        job.attempts < 6
          ? new Date(
              clock() + Math.min(3600000, 30000 * 4 ** (job.attempts - 1))
            ).toISOString()
          : null;
      await finish(
        job,
        {
          ...common,
          state: due ? "retrying" : "failed",
          error: message,
          ...(due ? { nextAttemptAt: due } : {}),
        },
        due
      );
      return { retrying: Boolean(due), failed: !due };
    }
    // A persistence failure here leaves the lease recoverable. The frozen email
    // and stable provider key make its retry safe within Resend's 24-hour window.
    await finish(job, {
      ...common,
      state: "sent",
      emailId: result.id,
      acceptedAt: new Date(clock()).toISOString(),
    });
    return { sent: true, emailId: result.id };
  }
  async function processBatch() {
    const result = await db.send(
      new QueryCommand({
        TableName: table,
        IndexName: "received",
        KeyConditionExpression: "recordType = :type AND createdAt <= :now",
        ExpressionAttributeValues: {
          ":type": "notification",
          ":now": new Date(clock()).toISOString(),
        },
        ScanIndexForward: true,
        Limit: 2,
      })
    );
    const results = [];
    for (const job of result.Items || []) results.push(await runJob(job.pk));
    return { processed: results.length, results };
  }
  return { runJob, processBatch };
}
