import express from "express";
import { getGroups, getGroupById, createGroup, getEventsByGroup, joinGroup, leaveGroup, getUserCurrencyByGroupId } from "../controllers/groupsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all groups
router.get("/", authMiddleware, getGroups); // Done - groups-service -> getAllGroups

// Get a specific group by ID
router.get("/:groupId", authMiddleware, getGroupById); // Done - groups-service -> getGroupById

// Create a new group
router.post("/", authMiddleware, createGroup); // Done - groups-service -> createGroup

// Join an existing group
router.post("/:groupId/join", authMiddleware, joinGroup); // Done - groups-service -> joinGroup

// Leave an existing group
router.post("/:groupId/leave", authMiddleware, leaveGroup); // Done - groups-service -> leaveGroup

// Get events for a specific group
router.get("/:groupId/events", authMiddleware, getEventsByGroup); // Done - events-service -> getEventsByGroup

// Get a users balance for a specific group
router.get("/:groupId/members/:userId/balance", authMiddleware, getUserCurrencyByGroupId);


export default router;
