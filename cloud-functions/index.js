import { onRequest } from "firebase-functions/v2/https";
import api from "./betify-api/src/index.js";
import closePastEvents from "./close-past-events/index.js";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Cloud Functions 2nd gen HTTP REST API
export const betify_api = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 100,
  },
  api
);

export const close_past_events = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 1,
  },
  closePastEvents
);