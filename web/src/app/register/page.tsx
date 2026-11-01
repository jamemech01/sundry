"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/back-button";

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        if (loading) return;

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
                body: JSON.stringify({
                    username,
                    password,
                    confirmPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Array.isArray(data.message)
                        ? data.message.join(", ")
                        : data.message || "Registration failed",
                );
            }

            const loginResponse = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(
                    Array.isArray(loginData.message)
                        ? loginData.message.join(", ")
                        : loginData.message ||
                        "Registration succeeded, but login failed. Please log in.",
                );
            }

            router.push("/");
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Registration failed",
            );
        } finally {
            setLoading(false);
        }
    }

    const focusStyle =
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

    const inputStyle =
        `h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 ${focusStyle}`;

    return (
        <main className="min-h-screen bg-gray-50 px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
            <header className="mb-6 flex items-center">
                <BackButton />
            </header>

            <section className="mx-auto w-full max-w-sm">
                <h1 className="mb-7 text-2xl font-semibold leading-8 tracking-tight text-gray-900">
                    Register
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="username"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                            minLength={3}
                            maxLength={20}
                            pattern="[a-zA-Z0-9_]+"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            required
                            className={inputStyle}
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                            3–20 letters, numbers, or underscores.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            minLength={8}
                            maxLength={50}
                            autoComplete="new-password"
                            required
                            className={inputStyle}
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                            8–50 characters.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassword"
                            className="mb-2 block text-sm font-medium text-gray-700"
                        >
                            Confirm password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(event.target.value)
                            }
                            minLength={8}
                            maxLength={50}
                            autoComplete="new-password"
                            required
                            className={inputStyle}
                        />
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
                    >
                        {loading ? "Creating account..." : "Register"}
                    </button>
                </form>

                <p className="mt-5 text-sm text-gray-500">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className={`inline-flex min-h-11 items-center font-semibold text-gray-900 hover:text-gray-600 ${focusStyle}`}
                    >
                        Login
                    </Link>
                </p>
            </section>
        </main>
    );
}