"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

const MapView = dynamic(() => import("@/components/map"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full animate-pulse bg-gray-100" />
    ),
});

type CartItem = {
    productId: number;
    shopId: number;
    shopName: string;
    name: string;
    price: number;
    imageUrl?: string | null;
    stock: number;
    quantity: number;
};

export default function CartPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
    const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
    const [locationError, setLocationError] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const savedCart = localStorage.getItem("sundry_cart");

            if (savedCart) {
                const parsed: unknown = JSON.parse(savedCart);

                if (Array.isArray(parsed)) {
                    setCart(parsed as CartItem[]);
                }
            }
        } catch {
            setCart([]);
        } finally {
            setReady(true);
        }
    }, []);

    const saveCart = useCallback((nextCart: CartItem[]) => {
        setCart(nextCart);
        localStorage.setItem("sundry_cart", JSON.stringify(nextCart));
    }, []);

    function updateQuantity(productId: number, quantity: number) {
        const nextCart = cart.map((item) =>
            item.productId === productId
                ? {
                    ...item,
                    quantity: Math.min(item.stock, Math.max(1, quantity)),
                }
                : item,
        );

        saveCart(nextCart);
    }

    function removeItem(productId: number) {
        saveCart(
            cart.filter((item) => item.productId !== productId),
        );
    }

    const subtotal = useMemo(
        () =>
            cart.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
            ),
        [cart],
    );

    const deliveryFee = 20;
    const total = subtotal + deliveryFee;
    const shopId = cart[0]?.shopId;

    const hasMultipleShops = cart.some(
        (item) => item.shopId !== shopId,
    );

    function useMyLocation() {
        setLocationError("");
        setError("");

        if (!navigator.geolocation) {
            setLocationError("Location is not supported by this device.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setDeliveryLat(position.coords.latitude);
                setDeliveryLng(position.coords.longitude);
            },
            () => {
                setLocationError(
                    "Unable to access your location. Select a point on the map instead.",
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            },
        );
    }

    async function confirmOrder() {
        setError("");

        if (cart.length === 0) {
            setError("Your cart is empty.");
            return;
        }

        if (hasMultipleShops) {
            setError("Your cart can contain products from one shop only.");
            return;
        }

        if (deliveryLat === null || deliveryLng === null) {
            setError("Select your delivery location on the map first.");
            return;
        }

        setLoading(true);

        try {
            await apiFetch("orders", {
                method: "POST",
                body: JSON.stringify({
                    shopId,
                    items: cart.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                    deliveryLat,
                    deliveryLng,
                }),
            });

            localStorage.removeItem("sundry_cart");
            window.location.href = "/orders";
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create your order.",
            );
        } finally {
            setLoading(false);
        }
    }

    if (!ready) {
        return (
            <main className="mx-auto max-w-3xl p-5">
                <p className="text-sm text-gray-500">Loading cart...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-4 pb-10 sm:p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Cart</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Review your items and choose a delivery location.
                    </p>
                </div>

                <Link
                    href="/"
                    className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium"
                >
                    Explore
                </Link>
            </header>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </p>
            )}

            {cart.length === 0 ? (
                <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                    <p className="font-semibold">Your cart is empty</p>
                    <p className="mt-2 text-sm text-gray-500">
                        Explore shops and add products to your cart.
                    </p>

                    <Link
                        href="/"
                        className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                        Explore Shops
                    </Link>
                </section>
            ) : (
                <>
                    <section className="space-y-3">
                        <h2 className="text-lg font-semibold">
                            Items ({cart.length})
                        </h2>

                        {cart.map((item) => (
                            <article
                                key={item.productId}
                                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                            >
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                                    />
                                ) : (
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                                        📦
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold">{item.name}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {item.shopName}
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-blue-700">
                                        ฿{item.price.toFixed(2)}
                                    </p>

                                    <div className="mt-3 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateQuantity(item.productId, item.quantity - 1)
                                            }
                                            disabled={item.quantity <= 1}
                                            aria-label={`Decrease ${item.name} quantity`}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"
                                        >
                                            −
                                        </button>

                                        <span className="min-w-5 text-center text-sm">
                                            {item.quantity}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateQuantity(item.productId, item.quantity + 1)
                                            }
                                            disabled={item.quantity >= item.stock}
                                            aria-label={`Increase ${item.name} quantity`}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"
                                        >
                                            +
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.productId)}
                                            className="ml-auto text-sm text-red-600"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <p className="shrink-0 text-sm font-semibold">
                                    ฿{(item.price * item.quantity).toFixed(2)}
                                </p>
                            </article>
                        ))}
                    </section>

                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Delivery Location
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Tap the map to choose your delivery location.
                            </p>
                        </div>

                        <div className="relative h-[320px] overflow-hidden rounded-2xl border border-gray-200">
                            <MapView
                                shops={[]}
                                selectedShopId={null}
                                onSelectShop={() => { }}
                                mode="delivery"
                                deliveryLat={deliveryLat}
                                deliveryLng={deliveryLng}
                                onSelectDeliveryLocation={(lat, lng) => {
                                    setDeliveryLat(lat);
                                    setDeliveryLng(lng);
                                    setLocationError("");
                                    setError("");
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={useMyLocation}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold"
                        >
                            Use My Location
                        </button>

                        {deliveryLat !== null && deliveryLng !== null && (
                            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
                                Delivery location selected
                                <span className="mt-1 block break-all text-xs">
                                    {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
                                </span>
                            </p>
                        )}

                        {locationError && (
                            <p role="alert" className="text-sm text-red-600">
                                {locationError}
                            </p>
                        )}
                    </section>

                    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
                        <h2 className="text-lg font-semibold">Order Summary</h2>

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span>฿{subtotal.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Delivery Fee</span>
                            <span>฿{deliveryFee.toFixed(2)}</span>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                            <div className="flex justify-between font-bold">
                                <span>Total</span>
                                <span>฿{total.toFixed(2)}</span>
                            </div>
                        </div>

                        {hasMultipleShops && (
                            <p className="text-sm text-red-600">
                                Your cart contains products from different shops. Please keep
                                products from one shop per order.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={confirmOrder}
                            disabled={
                                loading ||
                                cart.length === 0 ||
                                hasMultipleShops
                            }
                            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Creating Order..." : "Confirm Order"}
                        </button>

                        <p className="text-center text-xs text-gray-500">
                            Select a delivery location before confirming your order.
                        </p>
                    </section>
                </>
            )}
        </main>
    );
}