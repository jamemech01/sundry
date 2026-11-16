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
    style: "bg-blue-50 text-blue-700 ring-blue-200",
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
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});

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

  async function changeStatus(order: Order, status: OrderStatus) {
    if (updatingOrderId !== null) return;

    setUpdatingOrderId(order.id);
    setActionErrors((current) => ({ ...current, [order.id]: "" }));
    try {
      const updated = await apiFetch<Order>(`orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setActionErrors((current) => ({
        ...current,
        [order.id]:
          err instanceof Error ? err.message : "Unable to update order.",
      }));
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const orderedOrders = [...orders].sort((a, b) => {
    const shopA = shops.find((shop) => shop.id === a.shopId);
    const shopB = shops.find((shop) => shop.id === b.shopId);
    const actionableA =
      (shopA?.userId === userId && ["pending", "accepted"].includes(a.status)) ||
      (a.buyerId === userId && a.status === "delivered");
    const actionableB =
      (shopB?.userId === userId && ["pending", "accepted"].includes(b.status)) ||
      (b.buyerId === userId && b.status === "delivered");
    if (actionableA !== actionableB) return actionableA ? -1 : 1;
    return (
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime()
    );
  });

  const header = (
    <div className="sticky top-0 z-[610] w-full">
      <div className="absolute left-3 top-[max(10px,env(safe-area-inset-top))] z-[610] sm:left-6 lg:left-8">
        <BackButton />
      </div>
      <AppHeader
        authStatus={authStatus}
        username={username}
        balanceText={balanceText}
        walletError={walletError}
        loggingOut={loggingOut}
        onLogout={() => void logout()}
        userId={userId}
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
          <h1 className="page-title">
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
            <h1 className="page-title">Orders</h1>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6">
          {orders.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
                📦
              </div>
              <h2 className="section-title mt-4">
                No orders yet
              </h2>
              <p className="mt-2 text-sm text-gray-500">Orders will appear here.</p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                Explore shops
              </Link>
            </section>
          ) : (
            <div className="space-y-4">
              {orderedOrders.map((order) => {
                const shop = shops.find((item) => item.id === order.shopId);
                const isSeller = shop?.userId === userId;
                const isBuyer = order.buyerId === userId;
                const actions: {
                  label: string;
                  status: OrderStatus;
                  danger?: boolean;
                }[] =
                  isSeller
                    ? order.status === "pending"
                      ? [
                          { label: "Accept", status: "accepted" },
                          { label: "Reject", status: "rejected", danger: true },
                        ]
                      : order.status === "accepted"
                        ? [{ label: "Mark delivered", status: "delivered" }]
                        : []
                    : isBuyer && order.status === "delivered"
                      ? [{ label: "Confirm receipt", status: "completed" }]
                      : [];
                const unitCount = order.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                );

                return (
                  <article
                    key={order.id}
                    className="rounded-2xl bg-white p-4 ring-1 ring-gray-200 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                          Order #{order.id}
                        </p>
                        <h2 className="card-title mt-1">
                          {shop?.name ?? `Shop #${order.shopId}`}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusInfo[order.status].style}`}
                      >
                        {statusInfo[order.status].label}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                      <p className="text-sm text-gray-500">
                        {unitCount} {unitCount === 1 ? "item" : "items"}
                      </p>
                      <p className="text-base font-bold text-gray-950">
                        ฿{money(order.totalAmount)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Details
                      </Link>

                      {actions.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {actions.map((action) => (
                            <button
                              key={action.status}
                              type="button"
                              disabled={updatingOrderId !== null}
                              onClick={() =>
                                void changeStatus(order, action.status)
                              }
                              className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                action.danger
                                  ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                  : "bg-gray-900 text-white hover:bg-gray-700"
                              }`}
                            >
                              {updatingOrderId === order.id
                                ? "Updating..."
                                : action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {actionErrors[order.id] && (
                      <p
                        role="alert"
                        className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {actionErrors[order.id]}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}