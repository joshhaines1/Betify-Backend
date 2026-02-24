import express from "express";
import cors from "cors";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import groupsRoutes from "./routes/groups.js";
import wagersRoutes from "./routes/wagers.js";
import eventsRoutes from "./routes/events.js";
import usersRoutes from "./routes/users.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

const api = express();

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // higher since it's per-user now
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
});


api.use(authMiddleware);
api.use(limiter);
api.use(cors());
api.use(express.json());

// Request logging middleware
api.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl || req.url}`);
  next();
});

// Routes
api.use("/groups", groupsRoutes);
api.use("/wagers", wagersRoutes);
api.use("/events", eventsRoutes);
api.use("/users", usersRoutes);

api.get("/", (req, res) => {
  res.send("Betify API is running");
});

// Export the Express api for Cloud Functions
export default api;

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  api.listen(PORT, () => console.log(`API running on port ${PORT}`));
}
