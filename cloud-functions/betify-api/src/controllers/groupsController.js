import { db, admin} from "../config/firebase.js";

export const getGroups = async (req, res) => {
  try {
    const uid = req.user.uid;
    const limit = parseInt(req.query.limit) || 5;
    const startAfterId = req.query.startAfter || null;

    let queryRef = db
      .collection("groups")
      .where("visibility", "==", "Public")
      .orderBy("creationDate", "desc");

    if (startAfterId) {
      const startDoc = await db.collection("groups").doc(startAfterId).get();

      if (startDoc.exists) {
        queryRef = queryRef.startAfter(startDoc);
      }
    }

    let groups = [];
    let lastDoc = null;
    let currentQuery = queryRef;

    while (groups.length < limit) {
      const snapshot = await currentQuery.limit(limit).get();

      if (snapshot.empty) {
        console.log("No more groups found.");
        break;
      }

      let reachedLimit = false;

      for (const doc of snapshot.docs) {
        lastDoc = doc; // update on every doc actually examined

        const group = { id: doc.id, ...doc.data() };

        if (!group.members.includes(uid)) {
          groups.push(group);

          if (groups.length === limit) {
            reachedLimit = true;
            break;
          }
        }
      }

      if (reachedLimit) {
        break; // stop the outer loop too — we have enough
      }

      if (snapshot.size < limit) {
        break; // no more documents left
      }

      currentQuery = queryRef.startAfter(lastDoc);

    }

    res.json({
      groups,
      lastVisible: lastDoc ? lastDoc.id : null,
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
      creator: uid,
      creatorName: displayName,
      admins: [uid],
      members: [uid],
      creationDate: admin.firestore.Timestamp.now(),
      stats: {
        members: 1,
        memberNames: [displayName],
        totalBets: 0,
        totalWagered: 0,
        activeEvents: 0,
      }
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
      "stats.members": admin.firestore.FieldValue.increment(1),
      "stats.memberNames": admin.firestore.FieldValue.arrayUnion(displayName)
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
      "stats.members": admin.firestore.FieldValue.increment(-1),
      "stats.memberNames": admin.firestore.FieldValue.arrayRemove(req.user.name || "Unknown")
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
  return getGroupEvents(req, res, ["MSO", "basic", "single outcome event"]);
};

export const getPropsByGroup = async (req, res) => {
  return getGroupEvents(req, res, ["single outcome prop", "prop"]);
};


const getGroupEvents = async (req, res, allowedTypes) => {
  try {
    const uid = req.user.uid;

    const limit = Math.min(
      parseInt(req.query.limit) || 5,
      20
    );

    const startAfterId = req.query.startAfter || null;

    let queryRef = db
      .collection("events")
      .where("groupId", "==", req.params.groupId)
      .where("status", "in", ["open", "closed"])
      .where("type", "in", allowedTypes)
      .orderBy("createdAt", "desc");

    if (startAfterId) {
      const startDoc = await db
        .collection("events")
        .doc(startAfterId)
        .get();

      if (startDoc.exists) {
        queryRef = queryRef.startAfter(startDoc);
      }
    }


    const events = [];
    let lastDoc = null;

    let currentQuery = queryRef;


    while (events.length < limit) {
      const snapshot = await currentQuery
        .limit(limit)
        .get();


      if (snapshot.empty) {
        break;
      }


      let lastExaminedDoc = null;


      for (const doc of snapshot.docs) {
        lastExaminedDoc = doc;

        const event = {
          id: doc.id,
          ...doc.data(),
        };


        // Safely handle missing members
        const members = event.members ?? [];


        // Only return events user is NOT already in
        if (!members.includes(uid)) {
          events.push(event);

          if (events.length >= limit) {
            break;
          }
        }
      }


      // Important: pagination should continue after the last document examined
      if (lastExaminedDoc) {
        lastDoc = lastExaminedDoc;
      }


      if (events.length >= limit || snapshot.size < limit) {
        break;
      }


      currentQuery = queryRef.startAfter(lastDoc);
    }


    res.json({
      events,
      lastVisible: lastDoc ? lastDoc.id : null,
    });


  } catch (err) {
    console.error("Error fetching group events:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};


export const deleteAllGroups = async (req, res) => {
  try {
    const groupsSnapshot = await db.collection("groups").get();

    const batch = db.batch();
    groupsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ message: "All events deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getGroupLeaderboard = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({ message: "Missing groupId." });
    }

    const membersSnapshot = await db
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .orderBy("balance", "desc")
      .limit(10)
      .get();

    if (membersSnapshot.empty) {
      return res.status(404).json({ message: "No members found for this group." });
    }

    const leaderboard = membersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: data.id,
        displayName: data.displayName,
        balance: data.balance || 0,
      };
    });

    // Sort by balance descending
    leaderboard.sort((a, b) => b.balance - a.balance);

    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error("Error fetching group leaderboard:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const addRewardedCurrency = async (req, res) => {
  try {
    const { groupId } = req.params;
    const uid = req.user.uid;

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();
    if (!groupSnap.exists) return res.status(404).json({ message: "Group not found." });

    const startingCurrency = groupSnap.data()?.startingCurrency || 0;
    const rewardAmount = Math.round(startingCurrency * 0.075);

    const memberRef = groupDocRef.collection("members").doc(uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return res.status(404).json({ message: "Member not found." });

    const currentBalance = memberSnap.data()?.balance ?? 0;

    // Only allow the reward if balance is actually at/below the reward amount (i.e., depleted)
    if (currentBalance > rewardAmount) {
      return res.status(400).json({ message: "Balance must be depleted to claim a reward." });
    }

    const newBalance = currentBalance + rewardAmount;
    await memberRef.update({ balance: newBalance });

    return res.status(200).json({ balance: newBalance });
  } catch (err) {
    console.error("Error granting rewarded currency:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const uid = req.user.uid;

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: "Group not found." });
    }

    const groupData = groupSnap.data();

    // Check if the user is an admin of the group
    if (!groupData.admins.includes(uid)) {
      return res.status(403).json({ message: "User is not an admin of this group." });
    }

    // Delete all members in the subcollection
    const membersSnapshot = await groupDocRef.collection("members").get();
    const batch = db.batch();
    membersSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the group document
    batch.delete(groupDocRef);

    await batch.commit();

    return res.status(200).json({ message: "Group deleted successfully." });
  } catch (err) {
    console.error("Error deleting group:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const addGroupAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body; // uid of the member to promote
    const requesterUid = req.user.uid;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "Missing groupId or userId." });
    }

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();

    if (!groupSnap.exists) return res.status(404).json({ message: "Group not found." });

    const groupData = groupSnap.data();

    // Only current admins can promote someone else
    if (!groupData.admins.includes(requesterUid)) {
      return res.status(403).json({ message: "Only admins can add other admins." });
    }

    // Target must be a member of the group
    if (!groupData.members.includes(userId)) {
      return res.status(400).json({ message: "User must be a member of the group to become an admin." });
    }

    if (groupData.admins.includes(userId)) {
      return res.status(200).json({ message: "User is already an admin." });
    }

    await groupDocRef.update({
      admins: admin.firestore.FieldValue.arrayUnion(userId),
    });

    return res.status(200).json({ message: "Admin added successfully." });
  } catch (err) {
    console.error("Error adding group admin:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const removeGroupAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body; // uid of the admin to demote
    const requesterUid = req.user.uid;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "Missing groupId or userId." });
    }

    const groupDocRef = db.collection("groups").doc(groupId);
    const groupSnap = await groupDocRef.get();

    if (!groupSnap.exists) return res.status(404).json({ message: "Group not found." });

    const groupData = groupSnap.data();

    // Only current admins can demote another admin
    if (!groupData.admins.includes(requesterUid)) {
      return res.status(403).json({ message: "Only admins can remove other admins." });
    }

    if (!groupData.admins.includes(userId)) {
      return res.status(200).json({ message: "User is already not an admin." });
    }

    // Prevent removing the last remaining admin
    if (groupData.admins.length <= 1) {
      return res.status(400).json({ message: "Cannot remove the last admin of a group." });
    }

    // Prevent removing the group creator's admin status
    if (groupData.creator === userId) {
      return res.status(403).json({ message: "Cannot remove the group creator's admin status." });
    }

    await groupDocRef.update({
      admins: admin.firestore.FieldValue.arrayRemove(userId),
    });

    return res.status(200).json({ message: "Admin removed successfully." });
  } catch (err) {
    console.error("Error removing group admin:", err);
    return res.status(500).json({ error: err.message });
  }
};