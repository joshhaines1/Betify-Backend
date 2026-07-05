import { db, admin} from "../config/firebase.js";

export const getUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const userId = req.params.userId;
    const doc = await db.collection("users").doc(userId).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUsersGroups = async (req, res) => {
  try {
    const uid = req.user.uid; // Make sure auth middleware sets req.user
    const limit = parseInt(req.query.limit) || 5;
    const startAfterId = req.query.startAfter || null;

    let queryRef = db
      .collection("groups")
      .where("members", "array-contains", uid)
      .orderBy("creationDate", "desc");

    if (startAfterId) {
      const startDoc = await db.collection("groups").doc(startAfterId).get();

      if (startDoc.exists) {
        queryRef = queryRef.startAfter(startDoc);
      }
    }

    const snapshot = await queryRef.limit(limit).get();

    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    res.json({
      groups,
      lastVisible: lastDoc ? lastDoc.id : null,
    });
  } catch (err) {
    console.error("Error fetching user's groups:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getWagersByUser = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status, lastVisible } = req.query;

    let query = db
      .collection("wagers")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .limit(5);

    // Optional status filter
    if (status) {
      query = query.where("status", "==", status);
    }

    // Pagination (cursor)
    if (lastVisible) {
      query = query.startAfter(new Date(Number(lastVisible)));
    }

    const wagersSnap = await query.get();

    const wagers = wagersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const lastDoc = wagersSnap.docs[wagersSnap.docs.length - 1];
    const lastDate = lastDoc?.get("date");

    res.json({
      wagers,
      nextCursor: lastDate ? lastDate.toMillis?.() || lastDate.getTime() : null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

