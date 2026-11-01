"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";

type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "delivered"
  | "completed";

type Order = {
  id: number;
  buyerId: number;
  shopId: number;
  status: OrderStatus;
  deliveryFee: string | number;
  totalAmount: string | number;
  createdAt?: string;
  items: {
    id: number;
    productName: string;
    quantity: number;
    price: string | number;
  }[];
};

type Shop = {
  id: number;
  userId: number;
  name: string;
};

type CurrentUser = {
  authenticated: boolean;
  userId: number | null;
  username?: string | null;
};

type WalletResponse = {
  balance?: number | string;
  wallet?: { balance?: number | string };
  amount?: number | string;
};

type AuthStatus = "loading" | "logged-in" | "logged-out";

const statusInfo: Record<OrderStatus, { label: string; style: string }> = {
  pending: {
    label: "Pending",
    style: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  accepted: {
    label: "Accepted",
    style: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  rejected: {
    label: "Rejected",
    style: "bg-red-50 text-red-700 ring-red-200",
  },
  delivered: {
    label: "Delivered",
    style: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  completed: {
    label: "Completed",
    style: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

function money(value: string | number) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBalance(data: WalletResponse) {
  const value = data.balance ?? data.wallet?.balance ?? data.amount;

  if (value === undefined || value === null || value === "") return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [balanceText, setBalanceText] = useState("...");
  const [walletError, setWalletError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [user, orderData, shopData] = await Promise.all([
        apiFetch<CurrentUser>("auth/me"),
        apiFetch<Order[]>("orders"),
        apiFetch<Shop[]>("shops"),
      ]);

      if (!user.authenticated || typeof user.userId !== "number") {
        setUserId(null);
        setUsername("");
        setAuthStatus("logged-out");
        setBalanceText("—");
        setError("Please log in to view your orders.");
        return;
      }

      setUserId(user.userId);
      setUsername(user.username ?? "");
      setAuthStatus("logged-in");
      setOrders(orderData);
      setShops(shopData);

      try {
        const wallet = await apiFetch<WalletResponse>("wallet");
        setBalanceText(formatBalance(wallet) ?? "—");
        setWalletError("");
      } catch {
        setBalanceText("—");
        setWalletError("Unable to load balance");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load orders.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadOrders]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setLoggingOut(false);
      setUserId(null);
      setUsername("");
      setAuthStatus("logged-out");
      setBalanceText("—");
      setWalletError("");
      router.push("/");
    }
  }

  const pendingCount = orders.filter(
    (order) => order.status === "pending",
  ).length;

  const header = (
    <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
      <BackButton />
      <AppHeader
        authStatus={authStatus}
        username={username}
        balanceText={balanceText}
        walletError={walletError}
        loggingOut={loggingOut}
        onLogout={() => void logout()}
      />
    </div>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        {header}
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 px-4 py-10 sm:px-6">
          <div className="h-8 w-48 rounded-lg bg-gray-200" />
          <div className="h-36 rounded-2xl bg-white ring-1 ring-gray-200" />
          <div className="h-36 rounded-2xl bg-white ring-1 ring-gray-200" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        {header}
        <section className="mx-auto mt-8 max-w-3xl rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Your orders
          </h1>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-5 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {header}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Your account</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
              Orders
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Track purchases and manage orders from your shop.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Total orders</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">
              {orders.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Awaiting response</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">
              {orders.filter((order) => order.status === "completed").length}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {orders.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
                📦
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                No orders yet
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Your purchases and incoming shop orders will appear here.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                Explore shops
              </Link>
            </section>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const shop = shops.find((item) => item.id === order.shopId);
                const isSeller = shop?.userId === userId;
                const isBuyer = order.buyerId === userId;

                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="group block rounded-2xl bg-white p-5 ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                          Order #{order.id}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-gray-950 group-hover:text-gray-600">
                          {shop?.name ?? `Shop #${order.shopId}`}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {isSeller
                            ? "Incoming order"
                            : isBuyer
                              ? "Your purchase"
                              : "Order"}
                          {order.createdAt
                            ? ` · ${new Date(order.createdAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusInfo[order.status].style}`}
                      >
                        {statusInfo[order.status].label}
                      </span>
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <p className="text-sm text-gray-500">
                          {order.items.length}{" "}
                          {order.items.length === 1 ? "item" : "items"}
                          {" · "}
                          {order.items.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}{" "}
                          units
                        </p>
                        <p className="text-base font-bold text-gray-950">
                          ฿{money(order.totalAmount)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          View order details
                        </span>
                        <span className="font-semibold text-gray-900 transition group-hover:translate-x-1">
                          View details →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}