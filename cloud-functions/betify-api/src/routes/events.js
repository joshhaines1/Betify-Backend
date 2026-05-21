import express from "express";
import { createEvent, updateEvent, deleteEvent, getEventById } from "../controllers/eventsController.js";

const router = express.Router();

// Create a new event 
router.post("/", createEvent); // Done - events-service -> createEvent

// Update an event 
router.patch("/:eventId", updateEvent); // Done - events-service -> updateEvent

// Delete an event 
router.delete("/:eventId", deleteEvent); // Done - events-service -> deleteEvent

// Get a specific event by ID
router.get("/:eventId", getEventById); // Done - events-service -> getEventById

export default router;
