import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('url');
  if (!source) {
    return NextResponse.json({ error: 'Falta la URL de Postimg.' }, { status: 400 });
  }

  let pageUrl: URL;
  try {
    pageUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: 'La URL de Postimg no es válida.' }, { status: 400 });
  }

  if (
    pageUrl.protocol !== 'https:' ||
    !['postimg.cc', 'www.postimg.cc'].includes(pageUrl.hostname) ||
    !/^\/[a-zA-Z0-9]+\/?$/.test(pageUrl.pathname)
  ) {
    return NextResponse.json(
      { error: 'Solo se pueden resolver enlaces compartidos de Postimg.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Veto-App/1.0' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'No pudimos consultar el enlace de Postimg.' },
        { status: 422 },
      );
    }

    const html = await response.text();
    const metadata = html
      .match(/<meta\b[^>]*>/gi)
      ?.find((tag) => /\b(?:property|name)\s*=\s*["']og:image["']/i.test(tag));
    const imageSource = metadata?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!imageSource) {
      return NextResponse.json(
        { error: 'Postimg no publicó una imagen para este enlace.' },
        { status: 422 },
      );
    }

    const imageUrl = new URL(imageSource.replaceAll('&amp;', '&'), pageUrl);
    if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'i.postimg.cc') {
      return NextResponse.json(
        { error: 'El enlace de Postimg no apunta a una imagen compatible.' },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { url: imageUrl.toString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'No pudimos obtener la imagen. Revisa que el enlace sea público e inténtalo de nuevo.',
      },
      { status: 422 },
    );
  }
}
