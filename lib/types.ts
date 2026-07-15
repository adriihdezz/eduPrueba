export type Segment = { start: number; end: number; text: string };

export type TranscriptResult = {
  source: "upload" | "youtube";
  videoId?: string;
  text: string;
  segments: Segment[];
};

export type AdaptResult = {
  lecturaFacil: string;
  puntosClave: string[];
};
