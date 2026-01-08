import { db, admin} from "../config/firebase.js";

export const createEvent = async (req, res) => {
  try {
    const {
      groupId,
      type,
      options
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

    const eventData = {
      id: eventRef.id,
      groupId,
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
