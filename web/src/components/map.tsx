"use client";

import { useEffect } from "react";
import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapShop = {
    id: number;
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
    selectedShopId: number | null;
    onSelectShop: (shop: MapShop) => void;
    mode?: "shops" | "delivery";
    deliveryLat?: number | null;
    deliveryLng?: number | null;
    onSelectDeliveryLocation?: (lat: number, lng: number) => void;
};

const shopIcon = L.divIcon({
    className: "",
    html: `
    <div style="
      width: 30px;
      height: 30px;
      background: #2563eb;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px #0004;
    "></div>
  `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

const deliveryIcon = L.divIcon({
    className: "",
    html: `
    <div style="
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #16a34a;
      color: white;
      border: 3px solid white;
      border-radius: 50%;
      font-size: 19px;
      font-weight: bold;
      box-shadow: 0 2px 6px #0004;
    ">✓</div>
  `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
});

function FitShops({ shops }: { shops: MapShop[] }) {
    const map = useMap();

    useEffect(() => {
        const validShops = shops.filter(
            (shop) =>
                Number.isFinite(shop.lat) &&
                Number.isFinite(shop.lng),
        );

        if (validShops.length === 0) return;

        if (validShops.length === 1) {
            map.setView(
                [validShops[0].lat, validShops[0].lng],
                14,
            );
            return;
        }

        const bounds = L.latLngBounds(
            validShops.map((shop) =>
                L.latLng(shop.lat, shop.lng),
            ),
        );

        map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 14,
        });
    }, [map, shops]);

    return null;
}

function SelectedShopLocation({
    shop,
}: {
    shop: MapShop | undefined;
}) {
    const map = useMap();

    useEffect(() => {
        if (!shop) return;

        map.flyTo(
            [shop.lat, shop.lng],
            Math.max(map.getZoom(), 14),
        );
    }, [map, shop]);

    return null;
}

function LocateMeHandler() {
    const map = useMap();

    useEffect(() => {
        function handleLocate(event: Event) {
            const customEvent = event as CustomEvent<{
                lat: number;
                lng: number;
            }>;

            const { lat, lng } = customEvent.detail;

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            map.flyTo([lat, lng], 15);
        }

        window.addEventListener("sundry:locate", handleLocate);

        return () => {
            window.removeEventListener("sundry:locate", handleLocate);
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

function MoveToDeliveryLocation({
    lat,
    lng,
}: {
    lat: number | null;
    lng: number | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (lat === null || lng === null) return;

        map.flyTo(
            [lat, lng],
            Math.max(map.getZoom(), 15),
        );
    }, [map, lat, lng]);

    return null;
}

export default function Map({
    shops,
    selectedShopId,
    onSelectShop,
    mode = "shops",
    deliveryLat = null,
    deliveryLng = null,
    onSelectDeliveryLocation,
}: MapProps) {
    const selectedShop = shops.find(
        (shop) => shop.id === selectedShopId,
    );

    const center: [number, number] =
        mode === "delivery" &&
            deliveryLat !== null &&
            deliveryLng !== null
            ? [deliveryLat, deliveryLng]
            : [13.7563, 100.5018];

    return (
        <MapContainer
            center={center}
            zoom={12}
            className="h-full w-full"
            scrollWheelZoom
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {mode === "shops" && (
                <>
                    <FitShops shops={shops} />
                    <SelectedShopLocation shop={selectedShop} />
                    <LocateMeHandler />

                    {shops.map((shop) => {
                        if (
                            !Number.isFinite(shop.lat) ||
                            !Number.isFinite(shop.lng)
                        ) {
                            return null;
                        }

                        return (
                            <Marker
                                key={shop.id}
                                position={[shop.lat, shop.lng]}
                                icon={shopIcon}
                                eventHandlers={{
                                    click: () => onSelectShop(shop),
                                }}
                            />
                        );
                    })}
                </>
            )}

            {mode === "delivery" && onSelectDeliveryLocation && (
                <>
                    <DeliveryMapEvents
                        onSelect={onSelectDeliveryLocation}
                    />

                    <MoveToDeliveryLocation
                        lat={deliveryLat}
                        lng={deliveryLng}
                    />

                    {deliveryLat !== null && deliveryLng !== null && (
                        <Marker
                            position={[deliveryLat, deliveryLng]}
                            icon={deliveryIcon}
                        />
                    )}
                </>
            )}
        </MapContainer>
    );
}