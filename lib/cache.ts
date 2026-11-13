import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

/** Shared freshness for precomputed league, history, and prediction logs. */
export const CACHE_SECONDS = 900;

export function cached<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  key: string,
  revalidate = CACHE_SECONDS,
  tags: string[] = [key]
): (...args: Args) => Promise<T> {
  return unstable_cache(fn, [key], { revalidate, tags });
}

export async function bustAnalysisCache(): Promise<void> {
  try {
    revalidateTag("history");
    revalidateTag("league");
    revalidateTag("log");
    revalidateTag("ticker");
    revalidateTag("home");
    revalidateTag("match");
    revalidateTag("team");
  } catch {
    // revalidateTag is a no-op outside a Next request context
  }
}
