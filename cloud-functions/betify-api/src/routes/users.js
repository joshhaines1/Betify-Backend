import express from "express";
import { getUsers, getUserById, getWagersByUser, getUsersGroups } from "../controllers/usersController.js";

const router = express.Router();

// Get all users
router.get("/", getUsers);

// Get a specific user by ID
router.get("/:userId", getUserById);

// Get groups for a specific user
router.get("/:userId/groups", getUsersGroups); // Done - groups-service -> getUsersGroups

// Get wagers for a specific user
router.get("/:userId/wagers", getWagersByUser); // Done - wagers-service -> getWagersByUser


export default router;
