
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

type AuthStatus = "loading" | "logged-in" | "logged-out";
type IconName = "wallet" | "user" | "logout" | "bell" | "chevron";

type AppHeaderProps = {
    authStatus: AuthStatus;
    username: string;
    balanceText: string;
    walletError: string;
    loggingOut: boolean;
    onLogout: () => void;
    hasPendingOrders?: boolean;
    navigation?: ReactNode;
};

const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

const PANEL =
    "border border-gray-200/80 bg-white/95 shadow-md shadow-gray-900/[0.07] backdrop-blur-xl";

const STANDARD_HEIGHT = "h-12";
const ACCOUNT_WIDTH = "w-36";

const PURPLE_SURFACE =
    "border border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100";

const NEUTRAL_WALLET =
    "border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50";

const PURPLE_ICON =
    "bg-violet-100 text-violet-700";

function Icon({
    name,
    size = 20,
}: {
    name: IconName;
    size?: number;
}) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.9,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true as const,
    };

    switch (name) {
        case "wallet":
            return (
                <svg {...common}>
                    <rect x="3" y="6" width="18" height="15" rx="2.5" />
                    <path d="M3 9V5a2 2 0 0 1 2-2h13" />
                    <path d="M16 13h5" />
                    <circle cx="16" cy="13" r=".7" fill="currentColor" />
                </svg>
            );

        case "user":
            return (
                <svg {...common}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
            );

        case "logout":
            return (
                <svg {...common}>
                    <path d="M10 17l5-5-5-5M15 12H3" />
                    <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                </svg>
            );

        case "bell":
            return (
                <svg {...common}>
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                </svg>
            );

        case "chevron":
            return (
                <svg {...common}>
                    <path d="m7 10 5 5 5-5" />
                </svg>
            );
    }
}

export default function AppHeader({
    authStatus,
    username,
    balanceText,
    walletError,
    loggingOut,
    onLogout,
    hasPendingOrders = false,
    navigation,
}: AppHeaderProps) {
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const accountRef = useRef<HTMLDivElement>(null);
    const loggedIn = authStatus === "logged-in";

    const displayedBalance = (() => {
        if (balanceText === "...") return "...";
        if (walletError) return "—";

        const amount = Number(balanceText);

        return Number.isFinite(amount)
            ? amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
            : balanceText;
    })();

    const hasBalance =
        loggedIn &&
        displayedBalance !== "..." &&
        displayedBalance !== "—";

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !accountRef.current?.contains(event.target)
            ) {
                setAccountMenuOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setAccountMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const shortUsername =
        username.length > 12
            ? `${username.slice(0, 10)}…`
            : username || "Account";

    return (
        <header className="sticky top-0 z-[600] mx-auto w-full max-w-6xl bg-transparent px-3 pb-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 min-w-0 items-center">
                    {navigation}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center justify-end gap-2">
                        {loggedIn && (
                            <Link
                                href="/wallet"
                                aria-label={
                                    hasBalance
                                        ? `Wallet balance ${displayedBalance} baht`
                                        : "Open wallet"
                                }
                                title={walletError || "Wallet / Top up"}
                                className={`flex ${STANDARD_HEIGHT} shrink-0 items-center gap-1.5 rounded-2xl border px-2 transition duration-150 active:scale-[0.98] sm:gap-2 sm:px-3 ${NEUTRAL_WALLET} ${FOCUS}`}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                                    <Icon name="wallet" size={20} />
                                </span>

                                <span className="flex min-w-0 flex-col items-start justify-center gap-0.5 leading-none">
                                    <span className="text-[9px] font-medium tracking-wide text-gray-500">
                                        WALLET
                                    </span>
                                    <span className="whitespace-nowrap text-sm font-bold tabular-nums tracking-tight text-gray-900 sm:text-base">
                                        {hasBalance ? "฿" : ""}
                                        {displayedBalance}
                                    </span>
                                </span>
                            </Link>
                        )}

                        {loggedIn ? (
                            <div ref={accountRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAccountMenuOpen((open) => !open)
                                    }
                                    disabled={loggingOut}
                                    aria-label={`Account menu for ${username || "user"}`}
                                    aria-haspopup="menu"
                                    aria-expanded={accountMenuOpen}
                                    title={username || "Account"}
                                    className={`flex ${STANDARD_HEIGHT} ${ACCOUNT_WIDTH} shrink-0 items-center gap-2 rounded-2xl border px-2 transition duration-150 active:scale-[0.98] disabled:opacity-60 sm:px-2.5 ${PURPLE_SURFACE} ${FOCUS}`}
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${PURPLE_ICON}`}
                                    >
                                        <Icon name="user" size={19} />
                                    </span>

                                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                                        {shortUsername}
                                    </span>

                                    <span
                                        className={`shrink-0 transition-transform duration-200 ${accountMenuOpen ? "rotate-180" : ""}`}
                                    >
                                        <Icon name="chevron" size={16} />
                                    </span>
                                </button>

                                {accountMenuOpen && (
                                    <div
                                        role="menu"
                                        aria-label="Account options"
                                        className={`absolute right-0 top-full z-[620] mt-2 w-48 overflow-hidden rounded-2xl p-1.5 ${PANEL}`}
                                    >
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setAccountMenuOpen(false);
                                                onLogout();
                                            }}
                                            disabled={loggingOut}
                                            className={`flex ${STANDARD_HEIGHT} w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
                                        >
                                            <Icon name="logout" size={20} />
                                            {loggingOut
                                                ? "Logging out…"
                                                : "Log out"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                aria-label="Log in"
                                title="Log in"
                                className={`flex ${STANDARD_HEIGHT} w-36 shrink-0 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition duration-150 hover:bg-gray-50 active:scale-[0.98] ${FOCUS}`}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                                    <Icon name="user" size={20} />
                                </span>
                                <span>Log in</span>
                            </Link>
                        )}
                    </div>

                    {loggedIn && (
                        <Link
                            href="/orders"
                            aria-label={
                                hasPendingOrders
                                    ? "Orders, you have pending orders"
                                    : "Orders"
                            }
                            title="Orders"
                            className={`relative flex ${STANDARD_HEIGHT} w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 shadow-sm transition duration-150 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 active:scale-[0.98] ${FOCUS}`}
                        >
                            <Icon name="bell" size={21} />

                            {hasPendingOrders && (
                                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                            )}
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
