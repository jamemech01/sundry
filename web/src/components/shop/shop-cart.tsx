"use client";

import Link from "next/link";

type Product = {
    id: number;
    name: string;
    price: number | string;
};

type CartItem = {
    productId: number;
    quantity: number;
};

type ShopCartProps = {
    products: Product[];
    cart: CartItem[];
    currentUserId: number | null;
    authLoading: boolean;
    busy: boolean;
    hasDeliveryLocation: boolean;
    onChooseDeliveryLocation: () => void;
    onCheckout: (event: React.FormEvent<HTMLFormElement>) => void;
};

function formatMoney(value: number) {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function ShopCart({
    products,
    cart,
    currentUserId,
    authLoading,
    busy,
    hasDeliveryLocation,
    onChooseDeliveryLocation,
    onCheckout,
}: ShopCartProps) {
    if (cart.length === 0) return null;

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const subtotal = cart.reduce((sum, item) => {
        const product = products.find(
            (entry) => entry.id === item.productId,
        );

        return sum + (product ? Number(product.price) * item.quantity : 0);
    }, 0);

    return (
        <section
            id="cart"
            className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-gray-900">
                    Your cart
                </h2>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-blue-700">
                    {cartCount} {cartCount === 1 ? "item" : "items"}
                </span>
            </div>

            <div className="px-5 sm:px-6">
                <div className="divide-y divide-gray-100">
                    {cart.map((item) => {
                        const product = products.find(
                            (entry) => entry.id === item.productId,
                        );

                        if (!product) return null;

                        return (
                            <div
                                key={item.productId}
                                className="flex items-center justify-between gap-4 py-4"
                            >
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-medium text-gray-900">
                                        {product.name}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-500">
                                        ฿{formatMoney(Number(product.price))} ×{" "}
                                        {item.quantity}
                                    </p>
                                </div>

                                <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                                    ฿
                                    {formatMoney(
                                        Number(product.price) * item.quantity,
                                    )}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t border-gray-200 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-500">Subtotal</span>

                        <span className="text-lg font-semibold tabular-nums text-gray-900">
                            ฿{formatMoney(subtotal)}
                        </span>
                    </div>
                </div>

                <div className="border-t border-gray-100 py-5">
                    {!hasDeliveryLocation ? (
                        <button
                            type="button"
                            disabled={busy || authLoading}
                            onClick={onChooseDeliveryLocation}
                            className="h-11 w-full rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Choose delivery location
                        </button>
                    ) : currentUserId === null ? (
                        <Link
                            href="/login"
                            className="flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            Log in to order
                        </Link>
                    ) : (
                        <form onSubmit={onCheckout}>
                            <button
                                type="submit"
                                disabled={busy || authLoading}
                                className="h-11 w-full rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? "Placing order..." : "Place order"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}