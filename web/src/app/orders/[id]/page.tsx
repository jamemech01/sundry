
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
};

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

export default function OrderDetailPage() {
    const params = useParams<{ id: string }>();
    const orderId = String(params.id);

    const [order, setOrder] = useState<Order | null>(null);
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    const pageHeader = (
        <div className="sticky top-0 z-[610] w-full">
            <div className="absolute left-3 top-[max(10px,env(safe-area-inset-top))] z-[610] sm:left-6 lg:left-8">
                <BackButton fallbackHref="/orders" />
            </div>
            <AppHeader />
        </div>
    );

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                {pageHeader}
                <div className="mx-auto max-w-5xl animate-pulse space-y-4 px-4 py-10 sm:px-6">
                    <div className="h-8 w-52 rounded-lg bg-gray-200" />
                    <div className="h-64 rounded-2xl bg-white ring-1 ring-gray-200" />
                </div>
            </main>
        );
    }

    if (error && !order) {
        return (
            <main className="min-h-screen bg-gray-50">
                {pageHeader}
                <section className="mx-auto mt-8 max-w-3xl rounded-2xl bg-white p-5 text-center ring-1 ring-gray-200 sm:p-8">
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

    const subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
    );

    return (
        <main className="min-h-screen bg-gray-50">
            {pageHeader}
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">
                            Order details
                        </p>
                        <h1 className="page-title mt-1">
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

                <section className="mt-7 rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="section-title">
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
            </div>
        </main>
    );
}
