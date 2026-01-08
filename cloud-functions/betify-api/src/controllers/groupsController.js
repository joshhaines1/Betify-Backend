import { db, admin} from "../config/firebase.js";

export const getGroups = async (req, res) => {
  try {
    const uid = req.user?.uid; // from auth middleware
    const limit = parseInt(req.query.limit) || 0; // default limit
    const startAfterId = req.query.startAfter || null; // optional cursor

    let queryRef = db.collection("groups");
    
    // Handle pagination with startAfter
    if (startAfterId) {
      const startDoc = await db.collection("groups").doc(startAfterId).get();
      if (startDoc.exists) {
        queryRef = queryRef.startAfter(startDoc);
      }
    }

    // Limit of 0 fetches ALL groups
    if (limit > 0){
      queryRef = queryRef.limit(limit);
    }
    

    const snapshot = await queryRef.get();
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      groups,
      lastVisible: snapshot.docs[snapshot.docs.length - 1]?.id || null,
    });
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const doc = await db.collection("groups").doc(req.params.groupId).get();
    if (!doc.exists) return res.status(404).json({ message: "Group not found." });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createGroup = async (req, res) => {
  try {
    const { name, visibility, startingCurrency, password } = req.body;

    // Logged-in Firebase user
    const uid = req.user.uid;
    const displayName = req.user.name || "Unknown";

    if (!name || !visibility || startingCurrency == null) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Step 1: Create group document with auto ID
    const groupRef = db.collection("groups").doc();
    const groupId = groupRef.id;

    const groupData = {
      name,
      visibility,
      startingCurrency,
      password: password || "",
      creator: req.user.name,
      admins: [uid],
      members: [uid],
      creationDate: admin.firestore.Timestamp.now(),
    };

    await groupRef.set(groupData);

    // Step 2: Add member to subcollection
    const memberRef = groupRef.collection("members").doc(uid);

    await memberRef.set({
      id: uid,
      displayName,
      joinedAt: admin.firestore.Timestamp.now(),
      balance: startingCurrency,
    });

    return res.status(201).json({
      id: groupId,
      ...groupData,
    });

  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ error: err.message });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const uid = req.user.uid;
    const displayName = req.user.name || "Unknown";
    const { groupId } = req.params;

    if (!groupId) return res.status(400).json({ message: "Missing groupId." });

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();

    if (!groupSnap.exists) return res.status(404).json({ message: "Group not found." });

    const groupData = groupSnap.data();

    // Prevent joining twice
    if (groupData.members.includes(uid)) {
      return res.status(400).json({ message: "User already a member of this group." });
    }

    // Step 1: Add user to members array
    await groupDocRef.update({
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    // Step 2: Add user to members subcollection
    const memberRef = groupDocRef.collection("members").doc(uid);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      await memberRef.set({
        id: uid,
        displayName,
        joinedAt: admin.firestore.Timestamp.now(),
        balance: groupData.startingCurrency || 0,
      });
    }

    return res.status(200).json({ message: "Joined group successfully." });
  } catch (err) {
    console.error("Error joining group:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { groupId } = req.params;

    if (!groupId) return res.status(400).json({ message: "Missing groupId." });

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();

    if (!groupSnap.exists) return res.status(404).json({ message: "Group not found." });

    const groupData = groupSnap.data();

    // Prevent leaving if not a member
    if (!groupData.members.includes(uid)) {
      return res.status(400).json({ message: "User is not a member of this group." });
    }

    // Step 1: Remove user from members array
    await groupDocRef.update({
      members: admin.firestore.FieldValue.arrayRemove(uid),
    });

    // Step 2: Remove user from members subcollection
    const memberRef = groupDocRef.collection("members").doc(uid);
    await memberRef.delete();

    return res.status(200).json({ message: "Left group successfully." });
  } catch (err) {
    console.error("Error leaving group:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getUserCurrencyByGroupId = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "Missing groupId or userId." });
    }

    const memberRef = db.collection("groups").doc(groupId).collection("members").doc(userId);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).json({ message: "Member not found in this group." });
    }

    const memberData = memberSnap.data();

    return res.status(200).json({ balance: memberData.balance || 0 });
  } catch (err) {
    console.error("Error fetching user currency by group ID:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const getEventsByGroup = async (req, res) => {
  try {
    const snapshot = await db
      .collection("events")
      .where("groupId", "==", req.params.groupId)
      .where("acceptingWagers", "==", true)
      .get();

    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};