"use client";

import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signOut as fbSignOut,
  signInWithPopup,
  type User as FbUser,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getFirebaseAuth } from "@/lib/firebase";
import { setAuthToken, setAuthTokenGetter } from "@/services/api";

type AuthState = {
  user: FbUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FbUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    // Per-request fresh-token source. `getIdToken()` returns the cached token
    // and transparently refreshes it when it's expired (or close to it), so API
    // calls from long-open pages never go out with a stale token.
    setAuthTokenGetter(() =>
      auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null),
    );
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setLoading(false);
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setAuthToken(token);
      } else {
        setAuthToken(null);
      }
    });
    return () => {
      unsub();
      setAuthTokenGetter(null);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signInWithGoogle, signOut }),
    [user, loading, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
