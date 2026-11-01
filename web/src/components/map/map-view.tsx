"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    MapContainer,
    Marker,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const BANGKOK_CENTER: [number, number] = [13.7563, 100.5018];
const HOME_ZOOM = 11;
const SHOP_ZOOM = 15;
const MAP_VIEW_STORAGE_KEY = "sundry-explore-map-view";
const MAP_LOAD_ID_STORAGE_KEY = "sundry-explore-map-load-id";

const SHOP_MARKER_WIDTH = 176;
const SHOP_MARKER_BODY_HEIGHT = 44;
const SHOP_MARKER_AWNING_HEIGHT = 5;
const SHOP_MARKER_STEM_HEIGHT = 8;
const SHOP_MARKER_DOT_SIZE = 10;
const SHOP_MARKER_HEIGHT =
    SHOP_MARKER_BODY_HEIGHT +
    SHOP_MARKER_STEM_HEIGHT +
    SHOP_MARKER_DOT_SIZE;

const SHOP_MARKER_OWNER = {
    border: "#DDD6FE",
    background: "#F5F3FF",
    text: "#5B21B6",
    accent: "#8B5CF6",
};

const SHOP_MARKER_OTHER = {
    border: "#BFDBFE",
    background: "#EFF6FF",
    text: "#1D4ED8",
    accent: "#3B82F6",
};

if (typeof window !== "undefined") {
    try {
        const loadId = String(performance.timeOrigin);
        const previousLoadId = sessionStorage.getItem(MAP_LOAD_ID_STORAGE_KEY);

        if (previousLoadId !== loadId) {
            const navigation = performance.getEntriesByType(
                "navigation",
            )[0] as PerformanceNavigationTiming | undefined;

            if (navigation?.type === "reload") {
                sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY);
                sessionStorage.removeItem("sundry-checkout-cart");
            }

            sessionStorage.setItem(MAP_LOAD_ID_STORAGE_KEY, loadId);
        }
    } catch {
        // Ignore storage errors.
    }
}

function readSavedView(): SavedView | null {
    if (typeof window === "undefined") return null;

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
            return { lat: view.lat, lng: view.lng, zoom: view.zoom };
        }
    } catch {
        // Ignore parse/storage errors.
    }

    return null;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[char];
    });
}

function createShopIcon(name: string, isOwner: boolean) {
    const color = isOwner ? SHOP_MARKER_OWNER : SHOP_MARKER_OTHER;

    const html = `
        <div style="
            position:relative;
            width:${SHOP_MARKER_WIDTH}px;
            height:${SHOP_MARKER_HEIGHT}px;
            box-sizing:border-box;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        ">
            <div style="
                position:absolute;
                top:0;
                left:0;
                display:flex;
                flex-direction:column;
                width:${SHOP_MARKER_WIDTH}px;
                height:${SHOP_MARKER_BODY_HEIGHT}px;
                box-sizing:border-box;
                overflow:hidden;
                background:${color.background};
                border:1px solid ${color.border};
                border-radius:12px;
                box-shadow:0 2px 8px rgba(15,23,42,.10);
            ">
                <div style="
                    flex:none;
                    height:${SHOP_MARKER_AWNING_HEIGHT}px;
                    background:${color.accent};
                "></div>

                <div style="
                    display:flex;
                    flex:1;
                    min-height:0;
                    align-items:center;
                    gap:10px;
                    padding:0 12px;
                ">
                    <span style="
                        display:flex;
                        flex:none;
                        align-items:center;
                        justify-content:center;
                        width:18px;
                        height:18px;
                        color:${color.text};
                    ">
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 10l2-6h14l2 6"/>
                            <path d="M4 10v10h16V10"/>
                            <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>
                            <path d="M9 20v-5h6v5"/>
                        </svg>
                    </span>

                    <span style="
                        display:block;
                        flex:1;
                        min-width:0;
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                        color:${color.text};
                        font-size:12px;
                        font-weight:600;
                        line-height:1.25;
                    ">${escapeHtml(name)}</span>
                </div>
            </div>

            <div style="
                position:absolute;
                left:${SHOP_MARKER_WIDTH / 2 - 1}px;
                top:${SHOP_MARKER_BODY_HEIGHT}px;
                width:2px;
                height:${SHOP_MARKER_STEM_HEIGHT}px;
                background:${color.accent};
            "></div>

            <div style="
                position:absolute;
                left:${SHOP_MARKER_WIDTH / 2 - SHOP_MARKER_DOT_SIZE / 2}px;
                top:${SHOP_MARKER_BODY_HEIGHT + SHOP_MARKER_STEM_HEIGHT}px;
                width:${SHOP_MARKER_DOT_SIZE}px;
                height:${SHOP_MARKER_DOT_SIZE}px;
                box-sizing:border-box;
                background:${color.accent};
                border:2px solid white;
                border-radius:50%;
                box-shadow:0 1px 3px rgba(15,23,42,.25);
            "></div>
        </div>
    `;

    return L.divIcon({
        className: "shop-marker",
        html,
        iconSize: [SHOP_MARKER_WIDTH, SHOP_MARKER_HEIGHT],
        iconAnchor: [
            SHOP_MARKER_WIDTH / 2,
            SHOP_MARKER_HEIGHT - SHOP_MARKER_DOT_SIZE / 2,
        ],
    });
}

const deliveryIcon = L.divIcon({
    className: "location-marker",
    html: `
        <div style="
            display:flex;
            align-items:center;
            justify-content:center;
            width:38px;
            height:38px;
            box-sizing:border-box;
            background:#7C3AED;
            border:3px solid white;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 3px 10px rgba(15,23,42,.25);
        ">
            <div style="
                width:10px;
                height:10px;
                border:2px solid white;
                border-radius:50%;
                background:#7C3AED;
            "></div>
        </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
});

const createShopPinIcon = L.divIcon({
    className: "location-marker",
    html: `
        <div style="
            position:relative;
            display:flex;
            align-items:center;
            justify-content:center;
            width:38px;
            height:38px;
            box-sizing:border-box;
            background:#2563EB;
            color:white;
            border:3px solid white;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 3px 10px rgba(15,23,42,.22);
        ">
            <svg style="transform:rotate(45deg)" width="19" height="19"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14"/>
            </svg>
        </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
});

function BaseTileLayer() {
    const map = useMap();

    useEffect(() => {
        if (!map.getPane("tilePane")) return;

        const layer = L.tileLayer(
            "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
            {
                attribution:
                    "&copy; OpenStreetMap contributors &copy; Stadia Maps",
            },
        );

        try {
            layer.addTo(map);
        } catch (error) {
            console.error("Unable to add map tile layer:", error);
            return;
        }

        return () => {
            try {
                if (map.hasLayer(layer)) map.removeLayer(layer);
            } catch (error) {
                console.error("Unable to remove map tile layer:", error);
            }
        };
    }, [map]);

    return null;
}

function RememberMapView() {
    const map = useMap();

    useEffect(() => {
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
    }, [map]);

    return null;
}

function LocateMeHandler() {
    const map = useMap();

    useEffect(() => {
        function handleLocate(event: Event) {
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

            map.flyTo([lat, lng], zoom);
        }

        window.addEventListener("map:locate", handleLocate);

        return () => {
            window.removeEventListener("map:locate", handleLocate);
        };
    }, [map]);

    return null;
}

function DeliveryMapEvents({
    onSelect,
}: {
    onSelect: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(event) {
            onSelect(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

function CreateShopMapEvents({
    onSelect,
}: {
    onSelect: (lat: number, lng: number) => void;
}) {
    useMapEvents({
        click(event) {
            onSelect(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

function MoveToDeliveryShop({ shop }: { shop: MapShop }) {
    const map = useMap();

    useEffect(() => {
        if (
            !Number.isFinite(shop.lat) ||
            !Number.isFinite(shop.lng)
        ) {
            return;
        }

        map.setView([shop.lat, shop.lng], SHOP_ZOOM, {
            animate: false,
        });
    }, [map, shop.id, shop.lat, shop.lng]);

    return null;
}

function MoveToLocation({
    lat,
    lng,
}: {
    lat: number | null;
    lng: number | null;
}) {
    const map = useMap();
    const hasMoved = useRef(false);

    useEffect(() => {
        if (lat === null || lng === null) return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (hasMoved.current) return;

        hasMoved.current = true;
        map.setView([lat, lng], Math.max(map.getZoom(), SHOP_ZOOM), {
            animate: false,
        });
    }, [map, lat, lng]);

    return null;
}

function ShopMarkers({
    shops,
    currentUserId,
}: {
    shops: MapShop[];
    currentUserId: number | null;
}) {
    const router = useRouter();

    return (
        <>
            {shops.map((shop) => {
                if (
                    !Number.isFinite(shop.lat) ||
                    !Number.isFinite(shop.lng)
                ) {
                    return null;
                }

                const isOwner =
                    currentUserId !== null &&
                    shop.userId === currentUserId;

                return (
                    <Marker
                        key={shop.id}
                        position={[shop.lat, shop.lng]}
                        icon={createShopIcon(shop.name, isOwner)}
                        eventHandlers={{
                            click: () => {
                                router.push(`/shops/${shop.id}`);
                            },
                        }}
                    />
                );
            })}
        </>
    );
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
    const savedView = mode === "shops" ? readSavedView() : null;
    const deliveryShop = mode === "delivery" ? shops[0] : undefined;

    const center: [number, number] = savedView
        ? [savedView.lat, savedView.lng]
        : mode === "delivery" && deliveryShop
            ? [deliveryShop.lat, deliveryShop.lng]
            : mode === "delivery" &&
                deliveryLat !== null &&
                deliveryLng !== null
                ? [deliveryLat, deliveryLng]
                : mode === "create-shop" &&
                    shopLat !== null &&
                    shopLng !== null
                    ? [shopLat, shopLng]
                    : BANGKOK_CENTER;

    const initialZoom =
        mode === "delivery"
            ? SHOP_ZOOM
            : savedView?.zoom ?? HOME_ZOOM;

    return (
        <MapContainer
            center={center}
            zoom={initialZoom}
            className="h-full w-full"
            scrollWheelZoom
            attributionControl={false}
        >
            <BaseTileLayer />

            {mode === "shops" && (
                <>
                    <RememberMapView />
                    <LocateMeHandler />
                </>
            )}

            {(mode === "shops" || mode === "delivery") && (
                <ShopMarkers
                    shops={shops}
                    currentUserId={currentUserId}
                />
            )}

            {mode === "delivery" && deliveryShop && (
                <MoveToDeliveryShop shop={deliveryShop} />
            )}

            {mode === "delivery" && onSelectDeliveryLocation && (
                <>
                    <DeliveryMapEvents onSelect={onSelectDeliveryLocation} />

                    {deliveryLat !== null && deliveryLng !== null && (
                        <Marker
                            position={[deliveryLat, deliveryLng]}
                            icon={deliveryIcon}
                        />
                    )}
                </>
            )}

            {mode === "create-shop" && onSelectShopLocation && (
                <>
                    <CreateShopMapEvents onSelect={onSelectShopLocation} />
                    <MoveToLocation lat={shopLat} lng={shopLng} />

                    {shopLat !== null && shopLng !== null && (
                        <Marker
                            position={[shopLat, shopLng]}
                            icon={createShopPinIcon}
                            interactive={false}
                        />
                    )}
                </>
            )}
        </MapContainer>
    );
}
