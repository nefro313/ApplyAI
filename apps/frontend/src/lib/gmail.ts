"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/**
 * Pop up Google sign-in with the gmail.send scope and return the access token.
 *
 * The token is short-lived (~1 hour). We deliberately re-prompt on each send
 * rather than persisting credentials anywhere on the client; sending email is
 * a sensitive action and the user should consent each time until we wire a
 * proper backend OAuth flow.
 */
export async function requestGmailSendToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  let result;
  try {
    result = await signInWithPopup(getFirebaseAuth(), provider);
  } catch (e) {
    // Firebase surfaces popup-closed / cancelled as specific codes; everything
    // else is bucketed into a calm, generic message. Raw codes stay in the log.
    if (process.env.NODE_ENV !== "production") console.warn("[gmail] sign-in", e);
    const code = (e as { code?: string })?.code ?? "";
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      throw new Error("Sign-in was cancelled. Please try again.");
    }
    throw new Error("Couldn't sign in to Google. Please try again.");
  }
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) {
    throw new Error("Couldn't sign in to Google. Please try again.");
  }
  return cred.accessToken;
}

/**
 * Build an RFC 822 message and base64url-encode it for the Gmail send API.
 */
export function buildRfc822(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    `Subject: ${opts.subject}`,
    "",
    opts.body,
  ];
  const raw = lines.join("\r\n");
  // base64url encoding for Gmail API
  const b64 = typeof window === "undefined"
    ? Buffer.from(raw, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendViaGmail(opts: {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const raw = buildRfc822(opts);
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    // Log the Gmail API payload for debugging; show the user calm copy only.
    const text = await res.text().catch(() => "");
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[gmail] send → ${res.status}`, text);
    }
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Gmail couldn't authorise the send. Please try signing in again."
        : "Couldn't send the email right now. Please try again in a moment.",
    );
  }
}
