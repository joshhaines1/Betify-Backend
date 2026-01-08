import express from "express";
import cors from "cors";
import groupsRoutes from "./routes/groups.js";
import wagersRoutes from "./routes/wagers.js";
import eventsRoutes from "./routes/events.js";
import usersRoutes from "./routes/users.js";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/groups", groupsRoutes);
app.use("/wagers", wagersRoutes);
app.use("/events", eventsRoutes);
app.use("/users", usersRoutes)

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
