"use client";

import {
	createAxiosCommerceRequest,
	createCommerceClient,
	getCommerceRequest,
	type CommerceAxiosLike,
	type CommerceCart,
} from "@init/commerce";
import {
	commerceCartResourceKey,
	commerceCartStoreDefinition,
	useCommerceCartStore,
} from "@init/commerce/client";
import { NextDataFlowProvider } from "@init/next-data-flow/client";
import { createPhotonClientModule } from "@init/photon-nextjs/client";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";

export const commercePhotonDataStores = [
	commerceCartStoreDefinition,
] as const;

export const createCommercePhotonClient = (api: CommerceAxiosLike) =>
	createCommerceClient(createAxiosCommerceRequest(api));

const CommercePhotonClientContext = createContext<ReturnType<
	typeof createCommercePhotonClient
> | null>(null);

const resolveCommercePhotonClient = (api?: CommerceAxiosLike) =>
	api ? createCommercePhotonClient(api) : createCommerceClient(getCommerceRequest());

const resolveCommercePhotonApi = (services: Record<string, unknown>) => {
	const api = services.http as CommerceAxiosLike | undefined;

	if (!api) {
		throw new Error(
			'Commerce Photon client module requires an injected "http" service.',
		);
	}

	return api;
};

export const useCommercePhotonClient = () => {
	const client = useContext(CommercePhotonClientContext);

	if (!client) {
		throw new Error(
			"Commerce Photon client is not available. Wrap commerce pages with CommercePhotonDataFlowProvider.",
		);
	}

	return client;
};

export const createCommercePhotonCartSnapshot = (
	resources: Record<string, unknown>,
) => ({
	[commerceCartResourceKey.id]:
		resources[commerceCartResourceKey.id] ??
		resources.commerceCartSummary ??
		null,
});

export const withCommercePhotonRuntimeResources = <
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

export const broadcastCommercePhotonCart = (cart: CommerceCart | null) => {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent("commerce-cart-updated", {
			detail: cart,
		}),
	);
};

export const syncCommercePhotonCart = async (api: CommerceAxiosLike) => {
	const commerceClient = createCommercePhotonClient(api);
	const response = await commerceClient.syncCurrentCart();
	const cart = response.data ?? null;
	broadcastCommercePhotonCart(cart);

	return cart;
};

export const CommercePhotonCartEventBridge = () => {
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
		broadcastCommercePhotonCart(cart ?? null);
		broadcastingRef.current = false;
	}, [cart]);

	return null;
};

export const useCommercePhotonCartSnapshot = (
	resources: Record<string, unknown>,
) => useMemo(() => createCommercePhotonCartSnapshot(resources), [resources]);

export const CommercePhotonDataFlowProvider = ({
	api,
	children,
	resources,
}: {
	api?: CommerceAxiosLike;
	children: ReactNode;
	resources: Record<string, unknown>;
}) => {
	const snapshot = useCommercePhotonCartSnapshot(resources);
	const client = useMemo(() => resolveCommercePhotonClient(api), [api]);

	return (
		<CommercePhotonClientContext.Provider value={client}>
			<NextDataFlowProvider
				snapshot={snapshot}
				stores={commercePhotonDataStores}
			>
				<CommercePhotonCartEventBridge />
				{children}
			</NextDataFlowProvider>
		</CommercePhotonClientContext.Provider>
	);
};

export const createCommercePhotonClientModule = () =>
	createPhotonClientModule({
		name: "commerce-photon",
		adminPageDecorators: [withCommercePhotonRuntimeResources],
		publicPageDecorators: [withCommercePhotonRuntimeResources],
		adminPageWrappers: [
			({ children, page, services }) => (
				<CommercePhotonDataFlowProvider
					api={resolveCommercePhotonApi(services)}
					resources={page.resources}
				>
					{children}
				</CommercePhotonDataFlowProvider>
			),
		],
		publicPageWrappers: [
			({ children, page, services }) => (
				<CommercePhotonDataFlowProvider
					api={resolveCommercePhotonApi(services)}
					resources={page.resources}
				>
					{children}
				</CommercePhotonDataFlowProvider>
			),
		],
		adminAuthSuccessHandlers: [
			async ({ services }) => {
				try {
					await syncCommercePhotonCart(resolveCommercePhotonApi(services));
				} catch {
					// Auth should not fail just because the optional cart sync failed.
				}
			},
		],
		publicAuthSuccessHandlers: [
			async ({ services }) => {
				try {
					await syncCommercePhotonCart(resolveCommercePhotonApi(services));
				} catch {
					// Auth should not fail just because the optional cart sync failed.
				}
			},
		],
	});
