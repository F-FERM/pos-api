import { PopulateOptions } from 'mongoose';

/**
 * Normalize populate input for Mongoose.
 * Ensures it is either a PopulateOptions object or an array of strings/PopulateOptions.
 *
 * Handles:
 * 1. A single string (e.g., 'user')
 * 2. A single object (e.g., { path: 'user', select: 'name email' })
 * 3. An array of strings or objects (e.g., [{ path: 'user' }, { path: 'comments' }])
 *
 * @param populate - The populate option(s)
 * @returns Normalized populate option compatible with Mongoose typings
 */
export function normalizePopulate(
  populate?: string | PopulateOptions | (string | PopulateOptions)[],
): PopulateOptions | (string | PopulateOptions)[] | undefined {
  if (!populate) return undefined;

  // Single string or single object → wrap in array
  if (typeof populate === 'string' || 'path' in (populate as PopulateOptions)) {
    return [populate as string | PopulateOptions];
  }

  // Already an array → return as-is
  return populate as (string | PopulateOptions)[];
}
