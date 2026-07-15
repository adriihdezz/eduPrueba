"use client";

import { useEffect, useRef, useState } from "react";

type TtsButtonProps = {
  text: string;
  label: string;
};

export default function TtsButton({ text, label }: TtsButtonProps) {
  const [supported, setSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hadError, setHadError] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const stop = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  useEffect(
    () => () => {
      stop();
    },
    [text]
  );

  const toggleSpeech = () => {
    if (!supported || !text.trim()) return;
    if (isSpeaking) {
      stop();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 0.9;
      utteranceRef.current = utterance;
      utterance.onend = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setIsSpeaking(false);
        }
      };
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setIsSpeaking(false);
          setHadError(true);
        }
      };
      setHadError(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      utteranceRef.current = null;
      setIsSpeaking(false);
      setHadError(true);
    }
  };

  if (!supported) {
    return (
      <p className="tts-unavailable" role="status">
        La lectura en voz alta no está disponible en este navegador.
      </p>
    );
  }

  const action = isSpeaking ? "Detener" : hadError ? "Volver a intentar escuchar" : "Escuchar";
  return (
    <button type="button" className="tts-button" onClick={toggleSpeech} disabled={!text.trim()}>
      {action} {label}
    </button>
  );
}
