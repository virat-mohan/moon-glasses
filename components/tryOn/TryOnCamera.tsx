"use client";

import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";

type Status = "idle" | "loading-model" | "requesting-camera" | "running" | "denied" | "error";

// Landmark indices from MediaPipe's 478-point face mesh. Iris centers
// (468/473) track much more stably than eye-corner points — they don't
// shift as eyelids/eyebrows move, so scale/angle stop jittering frame to
// frame. Falls back to outer eye corners if a model build ever returns the
// 468-point mesh without iris refinement.
const RIGHT_IRIS = 468;
const LEFT_IRIS = 473;
const RIGHT_EYE_OUTER = 33;
const LEFT_EYE_OUTER = 263;

// Tuning knobs for the overlay fit — adjust these first if the glasses look
// too big/small or sit too high/low, rather than touching the draw logic.
// Bumped up from 2.55: on real faces the glasses were reading noticeably
// narrower than the actual face width.
const WIDTH_FACTOR = 3.1; // glasses width as a multiple of iris-to-iris distance
const VERTICAL_ANCHOR_RATIO = 0.4; // fraction down the glasses image that should land on the eye line
const VERTICAL_NUDGE = 0.05; // extra downward nudge, as a fraction of eye distance

function Thumbnail({
  product,
  active,
  onSelect,
}: {
  product: Chapter;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative aspect-square w-full overflow-hidden bg-surface-alt transition-opacity ${
        active ? "opacity-100 ring-1 ring-[var(--moon-gold)]" : "opacity-60 hover:opacity-100"
      }`}
      aria-label={`Try ${shortProductName(product.name)}`}
    >
      {/* Plain <img> — small thumbnail grid, not worth Next/Image's overhead. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chapterImageSrc(product.folder, product.sideImage)}
        alt={shortProductName(product.name)}
        className="h-full w-full object-contain p-1"
      />
    </button>
  );
}

/**
 * Real-time try-on: MediaPipe FaceLandmarker (loaded client-side from CDN,
 * nothing sent to a server) tracks the face every frame, and the selected
 * product image is scaled/rotated/positioned onto a canvas over the eyes
 * based on actual detected iris distance and head tilt — this is genuine
 * face tracking, not a fixed overlay.
 *
 * Honest limitation: our product photography is a three-quarter studio
 * angle (built for the ecommerce grid), not a flat frontal cutout — so the
 * fit is close but not pixel-perfect like a dedicated AR try-on shot would
 * give. Swap in frontal transparent cutouts per SKU for a tighter fit.
 */
export function TryOnCamera({ products }: { products: Chapter[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glassesImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").FaceLandmarker | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [selected, setSelected] = useState<Chapter>(products[0]);
  const [faceFound, setFaceFound] = useState(false);

  const half = Math.ceil(products.length / 2);
  const leftProducts = products.slice(0, half);
  const rightProducts = products.slice(half);

  // Swap the overlay image whenever the selection changes.
  useEffect(() => {
    const img = new Image();
    img.src = chapterImageSrc(selected.folder, selected.sideImage);
    img.onload = () => {
      glassesImgRef.current = img;
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start() {
      setStatus("loading-model");
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        setStatus("requesting-camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("running");
        loop();
      } catch (err) {
        console.error("Try-on camera/model failed to start", err);
        setStatus(
          err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            ? "denied"
            : "error"
        );
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const result = landmarker.detectForVideo(video, performance.now());
      const landmarks = result.faceLandmarks?.[0];
      const glasses = glassesImgRef.current;

      if (landmarks && glasses) {
        setFaceFound(true);
        const toPx = (i: number) => ({ x: landmarks[i].x * canvas.width, y: landmarks[i].y * canvas.height });

        const hasIris = landmarks.length > 473;
        const left = toPx(hasIris ? LEFT_IRIS : LEFT_EYE_OUTER);
        const right = toPx(hasIris ? RIGHT_IRIS : RIGHT_EYE_OUTER);
        const eyeCenter = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };

        const eyeDist = Math.hypot(left.x - right.x, left.y - right.y);
        const angle = Math.atan2(left.y - right.y, left.x - right.x);

        const glassesWidth = eyeDist * WIDTH_FACTOR;
        const glassesHeight = glassesWidth * (glasses.height / glasses.width);

        ctx.save();
        ctx.translate(eyeCenter.x, eyeCenter.y + eyeDist * VERTICAL_NUDGE);
        ctx.rotate(angle);
        ctx.drawImage(
          glasses,
          -glassesWidth / 2,
          -glassesHeight * VERTICAL_ANCHOR_RATIO,
          glassesWidth,
          glassesHeight
        );
        ctx.restore();
      } else {
        setFaceFound(false);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center">
      <div className="flex w-full flex-col items-start gap-4 md:flex-row md:justify-center">
        {/* Left thumbnail rail — hidden on narrow screens, shown as a row below instead. */}
        <div className="hidden w-24 flex-none flex-col gap-2 md:flex">
          {leftProducts.map((p) => (
            <Thumbnail key={p.slug} product={p} active={selected.slug === p.slug} onSelect={() => setSelected(p)} />
          ))}
        </div>

        <div className="relative aspect-[4/3] w-full max-w-2xl flex-none overflow-hidden bg-black">
          {/* Mirrored container: draw logic assumes raw (unmirrored) video coords,
              CSS flips the whole thing for a natural selfie-view. The filter on
              the video is display-only — MediaPipe reads the raw frame buffer
              underneath, so this never touches tracking accuracy. Kept
              deliberately light: a heavier glow/vignette combo washed out
              badly in dim/backlit rooms instead of flattering anyone. */}
          <div className="absolute inset-0 [transform:scaleX(-1)]">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover [filter:brightness(1.05)_contrast(1.04)_saturate(1.08)]"
            />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>

          {status !== "running" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center">
              <p className="font-sans text-body-s uppercase tracking-[0.1em] text-white">
                {status === "idle" || status === "loading-model"
                  ? "Loading face tracking…"
                  : status === "requesting-camera"
                    ? "Allow camera access to try MOON on"
                    : status === "denied"
                      ? "Camera access denied — enable it in your browser settings and reload."
                      : "Couldn't start the camera. Try reloading, or use a device with a front camera."}
              </p>
            </div>
          )}

          {status === "running" && !faceFound && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 font-sans text-caption uppercase tracking-[0.1em] text-white/70">
              Center your face in frame
            </p>
          )}
        </div>

        {/* Right thumbnail rail. */}
        <div className="hidden w-24 flex-none flex-col gap-2 md:flex">
          {rightProducts.map((p) => (
            <Thumbnail key={p.slug} product={p} active={selected.slug === p.slug} onSelect={() => setSelected(p)} />
          ))}
        </div>
      </div>

      {/* Mobile fallback: both rails as one row under the camera, since there's no side space. */}
      <div className="mt-4 grid w-full max-w-2xl grid-cols-8 gap-2 md:hidden">
        {products.map((p) => (
          <Thumbnail key={p.slug} product={p} active={selected.slug === p.slug} onSelect={() => setSelected(p)} />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <p className="font-sans text-body-s text-white">{shortProductName(selected.name)}</p>
        <p className="font-sans text-body-s text-white/70">₹{selected.price.toLocaleString("en-IN")}</p>
      </div>
      <div className="mt-3">
        <BuyNowButton
          chapter={selected}
          image={chapterImageSrc(selected.folder, selected.sideImage)}
          variant="minimal"
        />
      </div>
    </div>
  );
}
