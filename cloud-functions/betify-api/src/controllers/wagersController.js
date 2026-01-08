import { db } from "../config/firebase.js";

export const placeWager = async (req, res) => {
  try {
    const {
      groupId,
      picks,
      eventIds,
      odds,
      multiplier,
      risk,
      payout
    } = req.body;

    const userId = req.user.uid; // pulled from auth middleware

    if (!groupId || !userId || !picks || !Array.isArray(picks)) {
      return res.status(400).json({ message: "Missing required wager fields." });
    }

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ message: "Event IDs missing." });
    }

    // Verify group
    const groupRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Verify member
    const memberRef = groupRef.collection("members").doc(userId);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).json({ message: "User is not a member of this group." });
    }

    const currentBalance = memberSnap.data()?.balance ?? 0;

    if (currentBalance < risk) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    // Create wager
    const wagerRef = db.collection("wagers").doc();
    const wagerId = wagerRef.id;

    await wagerRef.set({
      id: wagerId,
      groupId,
      groupName: groupSnap.data()?.name || "Unnamed Group",
      userId,
      eventIds,
      odds,
      multiplier,
      risk,
      payout,
      picks,
      status: "active",
      date: new Date(),
    });

    // Update user balance
    await memberRef.update({
      balance: currentBalance - risk,
    });

    res.json({
      message: "Wager placed successfully.",
      wagerId,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};