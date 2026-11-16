"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/app-header";
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
  type: "topup" | "refund" | "sale" | "withdrawal";
  status: "pending" | "completed" | "rejected";
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
  if (transaction.type === "withdrawal") return "Withdrawal";
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
  const [historyError, setHistoryError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalAction, setModalAction] = useState<"topup" | "withdraw" | null>(
    null,
  );
  const [walletError, setWalletError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!modalAction) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        setModalAction(null);
        setError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalAction, submitting]);

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

        if (auth.authenticated !== true || typeof auth.userId !== "number") {
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

        const [walletResult, historyResult] = await Promise.allSettled([
          apiFetch<Wallet>("wallet"),
          apiFetch<Transaction[]>("wallet/transactions"),
        ]);

        if (!active) return;

        if (walletResult.status === "fulfilled") {
          setWallet(walletResult.value);
          setWalletError("");
        } else {
          setWalletError(
            walletResult.reason instanceof Error
              ? walletResult.reason.message
              : "Unable to load wallet.",
          );
        }

        if (historyResult.status === "fulfilled") {
          setTransactions(historyResult.value);
          setHistoryError("");
        } else {
          setHistoryError(
            historyResult.reason instanceof Error
              ? historyResult.reason.message
              : "Unable to load transaction history.",
          );
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

  async function handleWalletAction(event: SubmitEvent<HTMLFormElement>) {
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

    if (Number(value.toFixed(2)) !== value) {
      setError("Amount can have at most 2 decimal places.");
      return;
    }

    if (modalAction === "withdraw" && value > Number(wallet?.balance ?? 0)) {
      setError("Insufficient wallet balance.");
      return;
    }

    if (authStatus !== "logged-in") {
      setError("Please log in to use your wallet.");
      return;
    }

    const action = modalAction;
    if (!action) return;

    setSubmitting(true);

    try {
      const data = await apiFetch<Wallet>(
        action === "topup" ? "wallet/topup" : "wallet/withdraw",
        {
          method: "POST",
          body: JSON.stringify({ amount: value }),
        },
      );

      setWallet(data);
      setAmount("");
      setSuccess(
        action === "topup" ? "Top-up successful." : "Withdrawal completed.",
      );
      setModalAction(null);

      try {
        const history = await apiFetch<Transaction[]>("wallet/transactions");
        setTransactions(history);
        setHistoryError("");
      } catch {
        setHistoryError(
          `${action === "topup" ? "Top-up" : "Withdrawal"} completed, but history could not be refreshed.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : action === "topup"
            ? "Top-up failed."
            : "Withdrawal failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const focusStyle =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-[610] w-full">
        <div className="absolute left-3 top-[max(10px,env(safe-area-inset-top))] z-[610] sm:left-6 lg:left-8">
          <BackButton />
        </div>
        <AppHeader />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pb-36 sm:pt-8">
        <div className="mb-6">
          <h1 className="page-title">Wallet</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your balance and review transactions.
          </p>
        </div>

        {walletError && authStatus === "logged-in" && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {walletError}
          </p>
        )}

        {authStatus === "loading" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
            <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-gray-200" />
            <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-gray-200" />
          </div>
        ) : authStatus === "logged-out" ? (
          <section className="max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm text-gray-700">
              Please log in to access your wallet.
            </p>
            <Link
              href="/login"
              className={`mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 ${focusStyle}`}
            >
              Log in
            </Link>
          </section>
        ) : (
          <div className="space-y-5">
            {success && (
              <p
                role="status"
                className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700"
              >
                {success}
              </p>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-medium text-gray-500">
                Available balance
              </p>
              <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums text-gray-900 sm:text-4xl">
                {loading
                  ? "Loading..."
                  : `฿${formatBalance(wallet?.balance ?? 0)}`}
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="section-title">Transactions</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Your recent wallet activity
                  </p>
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-4 p-5 sm:p-6">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-xl bg-gray-100"
                    />
                  ))}
                </div>
              ) : historyError ? (
                <p
                  role="alert"
                  className="m-5 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:m-6"
                >
                  {historyError}
                </p>
              ) : transactions.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">
                  No transactions yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 px-5 sm:px-6">
                  {transactions.map((transaction) => {
                    const moneyIn = isMoneyIn(transaction.type);

                    return (
                      <li
                        key={transaction.id}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-medium ${
                              moneyIn
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {moneyIn ? "+" : "−"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {getTransactionLabel(transaction)}
                            </p>
                            {transaction.orderId !== null && (
                              <Link
                                href={`/orders/${transaction.orderId}`}
                                className={`mt-0.5 inline-block text-xs text-gray-500 underline underline-offset-4 hover:text-gray-900 ${focusStyle}`}
                              >
                                Order #{transaction.orderId}
                              </Link>
                            )}
                            <p className="mt-0.5 text-xs text-gray-500">
                              {formatDate(transaction.createdAt)}
                              {transaction.type === "withdrawal" && (
                                <>
                                  {" · "}
                                  {transaction.status === "completed"
                                    ? "Completed"
                                    : transaction.status}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            moneyIn ? "text-green-700" : "text-gray-900"
                          }`}
                        >
                          {moneyIn ? "+" : "−"}฿
                          {formatBalance(transaction.amount)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      {authStatus === "logged-in" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[590] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
          <div className="pointer-events-auto mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg shadow-gray-900/10 backdrop-blur-xl sm:p-4">
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setAmount("");
                setModalAction("withdraw");
              }}
              disabled={loading}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 ${focusStyle}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M5 12h14" />
              </svg>
              Withdraw
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setAmount("");
                setModalAction("topup");
              }}
              disabled={loading}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 ${focusStyle}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Top up
            </button>
          </div>
        </div>
      )}

      {modalAction && authStatus === "logged-in" && (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center bg-gray-950/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setModalAction(null);
              setError("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-action-title"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-950/20 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="wallet-action-title" className="section-title">
                {modalAction === "topup" ? "Top up" : "Withdraw"}
              </h2>
              <button
                type="button"
                aria-label={`Close ${modalAction === "topup" ? "top-up" : "withdrawal"} form`}
                onClick={() => {
                  if (submitting) return;
                  setModalAction(null);
                  setError("");
                }}
                disabled={submitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="h-5 w-5"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[100, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setAmount(String(preset));
                    setError("");
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    amount === String(preset)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  } ${focusStyle}`}
                >
                  ฿{preset.toLocaleString("en-US")}
                </button>
              ))}
            </div>

            <form onSubmit={handleWalletAction} className="mt-4">
              <label
                htmlFor="amount"
                className="text-sm font-medium text-gray-700"
              >
                Amount
                <div className="mt-1.5 flex h-12 items-center rounded-xl border border-gray-200 bg-white px-3.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
                  <span className="mr-2 text-base text-gray-400">฿</span>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    max={
                      modalAction === "withdraw"
                        ? Number(wallet?.balance ?? 0)
                        : 1_000_000
                    }
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setError("");
                    }}
                    disabled={submitting}
                    placeholder="0.00"
                    aria-label={`${modalAction === "topup" ? "Top-up" : "Withdrawal"} amount in Thai baht`}
                    className="h-full w-full min-w-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:bg-gray-50"
                  />
                </div>
              </label>

              <div
                aria-live="polite"
                className="mt-3 flex min-h-12 flex-col justify-center gap-1"
              >
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
              >
                {submitting
                  ? "Processing..."
                  : modalAction === "topup"
                    ? "Top up"
                    : "Withdraw"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
