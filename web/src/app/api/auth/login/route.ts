import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const apiUrl = process.env.API_URL;

    if (!apiUrl) {
        return NextResponse.json(
            { message: "API_URL is not configured" },
            { status: 500 },
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { message: "Invalid request body" },
            { status: 400 },
        );
    }

    let upstream: Response;

    try {
        upstream = await fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });
    } catch {
        return NextResponse.json(
            { message: "Backend is unavailable" },
            { status: 502 },
        );
    }

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
        return NextResponse.json(
            data ?? { message: "Login failed" },
            { status: upstream.status },
        );
    }

    if (!data || typeof data.accessToken !== "string") {
        return NextResponse.json(
            { message: "Invalid response from backend" },
            { status: 502 },
        );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("sundry_token", data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
    });

    return response;
}
