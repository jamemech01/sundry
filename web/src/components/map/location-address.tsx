"use client";

import { useEffect, useState } from "react";

type AddressLookup =
  | { key: string; status: "success"; address: string }
  | { key: string; status: "error"; message: string };

type LocationAddressProps = {
  lat: number;
  lng: number;
  className?: string;
};

export default function LocationAddress({
  lat,
  lng,
  className = "",
}: LocationAddressProps) {
  const key = `${lat}:${lng}`;
  const [lookup, setLookup] = useState<AddressLookup | null>(null);
  const currentLookup = lookup?.key === key ? lookup : null;

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const query = new URLSearchParams({
            format: "jsonv2",
            lat: String(lat),
            lon: String(lng),
            zoom: "18",
            addressdetails: "1",
          });
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${query}`,
            {
              headers: { Accept: "application/json" },
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            throw new Error("Unable to find an address for this location.");
          }

          const data: unknown = await response.json();
          const address =
            typeof data === "object" &&
            data !== null &&
            "display_name" in data &&
            typeof data.display_name === "string"
              ? data.display_name
              : "";
          if (!address) {
            throw new Error("No address found for this location.");
          }

          setLookup({ key, status: "success", address });
        } catch (error) {
          if (controller.signal.aborted) return;

          setLookup({
            key,
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to find an address for this location.",
          });
        }
      })();
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [key, lat, lng]);

  return (
    <div
      className={`rounded-xl bg-gray-50 px-3.5 py-3 ${className}`.trim()}
      aria-live="polite"
    >
      {currentLookup?.status === "success" ? (
        <p className="text-sm leading-5 text-gray-800">
          {currentLookup.address}
        </p>
      ) : currentLookup?.status === "error" ? (
        <p role="status" className="text-sm leading-5 text-red-600">
          {currentLookup.message}
        </p>
      ) : (
        <p className="text-sm leading-5 text-gray-500">Finding address...</p>
      )}
      <p className="mt-1 text-[11px] text-gray-400">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
