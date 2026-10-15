
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("sundry_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "API_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const upstream = await fetch(`${apiUrl}/wallet`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (upstream.status === 401 || upstream.status === 403) {
      const response = NextResponse.json({ authenticated: false });
      response.cookies.set("sundry_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { message: "Unable to verify login" },
        { status: 502 },
      );
    }

    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json(
      { message: "Backend is unavailable" },
      { status: 502 },
    );
  }
}
