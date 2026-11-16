"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

import { createDeliveryMarker, createShopIcon } from "./map-markers";
import { REGIONAL_MAP_ZOOM, SHOP_LOCATION_ZOOM } from "./map-constants";

export type MapShop = {
  id: number;
  userId?: number;
  name: string;
  lat: number;
  lng: number;
  products?: {
    id: number;
    name: string;
    category: string;
    price: number | string;
    stock: number;
  }[];
};

type MapProps = {
  shops: MapShop[];
  currentUserId?: number | null;
  mode?: "shops" | "delivery" | "create-shop";
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  onSelectDeliveryLocation?: (lat: number, lng: number) => void;
  shopLat?: number | null;
  shopLng?: number | null;
  onSelectShopLocation?: (lat: number, lng: number) => void;
};

type SavedView = {
  lat: number;
  lng: number;
  zoom: number;
};

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];
const HOME_ZOOM = 11;
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const MAP_VIEW_STORAGE_KEY = "sundry-explore-map-view";
const MAP_LOAD_ID_STORAGE_KEY = "sundry-explore-map-load-id";

function readSavedView(): SavedView | null {
  try {
    const saved = sessionStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!saved) return null;

    const view: unknown = JSON.parse(saved);

    if (
      typeof view === "object" &&
      view !== null &&
      "lat" in view &&
      "lng" in view &&
      "zoom" in view &&
      typeof view.lat === "number" &&
      typeof view.lng === "number" &&
      typeof view.zoom === "number" &&
      Number.isFinite(view.lat) &&
      Number.isFinite(view.lng) &&
      Number.isFinite(view.zoom)
    ) {
      return {
        lat: view.lat,
        lng: view.lng,
        zoom: view.zoom,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export default function Map({
  shops,
  currentUserId = null,
  mode = "shops",
  deliveryLat = null,
  deliveryLng = null,
  onSelectDeliveryLocation,
  shopLat = null,
  shopLng = null,
  onSelectShopLocation,
}: MapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const hasMovedToShopLocation = useRef(false);

  const savedView = mode === "shops" ? readSavedView() : null;
  const deliveryShop = mode === "delivery" ? shops[0] : undefined;

  const center: [number, number] = savedView
    ? [savedView.lng, savedView.lat]
    : mode === "delivery" && deliveryShop
      ? [deliveryShop.lng, deliveryShop.lat]
      : mode === "delivery" && deliveryLat !== null && deliveryLng !== null
        ? [deliveryLng, deliveryLat]
        : mode === "create-shop" && shopLat !== null && shopLng !== null
          ? [shopLng, shopLat]
          : BANGKOK_CENTER;

  const initialZoom =
    mode === "delivery" ? REGIONAL_MAP_ZOOM : (savedView?.zoom ?? HOME_ZOOM);

  const initialMapViewRef = useRef({
    center,
    zoom: initialZoom,
  });

  const deliveryShopId = deliveryShop?.id;
  const deliveryShopLat = deliveryShop?.lat;
  const deliveryShopLng = deliveryShop?.lng;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const loadId = String(performance.timeOrigin);
      const previousLoadId = sessionStorage.getItem(MAP_LOAD_ID_STORAGE_KEY);

      if (previousLoadId !== loadId) {
        const navigation = performance.getEntriesByType("navigation")[0] as
          PerformanceNavigationTiming | undefined;

        if (navigation?.type === "reload") {
          sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY);
        }

        sessionStorage.setItem(MAP_LOAD_ID_STORAGE_KEY, loadId);
      }
    } catch {
      // Ignore storage errors.
    }

    const map = new MapLibreMap({
      container,
      style: MAP_STYLE,
      center: initialMapViewRef.current.center,
      zoom: initialMapViewRef.current.zoom,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("error", (event) => {
      console.error("MapLibre error:", event.error);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (mode === "shops" || mode === "delivery") {
      shops.forEach((shop) => {
        if (!Number.isFinite(shop.lat) || !Number.isFinite(shop.lng)) {
          return;
        }

        const isOwner = currentUserId !== null && shop.userId === currentUserId;
        const element = createShopIcon(shop.name, isOwner);

        element.addEventListener("click", () => {
          router.push(`/shops/${shop.id}`);
        });

        const marker = new Marker({
          element,
          anchor: "bottom",
        })
          .setLngLat([shop.lng, shop.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    if (
      mode === "delivery" &&
      deliveryLat !== null &&
      deliveryLng !== null &&
      Number.isFinite(deliveryLat) &&
      Number.isFinite(deliveryLng)
    ) {
      const marker = new Marker({
        element: createDeliveryMarker(),
        anchor: "bottom",
      })
        .setLngLat([deliveryLng, deliveryLat])
        .addTo(map);

      markersRef.current.push(marker);
    }

    if (
      mode === "create-shop" &&
      shopLat !== null &&
      shopLng !== null &&
      Number.isFinite(shopLat) &&
      Number.isFinite(shopLng)
    ) {
      const marker = new Marker({
        element: createDeliveryMarker(),
        anchor: "bottom",
      })
        .setLngLat([shopLng, shopLat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [
    shops,
    currentUserId,
    mode,
    deliveryLat,
    deliveryLng,
    shopLat,
    shopLng,
    router,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (event: MapMouseEvent) => {
      const { lat, lng } = event.lngLat;

      if (mode === "delivery" && onSelectDeliveryLocation) {
        onSelectDeliveryLocation(lat, lng);
      }

      if (mode === "create-shop" && onSelectShopLocation) {
        onSelectShopLocation(lat, lng);
      }
    };

    if (
      (mode === "delivery" && onSelectDeliveryLocation) ||
      (mode === "create-shop" && onSelectShopLocation)
    ) {
      map.on("click", handleClick);
    }

    return () => {
      map.off("click", handleClick);
    };
  }, [mode, onSelectDeliveryLocation, onSelectShopLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "shops") return;

    const saveView = () => {
      try {
        const center = map.getCenter();

        sessionStorage.setItem(
          MAP_VIEW_STORAGE_KEY,
          JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: map.getZoom(),
          }),
        );
      } catch {
        // Ignore storage errors.
      }
    };

    map.on("moveend", saveView);

    return () => {
      map.off("moveend", saveView);
    };
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "shops") return;

    const handleLocate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
        zoom?: number;
      }>;

      const detail = customEvent.detail;
      if (!detail) return;

      const { lat, lng, zoom = HOME_ZOOM } = detail;

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !Number.isFinite(zoom)
      ) {
        return;
      }

      map.flyTo({
        center: [lng, lat],
        zoom,
      });
    };

    window.addEventListener("map:locate", handleLocate);

    return () => {
      window.removeEventListener("map:locate", handleLocate);
    };
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      mode !== "delivery" ||
      deliveryShopLat === undefined ||
      deliveryShopLng === undefined
    ) {
      return;
    }

    if (
      !Number.isFinite(deliveryShopLat) ||
      !Number.isFinite(deliveryShopLng)
    ) {
      return;
    }

    map.jumpTo({
      center: [deliveryShopLng, deliveryShopLat],
      zoom: REGIONAL_MAP_ZOOM,
    });
  }, [mode, deliveryShopId, deliveryShopLat, deliveryShopLng]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || mode !== "create-shop") {
      hasMovedToShopLocation.current = false;
      return;
    }

    if (
      shopLat === null ||
      shopLng === null ||
      !Number.isFinite(shopLat) ||
      !Number.isFinite(shopLng) ||
      hasMovedToShopLocation.current
    ) {
      return;
    }

    hasMovedToShopLocation.current = true;

    map.jumpTo({
      center: [shopLng, shopLat],
      zoom: Math.max(map.getZoom(), SHOP_LOCATION_ZOOM),
    });
  }, [mode, shopLat, shopLng]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      aria-label="Interactive map"
    />
  );
}
