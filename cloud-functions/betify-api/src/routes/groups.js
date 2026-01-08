import express from "express";
import { getGroups, getGroupById, createGroup, getEventsByGroup, joinGroup, leaveGroup, getUserCurrencyByGroupId } from "../controllers/groupsController.js";

const router = express.Router();

// Get all groups
router.get("/", getGroups); // Done - groups-service -> getAllGroups

// Get a specific group by ID
router.get("/:groupId", getGroupById); // Done - groups-service -> getGroupById

// Create a new group
router.post("/", createGroup); // Done - groups-service -> createGroup

// Join an existing group
router.post("/:groupId/join", joinGroup); // Done - groups-service -> joinGroup

// Leave an existing group
router.post("/:groupId/leave", leaveGroup); // Done - groups-service -> leaveGroup

// Get events for a specific group
router.get("/:groupId/events", getEventsByGroup); // Done - events-service -> getEventsByGroup

// Get a users balance for a specific group
router.get("/:groupId/members/:userId/balance", getUserCurrencyByGroupId);


export default router;
