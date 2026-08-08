// Curated tajweed / qira'at knowledge base for the recitation chatbot.
//
// The chatbot's job is narrow and Quran-specific, so the answers live in a
// hand-checked knowledge base rather than a general-purpose language model —
// no hallucinated rulings, no server, no API keys. Every entry can point at a
// demo passage so the bot doesn't just describe a rule, it plays a verified
// sheikh recording that exemplifies it.

export type KbDemo = {
  surahId: number;
  from: number;
  to: number;
  note: string;
};

export type KbEntry = {
  id: string;
  title: string;
  keywords: string[];
  answer: string[];
  demo?: KbDemo;
};

export const TAJWEED_KB: KbEntry[] = [
  {
    id: "tajweed",
    title: "What is Tajweed?",
    keywords: ["tajweed", "tajwid", "tajweeed", "rules of recitation"],
    answer: [
      "Tajweed (تجويد, \"to make well\") is the science of reciting the Quran exactly as it was revealed — giving every letter its right (haqq: its articulation point and inherent attributes) and its due (mustahaqq: attributes that appear in context, like ghunna or madd).",
      "Its major rule families are: makharij al-huruf (articulation points), sifat al-huruf (letter attributes), rules of noon sakinah & tanween (izhar, idgham, iqlab, ikhfa), rules of meem sakinah, madd (elongation), qalqalah (echoing bounce), and waqf & ibtida (stopping and starting).",
      "Ask me about any of these by name — e.g. \"what is qalqalah?\" or \"explain the madd rules\" — and I can play a sheikh recording that demonstrates it.",
    ],
    demo: {
      surahId: 1,
      from: 1,
      to: 7,
      note: "Al-Fatihah recited with full tajweed — listen for the 6-count madd in wa-lad-dāllīn (last ayah).",
    },
  },
  {
    id: "tarteel",
    title: "Tarteel",
    keywords: ["tarteel", "tartil", "measured recitation", "slow recitation"],
    answer: [
      "Tarteel (ترتيل) is measured, unhurried recitation with correct tajweed and reflection — the pace Allah commands in Surah Al-Muzzammil 73:4: \"wa rattilil-Qur'āna tartīlā\" (\"and recite the Quran with measured recitation\").",
      "In practice, reciters distinguish three tempos: tahqeeq (slowest, for teaching), tadweer (moderate), and hadr (quick, but never sacrificing the rules). Murattal recordings — like most reciters in this app — are recited at tarteel pace.",
    ],
    demo: {
      surahId: 73,
      from: 1,
      to: 4,
      note: "Surah Al-Muzzammil 1–4, ending with the very ayah that commands tarteel.",
    },
  },
  {
    id: "qiraat",
    title: "The Qira'at (canonical readings)",
    keywords: [
      "qiraat", "qirat", "qira'at", "qiraah", "readings", "ten readings",
      "seven readings", "riwayah", "riwaya", "asim", "nafi",
    ],
    answer: [
      "The Qira'at are the canonical modes of reciting the Quran, each transmitted with an unbroken chain (isnad) back to the Prophet ﷺ. Ten are recognized as mutawatir/authentic, each named for a master reciter: Nafi', Ibn Kathir, Abu 'Amr, Ibn 'Amir, 'Asim, Hamzah, Al-Kisa'i, Abu Ja'far, Ya'qub, and Khalaf.",
      "Each qira'ah is transmitted through two main students, giving a riwayah (transmission). The reading most of the world recites today is Hafs 'an 'Asim — the transmission of Hafs from 'Asim of Kufa. Warsh 'an Nafi' is widespread in North & West Africa.",
      "Differences between qira'at are in pronunciation, madd lengths, and some word forms — all divinely revealed variants, not errors. Everything you hear in this app is currently Hafs 'an 'Asim; multi-qira'at (Warsh, Qalun, Al-Duri) is on the Hifz.ai roadmap.",
    ],
  },
  {
    id: "hafs",
    title: "Hafs 'an 'Asim",
    keywords: ["hafs", "hafs an asim", "hafs asim"],
    answer: [
      "Hafs 'an 'Asim is the riwayah (transmission) of Hafs ibn Sulayman from his teacher 'Asim ibn Abi al-Najud of Kufa — one of the ten canonical qira'at. It's the reading printed in the standard Madinah mushaf and recited by the overwhelming majority of Muslims today.",
      "Characteristic features include: madd muttasil and munfasil at 4–5 counts, a single madd length per category, and the famous 2-count madd on عين in the openings of Maryam and Ash-Shura. All reciters and text in this app follow Hafs.",
    ],
  },
  {
    id: "warsh",
    title: "Warsh 'an Nafi'",
    keywords: ["warsh", "warsh an nafi", "nafi reading"],
    answer: [
      "Warsh 'an Nafi' is the transmission of Warsh ('Uthman ibn Sa'id) from Nafi' al-Madani, dominant in Morocco, Algeria, and much of West Africa.",
      "Compared to Hafs it features: taqleel/imalah (slight vowel inclination) in many alif-maqsurah words, longer madd muttasil (6 counts), transfer of hamzah's vowel to a preceding sakin letter (naql), and different orthography in a handful of words. The meaning of the Quran is identical — the variants are all authentically transmitted.",
      "Hifz.ai currently recites in Hafs only; Warsh overlays are planned for Phase 3.",
    ],
  },
  {
    id: "noon-sakinah",
    title: "Noon Sakinah & Tanween rules",
    keywords: [
      "noon sakinah", "noon sakin", "nun sakinah", "tanween", "tanwin",
      "izhar", "idgham", "idghaam", "iqlab", "ikhfa", "ikhfaa",
    ],
    answer: [
      "When a noon sakinah (نْ) or tanween meets the next letter, one of four rules applies:",
      "1. Izhar (clear pronunciation) — before the 6 throat letters ء ه ع ح غ خ: the noon is pronounced clearly with no ghunna extension.",
      "2. Idgham (merging) — before ي ر م ل و ن (yarmalūn): the noon merges into the next letter. With ي ن م و the merge keeps ghunna (idgham bi-ghunna); with ل ر it doesn't.",
      "3. Iqlab (conversion) — before ب: the noon converts to a hidden meem with ghunna, held 2 counts (e.g. مِنۢ بَعْدِ → \"mim ba'di\").",
      "4. Ikhfa (hiding) — before the remaining 15 letters: the noon is hidden between izhar and idgham, with a 2-count ghunna whose mouth posture anticipates the next letter.",
    ],
    demo: {
      surahId: 112,
      from: 1,
      to: 4,
      note: "Al-Ikhlas 4: \"wa lam yakul-lahu kufuwan ahad\" — tanween meeting hamzah (izhar) right after an idgham of noon into lam.",
    },
  },
  {
    id: "meem-sakinah",
    title: "Meem Sakinah rules",
    keywords: [
      "meem sakinah", "meem sakin", "mim sakinah", "ikhfa shafawi",
      "idgham shafawi", "izhar shafawi", "shafawi",
    ],
    answer: [
      "A meem sakinah (مْ) follows one of three rules based on the next letter:",
      "1. Ikhfa Shafawi (labial hiding) — before ب: the meem is lightly hidden with ghunna (e.g. تَرْمِيهِم بِحِجَارَةٍ).",
      "2. Idgham Shafawi — before another م: the meems merge with a full 2-count ghunna (e.g. لَهُم مَّا).",
      "3. Izhar Shafawi — before all other letters: the meem is pronounced clearly, taking special care before و and ف since they share/neighbor the meem's articulation point.",
    ],
    demo: {
      surahId: 105,
      from: 1,
      to: 5,
      note: "Al-Fil — listen for تَرْمِيهِم بِحِجَارَةٍ in ayah 4: ikhfa shafawi of meem before ba.",
    },
  },
  {
    id: "ghunna",
    title: "Ghunna (nasalization)",
    keywords: ["ghunna", "ghunnah", "nasal", "nasalization"],
    answer: [
      "Ghunna (غنّة) is the nasal sound produced from the nasal cavity (khayshum) — it always accompanies noon and meem, and reaches its fullest 2-count length when either is mushaddad (نّ / مّ) or in idgham, ikhfa, and iqlab positions.",
      "A reliable drill: pinch your nose while saying إِنَّ — if the sound cuts off, you're producing ghunna correctly, because it flows entirely through the nose.",
    ],
    demo: {
      surahId: 114,
      from: 1,
      to: 6,
      note: "An-Nas — the repeated النَّاس carries a full 2-count ghunna on the shaddah noon each time.",
    },
  },
  {
    id: "qalqalah",
    title: "Qalqalah (echoing bounce)",
    keywords: ["qalqalah", "qalqala", "echo", "bounce"],
    answer: [
      "Qalqalah (قلقلة) is the bouncing echo applied to the five letters ق ط ب ج د (gathered in the mnemonic قُطْبُ جَدٍّ, \"qutbu jadd\") when they carry sukoon.",
      "It has levels: sughra (minor) when the letter is sakin mid-word or mid-flow, and kubra (major) when you stop on the letter at the end of an ayah — the bounce is strongest there, and strongest of all on a stopped mushaddad letter (like الحقّ).",
    ],
    demo: {
      surahId: 113,
      from: 1,
      to: 5,
      note: "Al-Falaq — every ayah ends on a qalqalah letter (ق، ب، د): a masterclass in qalqalah kubra at each stop.",
    },
  },
  {
    id: "madd",
    title: "Madd (elongation)",
    keywords: [
      "madd", "mad", "elongation", "prolongation", "stretch", "harakat count",
      "madd muttasil", "madd munfasil", "madd lazim", "madd arid",
    ],
    answer: [
      "Madd (مدّ) is elongating a vowel sound on the madd letters (ا و ي preceded by the matching vowel). The main types in Hafs:",
      "• Madd Tabee'i (natural) — 2 counts, when no hamzah or sukoon follows.",
      "• Madd Muttasil (connected) — 4–5 counts, hamzah follows in the same word (e.g. جَآءَ).",
      "• Madd Munfasil (separated) — 4–5 counts, hamzah starts the next word (e.g. يَـٰٓأَيُّهَا).",
      "• Madd Lazim (necessary) — 6 counts, a permanent sukoon or shaddah follows (e.g. الضَّآلِّينَ, and the opening letters like الٓمٓ).",
      "• Madd 'Arid lis-Sukoon — 2, 4, or 6 counts when stopping creates a temporary sukoon at an ayah end.",
      "A \"count\" (harakah) is the time of one finger flex — consistency matters more than absolute speed.",
    ],
    demo: {
      surahId: 1,
      from: 7,
      to: 7,
      note: "Al-Fatihah 7 — وَلَا ٱلضَّآلِّينَ carries the famous 6-count madd lazim.",
    },
  },
  {
    id: "makharij",
    title: "Makharij al-Huruf (articulation points)",
    keywords: [
      "makharij", "makhraj", "articulation", "articulation points",
      "pronunciation points", "where letters come from",
    ],
    answer: [
      "Makharij al-huruf are the emission points of the letters — classically 17 points grouped into 5 regions:",
      "• Al-Jawf (oral/nasal cavity): the 3 madd letters.",
      "• Al-Halq (throat): ء ه (deepest), ع ح (middle), غ خ (nearest) — the 6 izhar letters.",
      "• Al-Lisan (tongue): 10 points covering ق ك ج ش ي ض ل ن ر ط د ت ص س ز ظ ذ ث.",
      "• Ash-Shafatan (lips): ف and ب م و.",
      "• Al-Khayshum (nasal cavity): the ghunna.",
      "Mastering makharij is the foundation — most recitation errors graded by Hifz.ai's letter-level diff come down to a makhraj slip (e.g. confusing س with ص, or ه with ح).",
    ],
  },
  {
    id: "waqf",
    title: "Waqf & Ibtida (stopping and starting)",
    keywords: [
      "waqf", "wakf", "stopping", "stop signs", "pause marks", "ibtida",
      "stopping signs", "mushaf symbols",
    ],
    answer: [
      "Waqf is the science of where to stop, and ibtida of where to resume, so the meaning stays intact. The mushaf marks guide you:",
      "• مـ (lazim) — obligatory stop; continuing could distort meaning.",
      "• قلى — stopping is preferred.  • صلى — continuing is preferred.",
      "• ج (ja'iz) — either is fine.",
      "• لا — do not stop here (unless at an ayah end).",
      "• ∴ ∴ (mu'anaqah twins) — stop at one of the pair, not both.",
      "When you stop, tajweed adjusts: final vowels drop to sukoon (creating madd 'arid or qalqalah kubra), and a final tanween-fath becomes an alif sound.",
    ],
  },
  {
    id: "basmalah",
    title: "Isti'adhah & Basmalah",
    keywords: [
      "basmalah", "bismillah", "istiadhah", "isti'adhah", "audhu billah",
      "starting recitation",
    ],
    answer: [
      "Before reciting, say the isti'adhah (أعوذ بالله من الشيطان الرجيم) — commanded in Surah An-Nahl 16:98. The basmalah (بسم الله الرحمن الرحيم) then opens every surah except At-Tawbah (surah 9).",
      "In Hafs, when joining the end of one surah to the start of the next, you may stop or join through the basmalah — but at At-Tawbah you proceed without it. Only in Al-Fatihah does the basmalah count as ayah 1.",
    ],
  },
  {
    id: "sifat",
    title: "Sifat al-Huruf (letter attributes)",
    keywords: [
      "sifat", "sifaat", "attributes", "letter attributes", "hams", "jahr",
      "tafkheem", "tarqeeq", "heavy letters", "light letters", "isti'la",
    ],
    answer: [
      "Sifat al-huruf are the qualities that distinguish letters sharing a makhraj. Key paired attributes: hams/jahr (breathiness vs voicing), shiddah/rikhawah (stopped vs flowing sound), isti'la/istifal (elevated vs lowered tongue — the 7 isti'la letters خ ص ض غ ط ق ظ are always heavy/mufakhkham), itbaq/infitah, and idhlaq/ismat.",
      "Unpaired attributes include safeer (whistle of ص س ز), qalqalah, leen, inhiraf, takreer (the rolled ر, to be restrained), tafashshi (spreading of ش), and istitalah (elongation of ض).",
      "The letter ر and lam of الله switch between heavy and light by context — a classic grading point for advanced tajweed.",
    ],
  },
];

/** Find the best KB entry for a normalized (lowercased) user query. */
export function findKbEntry(normalizedInput: string): KbEntry | null {
  let best: KbEntry | null = null;
  let bestScore = 0;
  for (const entry of TAJWEED_KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (normalizedInput.includes(kw)) {
        // Longer keyword hits are more specific
        score += kw.length;
      }
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}
