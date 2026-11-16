"use client";

import {
    CART_STORAGE_KEY,
    saveCart as saveStoredCart,
} from "@/lib/cart-storage";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";
import ShopCart from "@/components/shop/shop-cart";
import { apiFetch } from "@/lib/api";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type Product = {
    id: number;
    shopId: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
};

type Shop = {
    id: number;
    name: string;
};

type CartItem = {
    productId: number;
    quantity: number;
};

type SavedCart = {
    shopId: number;
    cart: CartItem[];
    cartProducts: Record<number, Product>;
    deliveryLat?: number;
    deliveryLng?: number;
};

type AuthResponse = {
    authenticated?: boolean;
    userId?: number | null;
    username?: string;
};

type DeliveryFeeResponse = {
    deliveryFee: number | string;
};

type DeliveryFeePreview = {
    key: string;
    amount: number;
};

type DeliveryFeeFailure = {
    key: string;
    message: string;
};

function readSavedCart(shopId: number): SavedCart | null {
    try {
        const raw = sessionStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return null;

        const saved: unknown = JSON.parse(raw);
        if (
            typeof saved !== "object" ||
            saved === null ||
            !("shopId" in saved) ||
            !("cart" in saved) ||
            saved.shopId !== shopId ||
            !Array.isArray(saved.cart)
        ) {
            return null;
        }

        const cart = saved.cart.filter(
            (item): item is CartItem =>
                typeof item === "object" &&
                item !== null &&
                "productId" in item &&
                "quantity" in item &&
                Number.isInteger(item.productId) &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0,
        );

        return {
            shopId,
            cart,
            cartProducts:
                "cartProducts" in saved &&
                typeof saved.cartProducts === "object" &&
                saved.cartProducts !== null
                    ? (saved.cartProducts as Record<number, Product>)
                    : {},
            deliveryLat:
                "deliveryLat" in saved && typeof saved.deliveryLat === "number"
                    ? saved.deliveryLat
                    : undefined,
            deliveryLng:
                "deliveryLng" in saved && typeof saved.deliveryLng === "number"
                    ? saved.deliveryLng
                    : undefined,
        };
    } catch {
        return null;
    }
}

function saveCart(saved: SavedCart) {
    saveStoredCart(saved, readSavedCart);
}

function parseCoordinate(value: string | null, min: number, max: number) {
    if (value === null || value.trim() === "") return null;
    const coordinate = Number(value);
    return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
        ? coordinate
        : null;
}

function money(value: number) {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function balanceAmount(data: unknown): number | null {
    if (!data || typeof data !== "object") return null;
    const result = data as {
        balance?: number | string;
        wallet?: { balance?: number | string };
        amount?: number | string;
    };
    const value = result.balance ?? result.wallet?.balance ?? result.amount;
    if (value === undefined || value === null || value === "") return null;
    const balance = Number(value);
    return Number.isFinite(balance) && balance >= 0 ? balance : null;
}

function CartPageContent() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const shopId = Number(id);
    const queryDeliveryLat = parseCoordinate(
        searchParams.get("deliveryLat"),
        -90,
        90,
    );
    const queryDeliveryLng = parseCoordinate(
        searchParams.get("deliveryLng"),
        -180,
        180,
    );

    const [shop, setShop] = useState<Shop | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [username, setUsername] = useState("");
    const [balanceText, setBalanceText] = useState("0.00");
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [walletError, setWalletError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [savedDeliveryLocation, setSavedDeliveryLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [deliveryFeeResult, setDeliveryFeeResult] =
        useState<DeliveryFeePreview | null>(null);
    const [deliveryFeeFailure, setDeliveryFeeFailure] =
        useState<DeliveryFeeFailure | null>(null);

    const hasQueryDeliveryLocation =
        queryDeliveryLat !== null && queryDeliveryLng !== null;
    const deliveryLat = hasQueryDeliveryLocation
        ? queryDeliveryLat
        : (savedDeliveryLocation?.lat ?? null);
    const deliveryLng = hasQueryDeliveryLocation
        ? queryDeliveryLng
        : (savedDeliveryLocation?.lng ?? null);
    const hasDeliveryLocation = deliveryLat !== null && deliveryLng !== null;
    const deliveryFeeKey = hasDeliveryLocation
        ? `${shopId}:${deliveryLat}:${deliveryLng}`
        : "";
    const deliveryFee =
        deliveryFeeResult?.key === deliveryFeeKey
            ? deliveryFeeResult.amount
            : null;
    const deliveryFeeError =
        deliveryFeeFailure?.key === deliveryFeeKey
            ? deliveryFeeFailure.message
            : "";
    const deliveryFeeLoading =
        Boolean(shop) &&
        hasDeliveryLocation &&
        deliveryFee === null &&
        deliveryFeeError === "";
    const loginHref = `/login?redirect=${encodeURIComponent(
        `/shops/${shopId}/cart?deliveryLat=${deliveryLat ?? ""}&deliveryLng=${deliveryLng ?? ""}`,
    )}`;
    const subtotalCents = useMemo(
        () =>
            cart.reduce((total, item) => {
                const product = products.find(
                    (entry) => entry.id === item.productId,
                );
                return (
                    total +
                    (product
                        ? Math.round(Number(product.price) * 100) *
                          item.quantity
                        : 0)
                );
            }, 0),
        [cart, products],
    );

    useEffect(() => {
        let active = true;

        async function loadCartPage() {
            setLoading(true);
            setAuthLoading(true);
            setError("");

            if (!Number.isInteger(shopId) || shopId <= 0) {
                setError("Shop not found.");
                setLoading(false);
                setAuthLoading(false);
                return;
            }

            const saved = readSavedCart(shopId);
            if (queryDeliveryLat !== null && queryDeliveryLng !== null) {
                setSavedDeliveryLocation({
                    lat: queryDeliveryLat,
                    lng: queryDeliveryLng,
                });
            } else if (
                saved?.deliveryLat !== undefined &&
                saved.deliveryLat >= -90 &&
                saved.deliveryLat <= 90 &&
                saved.deliveryLng !== undefined &&
                saved.deliveryLng >= -180 &&
                saved.deliveryLng <= 180
            ) {
                setSavedDeliveryLocation({
                    lat: saved.deliveryLat,
                    lng: saved.deliveryLng,
                });
            }
            if (!saved || saved.cart.length === 0) {
                setCart([]);
                setProducts([]);
                setError("Your cart is empty.");
                setLoading(false);
            } else {
                setCart(saved.cart);
            }

            try {
                const [shopData, authData] = await Promise.all([
                    apiFetch<Shop>(`shops/${shopId}`),
                    fetch("/api/auth/me", { cache: "no-store" })
                        .then(async (response) =>
                            response.ok
                                ? (response.json() as Promise<AuthResponse>)
                                : { authenticated: false, userId: null },
                        )
                        .catch((): AuthResponse => ({
                            authenticated: false,
                            userId: null,
                        })),
                ]);
                if (!active) return;

                setShop(shopData);
                const isAuthenticated =
                    authData.authenticated === true &&
                    typeof authData.userId === "number";
                setCurrentUserId(isAuthenticated ? authData.userId! : null);
                setUsername(isAuthenticated ? (authData.username ?? "") : "");
                setAuthStatus(isAuthenticated ? "logged-in" : "logged-out");

                if (isAuthenticated) {
                    try {
                        const wallet = await apiFetch<unknown>("wallet");
                        if (!active) return;
                        const amount = balanceAmount(wallet);
                        setWalletBalance(amount);
                        setBalanceText(amount === null ? "—" : money(amount));
                        setWalletError(
                            amount === null ? "Unable to load wallet." : "",
                        );
                    } catch {
                        if (!active) return;
                        setWalletBalance(null);
                        setBalanceText("—");
                        setWalletError("Unable to load wallet.");
                    }
                }

                if (saved && saved.cart.length > 0) {
                    const freshProducts = await Promise.all(
                        saved.cart.map((item) =>
                            apiFetch<Product>(`products/${item.productId}`),
                        ),
                    );
                    if (!active) return;

                    if (
                        freshProducts.some(
                            (product) => product.shopId !== shopData.id,
                        )
                    ) {
                        throw new Error(
                            "Some cart items no longer belong to this shop.",
                        );
                    }

                    const productsById = Object.fromEntries(
                        freshProducts.map((product) => [product.id, product]),
                    );
                    setProducts(freshProducts);
                    saveCart({
                        shopId,
                        cart: saved.cart,
                        cartProducts: productsById,
                        deliveryLat: queryDeliveryLat ?? saved.deliveryLat,
                        deliveryLng: queryDeliveryLng ?? saved.deliveryLng,
                    });
                    setError("");
                    setLoading(false);
                }
            } catch (err) {
                if (!active) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your cart.",
                );
                setLoading(false);
            } finally {
                if (active) setAuthLoading(false);
            }
        }

        void loadCartPage();
        return () => {
            active = false;
        };
    }, [shopId, queryDeliveryLat, queryDeliveryLng]);

    useEffect(() => {
        if (!shop || !hasDeliveryLocation) return;

        const controller = new AbortController();
        const key = deliveryFeeKey;

        async function loadDeliveryFee() {
            try {
                const response = await apiFetch<DeliveryFeeResponse>(
                    "orders/delivery-fee",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            shopId,
                            deliveryLat,
                            deliveryLng,
                        }),
                        signal: controller.signal,
                    },
                );
                const amount = Number(response.deliveryFee);
                if (!Number.isFinite(amount) || amount < 0) {
                    throw new Error("Unable to calculate delivery fee.");
                }
                setDeliveryFeeResult({ key, amount });
                setDeliveryFeeFailure(null);
            } catch (err) {
                if (controller.signal.aborted) return;
                setDeliveryFeeFailure({
                    key,
                    message:
                        err instanceof Error
                            ? err.message
                            : "Unable to calculate delivery fee.",
                });
            }
        }

        void loadDeliveryFee();
        return () => controller.abort();
    }, [
        shop,
        shopId,
        hasDeliveryLocation,
        deliveryFeeKey,
        deliveryLat,
        deliveryLng,
    ]);

    function selectDeliveryLocation() {
        if (!shop) return;
        const saved = readSavedCart(shopId);
        if (saved) {
            saveCart({
                ...saved,
                deliveryLat: deliveryLat ?? saved.deliveryLat,
                deliveryLng: deliveryLng ?? saved.deliveryLng,
            });
        }
        router.push(
            `/?mode=delivery&shopId=${shopId}&returnTo=cart&deliveryLat=${deliveryLat ?? ""}&deliveryLng=${deliveryLng ?? ""}`,
        );
    }

    function changeQuantity(productId: number, quantity: number) {
        const product = products.find((entry) => entry.id === productId);
        if (!product || quantity > product.stock) return;

        const nextCart =
            quantity <= 0
                ? cart.filter((item) => item.productId !== productId)
                : cart.map((item) =>
                      item.productId === productId
                          ? { ...item, quantity }
                          : item,
                  );

        setCart(nextCart);
        setError(nextCart.length === 0 ? "Your cart is empty." : "");

        if (nextCart.length === 0) {
            try {
                sessionStorage.removeItem(CART_STORAGE_KEY);
            } catch {
                // The cart update is complete even if session storage is unavailable.
            }
        } else {
            saveCart({
                shopId,
                cart: nextCart,
                cartProducts: Object.fromEntries(
                    products.map((entry) => [entry.id, entry]),
                ),
                deliveryLat: deliveryLat ?? undefined,
                deliveryLng: deliveryLng ?? undefined,
            });
        }
    }

    async function logout() {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });
            if (!response.ok) throw new Error("Unable to log out.");
            setCurrentUserId(null);
            setUsername("");
            setAuthStatus("logged-out");
            setWalletBalance(null);
            setBalanceText("0.00");
            setWalletError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to log out.");
        } finally {
            setLoggingOut(false);
        }
    }

    async function checkout(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!shop || cart.length === 0 || !hasDeliveryLocation) return;

        if (authStatus !== "logged-in") {
            router.push(loginHref);
            return;
        }
        if (deliveryFeeLoading || deliveryFee === null) {
            setError("Please wait for the delivery fee to finish calculating.");
            return;
        }
        if (
            cart.some((item) => {
                const product = products.find(
                    (entry) => entry.id === item.productId,
                );
                return !product || item.quantity > product.stock;
            })
        ) {
            setError("Some products no longer have enough stock.");
            return;
        }
        if (
            walletBalance !== null &&
            subtotalCents + Math.round(deliveryFee * 100) >
                Math.round(walletBalance * 100)
        ) {
            return;
        }

        setBusy(true);
        setError("");
        try {
            await apiFetch("orders", {
                method: "POST",
                body: JSON.stringify({
                    shopId: shop.id,
                    items: cart.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                    deliveryLat,
                    deliveryLng,
                }),
            });
            try {
                sessionStorage.removeItem(CART_STORAGE_KEY);
            } catch {
                // The placed order is complete even if session storage is unavailable.
            }
            router.push("/orders");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unable to place order.";
            setError(
                message.includes("Insufficient wallet balance")
                    ? "Insufficient wallet balance. Please top up."
                    : message,
            );
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                <div className="sticky top-0 z-[610]">
                    <div className="absolute left-3 top-2 z-[610] sm:left-6">
                        <BackButton fallbackHref={`/shops/${shopId}`} />
                    </div>
                    <AppHeader
                        authStatus={authStatus}
                        username={username}
                        balanceText={balanceText}
                        walletError={walletError}
                        loggingOut={loggingOut}
                        onLogout={logout}
                        userId={currentUserId}
                    />
                </div>
                <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-6">
                    <div className="h-10 rounded-xl bg-gray-200" />
                    <div className="h-72 rounded-2xl bg-gray-200" />
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="sticky top-0 z-[610]">
                <div className="absolute left-3 top-2 z-[610] sm:left-6">
                    <BackButton fallbackHref={`/shops/${shopId}`} />
                </div>
                <AppHeader
                    authStatus={authStatus}
                    username={username}
                    balanceText={balanceText}
                    walletError={walletError}
                    loggingOut={loggingOut}
                    onLogout={logout}
                    userId={currentUserId}
                />
            </div>

            <div className="mx-auto w-full max-w-3xl px-4 pb-72 pt-3 sm:px-6">
                <div className="mb-5">
                    <h1 className="shop-title min-w-0 break-words">
                        {shop?.name ?? "Shop"}
                    </h1>
                </div>

                {error && products.length === 0 ? (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                        <p role="alert" className="text-sm text-gray-700">
                            {error}
                        </p>
                    </section>
                ) : cart.length === 0 ? (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
                        Your cart is empty.
                    </section>
                ) : (
                    <ShopCart
                        products={products}
                        cart={cart}
                        currentUserId={currentUserId}
                        authLoading={authLoading}
                        busy={busy}
                        hasDeliveryLocation={hasDeliveryLocation}
                        deliveryFee={deliveryFee}
                        deliveryFeeLoading={deliveryFeeLoading}
                        deliveryFeeError={deliveryFeeError}
                        walletBalance={walletBalance}
                        errorMessage={error}
                        onSelectDeliveryLocation={selectDeliveryLocation}
                        onQuantityChange={changeQuantity}
                        onCheckout={checkout}
                    />
                )}
            </div>
        </main>
    );
}

export default function CartPage() {
    return (
        <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
            <CartPageContent />
        </Suspense>
    );
}
