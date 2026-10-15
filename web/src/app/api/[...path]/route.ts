import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "API_URL is not configured" },
      { status: 500 },
    );
  }

  const { path } = await context.params;
  const pathname = path.join("/");

  if (pathname === "auth/login" || pathname === "auth/register") {
    return NextResponse.json(
      { message: "Use the dedicated auth endpoint" },
      { status: 404 },
    );
  }

  const token = request.cookies.get("sundry_token")?.value;
  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = new URL(
    `/${pathname}`,
    apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`,
  );
  url.search = request.nextUrl.search;

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");

    if (upstreamContentType) {
      responseHeaders.set("Content-Type", upstreamContentType);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: "Backend is unavailable" },
      { status: 502 },
    );
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
};
