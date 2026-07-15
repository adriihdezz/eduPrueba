import type { Segment } from "./types";

const formatTimestamp = (seconds: number): string => {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((milliseconds % 60_000) / 1_000);
  const remainingMilliseconds = milliseconds % 1_000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}.${String(remainingMilliseconds).padStart(3, "0")}`;
};

export const segmentsToVtt = (segments: Segment[]): string => {
  const cues = segments
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.start >= 0 &&
        segment.end >= segment.start &&
        segment.text.trim().length > 0
    )
    .map(
      (segment) =>
        `${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${segment.text.trim()}`
    );

  return `WEBVTT\n\n${cues.join("\n\n")}${cues.length > 0 ? "\n" : ""}`;
};
