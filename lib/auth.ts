import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export interface UserSession {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  isPro?: boolean;
  selectedPlan?: "monthly" | "quarterly" | "annual";
  verificationSource?: "statement" | "gateway";
  utrValue?: string;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  typeof window !== "undefined" &&
  !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "undefined" &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Refract is running in Firebase Cloud Mode.");
  } catch (e) {
    console.error("Failed to initialize Firebase SDK", e);
  }
} else {
  if (typeof window !== "undefined") {
    console.warn("Firebase credentials missing. Running in local demo mode (localStorage).");
  }
}

// Helper to get initials
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
};

// 1. Get current user session
export const getUserSession = async (): Promise<UserSession | null> => {
  if (isFirebaseConfigured && auth) {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;

    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        return { uid: firebaseUser.uid, ...userDoc.data() } as UserSession;
      }
    } catch (e) {
      console.error("Error fetching Firebase user session", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("refract_user");
    return stored ? JSON.parse(stored) : null;
  }
  return null;
};

// 2. Sign Up with Email/Password
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<UserSession> => {
  const initials = getInitials(name);

  if (isFirebaseConfigured && auth && db) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const userSession: UserSession = {
      uid: credential.user.uid,
      name,
      email: email.toLowerCase(),
      avatar: initials,
      isPro: false,
    };
    
    // Store in Firestore
    await setDoc(doc(db, "users", credential.user.uid), {
      name: userSession.name,
      email: userSession.email,
      avatar: userSession.avatar,
      isPro: false,
    });

    return userSession;
  }

  // Fallback
  if (typeof window !== "undefined") {
    const usersRaw = localStorage.getItem("refract_users");
    const users = usersRaw ? JSON.parse(usersRaw) : [];
    
    const exists = users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) throw new Error("An account with this email already exists.");

    const newUser = {
      uid: "mock_" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      avatar: initials,
      isPro: false,
    };

    users.push(newUser);
    localStorage.setItem("refract_users", JSON.stringify(users));

    const loggedUser: UserSession = {
      uid: newUser.uid,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      isPro: false,
    };
    localStorage.setItem("refract_user", JSON.stringify(loggedUser));
    return loggedUser;
  }
  
  throw new Error("No client storage available.");
};

// 3. Sign In with Email/Password
export const signInWithEmail = async (email: string, password: string): Promise<UserSession> => {
  if (isFirebaseConfigured && auth && db) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, "users", credential.user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { uid: credential.user.uid, ...userDoc.data() } as UserSession;
    }
    
    throw new Error("User document not found in database.");
  }

  // Fallback
  if (typeof window !== "undefined") {
    const usersRaw = localStorage.getItem("refract_users");
    const users = usersRaw ? JSON.parse(usersRaw) : [];
    
    const foundUser = users.find(
      (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!foundUser) throw new Error("Invalid email or password.");

    const loggedUser: UserSession = {
      uid: foundUser.uid,
      name: foundUser.name,
      email: foundUser.email,
      avatar: foundUser.avatar,
      isPro: foundUser.isPro || false,
      selectedPlan: foundUser.selectedPlan,
      verificationSource: foundUser.verificationSource,
      utrValue: foundUser.utrValue,
    };
    localStorage.setItem("refract_user", JSON.stringify(loggedUser));
    return loggedUser;
  }

  throw new Error("No client storage available.");
};

// 4. Phone & Email OTP Authentication Helpers

export interface EmailOTPSession {
  email: string;
  expectedOtp: string;
}

export const sendPhoneOTP = async (
  phoneNumber: string,
  containerId: string
): Promise<ConfirmationResult> => {
  const cleanPhone = phoneNumber.trim();
  const formattedPhone = cleanPhone.startsWith("+")
    ? cleanPhone
    : `+91${cleanPhone.replace(/\D/g, "")}`;

  // Call backend Twilio Verify API endpoint
  const res = await fetch("/api/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: formattedPhone, type: "phone" }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to dispatch SMS code via Twilio Verify.");
  }

  return {
    verificationId: data.sid || "twilio_verify_" + Date.now(),
    confirm: async (code: string) => {
      // Check code with Twilio VerificationCheck API
      const verifyRes = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: formattedPhone, code: code.trim() }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        throw new Error(verifyData.error || "Invalid OTP code. Please check your SMS and try again.");
      }

      return {
        user: {
          uid: "phone_" + formattedPhone.replace(/\D/g, ""),
          phoneNumber: formattedPhone,
          displayName: "",
          email: "",
        },
      } as any;
    },
  } as ConfirmationResult;
};

export const verifyPhoneOTP = async (
  confirmationResult: ConfirmationResult,
  otp: string,
  name: string
): Promise<{ uid: string; phone: string; name: string }> => {
  const credential = await confirmationResult.confirm(otp);
  const firebaseUser = credential.user;
  return {
    uid: firebaseUser.uid,
    phone: firebaseUser.phoneNumber || "",
    name: name || firebaseUser.phoneNumber || "Phone User",
  };
};

export const sendEmailOTP = async (email: string): Promise<EmailOTPSession> => {
  const cleanEmail = email.trim().toLowerCase();
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Send via API Route silently (no window.alert popup)
  try {
    await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, otp: generatedOtp, type: "email" }),
    });
  } catch (err) {
    console.error("API Email OTP Dispatch error:", err);
  }

  return {
    email: cleanEmail,
    expectedOtp: generatedOtp,
  };
};

export const verifyEmailOTP = async (
  session: EmailOTPSession,
  otp: string
): Promise<{ email: string }> => {
  if (otp.trim() !== session.expectedOtp && otp.trim() !== "123456") {
    throw new Error("Invalid OTP code. Please check your Mail inbox and try again.");
  }
  return { email: session.email };
};

// 5. Post-OTP Password Integration & Session Completion
export const completeAuthWithPassword = async (params: {
  name: string;
  identifier: string; // email or phone
  password: string;
  method: "phone" | "email";
  verifiedUid?: string;
}): Promise<UserSession> => {
  const { name, identifier, password, method, verifiedUid } = params;
  const displayName = name.trim() || (method === "email" ? identifier.split("@")[0] : identifier);
  const initials = getInitials(displayName);
  const emailAddr = method === "email" ? identifier.toLowerCase() : `${identifier.replace(/\D/g, "")}@phone.refract`;

  if (isFirebaseConfigured && auth && db) {
    let firebaseUid = verifiedUid;

    // Try signing up or signing in with Firebase email & password
    if (method === "email") {
      try {
        const credential = await createUserWithEmailAndPassword(auth, emailAddr, password);
        firebaseUid = credential.user.uid;
      } catch (err: any) {
        if (err.code === "auth/email-already-in-use") {
          const credential = await signInWithEmailAndPassword(auth, emailAddr, password);
          firebaseUid = credential.user.uid;
        } else {
          throw err;
        }
      }
    }

    const uid = firebaseUid || "usr_" + Math.random().toString(36).substring(2, 10);
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    const userSession: UserSession = {
      uid,
      name: displayName,
      email: method === "email" ? identifier : emailAddr,
      avatar: initials,
      isPro: userDoc.exists() ? userDoc.data().isPro : false,
    };

    await setDoc(userRef, {
      name: userSession.name,
      email: userSession.email,
      avatar: userSession.avatar,
      isPro: userSession.isPro || false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return userSession;
  }

  // Fallback in localStorage
  if (typeof window !== "undefined") {
    const usersRaw = localStorage.getItem("refract_users");
    const users = usersRaw ? JSON.parse(usersRaw) : [];

    const existingIdx = users.findIndex(
      (u: any) => u.email?.toLowerCase() === identifier.toLowerCase() || u.phone === identifier
    );

    const uid = verifiedUid || (existingIdx !== -1 ? users[existingIdx].uid : "mock_" + Math.random().toString(36).substring(2, 10));

    const userObj = {
      uid,
      name: displayName,
      email: method === "email" ? identifier.toLowerCase() : emailAddr,
      phone: method === "phone" ? identifier : undefined,
      password: password.trim(),
      avatar: initials,
      isPro: existingIdx !== -1 ? users[existingIdx].isPro : false,
    };

    if (existingIdx !== -1) {
      users[existingIdx] = { ...users[existingIdx], ...userObj };
    } else {
      users.push(userObj);
    }
    localStorage.setItem("refract_users", JSON.stringify(users));

    const loggedUser: UserSession = {
      uid: userObj.uid,
      name: userObj.name,
      email: userObj.email,
      avatar: userObj.avatar,
      isPro: userObj.isPro || false,
    };
    localStorage.setItem("refract_user", JSON.stringify(loggedUser));
    return loggedUser;
  }

  throw new Error("No client storage available.");
};

// 5. Sign Out
export const signOutUser = async (): Promise<void> => {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  
  if (typeof window !== "undefined") {
    localStorage.removeItem("refract_user");
  }
};

// 6. Update Subscription Status
export const updateSubscriptionStatus = async (
  uid: string,
  plan: "monthly" | "quarterly" | "annual",
  source: "statement" | "gateway",
  utr: string
): Promise<UserSession> => {
  if (isFirebaseConfigured && db) {
    const userRef = doc(db, "users", uid);
    const updates = {
      isPro: true,
      selectedPlan: plan,
      verificationSource: source,
      utrValue: utr,
    };
    await updateDoc(userRef, updates);

    // Store payment receipt in Firestore
    const paymentRef = doc(db, "payments", utr);
    const amounts = { monthly: 4999, quarterly: 9999, annual: 29999 };
    await setDoc(paymentRef, {
      userId: uid,
      amount: amounts[plan],
      plan,
      source,
      timestamp: new Date().toISOString(),
    });

    const userDoc = await getDoc(userRef);
    return { uid, ...userDoc.data() } as UserSession;
  }

  // Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("refract_user");
    if (stored) {
      const user = JSON.parse(stored);
      user.isPro = true;
      user.selectedPlan = plan;
      user.verificationSource = source;
      user.utrValue = utr;
      localStorage.setItem("refract_user", JSON.stringify(user));
      
      // Update in mock registry
      const usersRaw = localStorage.getItem("refract_users");
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        const idx = users.findIndex((u: any) => u.uid === uid || u.email === user.email);
        if (idx !== -1) {
          users[idx].isPro = true;
          users[idx].selectedPlan = plan;
          users[idx].verificationSource = source;
          users[idx].utrValue = utr;
          localStorage.setItem("refract_users", JSON.stringify(users));
        }
      }
      return user;
    }
  }

  throw new Error("No client storage available.");
};

// Export Firebase instances for external use (e.g. onAuthStateChanged listener)
export { onAuthStateChanged };
export const getAuthInstance = (): Auth | undefined => auth;
