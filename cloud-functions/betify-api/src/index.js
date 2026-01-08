import express from "express";
import cors from "cors";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import groupsRoutes from "./routes/groups.js";
import wagersRoutes from "./routes/wagers.js";
import eventsRoutes from "./routes/events.js";
import usersRoutes from "./routes/users.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // higher since it's per-user now
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
});


app.use(authMiddleware);
app.use(limiter);
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl || req.url}`);
  next();
});

// Routes
app.use("/groups", groupsRoutes);
app.use("/wagers", wagersRoutes);
app.use("/events", eventsRoutes);
app.use("/users", usersRoutes);

app.get("/", (req, res) => {
  res.send("Betify API is running");
});

// Export the Express app for Cloud Functions
export default app;

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}
