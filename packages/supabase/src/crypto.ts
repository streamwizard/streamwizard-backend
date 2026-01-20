import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@repo/env";

/**
 * Encrypted token structure
 */
export interface EncryptedToken {
    ciphertext: string;
    iv: string;
    authTag: string;
}

/**
 * Encrypts a plaintext token using AES-256-GCM
 * 
 * @param plaintext - The plaintext token to encrypt
 * @returns Object containing base64-encoded ciphertext, IV, and authentication tag
 * 
 * @example
 * const encrypted = encryptToken("my-secret-token");
 * // Store encrypted.ciphertext, encrypted.iv, encrypted.authTag in database
 */
export function encryptToken(plaintext: string): EncryptedToken {
    // Generate a random 12-byte IV (96 bits, recommended for GCM)
    const iv = randomBytes(12);

    // Convert hex key to buffer
    const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

    // Create cipher with AES-256-GCM
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    // Encrypt the plaintext
    let ciphertext = cipher.update(plaintext, "utf8", "base64");
    ciphertext += cipher.final("base64");

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    return {
        ciphertext,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    };
}

/**
 * Decrypts an encrypted token using AES-256-GCM
 * 
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded initialization vector
 * @param authTag - Base64-encoded authentication tag
 * @returns The decrypted plaintext token
 * 
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 * 
 * @example
 * const plaintext = decryptToken(
 *     encrypted.ciphertext,
 *     encrypted.iv,
 *     encrypted.authTag
 * );
 */
export function decryptToken(ciphertext: string, iv: string, authTag: string): string {
    // Convert hex key to buffer
    const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

    // Convert base64 inputs to buffers
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

    // Create decipher with AES-256-GCM
    const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);

    // Set the authentication tag
    decipher.setAuthTag(authTagBuffer);

    // Decrypt the ciphertext
    let plaintext = decipher.update(ciphertext, "base64", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
}
