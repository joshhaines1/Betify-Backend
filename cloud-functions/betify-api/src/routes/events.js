import express from "express";
import { createEvent, updateEvent, deleteEvent } from "../controllers/eventsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new event 
router.post("/", authMiddleware, createEvent); // Done - events-service -> createEvent

// Update an event 
router.patch("/:eventId", authMiddleware, updateEvent); // Done - events-service -> updateEvent

// Delete an event 
router.delete("/:eventId", authMiddleware, deleteEvent); // Done - events-service -> deleteEvent

export default router;
