import express from "express";
import { placeWager } from "../controllers/wagersController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Place a new wager 
router.post("/", authMiddleware, placeWager); // Done - wagers-service -> placeWager

export default router;
