"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import BackButton from "@/components/ui/back-button";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type Wallet = {
    id: number;
    balance: number | string;
};

type AuthResponse = {
    authenticated?: boolean;
    userId?: number | null;
};

type Transaction = {
    id: number;
    type: "topup" | "refund" | "sale";
    amount: number | string;
    orderId: number | null;
    createdAt: string;
};

function formatBalance(balance: number | string) {
    return Number(balance).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getTransactionLabel(transaction: Transaction) {
    if (transaction.type === "topup") return "Top up";
    if (transaction.type === "refund") return "Refund";
    return "Order payment";
}

function isMoneyIn(type: Transaction["type"]) {
    return type === "topup" || type === "refund";
}

export default function WalletPage() {
    const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        let active = true;

        async function loadAccountData() {
            try {
                const response = await fetch("/api/auth/me", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Unable to check login.");
                }

                const auth = (await response.json()) as AuthResponse;

                if (
                    auth.authenticated !== true ||
                    typeof auth.userId !== "number"
                ) {
                    if (active) {
                        setAuthStatus("logged-out");
                        setLoading(false);
                        setHistoryLoading(false);
                    }
                    return;
                }

                if (active) {
                    setAuthStatus("logged-in");
                }

                const [walletResult, historyResult] =
                    await Promise.allSettled([
                        apiFetch<Wallet>("wallet"),
                        apiFetch<Transaction[]>("wallet/transactions"),
                    ]);

                if (!active) return;

                if (walletResult.status === "fulfilled") {
                    setWallet(walletResult.value);
                } else {
                    setError(
                        walletResult.reason instanceof Error
                            ? walletResult.reason.message
                            : "Unable to load wallet.",
                    );
                }

                if (historyResult.status === "fulfilled") {
                    setTransactions(historyResult.value);
                }

                setLoading(false);
                setHistoryLoading(false);
            } catch {
                if (active) {
                    setAuthStatus("logged-out");
                    setLoading(false);
                    setHistoryLoading(false);
                }
            }
        }

        void loadAccountData();

        return () => {
            active = false;
        };
    }, []);

    async function handleTopup(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        const value = Number(amount);

        if (
            amount.trim() === "" ||
            !Number.isFinite(value) ||
            value < 0.01 ||
            value > 1_000_000
        ) {
            setError("Amount must be between ฿0.01 and ฿1,000,000.");
            return;
        }

        if (Math.round(value * 100) !== value * 100) {
            setError("Amount can have at most 2 decimal places.");
            return;
        }

        if (authStatus !== "logged-in") {
            setError("Please log in to top up your wallet.");
            return;
        }

        setSubmitting(true);

        try {
            const data = await apiFetch<Wallet>("wallet/topup", {
                method: "POST",
                body: JSON.stringify({ amount: value }),
            });

            setWallet(data);
            setAmount("");
            setSuccess("Top-up successful.");

            try {
                const history = await apiFetch<Transaction[]>(
                    "wallet/transactions",
                );
                setTransactions(history);
            } catch {
                setError(
                    "Top-up successful, but history could not be refreshed.",
                );
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Top-up failed.",
            );
        } finally {
            setSubmitting(false);
        }
    }

    const focusStyle =
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

    const inputStyle =
        `h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-gray-50 ${focusStyle}`;

    return (
        <main className="min-h-screen bg-gray-50 px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
            <header className="mb-6">
                <BackButton />
            </header>

            <section className="mx-auto w-full max-w-sm">
                <h1 className="mb-6 text-2xl font-semibold leading-8 tracking-tight text-gray-900">
                    Wallet
                </h1>

                {authStatus === "loading" ? (
                    <p className="py-4 text-sm text-gray-500">
                        Loading...
                    </p>
                ) : authStatus === "logged-out" ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                        <p className="text-sm text-gray-700">
                            Please log in to access your wallet.
                        </p>

                        <Link
                            href="/login"
                            className={`mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 ${focusStyle}`}
                        >
                            Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-7 break-words text-3xl font-semibold tracking-tight tabular-nums text-gray-900">
                            {loading
                                ? "Loading..."
                                : `฿${formatBalance(wallet?.balance ?? 0)}`}
                        </p>

                        <form onSubmit={handleTopup} className="space-y-4">
                            <div>
                                <input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    min="0.01"
                                    max="1000000"
                                    step="0.01"
                                    required
                                    value={amount}
                                    onChange={(event) => {
                                        setAmount(event.target.value);
                                        setError("");
                                        setSuccess("");
                                    }}
                                    disabled={submitting || loading}
                                    placeholder="Enter amount (THB)"
                                    aria-label="Top-up amount in Thai baht"
                                    className={inputStyle}
                                />
                            </div>

                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
                                >
                                    {error}
                                </p>
                            )}

                            {success && (
                                <p
                                    role="status"
                                    className="rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-700"
                                >
                                    {success}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || submitting}
                                className={`flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
                            >
                                {submitting ? "Processing..." : "Top up"}
                            </button>
                        </form>

                        <section className="mt-10">
                            <h2 className="mb-4 text-base font-semibold text-gray-900">
                                Transactions
                            </h2>

                            {historyLoading ? (
                                <p className="py-4 text-sm text-gray-500">
                                    Loading...
                                </p>
                            ) : transactions.length === 0 ? (
                                <p className="py-4 text-sm text-gray-500">
                                    No transactions yet.
                                </p>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {transactions.map((transaction) => {
                                        const moneyIn = isMoneyIn(
                                            transaction.type,
                                        );

                                        return (
                                            <li
                                                key={transaction.id}
                                                className="flex items-start justify-between gap-3 py-4"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {getTransactionLabel(
                                                            transaction,
                                                        )}
                                                    </p>

                                                    {transaction.orderId !== null && (
                                                        <Link
                                                            href={`/orders/${transaction.orderId}`}
                                                            className={`mt-1 inline-block text-xs text-gray-500 underline underline-offset-4 hover:text-gray-900 ${focusStyle}`}
                                                        >
                                                            Order #
                                                            {transaction.orderId}
                                                        </Link>
                                                    )}

                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {formatDate(
                                                            transaction.createdAt,
                                                        )}
                                                    </p>
                                                </div>

                                                <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                                                    {moneyIn ? "+" : "−"}฿
                                                    {formatBalance(
                                                        transaction.amount,
                                                    )}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </section>
        </main>
    );
}