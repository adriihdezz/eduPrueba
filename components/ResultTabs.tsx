"use client";

import { KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import type { AdaptResult, TranscriptResult } from "../lib/types";
import TtsButton from "./TtsButton";

type TabKey = "transcripcion" | "lectura-facil" | "puntos-clave";

type ResultTabsProps = {
  transcript: TranscriptResult;
  adapt: AdaptResult;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "transcripcion", label: "Transcripción" },
  { key: "lectura-facil", label: "Lectura fácil" },
  { key: "puntos-clave", label: "Puntos clave" }
];

export default function ResultTabs({ transcript, adapt }: ResultTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("transcripcion");
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const voiceText = useMemo(() => {
    if (activeTab === "transcripcion") return transcript.text;
    if (activeTab === "lectura-facil") return adapt.lecturaFacil;
    return adapt.puntosClave.map((point, index) => `Punto ${index + 1}. ${point}`).join(" ");
  }, [activeTab, adapt.lecturaFacil, adapt.puntosClave, transcript.text]);

  const activeLabel = tabs.find((tab) => tab.key === activeTab)?.label.toLocaleLowerCase("es-ES") ?? "contenido";
  const moveFocus = (nextIndex: number) => {
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.key);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      moveFocus(nextIndex);
    }
  };

  const transcription = transcript.text.trim();
  const easyParagraphs = adapt.lecturaFacil.split(/\n{2,}/).filter((paragraph) => paragraph.trim());
  const keyPoints = adapt.puntosClave.filter((point) => point.trim());

  return (
    <section className="result-tabs" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`}>Adaptaciones</h2>
      <div className="tab-list" role="tablist" aria-label="Formatos de contenido">
        {tabs.map((tab, index) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${baseId}-tab-${tab.key}`}
              className="tab-button"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <div
            key={tab.key}
            id={`${baseId}-panel-${tab.key}`}
            className="tab-panel"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.key}`}
            hidden={!selected}
          >
            {tab.key === "transcripcion" && (
              <>
                <h3>Transcripción completa</h3>
                {transcription ? <p className="transcript-content">{transcript.text}</p> : <p>No hay transcripción disponible.</p>}
              </>
            )}
            {tab.key === "lectura-facil" && (
              <>
                <h3>Lectura fácil</h3>
                {easyParagraphs.length > 0 ? (
                  <div className="easy-reading-content">
                    {easyParagraphs.map((paragraph, index) => (
                      <p key={`${index}-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p>No hay una versión en lectura fácil disponible.</p>
                )}
              </>
            )}
            {tab.key === "puntos-clave" && (
              <>
                <h3>Puntos clave</h3>
                {keyPoints.length > 0 ? (
                  <ol className="key-points-content">
                    {keyPoints.map((point, index) => (
                      <li key={`${index}-${point}`}>
                        {index === 0 && <strong className="essential-badge">Lo esencial</strong>}
                        {point}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No hay puntos clave disponibles.</p>
                )}
              </>
            )}
            <TtsButton text={voiceText} label={activeLabel} />
          </div>
        );
      })}
    </section>
  );
}
