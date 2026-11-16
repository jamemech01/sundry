export const CART_STORAGE_KEY = "sundry-checkout-cart";

type CartLocation = {
    shopId: number;
    deliveryLat?: number;
    deliveryLng?: number;
};

export function saveCart<T extends CartLocation>(
    saved: T,
    readSavedCart: (shopId: number) => T | null,
) {
    try {
        const existing = readSavedCart(saved.shopId);
        sessionStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify({
                ...existing,
                ...saved,
                deliveryLat: saved.deliveryLat ?? existing?.deliveryLat,
                deliveryLng: saved.deliveryLng ?? existing?.deliveryLng,
            }),
        );
    } catch {
        // Cart persistence is optional when browser storage is unavailable.
    }
}
