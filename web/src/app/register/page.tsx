"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, confirmPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(data.message)
                        ? data.message.join(", ")
                        : data.message || "Registration failed",
                );
            }

            router.push("/login");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Registration failed",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-md px-6 py-16">
            <h1 className="text-3xl font-bold">Register</h1>
            <p className="mt-2 text-gray-600">
                Create your Sundry account.
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
                    <p className="mt-1 text-xs text-gray-500">
                        Use 3–20 letters, numbers, or underscores.
                    </p>
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
                        autoComplete="new-password"
                        required
                        className="w-full rounded-lg border px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Use 8–50 characters.
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="confirmPassword"
                        className="mb-2 block text-sm font-medium"
                    >
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        minLength={8}
                        maxLength={50}
                        autoComplete="new-password"
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
                    {loading ? "Registering..." : "Register"}
                </button>
            </form>

            <p className="mt-6 text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-black underline">
                    Login
                </Link>
            </p>
        </main>
    );
}