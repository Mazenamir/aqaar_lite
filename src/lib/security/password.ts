import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

/**
 * Strict Password Security using Argon2id (OWASP & RFC 9106 Recommended)
 */

// OWASP Recommended settings for Argon2id (Algorithm.Argon2id = 2)
const ARGON2_OPTIONS = {
  algorithm: 2,      // Algorithm.Argon2id
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  parallelism: 1,    // 1 thread
  outputLen: 32,
};

// Dummy Argon2id hash used to mitigate timing attacks on non-existent accounts
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$XSpb06Kiquh5N7xu/imxfw$ugEm94uOPFQdzcO6oN+L7jPz5ub0Re6B3UvaKAIzak0";

/**
 * Hash password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, ARGON2_OPTIONS);
}

/**
 * Verify password against stored hash.
 * Supports Argon2id, with backward compatibility for bcrypt hashes if needed.
 */
export async function verifyPassword(storedHash: string, candidatePassword: string): Promise<boolean> {
  try {
    if (storedHash.startsWith("$argon2")) {
      return await verify(storedHash, candidatePassword);
    } else if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
      return await bcrypt.compare(candidatePassword, storedHash);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Executes a dummy verification to ensure constant-time behavior
 * when a non-existent email is queried.
 */
export async function dummyVerifyPassword(candidatePassword: string): Promise<boolean> {
  try {
    await verify(DUMMY_HASH, candidatePassword);
  } catch {
    // Ignore error
  }
  return false;
}
