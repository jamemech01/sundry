type ShopOwner = {
    id: number;
    userId: number;
};

type OrderNotification = {
    status?: string | null;
    buyerId?: number;
    shopId?: number | null;
};

export function countActionableOrders(
    orders: unknown,
    shops: ShopOwner[],
    userId: number | null,
) {
    if (!Array.isArray(orders) || userId === null) return 0;

    return orders.reduce((count: number, value: unknown) => {
        if (typeof value !== "object" || value === null) return count;

        const order = value as OrderNotification;
        const status = String(order.status ?? "").trim().toLowerCase();
        const isBuyer = order.buyerId === userId;
        const isSeller = shops.some(
            (shop) => shop.id === order.shopId && shop.userId === userId,
        );
        const needsSellerAction =
            isSeller && (status === "pending" || status === "accepted");
        const needsBuyerAction = isBuyer && status === "delivered";

        return count + Number(needsSellerAction || needsBuyerAction);
    }, 0);
}
