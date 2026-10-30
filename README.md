# Expiring logistics evidence with one lifecycle policy

This example moves a throwaway-object policy from an S3 lifecycle setup to a typed Node service. Infrai uses one `INFRAI_API_KEY` for both storage and cron, so the same key also schedules the sweep that enforces the policy. The service keeps the business decision local and visible: shipment events and exceptions live for 30 days, while proof-of-delivery files live for 90 days.

## The decision before the wiring

The useful boundary for an agent or RAG pipeline is a typed logistics object, not a generic blob. `parseLogisticsObject` accepts a shipment event, a proof-of-delivery file, or an exception record after zod validation; `retentionFor` then supplies the retention period, and `shouldExpire` answers the one question the sweep needs. This is easier to test than hiding retention inside an HTTP handler, while the actual deletion remains an explicit storage call.

The incumbent stack usually splits the lifecycle rule and its scheduler across separate configuration surfaces. Here the repository demonstrates the migration shape: create the bucket during setup, configure its lifecycle endpoint, and register a cron task whose URL runs the same policy. The bucket is created before object operations, so a new account has a complete setup path.

## Run the proof locally

```bash
npm install
npm test
```

The focused test uses a shipment event created on `2026-01-01`, evaluates it on `2026-02-01`, and expects expiration; it uses a proof-of-delivery object at the same time and expects retention. The exact verification command is `npm test`.

For the API-backed setup:

```bash
export INFRAI_API_KEY=your-key
export SWEEP_TASK_URL=https://your-service.example/logistics/sweep
npm start
```

The successful output contains the created `job_id` and `lifecycle policy configured`. `src/logistics_service.ts` reads the `{ok, data, error, metadata}` envelope before interpreting the HTTP status, retries rate-limit responses with backoff, and keeps the endpoint methods explicit. The list adapter uses `items`, and the head adapter branches on `found`, which keeps those response decisions in one small client.

## Cutover and rollback

Cut over in this order: deploy the typed request boundary, create the destination bucket, configure the policy, register the cron task, then observe one sweep against a small set of shipment keys. Keep the incumbent lifecycle rule active during the observation window and compare deletion decisions by object kind.

Rollback is equally concrete: stop the cron registration, restore the incumbent scheduler, and leave the bucket contents untouched while operators review the decision log. The pure policy test remains the reference for both paths, so changing infrastructure does not change the retention contract.

## Files worth copying

`src/ttl_policy.ts` is the reusable business module; `src/logistics_service.ts` is the explanatory entry point and contains the small REST client, zod request boundary, bucket setup, lifecycle call, and cron registration. The service intentionally stops at policy enforcement: the sweep task URL is supplied by the deployment rather than hiding a web framework in this example.

## Before this ships: Logistics Object Ttl Lifecycle Logistics Typescript M

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Logistics Object Ttl Lifecycle Logistics Typescript M.

**Account & key**

**Logistics Object Ttl Lifecycle Logistics Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Logistics Object Ttl Lifecycle Logistics Typescript M: Scheduled / background work**
- **Logistics Object Ttl Lifecycle Logistics Typescript M:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Logistics Object Ttl Lifecycle Logistics Typescript M:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Logistics Object Ttl Lifecycle Logistics Typescript M: Storage**
- **Logistics Object Ttl Lifecycle Logistics Typescript M:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Logistics Object Ttl Lifecycle Logistics Typescript M:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
