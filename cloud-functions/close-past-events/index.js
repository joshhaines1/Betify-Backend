import { admin, db } from "../betify-api/src/config/firebase.js";

const closePastEvents = async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collectionGroup("events")
      .where("status", "==", "open")
      .where("lockDate", "<=", now)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: "closed",
        acceptingWagers: false,
      });
    });

    await batch.commit();
  };

export default closePastEvents;
