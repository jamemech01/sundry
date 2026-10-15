"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Wallet = {
    id: number;
    balance: number | string;
};

export default function WalletPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [amount, setAmount] = useState("100");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function loadWallet() {
        try {
            const data = await apiFetch<Wallet>("wallet");
            setWallet(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load wallet.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadWallet();
    }, []);

    async function handleTopup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        const value = Number(amount);

        if (!Number.isFinite(value) || value < 0.01 || value > 1_000_000) {
            setError("Amount must be between ฿0.01 and ฿1,000,000.");
            return;
        }

        if (Math.round(value * 100) !== value * 100) {
            setError("Amount can have at most 2 decimal places.");
            return;
        }

        setSubmitting(true);

        try {
            const data = await apiFetch<Wallet>("wallet/topup", {
                method: "POST",
                body: JSON.stringify({ amount: value }),
            });

            setWallet(data);
            setSuccess("Top-up successful.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Top-up failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="mt-2 text-gray-600">Manage your Sundry wallet balance.</p>

            <section className="mt-8 rounded-2xl bg-black p-6 text-white">
                <p className="text-sm text-gray-300">Available balance</p>
                <p className="mt-3 text-4xl font-bold">
                    {loading
                        ? "Loading..."
                        : `฿${Number(wallet?.balance ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}`}
                </p>
            </section>

            <form
                onSubmit={handleTopup}
                className="mt-8 space-y-5 rounded-2xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Top up wallet</h2>

                <div>
                    <label htmlFor="amount" className="mb-2 block text-sm font-medium">
                        Amount (THB)
                    </label>
                    <input
                        id="amount"
                        name="amount"
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                    />
                </div>

                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}

                {success && (
                    <p role="status" className="text-sm text-green-700">
                        {success}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading || submitting}
                    className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
                >
                    {submitting ? "Processing..." : "Top up"}
                </button>

                <p className="text-xs text-gray-500">
                    This is a mock top-up for development. No real payment is processed.
                </p>
            </form>
        </main>
    );
}