"use client";

import {
	createAxiosCommerceRequest,
	createCommerceClient,
	type CommerceAxiosLike,
	type CommerceCart,
} from "@init-modules/commerce";
import {
	commerceCartResourceKey,
	commerceCartStoreDefinition,
	useCommerceCartStore,
} from "@init-modules/commerce/client";
import { useEffect, useMemo, useRef } from "react";

export const commerceWebsiteBuilderDataStores = [
	commerceCartStoreDefinition,
] as const;

export const createCommerceWebsiteBuilderClient = (
	api: CommerceAxiosLike,
) => createCommerceClient(createAxiosCommerceRequest(api));

export const createCommerceWebsiteBuilderCartSnapshot = (
	resources: Record<string, unknown>,
) => ({
	[commerceCartResourceKey.id]:
		resources[commerceCartResourceKey.id] ??
		resources.commerceCartSummary ??
		null,
});

export const withCommerceWebsiteBuilderRuntimeResources = <
	TPage extends {
		resources: Record<string, unknown>;
	},
>(
	page: TPage,
	options: {
		path: string;
		search: string | URLSearchParams;
	},
): TPage => {
	const searchParams =
		typeof options.search === "string"
			? new URLSearchParams(options.search)
			: options.search;
	const checkoutStep = searchParams.get("checkoutStep");

	return {
		...page,
		resources: {
			...page.resources,
			...(options.path === "/checkout" || checkoutStep
				? {
						commerceCheckout: {
							...((page.resources.commerceCheckout as Record<
								string,
								unknown
							>) ?? {}),
							requestedStep: checkoutStep,
						},
					}
				: {}),
		},
	};
};

export const broadcastCommerceWebsiteBuilderCart = (
	cart: CommerceCart | null,
) => {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent("commerce-cart-updated", {
			detail: cart,
		}),
	);
};

export const syncCommerceWebsiteBuilderCart = async (
	api: CommerceAxiosLike,
) => {
	const commerceClient = createCommerceWebsiteBuilderClient(api);
	const response = await commerceClient.syncCurrentCart();
	const cart = response.data ?? null;
	broadcastCommerceWebsiteBuilderCart(cart);

	return cart;
};

export const CommerceWebsiteBuilderCartEventBridge = () => {
	const cart = useCommerceCartStore((state) => state.cart);
	const setCart = useCommerceCartStore((state) => state.setCart);
	const didBroadcastRef = useRef(false);
	const broadcastingRef = useRef(false);

	useEffect(() => {
		const handleCartUpdated = (event: Event) => {
			if (broadcastingRef.current) {
				return;
			}

			const nextCart = (event as CustomEvent).detail;

			if (nextCart === null || (nextCart && typeof nextCart === "object")) {
				setCart(nextCart);
			}
		};

		window.addEventListener("commerce-cart-updated", handleCartUpdated);

		return () => {
			window.removeEventListener("commerce-cart-updated", handleCartUpdated);
		};
	}, [setCart]);

	useEffect(() => {
		if (!didBroadcastRef.current) {
			didBroadcastRef.current = true;
			return;
		}

		broadcastingRef.current = true;
		broadcastCommerceWebsiteBuilderCart(cart ?? null);
		broadcastingRef.current = false;
	}, [cart]);

	return null;
};

export const useCommerceWebsiteBuilderCartSnapshot = (
	resources: Record<string, unknown>,
) =>
	useMemo(
		() => createCommerceWebsiteBuilderCartSnapshot(resources),
		[resources],
	);
