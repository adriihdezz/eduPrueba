import type { AdaptResult, TranscriptResult } from "./types";

export const mockTranscript: TranscriptResult = {
  source: "youtube",
  videoId: "dQw4w9WgXcQ",
  text:
    "La fotosíntesis es el proceso que usan las plantas para fabricar su alimento. Las plantas utilizan la luz del sol, el agua y el dióxido de carbono. Como resultado, producen glucosa y liberan oxígeno.",
  segments: [
    { start: 0, end: 5.2, text: "La fotosíntesis es el proceso que usan las plantas." },
    { start: 5.2, end: 10.4, text: "Sirve para fabricar su propio alimento." },
    { start: 10.4, end: 16.1, text: "Las plantas usan la luz del sol, agua y dióxido de carbono." },
    { start: 16.1, end: 22.3, text: "Después producen glucosa y liberan oxígeno." }
  ]
};

export const mockAdapt: AdaptResult = {
  lecturaFacil:
    "La fotosíntesis permite a las plantas fabricar su alimento.\n\nLas plantas usan la luz del sol. También usan agua y dióxido de carbono.\n\nCon estos elementos producen glucosa. La glucosa es su alimento.\n\nDurante el proceso, las plantas liberan oxígeno.",
  puntosClave: [
    "Las plantas fabrican su alimento mediante la fotosíntesis.",
    "La luz del sol es necesaria para el proceso.",
    "Las plantas usan agua y dióxido de carbono.",
    "La fotosíntesis produce glucosa y libera oxígeno."
  ]
};
