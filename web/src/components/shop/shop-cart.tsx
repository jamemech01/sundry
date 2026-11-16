"use client";

type Product = {
    id: number;
    name: string;
    price: number | string;
    stock: number;
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
    deliveryFee: number | null;
    deliveryFeeLoading: boolean;
    deliveryFeeError: string;
    walletBalance: number | null;
    errorMessage: string;
    onSelectDeliveryLocation: () => void;
    onQuantityChange: (productId: number, quantity: number) => void;
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
    deliveryFee,
    deliveryFeeLoading,
    deliveryFeeError,
    walletBalance,
    errorMessage,
    onSelectDeliveryLocation,
    onQuantityChange,
    onCheckout,
}: ShopCartProps) {
    if (cart.length === 0) return null;

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalCents = cart.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return sum + (product ? Math.round(Number(product.price) * 100) * item.quantity : 0);
    }, 0);
    const totalCents =
        deliveryFee === null
            ? null
            : subtotalCents + Math.round(deliveryFee * 100);
    const insufficientBalance =
        currentUserId !== null &&
        walletBalance !== null &&
        totalCents !== null &&
        totalCents > Math.round(walletBalance * 100);
    const subtotal = subtotalCents / 100;
    const total = totalCents === null ? null : totalCents / 100;

    return (
        <>
            <section
                id="cart"
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
                    <h2 className="section-title">
                        {cartCount} {cartCount === 1 ? "item" : "items"}
                    </h2>
                </div>

                <div className="px-4 sm:px-6">
                    <div className="divide-y divide-gray-100">
                        {cart.map((item) => {
                            const product = products.find(
                                (entry) => entry.id === item.productId,
                            );

                            if (!product) return null;

                            return (
                                <div
                                    key={item.productId}
                                    className="flex flex-col gap-3 py-4"
                                >
                                    <div className="w-full min-w-0">
                                        <p className="w-full break-words text-sm font-semibold leading-6 text-gray-900">
                                            {product.name}
                                        </p>
                                    </div>

                                    <div className="flex w-full items-center justify-between gap-3">
                                        <p className="text-sm font-semibold tabular-nums text-gray-900">
                                            ฿
                                            {formatMoney(
                                                (Math.round(Number(product.price) * 100) *
                                                    item.quantity) /
                                                    100,
                                            )}
                                        </p>
                                        <div className="flex h-10 items-center overflow-hidden rounded-lg border border-gray-200">
                                            <button
                                                type="button"
                                                aria-label={`Decrease ${product.name} quantity`}
                                                disabled={busy || authLoading}
                                                onClick={() =>
                                                    onQuantityChange(
                                                        product.id,
                                                        item.quantity - 1,
                                                    )
                                                }
                                                className="h-full w-10 text-lg font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                                            >
                                                −
                                            </button>
                                            <span className="w-10 text-center text-sm font-semibold tabular-nums text-gray-900">
                                                {item.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Increase ${product.name} quantity`}
                                                disabled={
                                                    busy ||
                                                    authLoading ||
                                                    item.quantity >= product.stock
                                                }
                                                onClick={() =>
                                                    onQuantityChange(
                                                        product.id,
                                                        item.quantity + 1,
                                                    )
                                                }
                                                className="h-full w-10 text-lg font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[590] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                <section className="pointer-events-auto mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg shadow-gray-900/10 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-600">Product total</span>

                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                            ฿{formatMoney(subtotal)}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-500">
                            Delivery fee
                        </span>
                        <span className="text-sm font-medium tabular-nums text-gray-700">
                            {deliveryFeeLoading
                                ? "Calculating..."
                                : deliveryFee === null
                                  ? "—"
                                  : `฿${formatMoney(deliveryFee)}`}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-gray-100 pt-3">
                        <span className="font-semibold text-gray-900">
                            Total
                        </span>
                        <span className="text-lg font-bold tabular-nums text-gray-900">
                            {total === null ? "—" : `฿${formatMoney(total)}`}
                        </span>
                    </div>

                    {errorMessage ? (
                        <p role="alert" className="mt-3 text-sm text-red-700">
                            {errorMessage}
                        </p>
                    ) : null}
                    {deliveryFeeError ? (
                        <p role="alert" className="mt-3 text-sm text-red-700">
                            {deliveryFeeError}
                        </p>
                    ) : null}
                    {insufficientBalance ? (
                        <p role="alert" className="mt-3 text-sm text-red-700">
                            Insufficient wallet balance. Please top up.
                        </p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onSelectDeliveryLocation}
                            className="flex h-12 items-center justify-center rounded-xl border border-blue-600 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Select location
                        </button>
                        <form onSubmit={onCheckout}>
                            <button
                                type="submit"
                                disabled={
                                    busy ||
                                    authLoading ||
                                    !hasDeliveryLocation ||
                                    deliveryFeeLoading ||
                                    deliveryFee === null ||
                                    deliveryFeeError !== "" ||
                                    insufficientBalance
                                }
                                className="flex h-12 w-full items-center justify-center rounded-xl bg-green-600 px-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? "Placing order..." : "Confirm order"}
                            </button>
                        </form>
                    </div>
                </section>
            </div>
        </>
    );
}