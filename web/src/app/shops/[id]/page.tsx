"use client";

import {
  CART_STORAGE_KEY,
  saveCart as saveStoredCart,
} from "@/lib/cart-storage";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";
import ProductGrid from "@/components/shop/product-grid";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number | string;
  stock: number;
  imageData?: string | null;
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
  shopTotal: number;
  categories: string[];
  page: number;
  limit: number;
  totalPages: number;
};

type ProductForm = {
  name: string;
  category: string;
  price: string;
  stock: string;
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
  deliveryLat?: number;
  deliveryLng?: number;
};

const PAGE_SIZE = 10;
const MAX_PRODUCT_IMAGE_SIZE = 1 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SOURCE_SIZE = 10 * 1024 * 1024;

function getProductQuery(page: number, category: string, search: string) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  if (category) query.set("category", category);
  if (search.trim()) query.set("search", search.trim());

  return query.toString();
}

const emptyProductForm: ProductForm = {
  name: "",
  category: "Other",
  price: "",
  stock: "0",
};

function formatBalance(data: unknown): string {
  const balance = getBalanceAmount(data);

  return balance !== null
    ? balance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function getBalanceAmount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;

  const result = data as {
    balance?: number | string;
    amount?: number | string;
    wallet?: { balance?: number | string };
  };
  const value = result.balance ?? result.wallet?.balance ?? result.amount;

  if (value === undefined || value === null || value === "") return null;

  const balance = Number(value);

  return Number.isFinite(balance) && balance >= 0 ? balance : null;
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
  saveStoredCart(saved, readSavedCart);
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
  const [cartProducts, setCartProducts] = useState<Record<number, Product>>({});

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
  const [shopTotal, setShopTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [editingShopName, setEditingShopName] = useState(false);
  const [shopNameDraft, setShopNameDraft] = useState("");
  const [confirmDeleteShop, setConfirmDeleteShop] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRestored, setCartRestored] = useState(false);

  const closeProductForm = useCallback(() => {
    if (busy) return;
    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setError("");
  }, [busy]);

  const closeShopNameForm = useCallback(() => {
    if (busy) return;
    setEditingShopName(false);
    setError("");
  }, [busy]);

  useEffect(() => {
    if (
      !showProductForm &&
      !editingShopName &&
      !confirmDeleteShop &&
      !productToDelete
    ) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      if (showProductForm) {
        closeProductForm();
      } else if (editingShopName) {
        closeShopNameForm();
      } else if (confirmDeleteShop) {
        setConfirmDeleteShop(false);
      } else {
        setProductToDelete(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showProductForm,
    editingShopName,
    confirmDeleteShop,
    productToDelete,
    busy,
    closeProductForm,
    closeShopNameForm,
  ]);

  const isOwner =
    shop !== null && currentUserId !== null && shop.userId === currentUserId;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartProductTotalCents = cart.reduce((sum, item) => {
    const product = cartProducts[item.productId];
    return (
      sum +
      (product ? Math.round(Number(product.price) * 100) * item.quantity : 0)
    );
  }, 0);

  const refreshShop = useCallback(async () => {
    const [shopData, productData] = await Promise.all([
      apiFetch<Shop>(`shops/${params.id}`),
      apiFetch<ProductResponse>(
        `products/shop/${params.id}?${getProductQuery(page, selectedCategory, productSearch)}`,
      ),
    ]);

    setShop(shopData);
    setProducts(productData.items);
    setTotal(productData.total);
    setShopTotal(productData.shopTotal);
    setTotalPages(productData.totalPages);
    setCategories(productData.categories);

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
  }, [params.id, page, selectedCategory, productSearch]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setProductsLoading(true);
      setError("");

      try {
        const [shopData, productData, authData] = await Promise.all([
          apiFetch<Shop>(`shops/${params.id}`),
          apiFetch<ProductResponse>(
            `products/shop/${params.id}?${getProductQuery(page, selectedCategory, productSearch)}`,
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
            .catch((): AuthResponse => ({
              authenticated: false,
              userId: null,
            })),
        ]);

        if (!active) return;

        setShop(shopData);
        setProducts(productData.items);
        setTotal(productData.total);
        setShopTotal(productData.shopTotal);
        setTotalPages(productData.totalPages);
        setCategories(productData.categories);

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

        setCurrentUserId(authenticated ? authData.userId! : null);
        setAuthStatus(authenticated ? "logged-in" : "logged-out");
        setUsername(
          authenticated
            ? (authData.username ?? authData.user?.username ?? "")
            : "",
        );

        if (page > Math.max(1, productData.totalPages)) {
          setPage(Math.max(1, productData.totalPages));
        }
      } catch (err) {
        if (!active) return;

        setError(err instanceof Error ? err.message : "Unable to load shop.");
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
  }, [params.id, page, selectedCategory, productSearch]);

  // Restore the selected products from browser storage after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (cartRestored) return;

    const saved = readSavedCart(shopId);

    if (saved) {
      setCart(saved.cart);
      setCartProducts((previous) => ({
        ...previous,
        ...saved.cartProducts,
      }));
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
            err instanceof Error ? err.message : "Unable to load wallet.",
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
      setError(err instanceof Error ? err.message : "Unable to log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  const pageHeader = (
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
        onLogout={logout}
        userId={currentUserId}
      />
    </div>
  );

  function startCreateProduct() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setShowProductForm(true);
    setMessage("");
    setError("");
  }

  function startEditShopName() {
    if (!shop) return;

    setShopNameDraft(shop.name);
    setEditingShopName(true);
    setConfirmDeleteShop(false);
    setMessage("");
    setError("");
  }

  async function saveShopName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!shop || busy) return;

    const name = shopNameDraft.trim();
    if (!name || name.length > 100) {
      setError("Shop name must be between 1 and 100 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const updatedShop = await apiFetch<Shop>(`shops/${shop.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });

      setShop(updatedShop);
      setShopNameDraft(updatedShop.name);
      setEditingShopName(false);
      setMessage("Shop name updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update shop name.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteShop() {
    if (!shop || !confirmDeleteShop || busy) return;

    setBusy(true);
    setError("");

    try {
      await apiFetch(`shops/${shop.id}`, { method: "DELETE" });

      try {
        sessionStorage.removeItem(CART_STORAGE_KEY);
      } catch {
        // Ignore storage errors.
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete shop.");
    } finally {
      setBusy(false);
    }
  }

  function requestDeleteProduct(product: Product) {
    setProductToDelete(product);
    setError("");
    setMessage("");
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category || "Other",
      price: String(product.price),
      stock: String(product.stock),
    });
    setShowProductForm(true);
    setMessage("");
    setError("");
  }

  async function encodeProductImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Choose an image file.");
    }

    if (file.size > MAX_PRODUCT_IMAGE_SOURCE_SIZE) {
      throw new Error("Image file must be 10 MB or smaller.");
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Unable to process the selected image.");
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let quality = 0.82;
    let blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );

    while (blob && blob.size > MAX_PRODUCT_IMAGE_SIZE && quality > 0.4) {
      quality -= 0.1;
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
    }

    if (!blob) {
      throw new Error("Unable to process the selected image.");
    }

    if (blob.size > MAX_PRODUCT_IMAGE_SIZE) {
      throw new Error("Image is too large after compression.");
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Unable to read the selected image."));
          return;
        }

        resolve(reader.result);
      };
      reader.onerror = () =>
        reject(new Error("Unable to read the selected image."));
      reader.readAsDataURL(blob);
    });
  }

  async function updateProductImage(product: Product, file: File) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const imageData = await encodeProductImage(file);
      const updatedProduct = await apiFetch<Product>(`products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ imageData }),
      });

      setCartProducts((current) => ({
        ...current,
        [updatedProduct.id]: updatedProduct,
      }));
      setMessage("Product image updated.");
      await refreshShop();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update product image.",
      );
    } finally {
      setBusy(false);
    }
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

    const payload: {
      name: string;
      price: number;
      stock: number;
      category: string;
    } = {
      name: productForm.name.trim(),
      price,
      stock,
      category: productForm.category.trim() || "Other",
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
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await apiFetch(`products/${product.id}`, {
        method: "DELETE",
      });

      const nextCart = cart.filter((item) => item.productId !== product.id);

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

      setProductToDelete(null);
      setMessage("Product deleted.");
      await refreshShop();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete product.",
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

    const existing = cart.find((item) => item.productId === product.id);

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
    setError("");

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
              item.productId === product.id ? { ...item, quantity } : item,
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        {pageHeader}

        <div className="mx-auto max-w-6xl animate-pulse space-y-5 px-4 py-3 sm:px-6">
          <div className="h-24 rounded-2xl bg-gray-200" />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 rounded-2xl bg-gray-200" />
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

      <div
        className={`mx-auto w-full max-w-6xl px-4 ${
          !isOwner && cartItemCount > 0 ? "pb-56" : "pb-8"
        } pt-2 sm:px-6 sm:pt-3`}
      >
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="min-w-0">
            <div>
              <h1 className="shop-title min-h-[81px] min-w-0 break-words">
                {shop.name}
              </h1>
              <div className="mt-2 flex min-h-9 items-center justify-end gap-2">
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      aria-label="Edit shop name"
                      title="Edit shop name"
                      onClick={startEditShopName}
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M12 20h9" />
                        <path d="m16.5 3.5 4 4L8 20H4v-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete shop"
                      title="Delete shop"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        setConfirmDeleteShop(true);
                      }}
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span aria-hidden="true" className="h-9" />
                )}
              </div>
            </div>
          </div>
        </section>

        {error &&
          !showProductForm &&
          !editingShopName &&
          !confirmDeleteShop &&
          !productToDelete && (
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

        {confirmDeleteShop && isOwner && (
          <div
            className="fixed inset-0 z-[700] flex items-center justify-center bg-gray-950/35 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) {
                setConfirmDeleteShop(false);
                setError("");
              }
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-shop-title"
              aria-describedby="delete-shop-description"
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-950/20 sm:p-6"
            >
              <h2 id="delete-shop-title" className="section-title">
                Delete this shop?
              </h2>
              <p
                id="delete-shop-description"
                className="mt-2 text-sm text-gray-600"
              >
                All products in this shop will also be deleted.
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteShop(false);
                    setError("");
                  }}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteShop()}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </section>
          </div>
        )}

        {productToDelete && isOwner && (
          <div
            className="fixed inset-0 z-[700] flex items-center justify-center bg-gray-950/35 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) {
                setProductToDelete(null);
                setError("");
              }
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-product-title"
              aria-describedby="delete-product-description"
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-950/20 sm:p-6"
            >
              <h2 id="delete-product-title" className="section-title">
                Delete this product?
              </h2>
              <p
                id="delete-product-description"
                className="mt-2 text-sm text-gray-600"
              >
                Delete “{productToDelete.name}”?
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProductToDelete(null);
                    setError("");
                  }}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteProduct(productToDelete)}
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </section>
          </div>
        )}

        {editingShopName && isOwner && (
          <div
            className="fixed inset-0 z-[700] flex items-center justify-center bg-gray-950/35 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeShopNameForm();
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="shop-name-form-title"
              className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-950/20 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="shop-name-form-title" className="section-title">
                  Edit shop name
                </h2>
                <button
                  type="button"
                  onClick={closeShopNameForm}
                  disabled={busy}
                  aria-label="Close shop name form"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-5 w-5"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <form onSubmit={saveShopName} className="mt-5">
                <label
                  htmlFor="shop-name"
                  className="text-sm font-medium text-gray-700"
                >
                  Shop name
                  <input
                    id="shop-name"
                    autoFocus
                    required
                    maxLength={100}
                    value={shopNameDraft}
                    onChange={(event) => setShopNameDraft(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </label>
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeShopNameForm}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {showProductForm && isOwner && (
          <div
            className="fixed inset-0 z-[700] flex items-center justify-center overflow-y-auto bg-gray-950/35 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeProductForm();
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-form-title"
              className="my-auto max-h-[min(90dvh,48rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-950/20 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">
                  <span id="product-form-title">
                    {editingProductId === null ? "Add product" : "Edit product"}
                  </span>
                </h2>

                <button
                  type="button"
                  onClick={closeProductForm}
                  disabled={busy}
                  aria-label="Close product form"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-5 w-5"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <form
                onSubmit={saveProduct}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <label className="text-sm font-medium text-gray-700">
                  Product name
                  <input
                    required
                    autoFocus
                    maxLength={200}
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        name: event.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
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
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
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
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Category
                  <input
                    maxLength={100}
                    value={productForm.category}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        category: event.target.value,
                      })
                    }
                    placeholder="Other"
                    className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </label>

                <div className="flex flex-wrap gap-3 pt-1 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Save product"}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeProductForm}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
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
          shopTotal={shopTotal}
          totalPages={totalPages}
          categories={categories}
          selectedCategory={selectedCategory}
          search={productSearch}
          onPageChange={setPage}
          onSearchChange={(search) => {
            setPage(1);
            setProductSearch(search);
          }}
          onCategoryChange={(category) => {
            setPage(1);
            setSelectedCategory(category);
          }}
          onEdit={startEditProduct}
          onDelete={requestDeleteProduct}
          onImageChange={(product, file) =>
            void updateProductImage(product, file)
          }
          onAddToCart={addToCart}
          onChangeQuantity={changeQuantity}
        />
      </div>

      {isOwner && (
        <button
          type="button"
          aria-label="Add product"
          title="Add product"
          onClick={startCreateProduct}
          disabled={busy}
          className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] right-4 z-[590] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 p-0 text-white shadow-lg shadow-green-900/25 transition hover:bg-green-700 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:right-8"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-7 w-7"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {!isOwner && cartRestored && cart.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[590] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
          <section className="pointer-events-auto mx-auto w-full max-w-6xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg shadow-gray-900/10 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-600">Product total</span>
              <span className="font-semibold tabular-nums text-gray-900">
                ฿
                {(cartProductTotalCents / 100).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!shop) return;
                router.push(`/shops/${shop.id}/cart`);
              }}
              disabled={authLoading || loading}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to cart
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
