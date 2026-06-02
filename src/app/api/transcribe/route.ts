import { NextResponse } from "next/server";

const HF_MODEL = "tarteel-ai/whisper-base-ar-quran";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function POST(request: Request) {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HF_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return NextResponse.json({ error: "Empty audio body." }, { status: 400 });
  }

  const hfRes = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: audio,
  });

  if (!hfRes.ok) {
    const detail = await hfRes.text();
    return NextResponse.json(
      { error: "HF inference failed", status: hfRes.status, detail },
      { status: 502 }
    );
  }

  const data = (await hfRes.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? "" });
}
