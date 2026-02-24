import { db, admin} from "../config/firebase.js";

export const createEvent = async (req, res) => {
  try {
    const {
      groupId,
      type,
      options,
      lockDate
    } = req.body;
    
    // ---- Validation ----
    if (!groupId || !type || Object.keys(options).length === 0) {
      return res.status(400).json({
        message: "Missing required event fields."
      });
    }

    // ---- Verify group exists ----
    const groupRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    // ---- Create event ----
    const eventRef = db.collection("events").doc();

    // Determine lockDate from input or default to 1 hour from now
    let eventLockDate = null;
    if (lockDate) {
      const parsedDate = new Date(lockDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid lockDate format." });
      }
      eventLockDate = admin.firestore.Timestamp.fromDate(parsedDate);
    } else {
      const defaultLock = new Date();
      defaultLock.setHours(defaultLock.getHours() + 1);
      eventLockDate = admin.firestore.Timestamp.fromDate(defaultLock);
    }
    const eventData = {
      id: eventRef.id,
      groupId,
      lockDate: eventLockDate,
      groupName: groupSnap.data()?.name || "Unnamed Group",
      type, // Basic, Prop, etc.
      options, // Array of betting options
      status: "open",
      results: [],
      acceptingWagers: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await eventRef.set(eventData);

    return res.status(201).json({
      message: "Event created successfully.",
      eventId: eventRef.id
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Failed to create event."
    });
  }
};


export const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const {
      status,
      results,
      acceptingWagers,
    } = req.body;

    const eventRef = db.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return res.status(404).json({ message: "Event not found." });
    }

    const previousStatus = eventSnap.data().status;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (results !== undefined) {
      if (!Array.isArray(results)) return res.status(400).json({ message: "Results must be an array." });
      updateData.results = results;
    }
    if (acceptingWagers !== undefined) updateData.acceptingWagers = !!acceptingWagers;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields provided to update." });
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await eventRef.update(updateData);

    const updatedSnap = await eventRef.get();

    // If status changed to "settled", automatically process settlements
    if (status === "settled" && previousStatus !== "settled") {
      console.log(`Event ${eventId} marked as settled. Processing wager settlements...`);
      
      try {
        const settlementResult = await settleEvent(eventId);
        
        return res.json({
          message: "Event updated and settled successfully.",
          event: { id: updatedSnap.id, ...updatedSnap.data() },
          settlement: settlementResult
        });
      } catch (settlementErr) {
        console.error("Error processing settlement:", settlementErr);
        return res.status(207).json({
          message: "Event updated but settlement processing failed.",
          event: { id: updatedSnap.id, ...updatedSnap.data() },
          error: settlementErr.message
        });
      }
    }

    return res.json({
      message: "Event updated successfully.",
      event: { id: updatedSnap.id, ...updatedSnap.data() },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update event." });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;

    const eventRef = db.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return res.status(404).json({ message: "Event not found." });
    }

    await eventRef.delete();

    res.json({
      message: "Event deleted successfully.",
      eventId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const settleEvent = async (eventId) => {
  console.log("Starting settle_event function for eventId:", eventId);

  // Fetch the event
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();

  if (!eventSnap.exists) {
    throw new Error("Event not found.");
  }

  const eventData = eventSnap.data();
  
  // Validate event is settled and has results
  if (eventData.status !== "settled") {
    throw new Error("Event must have status 'settled' to process payouts.");
  }

  const outcome = eventData.results;
  if (!outcome || outcome.length === 0) {
    throw new Error("No results found on settled event.");
  }

  console.log(`Settled Event ID: ${eventId} with outcome:`, outcome);

  // Fetch all wagers that include this event
  const wagersSnapshot = await db.collection("wagers")
    .where("eventIds", "array-contains", eventId)
    .get();

  if (wagersSnapshot.empty) {
    console.log("No wagers found for this event.");
    return { message: "Event settled. No wagers to process.", processed: 0 };
  }

  const batch = db.batch();
  let processedCount = 0;

  for (const wagerDoc of wagersSnapshot.docs) {
    const wager = wagerDoc.data();
    const picks = wager.picks || [];

    if (picks.length === 0) {
      console.log(`Skipping wager ${wagerDoc.id} — no picks.`);
      continue;
    }

    // Find pick for this event
    const matchingPick = picks.find(pick => pick.eventId === eventId);

    if (!matchingPick) {
      console.log(`Skipping wager ${wagerDoc.id} — no matching pick for this event.`);
      continue;
    }

    const betType = eventData.type;
    const selectedOutcome = matchingPick[eventId];

    // Check if pick is correct
    const isCorrect = betType === "MSO" 
      ? outcome.includes(selectedOutcome)
      : outcome[0] === selectedOutcome;

    if (!isCorrect) {
      console.log(`Wager ${wagerDoc.id} lost — pick outcome ${selectedOutcome} != ${outcome}`);

      // Mark wager as settled (lost)
      batch.update(wagerDoc.ref, {
        status: "settled",
        payout: 0
      });

      processedCount++;
      continue; // No need to check other picks — one wrong loses parlay
    }

    console.log(`Wager ${wagerDoc.id} has a correct pick for this event. Checking remaining picks...`);

    // Check if all picks are correct and all their events are settled
    let allPicksCorrect = true;

    for (const pick of picks) {
      const pickEventId = pick.eventId;
      const expectedOutcome = pick[pickEventId];

      if (!pickEventId || !expectedOutcome) {
        console.log(`Incomplete pick data in wager ${wagerDoc.id}, skipping pick.`);
        allPicksCorrect = false;
        break;
      }

      const pickEventDoc = await db.collection("events").doc(pickEventId).get();
      if (!pickEventDoc.exists) {
        console.log(`Event ${pickEventId} not found.`);
        allPicksCorrect = false;
        break;
      }

      const pickEventData = pickEventDoc.data();
      if (pickEventData.status !== "settled") {
        console.log(`Event ${pickEventId} not yet settled.`);
        allPicksCorrect = false;
        break;
      }
    }

    if (allPicksCorrect) {
      console.log(`Wager ${wagerDoc.id} is a winner.`);

      const amount = wager.risk || 0;
      const multiplier = wager.multiplier || 1;
      const winnings = Math.floor(amount * multiplier);

      // Update user balance in group members subcollection
      const groupRef = db.collection("groups").doc(wager.groupId);
      const userRef = groupRef.collection("members").doc(wager.userId);

      batch.update(userRef, {
        balance: admin.firestore.FieldValue.increment(winnings)
      });

      batch.update(wagerDoc.ref, {
        status: "settled",
        payout: winnings
      });

      processedCount++;
    } else {
      console.log(`Wager ${wagerDoc.id} not fully settled or correct — waiting on other events.`);
    }
  }

  await batch.commit();
  console.log("Finished processing all wagers.");

  return {
    message: "Event settled and wagers processed.",
    eventId,
    wagersProcessed: processedCount
  };
};

export const deleteAllEvents = async (req, res) => {
  try {
    const eventsSnapshot = await db.collection("events").get();

    const batch = db.batch();
    eventsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ message: "All events deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
