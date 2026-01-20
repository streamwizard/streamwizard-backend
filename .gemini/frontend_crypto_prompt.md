# Next.js Server Actions Crypto Implementation

## ⚠️ CRITICAL: Server-Side Only

This crypto implementation **MUST** run on the server only. The encryption key should **NEVER** be exposed to the client.

## Backend Reference

Backend crypto module (`packages/supabase/src/crypto.ts`):

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@repo/env";

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  return {
    ciphertext,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(ciphertext: string, iv: string, authTag: string): string {
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const authTagBuffer = Buffer.from(authTag, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let plaintext = decipher.update(ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
```

## Next.js Server Actions Implementation

Create `src/server/crypto.ts`:

```typescript
"use server";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a plaintext token using AES-256-GCM
 * ⚠️ Server Action - runs server-side only
 */
export async function encryptToken(plaintext: string): Promise<EncryptedToken> {
  // Server-side only - NO NEXT_PUBLIC_ prefix!
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }

  const iv = randomBytes(12);
  const key = Buffer.from(encryptionKey, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts an encrypted token using AES-256-GCM
 * ⚠️ Server Action - runs server-side only
 */
export async function decryptToken(
  ciphertext: string,
  iv: string,
  authTag: string,
): Promise<string> {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(encryptionKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const authTagBuffer = Buffer.from(authTag, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let plaintext = decipher.update(ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
```

## Environment Variables

**`.env.local` (Server-side only)**

```env
# ⚠️ DO NOT use NEXT_PUBLIC_ prefix - this must be server-side only!
TOKEN_ENCRYPTION_KEY=your-64-character-hex-key-here
```

## Key Changes for Next.js

1. ✅ **`'use server'` directive** - Marks file as Server Actions module
2. ✅ **`async` functions** - Required by Next.js Server Actions
3. ✅ **Server-side env var** - Use `process.env.TOKEN_ENCRYPTION_KEY` (NO `NEXT_PUBLIC_`)
4. ✅ **Error handling** - Validates encryption key exists

## Usage in Server Components/Actions

```typescript
// In a Server Component or Server Action
import { encryptToken, decryptToken } from "@/server/crypto";

// Encrypt
const encrypted = await encryptToken("my-secret-token");

// Decrypt
const plaintext = await decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
```

## Security Checklist

- ✅ Functions are `async` (Server Actions requirement)
- ✅ `'use server'` directive at top of file
- ✅ Uses server-side env var (no `NEXT_PUBLIC_`)
- ✅ Never import this in Client Components
- ✅ Only call from Server Components or Server Actions
- ✅ Encryption key never exposed to client bundle

## Common Errors Fixed

❌ **"Server Actions must be async functions"**

- Fixed by making functions `async`

❌ **Encryption key exposed to client**

- Fixed by removing `NEXT_PUBLIC_` prefix

❌ **Functions run on client**

- Fixed by adding `'use server'` directive
