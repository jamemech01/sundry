
"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MapShop } from "@/components/map/map-view";
import AppHeader from "@/components/app-header";
import BackButton from "@/components/ui/back-button";

const ICON_SIZE = 20;
const CONTROL_HEIGHT = "h-12";
const STANDARD_ACTION_WIDTH = "w-36";

type AuthStatus = "loading" | "logged-in" | "logged-out";

type WalletResponse = {
  balance?: number | string;
  wallet?: { balance?: number | string };
  amount?: number | string;
};

type OrderLike = { status?: string | null };

type DeliveryAddress = {
  display_name?: string;
  name?: string;
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

const FINISHED_STATUSES = [
  "completed",
  "complete",
  "done",
  "delivered",
  "cancelled",
  "canceled",
  "rejected",
  "refunded",
  "failed",
];

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

function hasPendingOrders(data: unknown) {
  const list: OrderLike[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { orders?: unknown })?.orders)
      ? (data as { orders: OrderLike[] }).orders
      : [];

  return list.some((order) => {
    const status = String(order?.status ?? "").trim().toLowerCase();
    return !FINISHED_STATUSES.includes(status);
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

  const [shops, setShops] = useState<MapShop[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [balance, setBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [pendingOrders, setPendingOrders] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creatingShop, setCreatingShop] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopLat, setShopLat] = useState<number | null>(null);
  const [shopLng, setShopLng] = useState<number | null>(null);
  const [creatingShopRequest, setCreatingShopRequest] = useState(false);
  const [createShopError, setCreateShopError] = useState("");

  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

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

          if (
            data.authenticated !== true ||
            typeof data.userId !== "number"
          ) {
            setCurrentUserId(null);
            setUsername("");
            setAuthStatus("logged-out");
            setBalance(null);
            setWalletError("");
            setPendingOrders(false);
            return;
          }

          setCurrentUserId(data.userId);
          setUsername(
            typeof data.username === "string" ? data.username : "",
          );
          setAuthStatus("logged-in");
          setWalletLoading(true);
          setWalletError("");

          apiFetch<unknown>("orders")
            .then((orders) => {
              if (active) {
                setPendingOrders(hasPendingOrders(orders));
              }
            })
            .catch(() => {
              if (active) setPendingOrders(false);
            });

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
          setPendingOrders(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !deliveryMode ||
      deliveryLat === null ||
      deliveryLng === null
    ) {
      return;
    }

    const controller = new AbortController();

    async function lookupAddress() {
      setAddressLoading(true);
      setAddressError("");
      setDeliveryAddress("");

      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(deliveryLat),
          lon: String(deliveryLng),
          addressdetails: "1",
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to find this address.");
        }

        const data = (await response.json()) as {
          display_name?: string;
          address?: DeliveryAddress;
        };

        const address = data.address;

        const parts = address
          ? [
            [address.house_number, address.road]
              .filter(Boolean)
              .join(" "),
            address.neighbourhood ??
            address.suburb ??
            address.quarter,
            address.city_district,
            address.city ?? address.town ?? address.village,
            address.state,
            address.postcode,
            address.country,
          ].filter(Boolean)
          : [];

        const formattedAddress = [...new Set(parts)].join(", ");
        const result = formattedAddress || data.display_name || "";

        if (!result) {
          throw new Error(
            "No detailed address found for this location.",
          );
        }

        setDeliveryAddress(result);
      } catch (err) {
        if (controller.signal.aborted) return;

        setAddressError(
          err instanceof Error
            ? err.message
            : "Unable to find this address.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setAddressLoading(false);
        }
      }
    }

    void lookupAddress();

    return () => controller.abort();
  }, [deliveryMode, deliveryLat, deliveryLng]);

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

  const deliveryShop = shops.find(
    (shop) => shop.id === deliveryShopId,
  );

  function startCreateShop() {
    if (authStatus === "loading") return;

    if (authStatus !== "logged-in") {
      router.push("/login");
      return;
    }

    if (ownShop) {
      router.push(`/shops/${ownShop.id}`);
      return;
    }

    setSearch("");
    setShopName("");
    setShopLat(null);
    setShopLng(null);
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

  async function confirmCreateShop(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (creatingShopRequest) return;

    const name = shopName.trim();

    if (!name || name.length > 100) {
      setCreateShopError(
        "Shop name must be between 1 and 100 characters.",
      );
      return;
    }

    if (shopLat === null || shopLng === null) {
      setCreateShopError(
        "Select your shop location on the map first.",
      );
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
        throw new Error(
          "Shop was created, but its ID was not returned.",
        );
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
      !deliveryAddress
    ) {
      return;
    }

    router.push(
      `/shops/${deliveryShopId}?deliveryLat=${encodeURIComponent(
        String(deliveryLat),
      )}&deliveryLng=${encodeURIComponent(String(deliveryLng))}`,
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
    setPendingOrders(false);
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
  const showEmpty =
    !loading && !error && filteredShops.length === 0;

  const showCount =
    !loading &&
    !error &&
    trimmedSearch !== "" &&
    filteredShops.length > 0;

  return (
    <main className="fixed inset-x-0 top-0 isolate h-[100svh] overflow-hidden bg-gray-100">
      <style>{`.leaflet-control-zoom { display: none !important; }`}</style>

      <div className="absolute inset-0">
        <MapView
          shops={
            creatingShop
              ? []
              : deliveryMode
                ? shops.filter(
                  (shop) => shop.id === deliveryShopId,
                )
                : filteredShops
          }
          currentUserId={currentUserId}
          mode={
            creatingShop
              ? "create-shop"
              : deliveryMode
                ? "delivery"
                : "shops"
          }
          deliveryLat={deliveryLat}
          deliveryLng={deliveryLng}
          onSelectDeliveryLocation={(lat, lng) => {
            setDeliveryLat(lat);
            setDeliveryLng(lng);
            setAddressError("");
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
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-3 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
            <div className="pointer-events-auto">
              <BackButton
                fallbackHref={`/shops/${deliveryShopId}`}
              />
            </div>

            <div
              className={`pointer-events-auto min-w-0 max-w-[70%] rounded-xl px-4 py-3 ${PANEL}`}
            >
              <p className="text-xs font-medium text-gray-500">
                Buying from
              </p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {deliveryShop?.name ?? "Loading shop..."}
              </p>
            </div>
          </header>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:p-5">
            <section
              className={`pointer-events-auto mx-auto w-full max-w-md rounded-2xl p-4 ${PANEL}`}
              aria-live="polite"
            >
              {deliveryLat === null || deliveryLng === null ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon name="pin" size={ICON_SIZE} />
                  </span>

                  <div className="min-w-0">
                    <h1 className="text-base font-semibold text-gray-900">
                      Select delivery location
                    </h1>
                    <p className="mt-1 text-sm leading-5 text-gray-500">
                      Tap the map to pin your delivery address.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon name="pin" size={ICON_SIZE} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h1 className="text-base font-semibold text-gray-900">
                        Delivery address
                      </h1>

                      {addressLoading ? (
                        <p className="mt-1 text-sm text-gray-500">
                          Finding address...
                        </p>
                      ) : addressError ? (
                        <p
                          role="alert"
                          className="mt-1 text-sm text-red-600"
                        >
                          {addressError}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm leading-6 text-gray-700">
                          {deliveryAddress}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={confirmDeliveryLocation}
                    disabled={
                      addressLoading ||
                      !deliveryAddress ||
                      !Number.isInteger(deliveryShopId) ||
                      deliveryShopId <= 0
                    }
                    className={`mt-4 flex ${CONTROL_HEIGHT} w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 ${FOCUS}`}
                  >
                    Confirm delivery location
                  </button>
                </>
              )}
            </section>
          </div>
        </>
      ) : creatingShop ? (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
            <button
              type="button"
              onClick={cancelCreateShop}
              disabled={creatingShopRequest}
              className={`pointer-events-auto flex ${CONTROL_HEIGHT} ${STANDARD_ACTION_WIDTH} shrink-0 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-lg transition hover:bg-gray-50 active:scale-95 disabled:opacity-50 ${FOCUS}`}
            >
              <Icon name="back" size={ICON_SIZE} />
              Cancel
            </button>
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
                className={`pointer-events-auto mx-auto w-full max-w-md rounded-2xl p-4 ${PANEL}`}
              >
                <label className="block text-sm font-medium text-gray-700">
                  Shop name
                  <input
                    autoFocus
                    required
                    minLength={1}
                    maxLength={100}
                    value={shopName}
                    onChange={(event) =>
                      setShopName(event.target.value)
                    }
                    placeholder="Enter shop name"
                    className={`mt-1.5 ${CONTROL_HEIGHT} w-full rounded-xl border border-gray-200 bg-white px-3.5 text-base font-normal text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15`}
                  />
                </label>

                {createShopError && (
                  <p
                    role="alert"
                    className="mt-2 text-sm text-red-600"
                  >
                    {createShopError}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={cancelCreateShop}
                    disabled={creatingShopRequest}
                    className={`${CONTROL_HEIGHT} flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 ${FOCUS}`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      creatingShopRequest ||
                      !shopName.trim()
                    }
                    className={`${CONTROL_HEIGHT} flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 ${FOCUS}`}
                  >
                    <Icon
                      name="check"
                      size={ICON_SIZE}
                      stroke={2.5}
                    />
                    {creatingShopRequest
                      ? "Creating..."
                      : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <>
          <AppHeader
            authStatus={authStatus}
            username={username}
            balanceText={balanceText}
            walletError={walletError}
            loggingOut={loggingOut}
            onLogout={logout}
            hasPendingOrders={pendingOrders}
          />

          {(loading || error || showCount) && (
            <div className="pointer-events-none absolute left-3 top-[max(76px,calc(env(safe-area-inset-top)+64px))] z-[500] flex max-w-[calc(100%-24px)] flex-col items-start gap-2 sm:left-5 sm:top-24">
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
                  <span className="font-semibold">
                    Couldn’t load shops.
                  </span>{" "}
                  {error}
                </p>
              )}

              {showCount && (
                <p
                  className={`rounded-full px-3.5 py-2 text-xs font-medium text-gray-700 ${PANEL}`}
                >
                  {filteredShops.length}{" "}
                  {filteredShops.length === 1
                    ? "shop"
                    : "shops"}{" "}
                  found
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
                <Icon
                  name="search"
                  size={ICON_SIZE}
                  stroke={2.1}
                />
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
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
                  <Icon
                    name="close"
                    size={ICON_SIZE}
                    stroke={2.4}
                  />
                </button>
              )}
            </label>

            <div className="ml-auto flex shrink-0 flex-col items-end gap-3">
              <button
                type="button"
                onClick={startCreateShop}
                disabled={authStatus === "loading"}
                className={`pointer-events-auto flex ${CONTROL_HEIGHT} w-36 shrink-0 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition duration-150 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
              >
                <Icon name="shop" size={ICON_SIZE} />
                {ownShop ? "Manage shop" : "Open shop"}
              </button>
            </div>
          </nav>
        </>
      )}
    </main>
  );
}
