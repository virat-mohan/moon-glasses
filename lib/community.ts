import { getSupabaseServerClient } from "@/lib/supabase";

export type ExplorerPost = {
  file: string;
  src: string;
  testimonial: string;
  chapterSlugs: string[];
};

/**
 * Community/UGC wall — no seed photos yet (previous static set was from an
 * earlier brand and has been removed). Drop real rave/festival crowd
 * shots into public/images/community/ and add captions here, or approve
 * submissions in /admin/explorer-submissions once that flow is wired back up.
 */
export async function getExplorerPosts(): Promise<ExplorerPost[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("explorer_submissions")
      .select("id, photo_url, testimonial, chapter_slugs")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => ({
      file: row.id,
      src: row.photo_url,
      testimonial: row.testimonial,
      chapterSlugs: row.chapter_slugs ?? [],
    }));
  } catch {
    return [];
  }
}

export async function getExplorerPostsForChapter(slug: string): Promise<ExplorerPost[]> {
  const posts = await getExplorerPosts();
  return posts.filter((p) => p.chapterSlugs.includes(slug));
}
