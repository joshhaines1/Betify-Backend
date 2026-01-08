import express from "express";
import { placeWager } from "../controllers/wagersController.js";

const router = express.Router();

// Place a new wager 
router.post("/", placeWager); // Done - wagers-service -> placeWager

export default router;
