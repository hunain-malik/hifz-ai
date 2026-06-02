const QURAN_API = "https://api.quran.com/api/v4";

export type Chapter = {
  id: number;
  revelation_place: "makkah" | "madinah";
  name_simple: string;
  name_arabic: string;
  translated_name: { name: string };
  verses_count: number;
  pages: [number, number];
};

export type Verse = {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  page_number: number;
};

export async function fetchChapters(): Promise<Chapter[]> {
  const res = await fetch(`${QURAN_API}/chapters?language=en`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  const data = (await res.json()) as { chapters: Chapter[] };
  return data.chapters;
}

export async function fetchChapter(id: number): Promise<Chapter> {
  const res = await fetch(`${QURAN_API}/chapters/${id}?language=en`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) throw new Error(`Failed to fetch chapter ${id}: ${res.status}`);
  const data = (await res.json()) as { chapter: Chapter };
  return data.chapter;
}

export async function fetchVerses(chapterId: number): Promise<Verse[]> {
  const res = await fetch(
    `${QURAN_API}/verses/by_chapter/${chapterId}?fields=text_uthmani,page_number&per_page=300`,
    { next: { revalidate: 60 * 60 * 24 * 30 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch verses: ${res.status}`);
  const data = (await res.json()) as {
    verses: {
      id: number;
      verse_key: string;
      verse_number: number;
      text_uthmani: string;
      page_number: number;
    }[];
  };
  return data.verses.map((v) => ({
    id: v.id,
    verse_key: v.verse_key,
    verse_number: v.verse_number,
    text_uthmani: v.text_uthmani,
    page_number: v.page_number,
  }));
}

export function pageLabel(pages: [number, number]): string {
  return pages[0] === pages[1] ? `Page ${pages[0]}` : `Pages ${pages[0]}–${pages[1]}`;
}
