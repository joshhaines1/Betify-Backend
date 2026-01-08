import express from "express";
import { getUsers, getUserById, getWagersByUser, getUsersGroups } from "../controllers/usersController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all users
router.get("/", authMiddleware, getUsers);

// Get a specific user by ID
router.get("/:userId", authMiddleware, getUserById);

// Get groups for a specific user
router.get("/:userId/groups", authMiddleware, getUsersGroups); // Done - groups-service -> getUsersGroups

// Get wagers for a specific user
router.get("/:userId/wagers", authMiddleware, getWagersByUser); // Done - wagers-service -> getWagersByUser


export default router;
