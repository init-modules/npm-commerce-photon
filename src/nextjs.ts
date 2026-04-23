import type {
	CommerceCart,
	CommerceCatalogItem,
	CommerceCatalogItemView,
	CommerceOrder,
} from "@init/commerce";
import {
	commerceCartSnapshotKey,
	configureCommerceRequest,
	createAxiosCommerceRequest,
} from "@init/commerce";
import {
	createNextDataSnapshot,
	defineNextDataServerResource,
} from "@init/next-data-flow/server";
import type {
	PhotonBlock,
	PhotonDocument,
	PhotonResources,
	PhotonSearchResult,
} from "@init/photon";
import { cache } from "react";

type CommercePhotonApiClient = {
	request<T = unknown>(config: {
		url: string;
		method?: "DELETE" | "GET" | "PATCH" | "POST";
		params?: Record<string, unknown>;
		data?: unknown;
		headers?: Record<string, string>;
		validateStatus?: () => boolean;
	}): Promise<{ data: T; status: number }>;
};

let commercePhotonApi: CommercePhotonApiClient | null = null;

const getCommercePhotonApi = () => {
	if (!commercePhotonApi) {
		throw new Error("Commerce Photon API client is not configured");
	}

	return commercePhotonApi;
};

const getCommerceApiResponse = <T>(
	url: string,
	config: {
		params?: Record<string, unknown>;
		validateStatus?: () => boolean;
	} = {},
) =>
	getCommercePhotonApi().request<T>({
		url,
		method: "GET",
		...config,
	});

export const configureCommercePhotonServer = (api: CommercePhotonApiClient) => {
	commercePhotonApi = api;
	configureCommerceRequest(createAxiosCommerceRequest(api));
};

type CommerceStorefrontKind = "hybrid" | "products" | "services";

type CommerceResolvedPage = {
	document: PhotonDocument;
	page: {
		route: string;
	};
	resources: PhotonResources;
};

class CommerceCatalogItemNotFoundError extends Error {
	readonly status = 404;

	constructor(readonly slug: string) {
		super(`Commerce catalog item "${slug}" was not found`);
		this.name = "CommerceCatalogItemNotFoundError";
	}
}

const isCommerceCatalogItemNotFoundError = (
	error: unknown,
): error is CommerceCatalogItemNotFoundError =>
	error instanceof CommerceCatalogItemNotFoundError;

const hasCommerceBinding = (document: PhotonDocument) =>
	document.blocks.some(
		(block) =>
			block.module === "commerce-photon" ||
			Object.values(block.bindings ?? {}).some((binding) =>
				binding.source.startsWith("commerce"),
			),
	);

const findCommerceBlocks = (
	blocks: PhotonBlock[],
	predicate: (block: PhotonBlock) => boolean,
): PhotonBlock[] =>
	blocks.flatMap((block) => [
		...(predicate(block) ? [block] : []),
		...(block.areas ?? []).flatMap((area) =>
			findCommerceBlocks(area.blocks, predicate),
		),
	]);

const getCommerceOrderListBlocks = (document: PhotonDocument) =>
	findCommerceBlocks(
		document.blocks,
		(block) =>
			block.module === "commerce-photon" &&
			block.type === "commerce-order-list",
	);

const resolveCommerceOrderListLimit = (document: PhotonDocument) => {
	const rawLimit = getCommerceOrderListBlocks(document)[0]?.props.limit;
	const numericLimit = typeof rawLimit === "number" ? rawLimit : 20;

	if (!Number.isFinite(numericLimit)) {
		return 20;
	}

	return Math.min(50, Math.max(1, Math.floor(numericLimit)));
};

const resolveCommerceStorefrontKind = (
	document: PhotonDocument,
): CommerceStorefrontKind => {
	const source = [
		document.id,
		document.name,
		...document.blocks.flatMap((block) => [
			block.id,
			typeof block.props.title === "string" ? block.props.title : "",
			typeof block.props.emptyTitle === "string" ? block.props.emptyTitle : "",
		]),
	]
		.join(" ")
		.toLowerCase();

	if (
		source.includes("hybrid") ||
		source.includes("offer") ||
		source.includes("offers") ||
		source.includes("предлож")
	) {
		return "hybrid";
	}

	if (
		source.includes("service") ||
		source.includes("services") ||
		source.includes("услуг")
	) {
		return "services";
	}

	return "products";
};

const toCommerceCatalogItemView = (
	item: CommerceCatalogItem,
): CommerceCatalogItemView => ({
	id: item.id,
	type: item.type,
	status: item.status,
	sku: item.sku,
	name: item.name,
	slug: item.slug,
	description: item.description,
	publicPriceAmount: item.public_price_amount,
	currency: item.currency,
	inventoryMode: item.inventory_mode,
	serviceDurationMinutes: item.service_duration_minutes,
	tracked: item.tracked,
	href: `/catalog/${item.slug}`,
	catalogHref: item.type === "service" ? "/services" : "/products",
	coverImage: null,
});

const listCommerceCatalogItems = cache(async (search?: string) => {
	const response = await getCommerceApiResponse<{
		data: CommerceCatalogItem[];
	}>("/commerce/catalog/items", {
		params: {
			search: search?.trim() || undefined,
		},
		validateStatus: () => true,
	});

	if (response.status === 404) {
		return [];
	}

	if (response.status >= 400) {
		throw new Error(
			`Commerce catalog request failed with HTTP ${response.status}`,
		);
	}

	if (!Array.isArray(response.data?.data)) {
		throw new Error("Commerce catalog response is missing a data array");
	}

	return response.data.data.map(toCommerceCatalogItemView);
});

const getCommerceCartSummary = cache(async () => {
	const response = await getCommerceApiResponse<{ data: CommerceCart | null }>(
		"/commerce/cart/v1/current",
		{
			validateStatus: () => true,
		},
	);

	if (
		response.status === 401 ||
		response.status === 403 ||
		response.status === 404 ||
		isMissingCommerceActorResponse(response)
	) {
		return null;
	}

	if (response.status >= 400) {
		throw new Error(
			`Commerce cart request failed with HTTP ${response.status}`,
		);
	}

	if (!response.data || !("data" in response.data)) {
		throw new Error("Commerce cart response is missing data");
	}

	return response.data.data;
});

const listCommerceOrders = cache(async (limit: number) => {
	const response = await getCommerceApiResponse<{ data: CommerceOrder[] }>(
		"/commerce/order/v1/orders",
		{
			params: {
				limit,
			},
			validateStatus: () => true,
		},
	);

	if (
		response.status === 401 ||
		response.status === 403 ||
		response.status === 404 ||
		isMissingCommerceActorResponse(response)
	) {
		return [];
	}

	if (response.status >= 400) {
		throw new Error(
			`Commerce orders request failed with HTTP ${response.status}`,
		);
	}

	if (!Array.isArray(response.data?.data)) {
		throw new Error("Commerce orders response is missing a data array");
	}

	return response.data.data;
});

const isMissingCommerceActorResponse = (response: {
	data?: unknown;
	status: number;
}) => {
	if (response.status !== 422) {
		return false;
	}

	const data = response.data as
		| {
				errors?: {
					actor?: unknown;
				};
		  }
		| null
		| undefined;

	return Array.isArray(data?.errors?.actor);
};

const listCommerceCatalogItemsForSearch = async (search: string) => {
	try {
		return await listCommerceCatalogItems(search);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Commerce catalog search failed: ${error.message}`, {
				cause: error,
			});
		}

		throw error;
	}
};

const listOptionalCommerceCatalogItems = async () => {
	try {
		return await listCommerceCatalogItems();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Commerce catalog resource failed: ${error.message}`, {
				cause: error,
			});
		}

		throw error;
	}
};

const getOptionalCommerceCartSummary = async () => {
	try {
		return await getCommerceCartSummary();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Commerce cart resource failed: ${error.message}`, {
				cause: error,
			});
		}

		throw error;
	}
};

const listOptionalCommerceOrders = async (limit: number) => {
	try {
		return await listCommerceOrders(limit);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Commerce orders resource failed: ${error.message}`, {
				cause: error,
			});
		}

		throw error;
	}
};

const getCommerceCatalogItem = cache(async (slug: string) => {
	const response = await getCommerceApiResponse<{ data: CommerceCatalogItem }>(
		`/commerce/catalog/items/${encodeURIComponent(slug)}`,
		{
			validateStatus: () => true,
		},
	);

	if (response.status === 404) {
		throw new CommerceCatalogItemNotFoundError(slug);
	}

	if (response.status >= 400) {
		throw new Error(
			`Commerce catalog item request failed with HTTP ${response.status}`,
		);
	}

	if (!response.data?.data) {
		throw new Error("Commerce catalog item response is missing data");
	}

	return toCommerceCatalogItemView(response.data.data);
});

export const searchCommerceCatalogItems = async (
	query: string,
	limit = 8,
): Promise<PhotonSearchResult[]> => {
	const normalizedQuery = query.trim();

	if (normalizedQuery.length < 2) {
		return [];
	}

	const items = await listCommerceCatalogItemsForSearch(normalizedQuery);

	return items.slice(0, limit).map((item, index) => ({
		id: `commerce:${item.id}`,
		pageKey: `commerce:${item.id}`,
		pageName: item.name,
		pageGroup: "Commerce",
		pageKind: "page",
		route: item.href ?? `/catalog/${item.slug}`,
		blockId: "commerce-product-detail",
		path: "product.name",
		targetId: `commerce-product:${item.id}`,
		occurrence: index,
		snippet: [item.sku, item.name, item.description]
			.filter(
				(part): part is string =>
					typeof part === "string" && part.trim() !== "",
			)
			.join(" · "),
	}));
};

const commerceCartServerResource = defineNextDataServerResource({
	key: commerceCartSnapshotKey,
	shouldLoad: async () => true,
	load: async () => getOptionalCommerceCartSummary(),
});

const resolveCommerceProductSlug = (requestPath: string) => {
	const requestedMatch = requestPath.match(/^\/catalog\/([^/?#]+)\/?$/);

	if (requestedMatch?.[1]) {
		return decodeURIComponent(requestedMatch[1]);
	}

	return null;
};

export const withCommerceResources = async <TPage extends CommerceResolvedPage>(
	requestPath: string,
	page: TPage,
): Promise<TPage> => {
	const nextResources: PhotonResources = { ...page.resources };
	const hasCommerceDocumentBinding = hasCommerceBinding(page.document);

	if (hasCommerceDocumentBinding) {
		const catalog = await listOptionalCommerceCatalogItems();
		const products = catalog.filter((item) => item.type === "product");
		const services = catalog.filter((item) => item.type === "service");
		const kind = resolveCommerceStorefrontKind(page.document);
		const defaultItems =
			kind === "services" ? services : kind === "hybrid" ? catalog : products;

		nextResources.commerceCatalog = {
			...((nextResources.commerceCatalog as Record<string, unknown>) ?? {}),
			items: defaultItems,
			products,
			services,
		};
	}

	const commerceSnapshot = await createNextDataSnapshot({
		context: {
			requestPath,
		},
		resources: [commerceCartServerResource],
	});
	const commerceCartSnapshot = commerceSnapshot[commerceCartSnapshotKey.id];

	if (commerceCartSnapshot !== undefined) {
		nextResources[commerceCartSnapshotKey.id] = commerceCartSnapshot;
		nextResources.commerceCartSummary = commerceCartSnapshot;
	}

	const slug = resolveCommerceProductSlug(requestPath);

	if (hasCommerceDocumentBinding && slug) {
		try {
			nextResources.commerceProduct = {
				...((nextResources.commerceProduct as Record<string, unknown>) ?? {}),
				product: await getCommerceCatalogItem(slug),
				status: "ready",
				slug,
			};
		} catch (error) {
			if (!isCommerceCatalogItemNotFoundError(error)) {
				throw error;
			}

			nextResources.commerceProduct = {
				...((nextResources.commerceProduct as Record<string, unknown>) ?? {}),
				product: null,
				status: "not-found",
				slug,
			};
		}
	}

	if (getCommerceOrderListBlocks(page.document).length > 0) {
		const limit = resolveCommerceOrderListLimit(page.document);

		nextResources.commerceOrders = {
			orders: await listOptionalCommerceOrders(limit),
			status: "ready",
			limit,
		};
	}

	return {
		...page,
		resources: nextResources,
	};
};
