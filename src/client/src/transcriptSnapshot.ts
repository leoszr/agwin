/**
 * Coherence rule for a transcript snapshot built from two independent reads:
 * a committed message page and the environment's stream watermark.
 *
 * The environment stamps every event with a monotonic sequence as it publishes
 * it, after committing its effect, so a page read at time T contains every
 * event published before T. Reading the watermark immediately before and after
 * the page gives:
 *
 * - equal watermarks: no event was published in between, so every event at or
 *   below the watermark is committed in the page and every event above it was
 *   published after the page was read and will arrive live. The pair is
 *   exactly-once: no committed message is missing and no live event is already
 *   in the page.
 * - a moved watermark: an event published in that interval may or may not be
 *   in the page, so the pair is ambiguous and the read is retried.
 *
 * Retries are bounded so a join cannot hang on a busy session; an exhausted
 * retry throws, which makes the caller keep its previous transcript and report
 * the failure. It never returns an ambiguous pair, so no committed message and
 * no live event is ever dropped or duplicated. Environments that expose the
 * atomic `transcriptSnapshot` capability are read through it instead of
 * rebuilding the pair from two requests.
 */
export interface CoherentTranscriptReads<TStream, TPage> {
  readStream: () => Promise<TStream>;
  readPage: () => Promise<TPage>;
  seqOf: (stream: TStream) => number;
}

export interface CoherentTranscript<TStream, TPage> {
  stream: TStream;
  page: TPage;
}

export const TRANSCRIPT_SNAPSHOT_ATTEMPTS = 3;

export async function readCoherentTranscriptSnapshot<TStream, TPage>(
  reads: CoherentTranscriptReads<TStream, TPage>,
  attempts = TRANSCRIPT_SNAPSHOT_ATTEMPTS,
): Promise<CoherentTranscript<TStream, TPage>> {
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("attempts must be a positive integer");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const before = await reads.readStream();
    const page = await reads.readPage();
    const after = await reads.readStream();
    if (reads.seqOf(before) === reads.seqOf(after)) return { stream: after, page };
  }
  throw new Error("Session transcript changed while being read; retry the join");
}
