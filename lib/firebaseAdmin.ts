import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || "restok-build";
const hasServiceAccount =
  Boolean(process.env.FIREBASE_PROJECT_ID) &&
  Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(process.env.FIREBASE_PRIVATE_KEY);

const app =
  getApps().length === 0
    ? initializeApp(
        hasServiceAccount
          ? {
              credential: cert({
                projectId,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                  /\\n/g,
                  "\n"
                ),
              }),
              projectId,
            }
          : {
              projectId,
            }
      )
    : getApps()[0];

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
