import { onRequest } from "firebase-functions/v2/https";
import app from "./betify-api/src/index.js";

// Cloud Functions 2nd gen HTTP function
export const betify_api = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 100,
  },
  app
);
