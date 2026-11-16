
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { countActionableOrders } from "@/lib/order-notifications";

type AuthStatus = "loading" | "logged-in" | "logged-out";
type IconName = "wallet" | "user" | "logout" | "bell" | "chevron";

type AppHeaderProps = {
    authStatus?: AuthStatus;
    username?: string;
    balanceText?: string;
    walletError?: string;
    loggingOut?: boolean;
    onLogout?: () => void;
    userId?: number | null;
    homePage?: boolean;
};

type CurrentUser = {
    authenticated: boolean;
    userId: number | null;
    username?: string | null;
};

const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

const PANEL =
    "border border-gray-200/80 bg-white/95 shadow-md shadow-gray-900/[0.07] backdrop-blur-xl";

const STANDARD_HEIGHT = "h-12";
const ICON_SIZE = 20;

const PURPLE_SURFACE =
    "border border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100";

const NEUTRAL_WALLET =
    "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50";

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
    authStatus: controlledAuthStatus,
    username: controlledUsername,
    balanceText: controlledBalanceText,
    walletError: controlledWalletError,
    loggingOut: controlledLoggingOut,
    onLogout,
    userId: controlledUserId,
    homePage = false,
}: AppHeaderProps) {
    const router = useRouter();
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [internalAuthStatus, setInternalAuthStatus] =
        useState<AuthStatus>("loading");
    const [internalUsername, setInternalUsername] = useState("");
    const [internalBalanceText, setInternalBalanceText] = useState("...");
    const [internalWalletError, setInternalWalletError] = useState("");
    const [internalUserId, setInternalUserId] = useState<number | null>(null);
    const [internalLoggingOut, setInternalLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [orderNotification, setOrderNotification] = useState<{
        userId: number;
        count: number;
    } | null>(null);
    const accountRef = useRef<HTMLDivElement>(null);
    const isControlled = controlledAuthStatus !== undefined;
    const authStatus = controlledAuthStatus ?? internalAuthStatus;
    const username = controlledUsername ?? internalUsername;
    const balanceText = controlledBalanceText ?? internalBalanceText;
    const walletError = controlledWalletError ?? internalWalletError;
    const userId = isControlled ? (controlledUserId ?? null) : internalUserId;
    const loggingOut = controlledLoggingOut ?? internalLoggingOut;
    const loggedIn = authStatus === "logged-in";
    const orderActionCount =
        loggedIn && orderNotification?.userId === userId
            ? orderNotification.count
            : 0;

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
        if (isControlled) return;

        let active = true;

        async function loadAccount() {
            try {
                const response = await fetch("/api/auth/me", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Unable to verify login.");
                }

                const user = (await response.json()) as CurrentUser;

                if (!user.authenticated || typeof user.userId !== "number") {
                    if (active) {
                        setInternalAuthStatus("logged-out");
                        setInternalUserId(null);
                        setInternalBalanceText("—");
                    }
                    return;
                }

                if (active) {
                    setInternalAuthStatus("logged-in");
                    setInternalUserId(user.userId);
                    setInternalUsername(user.username ?? "");
                }

                try {
                    const wallet = await apiFetch<{
                        balance?: number | string;
                        wallet?: { balance?: number | string };
                        amount?: number | string;
                    }>("wallet");
                    const value =
                        wallet.balance ?? wallet.wallet?.balance ?? wallet.amount;
                    const amount = Number(value);

                    if (!Number.isFinite(amount)) {
                        throw new Error("Invalid wallet balance.");
                    }

                    if (active) {
                        setInternalBalanceText(
                            amount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            }),
                        );
                    }
                } catch (error) {
                    console.error("Unable to load wallet for header:", error);
                    if (active) {
                        setInternalBalanceText("—");
                        setInternalWalletError("Unable to load balance");
                    }
                }
            } catch (error) {
                console.error("Unable to load account for header:", error);
                if (active) {
                    setInternalAuthStatus("logged-out");
                    setInternalUserId(null);
                    setInternalBalanceText("—");
                    setInternalWalletError("Unable to verify login");
                }
            }
        }

        void loadAccount();

        return () => {
            active = false;
        };
    }, [isControlled]);

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

    async function handleLogout() {
        if (onLogout) {
            onLogout();
            return;
        }

        if (internalLoggingOut) return;

        setInternalLoggingOut(true);
        setLogoutError("");

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Unable to log out. Please try again.");
            }

            setAccountMenuOpen(false);
            setInternalAuthStatus("logged-out");
            setInternalUserId(null);
            setInternalUsername("");
            setInternalBalanceText("—");
            setInternalWalletError("");
            router.push("/");
        } catch (error) {
            console.error("Unable to log out:", error);
            setLogoutError(
                error instanceof Error ? error.message : "Unable to log out.",
            );
        } finally {
            setInternalLoggingOut(false);
        }
    }

    useEffect(() => {
        let active = true;

        if (!loggedIn || userId === null) {
            return;
        }

        const currentUserId = userId;

        async function loadActionableOrders() {
            const [ordersResult, shopsResult] = await Promise.allSettled([
                apiFetch<unknown>("orders"),
                apiFetch<{ id: number; userId: number }[]>("shops"),
            ]);

            if (!active) return;

            if (ordersResult.status === "rejected") {
                console.error(
                    "Unable to load orders for header notifications:",
                    ordersResult.reason,
                );
                setOrderNotification({ userId: currentUserId, count: 0 });
                return;
            }

            if (shopsResult.status === "rejected") {
                console.error(
                    "Unable to load shops for header notifications:",
                    shopsResult.reason,
                );
                setOrderNotification({ userId: currentUserId, count: 0 });
                return;
            }

            setOrderNotification({
                userId: currentUserId,
                count: countActionableOrders(
                    ordersResult.value,
                    shopsResult.value,
                    currentUserId,
                ),
            });
        }

        void loadActionableOrders();

        return () => {
            active = false;
        };
    }, [loggedIn, userId]);

    return (
        <header className="sticky top-0 z-[600] w-full bg-transparent px-3 pb-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-6 lg:px-8">
            <div className="flex w-full min-w-0 items-start gap-1 sm:gap-2">
                <div className="ml-auto flex w-full min-w-0 max-w-full shrink items-start justify-end gap-1 sm:gap-2">
                        {loggedIn && (
                            <Link
                                href="/wallet"
                                aria-label={
                                    hasBalance
                                        ? `Wallet balance ${displayedBalance} baht`
                                        : "Open wallet"
                                }
                                title={walletError || "Wallet / Top up"}
                                className={`flex ${STANDARD_HEIGHT} w-[min(176px,calc(100vw-176px))] min-w-0 shrink items-center gap-2 rounded-2xl border px-3 transition duration-150 active:scale-[0.98] sm:w-[min(220px,30vw)] sm:shrink-0 sm:px-4 ${NEUTRAL_WALLET} ${FOCUS}`}
                            >
                                <span className="shrink-0 text-gray-600">
                                    <Icon name="wallet" size={ICON_SIZE} />
                                </span>
                                <span className="min-w-0 flex-1 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-900">
                                    {hasBalance ? "฿" : ""}
                                    {displayedBalance}
                                </span>
                            </Link>
                        )}

                        {loggedIn ? (
                            <div
                                ref={accountRef}
                                className="relative flex min-w-0 shrink-0 flex-col items-end gap-1"
                            >
                                <div className="flex w-[min(96px,29vw)] min-w-0 shrink-0 flex-col items-end gap-1 sm:w-[min(180px,25vw)]">
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
                                        className={`relative flex ${STANDARD_HEIGHT} w-full min-w-0 items-center justify-center rounded-2xl border px-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${PURPLE_SURFACE} ${FOCUS}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate text-center">
                                            {username || "Account"}
                                        </span>

                                        {!homePage && (
                                            <span
                                                className={`absolute right-1 hidden shrink-0 transition-transform duration-200 sm:right-2 sm:block ${accountMenuOpen ? "rotate-180" : ""}`}
                                            >
                                                <Icon
                                                    name="chevron"
                                                    size={ICON_SIZE}
                                                />
                                            </span>
                                        )}
                                    </button>

                                </div>

                                <Link
                                    href="/orders"
                                    aria-label={
                                        orderActionCount > 0
                                            ? `Orders, ${orderActionCount} ${orderActionCount === 1 ? "order" : "orders"} need action`
                                            : "Orders"
                                    }
                                    title="Orders"
                                    className={`relative flex ${STANDARD_HEIGHT} w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-red-600 transition duration-150 hover:border-red-200 hover:bg-red-50 active:scale-[0.98] ${FOCUS}`}
                                >
                                    <Icon name="bell" size={ICON_SIZE} />
                                    {orderActionCount > 0 && (
                                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                                            {orderActionCount > 99
                                                ? "99+"
                                                : orderActionCount}
                                        </span>
                                    )}
                                </Link>

                                {accountMenuOpen && (
                                    <div
                                        role="menu"
                                        aria-label="Account options"
                                        className={`absolute right-0 top-12 z-[620] mt-1 w-max min-w-[132px] overflow-hidden rounded-2xl p-1.5 ${PANEL}`}
                                    >
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                void handleLogout();
                                            }}
                                            disabled={loggingOut}
                                            className={`flex ${STANDARD_HEIGHT} w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
                                        >
                                            <Icon name="logout" size={ICON_SIZE} />
                                            {loggingOut
                                                ? "Logging out…"
                                                : "Log out"}
                                        </button>
                                        {logoutError ? (
                                            <p
                                                role="alert"
                                                className="px-3 py-1 text-xs text-red-700"
                                            >
                                                {logoutError}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                aria-label="Log in"
                                title="Log in"
                                className={`relative flex ${STANDARD_HEIGHT} w-[min(96px,29vw)] shrink-0 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-700 transition duration-150 hover:bg-gray-50 active:scale-[0.98] sm:w-[min(180px,25vw)] sm:px-3 ${FOCUS}`}
                            >
                                <Icon name="user" size={ICON_SIZE} />
                                <span className="truncate text-center">
                                    Log in
                                </span>
                            </Link>
                        )}
                </div>
            </div>
        </header>
    );
}
