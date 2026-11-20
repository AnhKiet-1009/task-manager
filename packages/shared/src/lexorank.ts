/**
 * Deterministic Base-62 LexoRank (Fractional Indexing) for O(1) drag-and-drop ordering.
 *
 * Alphabet follows exact ASCII code point order (`0-9` < `A-Z` < `a-z`) so
 * JavaScript `<` comparison and PostgreSQL `ORDER BY position COLLATE "C"`
 * always produce identical ordering.
 */
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length; // 62
const MIN_CHAR = ALPHABET[0]!; // '0'
const MAX_CHAR = ALPHABET[BASE - 1]!; // 'z'
const MID_INDEX = Math.floor(BASE / 2); // 31 -> 'V'

function charToIndex(char: string): number {
  const idx = ALPHABET.indexOf(char);
  if (idx === -1) {
    throw new Error(`Invalid LexoRank character: "${char}"`);
  }
  return idx;
}

function indexToChar(index: number): string {
  return ALPHABET[index]!;
}

/**
 * Computes a rank string strictly between `prev` and `next` in ASCII order:
 *   prev < result < next
 */
export function generateRankBetween(
  prev: string | null | undefined,
  next: string | null | undefined,
): string {
  const a = prev ?? "";
  const b = next ?? "";

  if (!a && !b) {
    return indexToChar(MID_INDEX);
  }

  if (a && b && a >= b) {
    throw new Error(`Invalid LexoRank bounds: prev ("${a}") must be < next ("${b}")`);
  }

  // Insert before the first item
  if (!a) {
    for (let i = 0; i < b.length; i++) {
      const bIdx = charToIndex(b[i]!);
      if (bIdx > 1) {
        return b.slice(0, i) + indexToChar(Math.floor(bIdx / 2));
      }
      if (bIdx === 1) {
        return b.slice(0, i) + MIN_CHAR + indexToChar(MID_INDEX);
      }
    }
    return b + MIN_CHAR; // Fallback (unreachable if ranks never end with MIN_CHAR)
  }

  // Insert after the last item
  if (!b) {
    for (let i = 0; i < a.length; i++) {
      const aIdx = charToIndex(a[i]!);
      if (aIdx < BASE - 2) {
        return a.slice(0, i) + indexToChar(Math.ceil((aIdx + BASE - 1) / 2));
      }
      if (aIdx === BASE - 2) {
        return a.slice(0, i) + MAX_CHAR;
      }
    }
    return a + indexToChar(MID_INDEX);
  }

  // Insert strictly between `a` and `b`
  let prefix = "";
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i <= maxLen; i++) {
    const aIdx = i < a.length ? charToIndex(a[i]!) : 0;
    const bIdx = i < b.length ? charToIndex(b[i]!) : BASE;

    if (bIdx - aIdx > 1) {
      const mid = Math.floor((aIdx + bIdx) / 2);
      return prefix + indexToChar(mid);
    }

    // Characters are identical or adjacent (difference is 0 or 1).
    // Extend along `a`'s branch so the resulting rank stays > `a` and < `b`.
    prefix += indexToChar(aIdx);

    if (bIdx - aIdx === 1) {
      // Any suffix strictly greater than the rest of `a` is automatically < `b`
      // because at position `i`, prefix[i] === a[i] < b[i].
      let suffixIndex = i + 1;
      while (suffixIndex < a.length) {
        const restIdx = charToIndex(a[suffixIndex]!);
        if (restIdx < BASE - 1) {
          const mid = Math.ceil((restIdx + BASE) / 2);
          return prefix + indexToChar(Math.min(mid, BASE - 1));
        }
        prefix += MAX_CHAR;
        suffixIndex += 1;
      }
      return prefix + indexToChar(MID_INDEX);
    }
  }

  return a + indexToChar(MID_INDEX);
}

/**
 * Generates `count` evenly spaced initial rank strings in strict ascending order.
 */
export function generateInitialRanks(count: number): string[] {
  if (count <= 0) return [];
  const ranks: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    const nextRank = generateRankBetween(prev, null);
    ranks.push(nextRank);
    prev = nextRank;
  }
  return ranks;
}
