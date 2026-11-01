
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
};

const statusInfo: Record<
    OrderStatus,
    { label: string; description: string; style: string }
> = {
    pending: {
        label: "Pending",
        description: "Waiting for the seller to respond.",
        style: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    accepted: {
        label: "Accepted",
        description: "The seller accepted this order and is preparing it.",
        style: "bg-blue-50 text-blue-700 ring-blue-200",
    },
    rejected: {
        label: "Rejected",
        description: "The seller rejected this order.",
        style: "bg-red-50 text-red-700 ring-red-200",
    },
    delivered: {
        label: "Delivered",
        description: "The seller marked this order as delivered.",
        style: "bg-violet-50 text-violet-700 ring-violet-200",
    },
    completed: {
        label: "Completed",
        description: "The buyer confirmed receipt of the order.",
        style: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
};

function money(value: string | number) {
    return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function OrderDetailPage() {
    const params = useParams<{ id: string }>();
    const orderId = String(params.id);

    const [order, setOrder] = useState<Order | null>(null);
    const [shop, setShop] = useState<Shop | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [updating, setUpdating] = useState(false);

    const loadOrder = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [user, orderData] = await Promise.all([
                apiFetch<CurrentUser>("auth/me"),
                apiFetch<Order>(`orders/${orderId}`),
            ]);

            if (!user.authenticated || !user.userId) {
                setError("Please log in to view this order.");
                return;
            }

            const shopData = await apiFetch<Shop>(`shops/${orderData.shopId}`);

            setUserId(user.userId);
            setOrder(orderData);
            setShop(shopData);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to load this order.",
            );
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadOrder();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadOrder]);

    async function changeStatus(status: OrderStatus) {
        if (!order) return;

        setUpdating(true);
        setError("");
        setMessage("");

        try {
            const updated = await apiFetch<Order>(
                `orders/${order.id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status }),
                },
            );

            setOrder((current) =>
                current ? { ...current, ...updated } : updated,
            );
            setMessage("Order status updated successfully.");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update the order status.",
            );
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
                <div className="mx-auto max-w-5xl animate-pulse space-y-4">
                    <div className="h-8 w-52 rounded-lg bg-gray-200" />
                    <div className="h-64 rounded-2xl bg-white ring-1 ring-gray-200" />
                </div>
            </main>
        );
    }

    if (error && !order) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
                <section className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center ring-1 ring-gray-200">
                    <p className="text-red-600">{error}</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => void loadOrder()}
                            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                            Try again
                        </button>
                        <Link
                            href="/orders"
                            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Back to orders
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    if (!order) return null;

    const isSeller = shop?.userId === userId;
    const isBuyer = order.buyerId === userId;

    const actions: { label: string; status: OrderStatus; danger?: boolean }[] =
        isSeller
            ? order.status === "pending"
                ? [
                    { label: "Accept order", status: "accepted" },
                    { label: "Reject order", status: "rejected", danger: true },
                ]
                : order.status === "accepted"
                    ? [{ label: "Mark as delivered", status: "delivered" }]
                    : []
            : isBuyer && order.status === "delivered"
                ? [{ label: "Confirm receipt", status: "completed" }]
                : [];

    const subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
    );

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-5xl">
                <Link
                    href="/orders"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
                >
                    ← Back to orders
                </Link>

                <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">
                            Order details
                        </p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                            Order #{order.id}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            {shop?.name ?? `Shop #${order.shopId}`}
                            {order.createdAt
                                ? ` · ${new Date(order.createdAt).toLocaleString()}`
                                : ""}
                        </p>
                    </div>

                    <span
                        className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset ${statusInfo[order.status].style}`}
                    >
                        {statusInfo[order.status].label}
                    </span>
                </div>

                <div className="mt-7 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
                    <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold text-gray-950">
                                Items ordered
                            </h2>
                            <span className="text-sm text-gray-500">
                                {order.items.length}{" "}
                                {order.items.length === 1 ? "item" : "items"}
                            </span>
                        </div>

                        <div className="mt-5 divide-y divide-gray-100">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900">
                                            {item.productName}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Quantity: {item.quantity}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            ฿{money(item.price)} each
                                        </p>
                                    </div>
                                    <p className="shrink-0 font-semibold text-gray-900">
                                        ฿{money(Number(item.price) * item.quantity)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 space-y-3 border-t border-gray-100 pt-5 text-sm">
                            <div className="flex justify-between gap-4 text-gray-500">
                                <span>Subtotal</span>
                                <span>฿{money(subtotal)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-gray-500">
                                <span>Delivery fee</span>
                                <span>฿{money(order.deliveryFee)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-gray-100 pt-4 text-base font-bold text-gray-950">
                                <span>Total</span>
                                <span>฿{money(order.totalAmount)}</span>
                            </div>
                        </div>
                    </section>

                    <aside className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-6">
                            <h2 className="text-lg font-semibold text-gray-950">
                                Order progress
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-gray-500">
                                {statusInfo[order.status].description}
                            </p>

                            <div className="mt-5 space-y-4">
                                {[
                                    { status: "pending", label: "Order placed" },
                                    { status: "accepted", label: "Accepted by seller" },
                                    { status: "delivered", label: "Marked as delivered" },
                                    { status: "completed", label: "Order completed" },
                                ].map((step, index) => {
                                    const sequence = [
                                        "pending",
                                        "accepted",
                                        "delivered",
                                        "completed",
                                    ];
                                    const currentIndex = sequence.indexOf(order.status);
                                    const done =
                                        order.status !== "rejected" &&
                                        currentIndex >= index;

                                    return (
                                        <div key={step.status} className="flex gap-3">
                                            <span
                                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-400"
                                                    }`}
                                            >
                                                {done ? "✓" : index + 1}
                                            </span>
                                            <div>
                                                <p
                                                    className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"
                                                        }`}
                                                >
                                                    {step.label}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-6">
                            <h2 className="text-lg font-semibold text-gray-950">
                                {isSeller
                                    ? "Seller actions"
                                    : isBuyer
                                        ? "Buyer actions"
                                        : "Order actions"}
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-gray-500">
                                {isSeller
                                    ? "Manage this order as the shop owner."
                                    : isBuyer
                                        ? "Check the order status and confirm receipt when it arrives."
                                        : "You do not have actions available for this order."}
                            </p>

                            {error && (
                                <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                    {error}
                                </p>
                            )}

                            {message && (
                                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                                    {message}
                                </p>
                            )}

                            {order.status === "rejected" && (
                                <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                                    This order was rejected.
                                </p>
                            )}

                            {order.status === "completed" && (
                                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                                    This order is complete.
                                </p>
                            )}

                            {actions.length > 0 && (
                                <div className="mt-5 space-y-2">
                                    {actions.map((action) => (
                                        <button
                                            key={action.status}
                                            type="button"
                                            disabled={updating}
                                            onClick={() => void changeStatus(action.status)}
                                            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${action.danger
                                                ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                                : "bg-gray-900 text-white hover:bg-gray-700"
                                                }`}
                                        >
                                            {updating ? "Updating..." : action.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <Link
                                href="/orders"
                                className="mt-3 flex w-full justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                                All orders
                            </Link>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}
