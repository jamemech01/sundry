import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OrderStatus } from "../prisma/generated/client";
import { LoginDto } from "./auth/login.dto";
import { RegisterDto } from "./auth/register.dto";
import {
  CreateOrderDto,
  CreateOrderItemDto,
  DeliveryLocationDto,
} from "./order/create-order.dto";
import { PreviewDeliveryFeeDto } from "./order/preview-delivery-fee.dto";
import { UpdateOrderStatusDto } from "./order/update-order-status.dto";
import { CreateProductDto } from "./product/create-product.dto";
import { UpdateProductDto } from "./product/update-product.dto";
import { CreateShopDto } from "./shop/create-shop.dto";
import { UpdateShopDto } from "./shop/update-shop.dto";
import { WalletAmountDto } from "./wallet/amount.dto";

async function validationErrors<T extends object>(
  dto: new () => T,
  value: object,
) {
  return validate(plainToInstance(dto, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe("API request DTOs", () => {
  it("validates register and login credentials", async () => {
    await expect(
      validationErrors(RegisterDto, {
        username: "test_user",
        password: "password123",
        confirmPassword: "password123",
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(RegisterDto, {
        username: "bad name",
        password: "short",
        confirmPassword: "short",
      }),
    ).resolves.not.toHaveLength(0);

    await expect(
      validationErrors(LoginDto, {
        username: "test_user",
        password: "password123",
      }),
    ).resolves.toHaveLength(0);
  });

  it("validates shop creation coordinates and non-blank names", async () => {
    await expect(
      validationErrors(CreateShopDto, {
        name: "Corner Shop",
        lat: 90,
        lng: -180,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(CreateShopDto, {
        name: "   ",
        lat: 90.01,
        lng: 181,
      }),
    ).resolves.not.toHaveLength(0);
  });

  it("allows partial shop updates but rejects invalid supplied fields", async () => {
    await expect(validationErrors(UpdateShopDto, {})).resolves.toHaveLength(0);
    await expect(
      validationErrors(UpdateShopDto, { name: "Updated Shop", lat: 13.7 }),
    ).resolves.toHaveLength(0);
    await expect(
      validationErrors(UpdateShopDto, { name: "  " }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validationErrors(UpdateShopDto, { lng: 181 }),
    ).resolves.not.toHaveLength(0);
  });

  it("validates product creation fields and optional defaults", async () => {
    await expect(
      validationErrors(CreateProductDto, {
        shopId: 1,
        name: "Coffee",
        price: 99.99,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(CreateProductDto, {
        shopId: 1,
        name: "  ",
        category: " ",
        price: 100000000,
        stock: -1,
      }),
    ).resolves.not.toHaveLength(0);
  });

  it("allows product field updates and clearing the product image", async () => {
    await expect(
      validationErrors(UpdateProductDto, {
        price: 12.5,
        imageData: null,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(UpdateProductDto, {
        name: "  ",
      }),
    ).resolves.not.toHaveLength(0);

    await expect(
      validationErrors(UpdateProductDto, {
        imageData: "https://example.com/image.png",
      }),
    ).resolves.not.toHaveLength(0);
  });

  it("validates order items, nested products, and delivery coordinates", async () => {
    await expect(
      validationErrors(CreateOrderItemDto, {
        productId: 1,
        quantity: 999999999,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(CreateOrderDto, {
        shopId: 1,
        items: [{ productId: 2, quantity: 1 }],
        deliveryLat: -90,
        deliveryLng: 180,
      }),
    ).resolves.toHaveLength(0);

    const invalidOrder = await validationErrors(CreateOrderDto, {
      shopId: 1,
      items: [{ productId: 2, quantity: 0 }],
      deliveryLat: 91,
      deliveryLng: 180,
    });
    expect(invalidOrder.length).toBeGreaterThan(0);
    expect(
      invalidOrder.find((error) => error.property === "items")?.children
        ?.length ?? 0,
    ).toBeGreaterThan(0);
  });

  it("shares coordinate validation with delivery-fee preview requests", async () => {
    await expect(
      validationErrors(DeliveryLocationDto, {
        deliveryLat: 13.7,
        deliveryLng: 100.5,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(PreviewDeliveryFeeDto, {
        shopId: 1,
        deliveryLat: 13.7,
        deliveryLng: 100.5,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(PreviewDeliveryFeeDto, {
        shopId: 1,
        deliveryLat: 91,
        deliveryLng: 100.5,
      }),
    ).resolves.not.toHaveLength(0);
  });

  it("accepts only defined order status values", async () => {
    await expect(
      validationErrors(UpdateOrderStatusDto, {
        status: OrderStatus.delivered,
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validationErrors(UpdateOrderStatusDto, { status: "unknown" }),
    ).resolves.not.toHaveLength(0);
  });

  it("uses the same bounded amount contract for top-up and withdrawal", async () => {
    await expect(
      validationErrors(WalletAmountDto, { amount: 0.01 }),
    ).resolves.toHaveLength(0);
    await expect(
      validationErrors(WalletAmountDto, { amount: 1000000 }),
    ).resolves.toHaveLength(0);

    for (const amount of [0, -1, 1000000.01, 1.001, "10"]) {
      await expect(
        validationErrors(WalletAmountDto, { amount }),
      ).resolves.not.toHaveLength(0);
    }
  });

  it("rejects request properties not declared in the DTO", async () => {
    const errors = await validationErrors(CreateOrderDto, {
      shopId: 1,
      items: [{ productId: 2, quantity: 1 }],
      deliveryLat: 13.7,
      deliveryLng: 100.5,
      buyerId: 999,
    });

    expect(errors.map((error) => error.property)).toContain("buyerId");
  });
});
