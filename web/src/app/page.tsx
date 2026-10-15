"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MapShop } from "@/components/map";

const MapView = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-gray-100" />
  ),
});

const categories = ["All", "Food", "Groceries", "Other"];

export default function Home() {
  const [shops, setShops] = useState<MapShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    apiFetch<MapShop[]>("shops")
      .then(setShops)
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Unable to load shops.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shops.filter((shop) => {
      const matchesSearch =
        !query ||
        shop.name.toLowerCase().includes(query) ||
        shop.products?.some((product) =>
          product.name.toLowerCase().includes(query),
        );

      const matchesCategory =
        category === "All" ||
        shop.products?.some(
          (product) => product.category === category,
        );

      return matchesSearch && matchesCategory;
    });
  }, [shops, search, category]);

  const selectedShop = filteredShops.find(
    (shop) => shop.id === selectedShopId,
  );

  function locateMe() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.dispatchEvent(
          new CustomEvent("sundry:locate", {
            detail: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          }),
        );
      },
      () => setLocationError("Unable to access your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <main className="fixed inset-0 z-0 overflow-hidden bg-gray-100">
      <div className="absolute inset-0">
        <MapView
          shops={filteredShops}
          selectedShopId={selectedShopId}
          onSelectShop={(shop) => setSelectedShopId(shop.id)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-5">
        <div className="pointer-events-auto mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Sundry
            </Link>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedShopId(null);
                }}
                placeholder="Search shops or products"
                aria-label="Search shops or products"
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </div>

            <Link
              href="/login"
              aria-label="Account"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"
            >
              <span aria-hidden="true">♙</span>
            </Link>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setCategory(item);
                  setSelectedShopId(null);
                }}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium shadow-md ${category === item
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700"
                  }`}
              >
                {item === "All" ? "All shops" : item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-1/2 z-[500] -translate-y-1/2 sm:right-5">
        <button
          type="button"
          onClick={locateMe}
          aria-label="My location"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-lg"
        >
          ◎
        </button>
      </div>

      {(loading || error || locationError) && (
        <div className="absolute left-3 right-3 top-36 z-[500] mx-auto max-w-xl">
          {loading && (
            <p className="rounded-xl bg-white p-3 text-sm shadow">
              Loading shops...
            </p>
          )}

          {(error || locationError) && (
            <p
              role="alert"
              className="rounded-xl bg-white p-3 text-sm text-red-600 shadow"
            >
              {error || locationError}
            </p>
          )}
        </div>
      )}

      {selectedShop && (
        <section className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-3 z-[500] mx-auto max-w-xl rounded-2xl bg-white p-4 shadow-xl sm:bottom-24">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{selectedShop.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedShop.products?.length ?? 0} products
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedShopId(null)}
              aria-label="Close shop details"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100"
            >
              ×
            </button>
          </div>

          {selectedShop.products && selectedShop.products.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {selectedShop.products.map((product) => (
                <div
                  key={product.id}
                  className="min-w-28 rounded-xl bg-gray-50 p-3"
                >
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="mt-1 text-sm text-blue-700">
                    ฿{Number(product.price).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/shops/${selectedShop.id}`}
            className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
          >
            View Shop
          </Link>
        </section>
      )}

      {!loading && !error && filteredShops.length === 0 && (
        <div className="absolute left-3 right-3 top-1/2 z-[500] mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-5 text-center shadow-lg">
          <p className="font-semibold">No shops found</p>
          <p className="mt-1 text-sm text-gray-500">
            Try another search or category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            Clear filters
          </button>
        </div>
      )}

      <nav className="absolute inset-x-0 bottom-0 z-[500] border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-[64px] max-w-xl grid-cols-4">
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 text-blue-600"
          >
            <span aria-hidden="true" className="text-xl">⌖</span>
            <span className="text-xs font-medium">Explore</span>
          </Link>

          <Link
            href="/orders"
            className="flex flex-col items-center justify-center gap-1 text-gray-500"
          >
            <span aria-hidden="true" className="text-xl">▤</span>
            <span className="text-xs">Orders</span>
          </Link>

          <Link
            href="/wallet"
            className="flex flex-col items-center justify-center gap-1 text-gray-500"
          >
            <span aria-hidden="true" className="text-xl">◉</span>
            <span className="text-xs">Wallet</span>
          </Link>

          <Link
            href="/login"
            className="flex flex-col items-center justify-center gap-1 text-gray-500"
          >
            <span aria-hidden="true" className="text-xl">♙</span>
            <span className="text-xs">Account</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}