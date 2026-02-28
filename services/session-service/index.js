import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
// Using port 3002 so it doesn't clash with the Gateway API or the Canvas WebSocket
const PORT = process.env.PORT || 3002; 

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin using your downloaded key
try {
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase initialized successfully");
} catch (error) {
    console.error("❌ Firebase initialization failed. Is serviceAccountKey.json in the folder?", error.message);
}

const db = admin.firestore();

// SAVE ENDPOINT: Receives canvas data and saves it to Firestore
app.post('/api/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id; 
        const canvasData = req.body.canvasData; 

        if (!canvasData) {
            return res.status(400).json({ error: "Missing canvasData in request body" });
        }

        await db.collection('sessions').doc(sessionId).set({
            canvasData,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: `Session ${sessionId} saved successfully!` });
    } catch (error) {
        console.error("Save error:", error);
        res.status(500).json({ error: "Failed to save session to Firestore" });
    }
});

// LOAD ENDPOINT: Retrieves saved canvas data
app.get('/api/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const doc = await db.collection('sessions').doc(sessionId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Session not found" });
        }

        res.json({ success: true, data: doc.data() });
    } catch (error) {
        console.error("Load error:", error);
        res.status(500).json({ error: "Failed to load session from Firestore" });
    }
});

app.listen(PORT, () => {
    console.log(`💾 Session Service running on http://localhost:${PORT}`);
});