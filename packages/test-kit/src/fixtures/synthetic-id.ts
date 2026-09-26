/**
 * @file Derives deterministic, clearly synthetic UUIDs from an entity kind and a numeric seed.
 * @module @caa/test-kit/fixtures/synthetic-id
 * @see docs/standards/07-testing.md
 */

/** Entity kinds that get their own synthetic ID range. */
export type SyntheticIdKind = 'tenant' | 'user' | 'student' | 'assignment';

/** First UUID group per kind, so the kind is visible when an ID shows up in a failing test. */
const KIND_PREFIX: Readonly<Record<SyntheticIdKind, string>> = {
  tenant: '10000000',
  user: '20000000',
  student: '30000000',
  assignment: '40000000',
};

/** Largest seed that fits the 12-hex-digit final UUID group. */
const MAX_SEED = 0xffff_ffff_ffff;

/**
 * Derives a deterministic version-4-shaped UUID, `<kind prefix>-0000-4000-8000-<seed as 12 hex>`.
 *
 * The same kind and seed always give the same ID. The ID does not include the tenant, so give
 * users in different tenants different seeds when a test needs them to be distinct.
 *
 * @param kind - Entity kind; selects the first UUID group.
 * @param seed - Non-negative integer that distinguishes objects of the same kind.
 * @returns A lowercase UUID string.
 * @throws {RangeError} When the seed is not an integer between 0 and 2^48 - 1.
 */
export function syntheticId(kind: SyntheticIdKind, seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError(`Synthetic ID seed must be an integer from 0 to ${String(MAX_SEED)}`);
  }
  return `${KIND_PREFIX[kind]}-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`;
}

/**
 * Derives a synthetic source-system (SIS) student identifier, `SYN-` plus the seed padded to six
 * digits. `buildStudent` and `buildRosterRow` use the same value for the same seed.
 *
 * @param seed - Non-negative integer that distinguishes students.
 * @returns A source student identifier such as `SYN-000001`.
 * @throws {RangeError} When the seed is not a non-negative integer.
 */
export function syntheticSourceStudentId(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0) {
    throw new RangeError('Synthetic source student seed must be a non-negative integer');
  }
  return `SYN-${String(seed).padStart(6, '0')}`;
}
