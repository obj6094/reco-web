import { NextResponse } from "next/server";

/**
 * Spotify 검색 API
 * ⚠️ 키는 코드에 넣지 말고 .env.local에 넣습니다.
 * - SPOTIFY_CLIENT_ID
 * - SPOTIFY_CLIENT_SECRET
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing Spotify env vars" },
      { status: 500 }
    );
  }

  // 1) Client Credentials 토큰 발급
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return NextResponse.json(
      { error: "Spotify token error", detail: errText },
      { status: 500 }
    );
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token as string;

  // 2) 트랙 검색
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=5&q=${encodeURIComponent(
      q
    )}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    return NextResponse.json(
      { error: "Spotify search error", detail: errText },
      { status: 500 }
    );
  }

  const data = await searchRes.json();

  // UI에서 쓰기 편하게 track 리스트만 추려서 반환
  const tracks =
    data?.tracks?.items?.map((t: any) => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map((a: any) => a.name).join(", "),
      albumImage:
        t.album?.images?.[0]?.url ?? t.album?.images?.[1]?.url ?? null,
      externalUrl: t.external_urls?.spotify ?? null,
    })) ?? [];

  return NextResponse.json({ tracks });
}