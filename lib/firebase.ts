import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      !String(firebaseConfig.apiKey).includes("your-")
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

/** Map Agent ID → synthetic email for Firebase Email/Password */
export function agentIdToEmail(agentId: string): string {
  const clean = agentId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean || "agent"}@payflow.agent`;
}

export async function firebaseLoginWithAgent(
  agentId: string,
  passcode: string
): Promise<{ user: User; idToken: string }> {
  const authInst = getFirebaseAuth();
  if (!authInst) throw new Error("Firebase is not configured");

  const email = agentIdToEmail(agentId);
  try {
    const cred = await signInWithEmailAndPassword(authInst, email, passcode);
    const idToken = await cred.user.getIdToken();
    return { user: cred.user, idToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "";
    // Auto-provision agent account on first login (Email/Password must be enabled)
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      try {
        const created = await createUserWithEmailAndPassword(authInst, email, passcode);
        await updateProfile(created.user, { displayName: agentId.trim().toUpperCase() });
        const idToken = await created.user.getIdToken();
        return { user: created.user, idToken };
      } catch (createErr: unknown) {
        const createCode = (createErr as { code?: string })?.code || "";
        if (createCode === "auth/email-already-in-use") {
          const cred = await signInWithEmailAndPassword(authInst, email, passcode);
          return { user: cred.user, idToken: await cred.user.getIdToken() };
        }
        throw createErr;
      }
    }
    throw err;
  }
}

export async function firebaseLoginWithGoogle(): Promise<{ user: User; idToken: string }> {
  const authInst = getFirebaseAuth();
  if (!authInst) throw new Error("Firebase is not configured");
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(authInst, provider);
  return { user: cred.user, idToken: await cred.user.getIdToken() };
}

export async function firebaseLogout(): Promise<void> {
  const authInst = getFirebaseAuth();
  if (authInst) await signOut(authInst);
}
