import "dotenv/config";

import cors from "cors";
import express from "express";
import mongoose from "mongoose";

import type { ServerRoutesDeps } from "./modules/deps";
import { registerCreateRunRoute } from "./modules/runs/use-cases/create-run";
import { registerGetRunRoute } from "./modules/runs/use-cases/get-run";
import { registerStreamRunLogsSseRoute } from "./modules/runs/use-cases/stream-run-logs-sse";
import { registerCreateStageRoute } from "./modules/sessions/use-cases/create-stage";
import { registerCreateStageModelResponseRoute } from "./modules/sessions/use-cases/create-stage-model-response";
import { registerCreateStageToolCallsRoute } from "./modules/sessions/use-cases/create-stage-tool-calls";
import { registerFinalizeSessionRoute } from "./modules/sessions/use-cases/finalize-session";
import { registerGetSessionRoute } from "./modules/sessions/use-cases/get-session";
import { registerHardDeleteSessionRoute } from "./modules/sessions/use-cases/hard-delete-session";
import { registerListSessionsRoute } from "./modules/sessions/use-cases/list-sessions";
import { registerPatchStageRuntimeSnapshotRoute } from "./modules/sessions/use-cases/patch-stage-runtime-snapshot";
import { registerRegisterSessionRoute } from "./modules/sessions/use-cases/register-session";
import { registerRerunRequestRoute } from "./modules/sessions/use-cases/rerun-request";
import { registerSoftDeleteSessionRoute } from "./modules/sessions/use-cases/soft-delete-session";
import { registerStreamSessionSseRoute } from "./modules/sessions/use-cases/stream-session-sse";
import { registerStreamSessionsSseRoute } from "./modules/sessions/use-cases/stream-sessions-sse";
import { registerGetHealthRoute } from "./modules/system/use-cases/get-health";
import { registerListTasksRoute } from "./modules/tasks/use-cases/list-tasks";
import { createRunManager } from "./run-manager";

const app = express();

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yahl";

const runManager = createRunManager();

const deps: ServerRoutesDeps = { runManager };

app.use(cors());
app.use(express.json({ limit: "50mb" }));

registerGetHealthRoute(app);
registerListTasksRoute(app, deps);
registerCreateRunRoute(app, deps);
registerGetRunRoute(app, deps);
registerStreamRunLogsSseRoute(app, deps);
registerRegisterSessionRoute(app);
registerRerunRequestRoute(app, deps);
registerCreateStageRoute(app);
registerCreateStageToolCallsRoute(app);
registerCreateStageModelResponseRoute(app);
registerPatchStageRuntimeSnapshotRoute(app);
registerFinalizeSessionRoute(app);
registerStreamSessionSseRoute(app);
registerStreamSessionsSseRoute(app);
registerListSessionsRoute(app);
registerGetSessionRoute(app);
registerSoftDeleteSessionRoute(app);
registerHardDeleteSessionRoute(app);

const start = async () => {
  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    process.stdout.write(`[server] listening on ${port}\n`);
  });
};

start().catch((error: unknown) => {
  console.error(`[server] failed to boot: ${String(error)}\n`);
  process.exit(1);
});
