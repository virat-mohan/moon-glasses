"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const BPM = 128;
const STEP_SECONDS = 60 / BPM / 4; // 16th notes
const VOLUME = 0.15;

/**
 * Procedurally-generated four-on-the-floor techno loop via Web Audio API —
 * no audio file needed. On by default: browsers block audio before any user
 * gesture, so this arms a one-time listener for the visitor's first
 * click/tap/keypress anywhere on the page and starts the loop right then,
 * rather than requiring them to find and press the speaker toggle. The
 * toggle still works normally for muting/unmuting afterward.
 */
export function AmbientTechno() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const mutedByUserRef = useRef(false);

  function kick(ctx: AudioContext, dest: AudioNode, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  function hat(ctx: AudioContext, dest: AudioNode, time: number, open: boolean) {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.25 : 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.18 : 0.05));
    noise.connect(filter).connect(gain).connect(dest);
    noise.start(time);
    noise.stop(time + 0.2);
  }

  function bass(ctx: AudioContext, dest: AudioNode, time: number, freq: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, time);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + STEP_SECONDS * 1.8);
    osc.connect(filter).connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + STEP_SECONDS * 2);
  }

  function scheduleStep(ctx: AudioContext, dest: AudioNode, step: number, time: number) {
    const beat = step % 16;
    if (beat % 4 === 0) kick(ctx, dest, time);
    if (beat % 4 === 2) hat(ctx, dest, time, false);
    if (beat === 14) hat(ctx, dest, time, true);
    const bassPattern = [55, 0, 0, 0, 55, 0, 82.4, 0, 55, 0, 0, 0, 73.4, 0, 0, 0];
    const f = bassPattern[beat];
    if (f) bass(ctx, dest, time, f);
  }

  useEffect(() => {
    function armStart() {
      if (mutedByUserRef.current || ctxRef.current) return;
      start();
    }
    // "click"/"keydown" alone satisfy every major browser's user-gesture
    // requirement for starting audio; touchstart covers mobile Safari, which
    // is stricter about needing the gesture on the same tick.
    window.addEventListener("pointerdown", armStart, { once: true });
    window.addEventListener("keydown", armStart, { once: true });
    window.addEventListener("touchstart", armStart, { once: true });

    return () => {
      window.removeEventListener("pointerdown", armStart);
      window.removeEventListener("keydown", armStart);
      window.removeEventListener("touchstart", armStart);
      if (schedulerRef.current) window.clearInterval(schedulerRef.current);
      ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = VOLUME;
    gain.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.05;

    schedulerRef.current = window.setInterval(() => {
      while (nextTimeRef.current < ctx.currentTime + 0.15) {
        scheduleStep(ctx, gain, stepRef.current, nextTimeRef.current);
        nextTimeRef.current += STEP_SECONDS;
        stepRef.current += 1;
      }
    }, 30);
    setPlaying(true);
  }

  function stop() {
    if (schedulerRef.current) window.clearInterval(schedulerRef.current);
    ctxRef.current?.close();
    ctxRef.current = null;
    setPlaying(false);
  }

  return (
    <button
      type="button"
      aria-label={playing ? "Mute background music" : "Play background music"}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClick={() => {
        if (playing) {
          mutedByUserRef.current = true;
          stop();
        } else {
          mutedByUserRef.current = false;
          start();
        }
      }}
      className="fixed bottom-6 left-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-[var(--color-surface)] text-white transition-transform hover:scale-105 hover:border-white"
    >
      {playing ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
    </button>
  );
}
