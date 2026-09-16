import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";

// "veo-3.0-generate-001" no longer exists for this API key — confirmed via
// ListModels that only the 3.1 preview variants are available. Using the
// standard-quality one; veo-3.1-fast-generate-preview trades quality for
// speed/cost if that turns out to matter more for ad creative at volume.
const VEO_MODEL = "veo-3.1-generate-preview";

/**
 * Starts a Veo video generation job (long-running — Google's API returns an
 * operation name immediately, the actual video takes 1-3+ minutes). Uses the
 * same IMAGE_GEN_API_KEY (a Google AI Studio key) as the image generator.
 * This is the least battle-tested integration in the pipeline — the exact
 * response shape for long-running video operations may need adjustment once
 * exercised against a real key; the field lookups in checkVideoStatus are
 * deliberately defensive for that reason.
 */
export async function startVideoGeneration(prompt: string, referenceImageUrl?: string) {
  const apiKey = await getSetting("IMAGE_GEN_API_KEY");
  if (!apiKey) throw new Error("IMAGE_GEN_API_KEY is not set — add a Gemini/Veo key in /admin/settings");

  const instance: Record<string, unknown> = { prompt };
  if (referenceImageUrl) {
    const refRes = await fetch(referenceImageUrl);
    if (refRes.ok) {
      const buffer = await refRes.arrayBuffer();
      const mimeType = refRes.headers.get("content-type") ?? "image/png";
      instance.image = { bytesBase64Encoded: Buffer.from(buffer).toString("base64"), mimeType };
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [instance],
        parameters: { aspectRatio: "9:16", durationSeconds: 8 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Veo generation failed to start: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const operationName = data.name;
  if (!operationName) throw new Error("Veo did not return an operation name");
  return operationName as string;
}

/**
 * Polls a Veo operation. Returns { done: false } while still rendering, or
 * { done: true, videoUrl } once uploaded to Storage. Call this from a manual
 * "Check Status" button in the admin UI rather than blocking a request on it
 * — video generation is too slow to hold an HTTP request open for.
 */
export async function checkVideoStatus(operationName: string, briefId: string) {
  const apiKey = await getSetting("IMAGE_GEN_API_KEY");
  if (!apiKey) throw new Error("IMAGE_GEN_API_KEY is not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Veo status check failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  if (!data.done) return { done: false as const };

  if (data.error) {
    throw new Error(`Veo generation failed: ${JSON.stringify(data.error)}`);
  }

  const videoUri =
    data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
    data.response?.generatedVideos?.[0]?.video?.uri ??
    data.response?.videos?.[0]?.uri;
  if (!videoUri) throw new Error("Veo response did not contain a video URI");

  const videoRes = await fetch(`${videoUri}${videoUri.includes("?") ? "&" : "?"}key=${apiKey}`);
  if (!videoRes.ok) throw new Error(`Could not download generated video: ${videoRes.status}`);
  const videoBuffer = await videoRes.arrayBuffer();

  const supabase = getSupabaseServerClient();
  const path = `videos/${briefId}.mp4`;
  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, videoBuffer, { contentType: "video/mp4", upsert: true });
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return { done: true as const, videoUrl: publicUrlData.publicUrl };
}
