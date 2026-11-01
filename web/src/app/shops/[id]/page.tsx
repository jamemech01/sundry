"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";
import ProductGrid from "@/components/shop/product-grid";
import ShopCart from "@/components/shop/shop-cart";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type Product = {
    id: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
    imageUrl?: string | null;
};

type Shop = {
    id: number;
    name: string;
    userId: number;
    lat: number;
    lng: number;
};

type ProductResponse = {
    items: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

type ProductForm = {
    name: string;
    category: string;
    price: string;
    stock: string;
    imageUrl: string;
};

type CartItem = {
    productId: number;
    quantity: number;
};

type AuthResponse = {
    authenticated?: boolean;
    userId?: number | null;
    username?: string;
    user?: {
        id?: number;
        username?: string;
    };
};

type SavedCart = {
    shopId: number;
    cart: CartItem[];
    cartProducts: Record<number, Product>;
};

const PAGE_SIZE = 10;
const CART_STORAGE_KEY = "sundry-checkout-cart";
const PAGE_LOAD_ID_STORAGE_KEY = "sundry-explore-map-load-id";

let IS_PAGE_RELOAD = false;

if (typeof window !== "undefined") {
    try {
        const loadId = String(performance.timeOrigin);
        const previousLoadId = sessionStorage.getItem(
            PAGE_LOAD_ID_STORAGE_KEY,
        );

        if (previousLoadId !== loadId) {
            const navigation = performance.getEntriesByType(
                "navigation",
            )[0] as PerformanceNavigationTiming | undefined;

            IS_PAGE_RELOAD = navigation?.type === "reload";

            if (IS_PAGE_RELOAD) {
                sessionStorage.removeItem(CART_STORAGE_KEY);
            }

            sessionStorage.setItem(PAGE_LOAD_ID_STORAGE_KEY, loadId);
        }
    } catch {
        // Ignore storage errors.
    }
}

const emptyProductForm: ProductForm = {
    name: "",
    category: "Other",
    price: "",
    stock: "0",
    imageUrl: "",
};

function formatBalance(data: unknown): string {
    if (!data || typeof data !== "object") return "0.00";

    const result = data as {
        balance?: number | string;
        amount?: number | string;
        wallet?: { balance?: number | string };
    };

    const value =
        result.balance ?? result.wallet?.balance ?? result.amount ?? 0;

    const balance = Number(value);

    return Number.isFinite(balance)
        ? balance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
        : "0.00";
}

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
            !("cartProducts" in saved) ||
            saved.shopId !== shopId ||
            !Array.isArray(saved.cart) ||
            typeof saved.cartProducts !== "object" ||
            saved.cartProducts === null
        ) {
            return null;
        }

        return saved as SavedCart;
    } catch {
        return null;
    }
}

function saveCart(saved: SavedCart) {
    try {
        sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(saved));
    } catch {
        // Ignore storage errors.
    }
}

export default function ShopDetailPage() {
    return (
        <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
            <ShopDetailContent />
        </Suspense>
    );
}

function ShopDetailContent() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const shopId = Number(params.id);

    const [shop, setShop] = useState<Shop | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [cartProducts, setCartProducts] = useState<Record<number, Product>>(
        {},
    );

    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
    const [username, setUsername] = useState("");
    const [balanceText, setBalanceText] = useState("0.00");
    const [walletError, setWalletError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);

    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const [editingProductId, setEditingProductId] = useState<number | null>(
        null,
    );
    const [showProductForm, setShowProductForm] = useState(false);
    const [productForm, setProductForm] =
        useState<ProductForm>(emptyProductForm);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [deliveryLat, setDeliveryLat] = useState("");
    const [deliveryLng, setDeliveryLng] = useState("");
    const [cartRestored, setCartRestored] = useState(false);

    const hasDeliveryLocation =
        deliveryLat.trim() !== "" &&
        deliveryLng.trim() !== "" &&
        Number.isFinite(Number(deliveryLat)) &&
        Number.isFinite(Number(deliveryLng)) &&
        Number(deliveryLat) >= -90 &&
        Number(deliveryLat) <= 90 &&
        Number(deliveryLng) >= -180 &&
        Number(deliveryLng) <= 180;

    const isOwner =
        shop !== null &&
        currentUserId !== null &&
        shop.userId === currentUserId;

    const refreshShop = useCallback(async () => {
        const [shopData, productData] = await Promise.all([
            apiFetch<Shop>(`shops/${params.id}`),
            apiFetch<ProductResponse>(
                `products/shop/${params.id}?page=${page}&limit=${PAGE_SIZE}`,
            ),
        ]);

        setShop(shopData);
        setProducts(productData.items);
        setTotal(productData.total);
        setTotalPages(productData.totalPages);

        setCartProducts((previous) => {
            const next = { ...previous };

            for (const product of productData.items) {
                next[product.id] = product;
            }

            return next;
        });

        if (page > Math.max(1, productData.totalPages)) {
            setPage(Math.max(1, productData.totalPages));
        }
    }, [params.id, page]);

    useEffect(() => {
        let active = true;

        async function loadPage() {
            setProductsLoading(true);
            setError("");

            try {
                const [shopData, productData, authData] = await Promise.all([
                    apiFetch<Shop>(`shops/${params.id}`),
                    apiFetch<ProductResponse>(
                        `products/shop/${params.id}?page=${page}&limit=${PAGE_SIZE}`,
                    ),
                    fetch("/api/auth/me", { cache: "no-store" })
                        .then(async (response) => {
                            if (!response.ok) {
                                return {
                                    authenticated: false,
                                    userId: null,
                                } satisfies AuthResponse;
                            }

                            return response.json() as Promise<AuthResponse>;
                        })
                        .catch(
                            (): AuthResponse => ({
                                authenticated: false,
                                userId: null,
                            }),
                        ),
                ]);

                if (!active) return;

                setShop(shopData);
                setProducts(productData.items);
                setTotal(productData.total);
                setTotalPages(productData.totalPages);

                setCartProducts((previous) => {
                    const next = { ...previous };

                    for (const product of productData.items) {
                        next[product.id] = product;
                    }

                    return next;
                });

                const authenticated =
                    authData.authenticated === true &&
                    typeof authData.userId === "number";

                setCurrentUserId(
                    authenticated ? authData.userId! : null,
                );
                setAuthStatus(
                    authenticated ? "logged-in" : "logged-out",
                );
                setUsername(
                    authenticated
                        ? authData.username ?? authData.user?.username ?? ""
                        : "",
                );

                if (page > Math.max(1, productData.totalPages)) {
                    setPage(Math.max(1, productData.totalPages));
                }
            } catch (err) {
                if (!active) return;

                setError(
                    err instanceof Error ? err.message : "Unable to load shop.",
                );
            } finally {
                if (active) {
                    setLoading(false);
                    setProductsLoading(false);
                    setAuthLoading(false);
                }
            }
        }

        void loadPage();

        return () => {
            active = false;
        };
    }, [params.id, page]);

    // Restore cart and delivery coordinates from browser storage and URL after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (cartRestored) return;

        const saved = IS_PAGE_RELOAD ? null : readSavedCart(shopId);

        if (saved) {
            setCart(saved.cart);
            setCartProducts((previous) => ({
                ...previous,
                ...saved.cartProducts,
            }));
        }

        const query = new URLSearchParams(window.location.search);
        const lat = query.get("deliveryLat");
        const lng = query.get("deliveryLng");

        if (
            lat !== null &&
            lng !== null &&
            lat.trim() !== "" &&
            lng.trim() !== "" &&
            Number.isFinite(Number(lat)) &&
            Number.isFinite(Number(lng)) &&
            Number(lat) >= -90 &&
            Number(lat) <= 90 &&
            Number(lng) >= -180 &&
            Number(lng) <= 180
        ) {
            setDeliveryLat(lat);
            setDeliveryLng(lng);
        } else {
            setDeliveryLat("");
            setDeliveryLng("");
        }

        setCartRestored(true);
    }, [cartRestored, shopId]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!cartRestored || cart.length === 0) return;

        saveCart({
            shopId,
            cart,
            cartProducts,
        });
    }, [cartRestored, shopId, cart, cartProducts]);

    useEffect(() => {
        if (authStatus !== "logged-in") return;

        let active = true;

        async function loadAccountData() {
            try {
                const wallet = await apiFetch<unknown>("wallet");

                if (active) {
                    setBalanceText(formatBalance(wallet));
                    setWalletError("");
                }
            } catch (err) {
                if (active) {
                    setWalletError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load wallet.",
                    );
                }
            }
        }

        void loadAccountData();

        return () => {
            active = false;
        };
    }, [authStatus]);

    async function logout() {
        if (loggingOut) return;

        setLoggingOut(true);

        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Unable to log out. Please try again.");
            }

            setCurrentUserId(null);
            setUsername("");
            setAuthStatus("logged-out");
            setBalanceText("0.00");
            setWalletError("");
            setMessage("You have been logged out.");
            setError("");

            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to log out.",
            );
        } finally {
            setLoggingOut(false);
        }
    }

    const pageHeader = (
        <AppHeader
            authStatus={authStatus}
            username={username}
            balanceText={balanceText}
            walletError={walletError}
            loggingOut={loggingOut}
            onLogout={logout}
            navigation={<BackButton fallbackHref="/" />}
        />
    );

    function startCreateProduct() {
        setEditingProductId(null);
        setProductForm(emptyProductForm);
        setShowProductForm(true);
        setMessage("");
        setError("");
    }

    function startEditProduct(product: Product) {
        setEditingProductId(product.id);
        setProductForm({
            name: product.name,
            category: product.category || "Other",
            price: String(product.price),
            stock: String(product.stock),
            imageUrl: product.imageUrl || "",
        });
        setShowProductForm(true);
        setMessage("");
        setError("");
    }

    async function saveProduct(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!shop) return;

        const price = Number(productForm.price);
        const stock = Number(productForm.stock);

        if (
            !productForm.name.trim() ||
            !Number.isFinite(price) ||
            price < 0 ||
            price > 99_999_999.99 ||
            !Number.isFinite(stock) ||
            !Number.isInteger(stock) ||
            stock < 0 ||
            stock > 999_999_999
        ) {
            setError("Enter a valid name, price, and whole-number stock.");
            return;
        }

        const imageUrl = productForm.imageUrl.trim();

        if (imageUrl) {
            try {
                const url = new URL(imageUrl);

                if (
                    url.protocol !== "http:" &&
                    url.protocol !== "https:"
                ) {
                    throw new Error("Invalid protocol");
                }
            } catch {
                setError("Image URL must be a valid HTTP or HTTPS URL.");
                return;
            }
        }

        const payload = {
            name: productForm.name.trim(),
            category: productForm.category.trim() || "Other",
            price,
            stock,
            ...(imageUrl ? { imageUrl } : {}),
        };

        setBusy(true);
        setError("");
        setMessage("");

        try {
            if (editingProductId !== null) {
                await apiFetch(`products/${editingProductId}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });

                setMessage("Product updated.");
            } else {
                await apiFetch("products", {
                    method: "POST",
                    body: JSON.stringify({
                        shopId: shop.id,
                        ...payload,
                    }),
                });

                setPage(1);
                setMessage("Product added.");
            }

            setShowProductForm(false);
            setEditingProductId(null);
            setProductForm(emptyProductForm);

            await refreshShop();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to save product.",
            );
        } finally {
            setBusy(false);
        }
    }

    async function deleteProduct(product: Product) {
        if (!window.confirm(`Delete "${product.name}"?`)) return;

        setBusy(true);
        setError("");
        setMessage("");

        try {
            await apiFetch(`products/${product.id}`, {
                method: "DELETE",
            });

            const nextCart = cart.filter(
                (item) => item.productId !== product.id,
            );

            const nextProducts = { ...cartProducts };
            delete nextProducts[product.id];

            setCart(nextCart);
            setCartProducts(nextProducts);

            if (nextCart.length === 0) {
                try {
                    sessionStorage.removeItem(CART_STORAGE_KEY);
                } catch {
                    // Ignore storage errors.
                }
            } else {
                saveCart({
                    shopId,
                    cart: nextCart,
                    cartProducts: nextProducts,
                });
            }

            setMessage("Product deleted.");
            await refreshShop();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to delete product.",
            );
        } finally {
            setBusy(false);
        }
    }

    function addToCart(product: Product) {
        if (authStatus === "loading" || cartRestored === false) return;

        if (authStatus !== "logged-in") {
            router.push(
                `/login?redirect=${encodeURIComponent(`/shops/${params.id}`)}`,
            );
            return;
        }

        if (isOwner || product.stock < 1) return;

        const existing = cart.find(
            (item) => item.productId === product.id,
        );

        if (existing && existing.quantity >= product.stock) {
            setError("You have added all available stock.");
            return;
        }

        const nextCart = existing
            ? cart.map((item) =>
                item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item,
            )
            : [...cart, { productId: product.id, quantity: 1 }];

        const nextProducts = {
            ...cartProducts,
            [product.id]: product,
        };

        setCart(nextCart);
        setCartProducts(nextProducts);
        setDeliveryLat("");
        setDeliveryLng("");
        setError("");
        setMessage(`${product.name} added to cart.`);

        saveCart({
            shopId,
            cart: nextCart,
            cartProducts: nextProducts,
        });
    }

    function changeQuantity(product: Product, quantity: number) {
        const nextCart =
            quantity <= 0
                ? cart.filter((item) => item.productId !== product.id)
                : quantity > product.stock
                    ? cart
                    : cart.map((item) =>
                        item.productId === product.id
                            ? { ...item, quantity }
                            : item,
                    );

        setCart(nextCart);

        if (nextCart.length === 0) {
            try {
                sessionStorage.removeItem(CART_STORAGE_KEY);
            } catch {
                // Ignore storage errors.
            }
        } else {
            saveCart({
                shopId,
                cart: nextCart,
                cartProducts,
            });
        }
    }

    function goToDeliveryMap() {
        if (cart.length === 0 || !shop) return;

        saveCart({
            shopId,
            cart,
            cartProducts,
        });

        router.push(`/?mode=delivery&shopId=${shop.id}`);
    }

    async function checkout(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!shop || cart.length === 0 || !hasDeliveryLocation) return;

        if (currentUserId === null) {
            setError("Please log in before placing an order.");
            return;
        }

        setBusy(true);
        setError("");
        setMessage("");

        try {
            await apiFetch("orders", {
                method: "POST",
                body: JSON.stringify({
                    shopId: shop.id,
                    items: cart.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                    deliveryLat: Number(deliveryLat),
                    deliveryLng: Number(deliveryLng),
                }),
            });

            setCart([]);
            setCartProducts({});
            setDeliveryLat("");
            setDeliveryLng("");

            try {
                sessionStorage.removeItem(CART_STORAGE_KEY);
            } catch {
                // Ignore storage errors.
            }

            setMessage("Order placed successfully.");
            await refreshShop();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to place order.",
            );
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                {pageHeader}

                <div className="mx-auto max-w-6xl animate-pulse space-y-5 px-4 py-3 sm:px-6">
                    <div className="h-24 rounded-2xl bg-gray-200" />

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-72 rounded-2xl bg-gray-200"
                            />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    if (error && !shop) {
        return (
            <main className="min-h-screen bg-gray-50">
                {pageHeader}

                <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>
                </div>
            </main>
        );
    }

    if (!shop) {
        return (
            <main className="min-h-screen bg-gray-50">
                {pageHeader}

                <div className="mx-auto max-w-6xl px-4 py-3 text-sm text-gray-600 sm:px-6">
                    Shop not found.
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            {pageHeader}

            <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-6 sm:pt-3">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="break-words text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                                    {shop.name}
                                </h1>

                                {isOwner && (
                                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                                        Your shop
                                    </span>
                                )}
                            </div>

                            <p className="mt-2 text-sm text-gray-500">
                                {total} {total === 1 ? "product" : "products"}
                            </p>
                        </div>

                        {isOwner && (
                            <button
                                type="button"
                                onClick={startCreateProduct}
                                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
                            >
                                <span aria-hidden="true">+</span>
                                Add product
                            </button>
                        )}
                    </div>
                </section>

                {error && (
                    <p
                        role="alert"
                        className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {error}
                    </p>
                )}

                {message && (
                    <p
                        role="status"
                        className="mt-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700"
                    >
                        {message}
                    </p>
                )}

                {showProductForm && isOwner && (
                    <section className="mt-6 rounded-2xl border border-purple-100 bg-white p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingProductId === null
                                    ? "Add product"
                                    : "Edit product"}
                            </h2>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowProductForm(false);
                                    setEditingProductId(null);
                                    setProductForm(emptyProductForm);
                                    setError("");
                                }}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                            >
                                Close
                            </button>
                        </div>

                        <form
                            onSubmit={saveProduct}
                            className="mt-5 grid gap-4 sm:grid-cols-2"
                        >
                            <label className="text-sm font-medium text-gray-700">
                                Product name
                                <input
                                    required
                                    maxLength={200}
                                    value={productForm.name}
                                    onChange={(event) =>
                                        setProductForm({
                                            ...productForm,
                                            name: event.target.value,
                                        })
                                    }
                                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
                                />
                            </label>

                            <label className="text-sm font-medium text-gray-700">
                                Category
                                <select
                                    value={productForm.category}
                                    onChange={(event) =>
                                        setProductForm({
                                            ...productForm,
                                            category: event.target.value,
                                        })
                                    }
                                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
                                >
                                    <option value="Food">Food</option>
                                    <option value="Groceries">Groceries</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>

                            <label className="text-sm font-medium text-gray-700">
                                Price (฿)
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="99999999.99"
                                    step="0.01"
                                    value={productForm.price}
                                    onChange={(event) =>
                                        setProductForm({
                                            ...productForm,
                                            price: event.target.value,
                                        })
                                    }
                                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
                                />
                            </label>

                            <label className="text-sm font-medium text-gray-700">
                                Stock
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="999999999"
                                    step="1"
                                    value={productForm.stock}
                                    onChange={(event) =>
                                        setProductForm({
                                            ...productForm,
                                            stock: event.target.value,
                                        })
                                    }
                                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
                                />
                            </label>

                            <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                                Image URL
                                <input
                                    type="url"
                                    maxLength={2048}
                                    placeholder="https://example.com/image.jpg"
                                    value={productForm.imageUrl}
                                    onChange={(event) =>
                                        setProductForm({
                                            ...productForm,
                                            imageUrl: event.target.value,
                                        })
                                    }
                                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
                                />
                            </label>

                            <div className="flex flex-wrap gap-3 pt-1 sm:col-span-2">
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {busy ? "Saving..." : "Save product"}
                                </button>

                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        setShowProductForm(false);
                                        setEditingProductId(null);
                                        setProductForm(emptyProductForm);
                                        setError("");
                                    }}
                                    className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <ProductGrid
                    products={products}
                    isOwner={isOwner}
                    busy={busy}
                    authLoading={authLoading}
                    loading={productsLoading}
                    cart={cart}
                    page={page}
                    total={total}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    onEdit={startEditProduct}
                    onDelete={deleteProduct}
                    onAddToCart={addToCart}
                    onChangeQuantity={changeQuantity}
                />

                <ShopCart
                    products={Object.values(cartProducts)}
                    cart={isOwner ? [] : cart}
                    currentUserId={currentUserId}
                    authLoading={authLoading}
                    busy={busy}
                    hasDeliveryLocation={hasDeliveryLocation}
                    onChooseDeliveryLocation={goToDeliveryMap}
                    onCheckout={checkout}
                />
            </div>
        </main>
    );
}
