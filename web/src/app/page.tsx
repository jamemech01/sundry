"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MapShop } from "@/components/map/map-view";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";
import { REGIONAL_MAP_ZOOM } from "@/components/map/map-constants";
import LocationAddress from "@/components/map/location-address";

const ICON_SIZE = 20;
const CONTROL_HEIGHT = "h-12";
const STANDARD_ACTION_WIDTH = "w-auto min-w-[128px]";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type WalletResponse = {
  balance?: number | string;
  wallet?: { balance?: number | string };
  amount?: number | string;
};

type DeliveryFeeResponse = {
  deliveryFee: number | string;
};

type DeliveryFeePreview = {
  key: string;
  amount: number;
};

const PANEL =
  "border border-gray-200/80 bg-white/95 shadow-lg shadow-gray-900/10 backdrop-blur-xl";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

function formatBalance(data: WalletResponse | null) {
  if (!data) return null;

  const value = data.balance ?? data.wallet?.balance ?? data.amount;

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return null;

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type IconName = "shop" | "pin" | "search" | "close" | "check" | "back";

function Icon({
  name,
  size = ICON_SIZE,
  stroke = 1.8,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "shop":
      return (
        <svg {...common}>
          <path d="M3 10l2-6h14l2 6" />
          <path d="M4 10v10h16V10" />
          <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M9 20v-5h6v5" />
        </svg>
      );

    case "pin":
      return (
        <svg {...common}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      );

    case "back":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
  }
}

export default function Home() {
  return (
    <Suspense
      fallback={<main className="fixed inset-0 animate-pulse bg-gray-100" />}
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const deliveryMode = mode === "delivery";
  const deliveryShopId = Number(searchParams.get("shopId"));
  const deliveryReturnToCart = searchParams.get("returnTo") === "cart";

  const [shops, setShops] = useState<MapShop[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [balance, setBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creatingShop, setCreatingShop] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopLat, setShopLat] = useState<number | null>(null);
  const [shopLng, setShopLng] = useState<number | null>(null);
  const [focusedOwnShopId, setFocusedOwnShopId] = useState<number | null>(null);
  const [creatingShopRequest, setCreatingShopRequest] = useState(false);
  const [createShopError, setCreateShopError] = useState("");

  const initialDeliveryLatValue = searchParams.get("deliveryLat");
  const initialDeliveryLngValue = searchParams.get("deliveryLng");
  const initialDeliveryLat = Number(initialDeliveryLatValue);
  const initialDeliveryLng = Number(initialDeliveryLngValue);
  const hasInitialDeliveryLocation =
    initialDeliveryLatValue !== null &&
    initialDeliveryLatValue.trim() !== "" &&
    initialDeliveryLngValue !== null &&
    initialDeliveryLngValue.trim() !== "" &&
    Number.isFinite(initialDeliveryLat) &&
    initialDeliveryLat >= -90 &&
    initialDeliveryLat <= 90 &&
    Number.isFinite(initialDeliveryLng) &&
    initialDeliveryLng >= -180 &&
    initialDeliveryLng <= 180;
  const [deliveryLat, setDeliveryLat] = useState<number | null>(
    hasInitialDeliveryLocation ? initialDeliveryLat : null,
  );
  const [deliveryLng, setDeliveryLng] = useState<number | null>(
    hasInitialDeliveryLocation ? initialDeliveryLng : null,
  );
  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeePreview | null>(
    null,
  );
  const [deliveryFeeError, setDeliveryFeeError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [itemsSubtotal, setItemsSubtotal] = useState<number | null>(null);

  const deliveryFeeKey =
    deliveryLat !== null && deliveryLng !== null
      ? `${deliveryShopId}:${deliveryLat}:${deliveryLng}`
      : "";
  const currentDeliveryFee =
    deliveryFee?.key === deliveryFeeKey ? deliveryFee.amount : null;
  const currentDeliveryFeeError =
    deliveryFeeError?.key === deliveryFeeKey ? deliveryFeeError.message : "";
  const deliveryFeeLoading =
    deliveryMode &&
    deliveryFeeKey !== "" &&
    currentDeliveryFee === null &&
    !currentDeliveryFeeError;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      !deliveryMode ||
      !Number.isInteger(deliveryShopId) ||
      deliveryShopId <= 0
    ) {
      setItemsSubtotal(null);
      return;
    }

    try {
      const rawCart = sessionStorage.getItem("sundry-checkout-cart");
      if (!rawCart) {
        setItemsSubtotal(null);
        return;
      }

      const saved: unknown = JSON.parse(rawCart);
      if (
        typeof saved !== "object" ||
        saved === null ||
        !("shopId" in saved) ||
        saved.shopId !== deliveryShopId ||
        !("cart" in saved) ||
        !Array.isArray(saved.cart)
      ) {
        setItemsSubtotal(null);
        return;
      }

      const cartProducts = "cartProducts" in saved ? saved.cartProducts : null;
      if (typeof cartProducts !== "object" || cartProducts === null) {
        setItemsSubtotal(null);
        return;
      }

      const subtotalCents = saved.cart.reduce((sum, item) => {
        if (
          typeof item !== "object" ||
          item === null ||
          !("productId" in item) ||
          !("quantity" in item) ||
          typeof item.productId !== "number" ||
          typeof item.quantity !== "number" ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) {
          return sum;
        }

        const product = Object.entries(cartProducts).find(
          ([productId]) => productId === String(item.productId),
        )?.[1];
        if (
          typeof product !== "object" ||
          product === null ||
          !("price" in product)
        ) {
          return sum;
        }

        const price = Number(product.price);
        return Number.isFinite(price) && price >= 0
          ? sum + Math.round(price * 100) * item.quantity
          : sum;
      }, 0);

      setItemsSubtotal(subtotalCents / 100);
    } catch {
      setItemsSubtotal(null);
    }
  }, [deliveryMode, deliveryShopId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let active = true;

    apiFetch<MapShop[]>("shops")
      .then((data) => {
        if (active) setShops(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load shops.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to check login");
        return response.json();
      })
      .then(
        async (data: {
          authenticated?: boolean;
          userId?: number | null;
          username?: string | null;
        }) => {
          if (!active) return;

          if (data.authenticated !== true || typeof data.userId !== "number") {
            setCurrentUserId(null);
            setUsername("");
            setAuthStatus("logged-out");
            setBalance(null);
            setWalletError("");
            return;
          }

          setCurrentUserId(data.userId);
          setUsername(typeof data.username === "string" ? data.username : "");
          setAuthStatus("logged-in");
          setWalletLoading(true);
          setWalletError("");

          try {
            const wallet = await apiFetch<WalletResponse>("wallet");

            if (active) {
              setBalance(formatBalance(wallet));
            }
          } catch {
            if (active) {
              setBalance(null);
              setWalletError("Unable to load balance");
            }
          } finally {
            if (active) setWalletLoading(false);
          }
        },
      )
      .catch(() => {
        if (active) {
          setCurrentUserId(null);
          setUsername("");
          setAuthStatus("logged-out");
          setBalance(null);
          setWalletError("");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !deliveryMode ||
      !Number.isInteger(deliveryShopId) ||
      deliveryShopId <= 0 ||
      deliveryLat === null ||
      deliveryLng === null
    ) {
      return;
    }

    const controller = new AbortController();
    const key = `${deliveryShopId}:${deliveryLat}:${deliveryLng}`;

    async function loadDeliveryFee() {
      try {
        const result = await apiFetch<DeliveryFeeResponse>(
          "orders/delivery-fee",
          {
            method: "POST",
            body: JSON.stringify({
              shopId: deliveryShopId,
              deliveryLat,
              deliveryLng,
            }),
            signal: controller.signal,
          },
        );
        const amount = Number(result.deliveryFee);

        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("Unable to calculate delivery fee.");
        }

        setDeliveryFee({ key, amount });
        setDeliveryFeeError(null);
      } catch (err) {
        if (controller.signal.aborted) return;

        setDeliveryFeeError({
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
  }, [deliveryMode, deliveryShopId, deliveryLat, deliveryLng]);

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return shops;

    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(query) ||
        shop.products?.some((product) =>
          product.name.toLowerCase().includes(query),
        ),
    );
  }, [shops, search]);

  const ownShop =
    currentUserId === null
      ? undefined
      : shops.find((shop) => shop.userId === currentUserId);

  const deliveryShop = shops.find((shop) => shop.id === deliveryShopId);

  function startCreateShop() {
    if (authStatus === "loading") return;

    if (authStatus !== "logged-in") {
      router.push("/login");
      return;
    }

    if (ownShop) {
      if (focusedOwnShopId === ownShop.id) {
        router.push(`/shops/${ownShop.id}`);
        return;
      }

      setFocusedOwnShopId(ownShop.id);
      setSearch("");
      window.dispatchEvent(
        new CustomEvent("map:locate", {
          detail: {
            lat: ownShop.lat,
            lng: ownShop.lng,
            zoom: REGIONAL_MAP_ZOOM,
          },
        }),
      );
      return;
    }

    setSearch("");
    setShopName("");
    setShopLat(null);
    setShopLng(null);
    setFocusedOwnShopId(null);
    setCreateShopError("");
    setCreatingShop(true);
  }

  function cancelCreateShop() {
    if (creatingShopRequest) return;

    setCreatingShop(false);
    setShopName("");
    setShopLat(null);
    setShopLng(null);
    setCreateShopError("");
  }

  async function confirmCreateShop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creatingShopRequest) return;

    const name = shopName.trim();

    if (!name || name.length > 100) {
      setCreateShopError("Shop name must be between 1 and 100 characters.");
      return;
    }

    if (shopLat === null || shopLng === null) {
      setCreateShopError("Select your shop location on the map first.");
      return;
    }

    setCreatingShopRequest(true);
    setCreateShopError("");

    try {
      const shop = await apiFetch<{ id: number }>("shops", {
        method: "POST",
        body: JSON.stringify({ name, lat: shopLat, lng: shopLng }),
      });

      if (!Number.isInteger(shop.id)) {
        throw new Error("Shop was created, but its ID was not returned.");
      }

      router.push(`/shops/${shop.id}`);
      router.refresh();
    } catch (err) {
      setCreateShopError(
        err instanceof Error ? err.message : "Unable to create shop.",
      );
    } finally {
      setCreatingShopRequest(false);
    }
  }

  function confirmDeliveryLocation() {
    if (
      !Number.isInteger(deliveryShopId) ||
      deliveryShopId <= 0 ||
      deliveryLat === null ||
      deliveryLng === null ||
      currentDeliveryFee === null
    ) {
      return;
    }

    try {
      const rawCart = sessionStorage.getItem("sundry-checkout-cart");
      if (rawCart) {
        const saved: unknown = JSON.parse(rawCart);
        if (
          typeof saved === "object" &&
          saved !== null &&
          "shopId" in saved &&
          saved.shopId === deliveryShopId &&
          "cart" in saved &&
          Array.isArray(saved.cart) &&
          "cartProducts" in saved &&
          typeof saved.cartProducts === "object" &&
          saved.cartProducts !== null
        ) {
          sessionStorage.setItem(
            "sundry-checkout-cart",
            JSON.stringify({
              ...saved,
              deliveryLat,
              deliveryLng,
            }),
          );
        }
      }
    } catch {
      setError("Unable to save delivery location. Please try again.");
      return;
    }

    const locationQuery = `deliveryLat=${encodeURIComponent(
      String(deliveryLat),
    )}&deliveryLng=${encodeURIComponent(String(deliveryLng))}`;
    router.push(
      deliveryReturnToCart
        ? `/shops/${deliveryShopId}/cart?${locationQuery}`
        : `/shops/${deliveryShopId}`,
    );
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Keep the local account state synchronized with the UI.
    }

    setCurrentUserId(null);
    setUsername("");
    setAuthStatus("logged-out");
    setBalance(null);
    setWalletError("");
    setLoggingOut(false);

    router.refresh();
  }

  const balanceText =
    authStatus === "loading" || walletLoading
      ? "..."
      : authStatus === "logged-out"
        ? "—"
        : walletError
          ? "—"
          : (balance ?? "—");

  const trimmedSearch = search.trim();
  const showEmpty = !loading && !error && filteredShops.length === 0;

  const showCount =
    !loading && !error && trimmedSearch !== "" && filteredShops.length > 0;

  return (
    <main className="fixed inset-x-0 top-0 isolate h-dvh overflow-hidden bg-gray-100">
      <div className="absolute inset-0">
        <MapView
          shops={
            creatingShop
              ? []
              : deliveryMode
                ? shops.filter((shop) => shop.id === deliveryShopId)
                : filteredShops
          }
          currentUserId={currentUserId}
          mode={
            creatingShop ? "create-shop" : deliveryMode ? "delivery" : "shops"
          }
          deliveryLat={deliveryLat}
          deliveryLng={deliveryLng}
          onSelectDeliveryLocation={(lat, lng) => {
            setDeliveryLat(lat);
            setDeliveryLng(lng);
            setError("");
          }}
          shopLat={shopLat}
          shopLng={shopLng}
          onSelectShopLocation={(lat, lng) => {
            setShopLat(lat);
            setShopLng(lng);
            setCreateShopError("");
          }}
        />
      </div>

      {deliveryMode ? (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start gap-3 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
            <div className="pointer-events-auto">
              <BackButton
                fallbackHref={
                  deliveryReturnToCart
                    ? `/shops/${deliveryShopId}/cart?deliveryLat=${deliveryLat ?? ""}&deliveryLng=${deliveryLng ?? ""}`
                    : `/shops/${deliveryShopId}`
                }
              />
            </div>

            <div
              className={`pointer-events-auto flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 ${PANEL} sm:max-w-md`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon name="shop" size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">
                  Delivery location for
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
                  {deliveryShop?.name ?? "Loading shop..."}
                </p>
              </div>
            </div>
          </header>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:p-5">
            <section
              className={`pointer-events-auto mx-auto w-full max-w-md rounded-2xl p-4 ${PANEL}`}
              aria-live="polite"
            >
              {deliveryLat === null || deliveryLng === null ? (
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon name="pin" size={ICON_SIZE} />
                  </span>

                  <div className="min-w-0">
                    <h1 className="card-title">Select delivery location</h1>
                    <p className="mt-1 text-sm leading-5 text-gray-500">
                      Tap the map to choose a delivery point.
                    </p>
                  </div>
                </div>
              ) : null}
              {deliveryLat !== null && deliveryLng !== null && (
                <LocationAddress
                  lat={deliveryLat}
                  lng={deliveryLng}
                  className="mb-3"
                />
              )}
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-600">Product total</span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {itemsSubtotal === null
                    ? "—"
                    : `฿${itemsSubtotal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-600">Delivery fee</span>
                {deliveryFeeLoading ? (
                  <span className="text-gray-500">Calculating...</span>
                ) : currentDeliveryFeeError ? (
                  <span role="alert" className="text-right text-red-600">
                    {currentDeliveryFeeError}
                  </span>
                ) : currentDeliveryFee !== null ? (
                  <span className="font-semibold tabular-nums text-gray-900">
                    ฿
                    {currentDeliveryFee.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold tabular-nums text-gray-900">
                  {itemsSubtotal === null || currentDeliveryFee === null
                    ? "—"
                    : `฿${(itemsSubtotal + currentDeliveryFee).toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}`}
                </span>
              </div>

              <button
                type="button"
                onClick={confirmDeliveryLocation}
                disabled={
                  deliveryLat === null ||
                  deliveryLng === null ||
                  deliveryFeeLoading ||
                  currentDeliveryFee === null ||
                  currentDeliveryFeeError !== "" ||
                  !Number.isInteger(deliveryShopId) ||
                  deliveryShopId <= 0
                }
                className={`mt-4 flex ${CONTROL_HEIGHT} w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 ${FOCUS}`}
              >
                Continue to cart
              </button>
            </section>
          </div>
        </>
      ) : creatingShop ? (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
            <div className="pointer-events-auto">
              <BackButton
                onClick={cancelCreateShop}
                disabled={creatingShopRequest}
              />
            </div>
          </header>

          {shopLat === null || shopLng === null ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2">
              <div
                className={`rounded-2xl px-5 py-3.5 text-sm font-semibold text-gray-800 ${PANEL}`}
              >
                Select your location
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:p-5">
              <form
                onSubmit={confirmCreateShop}
                className={`pointer-events-auto mx-auto max-h-[min(70dvh,36rem)] w-full max-w-md overflow-y-auto rounded-2xl p-4 ${PANEL}`}
              >
                <LocationAddress lat={shopLat} lng={shopLng} />
                <label className="block text-sm font-medium text-gray-700">
                  Shop name
                  <input
                    required
                    minLength={1}
                    maxLength={100}
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Enter shop name"
                    className={`mt-1.5 ${CONTROL_HEIGHT} w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base font-normal text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15`}
                  />
                </label>

                {createShopError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {createShopError}
                  </p>
                )}

                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={creatingShopRequest || !shopName.trim()}
                    className={`${CONTROL_HEIGHT} flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 ${FOCUS}`}
                  >
                    <Icon name="check" size={ICON_SIZE} stroke={2.5} />
                    {creatingShopRequest ? "Creating..." : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <>
          <AppHeader
            homePage
            authStatus={authStatus}
            username={username}
            balanceText={balanceText}
            walletError={walletError}
            loggingOut={loggingOut}
            onLogout={logout}
            userId={currentUserId}
          />

          {(loading || error || showCount) && (
            <div
              className={`pointer-events-none absolute left-3 z-[500] flex max-w-[calc(100%-24px)] flex-col items-start gap-2 sm:left-5 ${authStatus === "logged-in" ? "top-[max(132px,calc(env(safe-area-inset-top)+122px))] sm:top-32" : "top-[max(76px,calc(env(safe-area-inset-top)+64px))] sm:top-24"}`}
            >
              {loading && (
                <p
                  className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium text-gray-700 ${PANEL}`}
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                  Loading shops…
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="max-w-full rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs text-red-700 shadow-sm"
                >
                  <span className="font-semibold">Couldn’t load shops.</span>{" "}
                  {error}
                </p>
              )}

              {showCount && (
                <p
                  className={`rounded-full px-3.5 py-2 text-xs font-medium text-gray-700 ${PANEL}`}
                >
                  {filteredShops.length}{" "}
                  {filteredShops.length === 1 ? "shop" : "shops"} found
                </p>
              )}
            </div>
          )}

          {showEmpty && (
            <div
              className={`absolute left-1/2 top-1/2 z-[500] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 text-center ${PANEL}`}
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                <Icon name="pin" size={ICON_SIZE} />
              </span>

              <p className="mt-3 text-base font-semibold text-gray-900">
                {trimmedSearch
                  ? `No shops match “${trimmedSearch}”`
                  : "No shops yet"}
              </p>

              <p className="mt-1 text-sm leading-5 text-gray-500">
                {trimmedSearch
                  ? "Try a different shop or product name."
                  : "Open the first shop on the map."}
              </p>

              {trimmedSearch && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={`${CONTROL_HEIGHT} mt-4 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-700 ${FOCUS}`}
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          <nav
            aria-label="Main actions"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-end gap-3 p-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:gap-4 sm:p-5"
          >
            <label
              className={`pointer-events-auto flex ${CONTROL_HEIGHT} min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3.5 focus-within:ring-2 focus-within:ring-blue-500 ${PANEL}`}
            >
              <span className="shrink-0 text-gray-500">
                <Icon name="search" size={ICON_SIZE} stroke={2.1} />
              </span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                aria-label="Search"
                suppressHydrationWarning
                className="h-full w-full min-w-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  title="Clear search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon name="close" size={ICON_SIZE} stroke={2.4} />
                </button>
              )}
            </label>

            <div className="ml-auto flex shrink-0 flex-col items-end gap-3">
              <button
                type="button"
                onClick={startCreateShop}
                disabled={authStatus === "loading"}
                aria-label="Open shop"
                className={`pointer-events-auto flex ${CONTROL_HEIGHT} ${STANDARD_ACTION_WIDTH} shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition duration-150 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
              >
                <Icon name="shop" size={ICON_SIZE} />
                Open shop
              </button>
            </div>
          </nav>
        </>
      )}
    </main>
  );
}
