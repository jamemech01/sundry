"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(data.message)
                        ? data.message.join(", ")
                        : data.message || "Login failed",
                );
            }

            router.push("/");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-md px-6 py-16">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="mt-2 text-gray-600">
                Log in to your Sundry account.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                    <label htmlFor="username" className="mb-2 block text-sm font-medium">
                        Username
                    </label>
                    <input
                        id="username"
                        name="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        minLength={3}
                        maxLength={20}
                        pattern="[a-zA-Z0-9_]+"
                        autoComplete="username"
                        required
                        className="w-full rounded-lg border px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-medium">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        maxLength={50}
                        autoComplete="current-password"
                        required
                        className="w-full rounded-lg border px-3 py-2"
                    />
                </div>

                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
                >
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>

            <p className="mt-6 text-sm text-gray-600">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-medium text-black underline">
                    Register
                </Link>
            </p>
        </main>
    );
}