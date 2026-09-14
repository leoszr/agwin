import { describe, expect, it } from "vitest";
import { readCoherentTranscriptSnapshot } from "./transcriptSnapshot";

interface Reads {
  calls: string[];
  streams: number[];
  pages: string[];
}

function reads(streamSeqs: number[], pages: string[]): Reads & {
  readStream: () => Promise<{ seq: number }>;
  readPage: () => Promise<string>;
} {
  const state: Reads = { calls: [], streams: streamSeqs, pages };
  let streamIndex = 0;
  let pageIndex = 0;
  return {
    ...state,
    readStream: () => {
      const seq = state.streams[Math.min(streamIndex, state.streams.length - 1)] ?? 0;
      streamIndex += 1;
      state.calls.push(`stream:${String(seq)}`);
      return Promise.resolve({ seq });
    },
    readPage: () => {
      const page = state.pages[Math.min(pageIndex, state.pages.length - 1)] ?? "";
      pageIndex += 1;
      state.calls.push(`page:${page}`);
      return Promise.resolve(page);
    },
  };
}

describe("readCoherentTranscriptSnapshot", () => {
  it("returns the pair unchanged when the watermark does not move across the page read", async () => {
    const source = reads([4, 4], ["p1"]);
    const result = await readCoherentTranscriptSnapshot({ readStream: source.readStream, readPage: source.readPage, seqOf: (stream) => stream.seq });

    expect(result).toEqual({ stream: { seq: 4 }, page: "p1" });
    expect(source.calls).toEqual(["stream:4", "page:p1", "stream:4"]);
  });

  it("retries when an event lands between the reads and returns the coherent attempt", async () => {
    const source = reads([4, 6, 6], ["stale", "fresh"]);
    const result = await readCoherentTranscriptSnapshot({ readStream: source.readStream, readPage: source.readPage, seqOf: (stream) => stream.seq });

    expect(result).toEqual({ stream: { seq: 6 }, page: "fresh" });
    expect(source.calls).toEqual(["stream:4", "page:stale", "stream:6", "stream:6", "page:fresh", "stream:6"]);
  });

  it("fails observably instead of returning an ambiguous pair after the attempt limit", async () => {
    const source = reads([1, 2, 3, 4, 5, 6], ["a", "b", "c"]);

    await expect(readCoherentTranscriptSnapshot(
      { readStream: source.readStream, readPage: source.readPage, seqOf: (stream) => stream.seq },
      3,
    )).rejects.toThrow("Session transcript changed while being read");

    // Every attempt was consumed; nothing ambiguous is handed back.
    expect(source.calls).toHaveLength(9);
  });

  it("requires at least one attempt", async () => {
    const source = reads([1], ["a"]);
    await expect(readCoherentTranscriptSnapshot(
      { readStream: source.readStream, readPage: source.readPage, seqOf: (stream) => stream.seq },
      0,
    )).rejects.toThrow("attempts must be a positive integer");
  });
});
