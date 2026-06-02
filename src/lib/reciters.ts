export type Reciter = {
  id: string;
  name: string;
  arabicName: string;
  style: "murattal" | "mujawwad" | "muallim";
  everyAyahPath: string;
};

export const RECITERS: Reciter[] = [
  {
    id: "mishary",
    name: "Mishary Rashid Al-Afasy",
    arabicName: "مشاري راشد العفاسي",
    style: "murattal",
    everyAyahPath: "Alafasy_128kbps",
  },
  {
    id: "sudais",
    name: "Abdul Rahman Al-Sudais",
    arabicName: "عبد الرحمن السديس",
    style: "murattal",
    everyAyahPath: "Abdurrahmaan_As-Sudais_192kbps",
  },
  {
    id: "husary",
    name: "Mahmoud Khalil Al-Husary",
    arabicName: "محمود خليل الحصري",
    style: "murattal",
    everyAyahPath: "Husary_128kbps",
  },
  {
    id: "husary-mujawwad",
    name: "Al-Husary (Mujawwad)",
    arabicName: "الحصري — مجوّد",
    style: "mujawwad",
    everyAyahPath: "Husary_Mujawwad_128kbps",
  },
  {
    id: "minshawi",
    name: "Mohamed Siddiq Al-Minshawi",
    arabicName: "محمد صديق المنشاوي",
    style: "murattal",
    everyAyahPath: "Minshawy_Murattal_128kbps",
  },
  {
    id: "minshawi-mujawwad",
    name: "Al-Minshawi (Mujawwad)",
    arabicName: "المنشاوي — مجوّد",
    style: "mujawwad",
    everyAyahPath: "Minshawy_Mujawwad_192kbps",
  },
  {
    id: "ghamdi",
    name: "Saad Al-Ghamdi",
    arabicName: "سعد الغامدي",
    style: "murattal",
    everyAyahPath: "Ghamadi_40kbps",
  },
  {
    id: "shatri",
    name: "Abu Bakr Al-Shatri",
    arabicName: "أبو بكر الشاطري",
    style: "murattal",
    everyAyahPath: "Abu_Bakr_Ash-Shaatree_128kbps",
  },
  {
    id: "muaiqly",
    name: "Maher Al-Muaiqly",
    arabicName: "ماهر المعيقلي",
    style: "murattal",
    everyAyahPath: "MaherAlMuaiqly128kbps",
  },
  {
    id: "shuraim",
    name: "Saud Al-Shuraim",
    arabicName: "سعود الشريم",
    style: "murattal",
    everyAyahPath: "Saood_ash-Shuraym_128kbps",
  },
  {
    id: "muallim-husary",
    name: "Al-Husary (Mu'allim — teaching style)",
    arabicName: "الحصري — معلّم",
    style: "muallim",
    everyAyahPath: "Husary_Muallim_128kbps",
  },
];

export const DEFAULT_RECITER_ID = "mishary";

export function getReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}
