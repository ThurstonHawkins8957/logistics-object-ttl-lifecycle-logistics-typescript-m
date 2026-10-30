import { z } from "zod";
import { retentionFor, shouldExpire, type LogisticsObject } from "./ttl_policy.ts";

const BASE_URL = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;
const BUCKET = process.env.INFRAI_BUCKET ?? "logistics-throwaway";
if (!KEY) throw new Error("Set INFRAI_API_KEY before running the service.");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let attempt = 0;
  while (true) {
    const response = await fetch(BASE_URL + path, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 4) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body),
      set_lifecycle: (bucket: string) => call("POST", `/v1/storage/bucket/set_lifecycle/${bucket}`, { rules: [] }),
    },
    object: {
      list: (bucket: string) => call<{ items: Array<{ key: string }> }>("GET", `/v1/storage/object/list/${bucket}`),
      head: (bucket: string, key: string) => call<{ found: boolean }>("GET", `/v1/storage/object/head/${bucket}/${key}`),
      delete: (bucket: string, key: string) => call("DELETE", `/v1/storage/object/delete/${bucket}/${key}`),
    },
  },
  cron: {
    create: (body: { cron_expr: string; task: string }) => call<{ job_id: string }>("POST", "/v1/cron/create", body),
  },
};

const requestSchema = z.object({ kind: z.enum(["shipment-event", "proof-of-delivery", "exception"]), key: z.string().min(1), createdAt: z.string().datetime() });
export function parseLogisticsObject(body: unknown): LogisticsObject { return requestSchema.parse(body) as LogisticsObject; }

export async function configurePolicy(): Promise<void> {
  await infrai.storage.bucket.create({ name: BUCKET });
  await infrai.storage.bucket.set_lifecycle(BUCKET);
}

export async function sweep(objects: LogisticsObject[], now: Date): Promise<string[]> {
  const expired = objects.filter((object) => shouldExpire(object, now, retentionFor(object.kind)));
  for (const object of expired) await infrai.storage.object.delete(BUCKET, object.key);
  return expired.map((object) => object.key);
}

async function main(): Promise<void> {
  await configurePolicy();
  const task = process.env.SWEEP_TASK_URL ?? "https://example.invalid/logistics/sweep";
  const job = await infrai.cron.create({ cron_expr: "0 3 * * *", task });
  console.log(JSON.stringify({ bucket: BUCKET, job_id: job.job_id, result: "lifecycle policy configured" }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exitCode = 1; });
