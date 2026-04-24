import type {
	CommerceCart,
	CommerceCartItem,
	CommerceCatalogItemView,
} from "@init/commerce";
import {
	applyCommerceCartItemQuantity as applyCommerceCartItemQuantityFromStore,
	normalizeCommerceCartTotals,
	toCommerceAmountNumber,
} from "@init/commerce";

export const commerceBlockClassNames = {
	section:
		"border-y border-[color:var(--photon-site-border)] bg-[var(--photon-site-background)] px-5 text-[var(--photon-site-text)] sm:px-8",
	surface:
		"rounded-lg border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_86%,var(--photon-site-background))]",
	mediaSurface:
		"rounded-lg border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_72%,var(--photon-site-background))]",
	mutedSurface:
		"bg-[color-mix(in_oklab,var(--photon-site-surface)_72%,var(--photon-site-background))]",
	eyebrow:
		"text-xs font-semibold uppercase tracking-[0.22em] text-[var(--photon-site-accent)]",
	mutedText: "text-[var(--photon-site-muted-text)]",
	strongText: "text-[var(--photon-site-text)]",
	input:
		"h-11 rounded-lg border border-[color:var(--photon-site-border)] bg-[var(--photon-site-background)] px-3 text-base text-[var(--photon-site-text)] outline-none transition placeholder:text-[color-mix(in_oklab,var(--photon-site-muted-text)_72%,transparent)] focus:border-[var(--photon-site-accent)] disabled:cursor-not-allowed disabled:opacity-60",
	primaryButton:
		"inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-[var(--photon-site-accent)] px-5 text-sm font-semibold text-[var(--photon-site-background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[color-mix(in_oklab,var(--photon-site-border)_72%,var(--photon-site-surface))] disabled:text-[var(--photon-site-muted-text)]",
	secondaryButton:
		"inline-flex h-11 items-center justify-center rounded-lg border border-[color:var(--photon-site-border)] bg-[var(--photon-site-surface)] px-5 text-sm font-semibold text-[var(--photon-site-text)] transition hover:border-[var(--photon-site-accent)]",
	card: "group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_86%,var(--photon-site-background))] transition hover:border-[var(--photon-site-accent)] hover:bg-[var(--photon-site-surface)]",
	empty:
		"mt-8 rounded-lg border border-dashed border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_72%,var(--photon-site-background))] px-6 py-10 text-center",
	pill: "rounded-full border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-accent)_12%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--photon-site-accent)]",
	errorText: "text-[color-mix(in_oklab,#ef4444_78%,var(--photon-site-text))]",
	successPanel:
		"rounded-lg border border-[color-mix(in_oklab,var(--photon-site-accent)_48%,var(--photon-site-border))] bg-[color-mix(in_oklab,var(--photon-site-accent)_12%,var(--photon-site-surface))]",
};

export const normalizeCommerceProduct = (
	value: unknown,
): CommerceCatalogItemView | null => {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const product = value as Record<string, unknown>;
	const id = typeof product.id === "string" ? product.id : null;
	const name = typeof product.name === "string" ? product.name : null;
	const slug = typeof product.slug === "string" ? product.slug : "";

	if (!id || !name) {
		return null;
	}

	return {
		id,
		name,
		slug,
		type: typeof product.type === "string" ? product.type : null,
		status: typeof product.status === "string" ? product.status : null,
		sku: typeof product.sku === "string" ? product.sku : null,
		description:
			typeof product.description === "string" ? product.description : null,
		publicPriceAmount:
			typeof product.publicPriceAmount === "number"
				? product.publicPriceAmount
				: 0,
		currency:
			typeof product.currency === "string" && product.currency
				? product.currency
				: "KZT",
		inventoryMode:
			typeof product.inventoryMode === "string" ? product.inventoryMode : null,
		tracked: Boolean(product.tracked),
		href: typeof product.href === "string" ? product.href : null,
		catalogHref:
			typeof product.catalogHref === "string" ? product.catalogHref : null,
		coverImage:
			typeof product.coverImage === "string" ? product.coverImage : null,
	};
};

export const normalizeCommerceProducts = (
	value: unknown,
): CommerceCatalogItemView[] =>
	Array.isArray(value)
		? value.flatMap((item) => {
				const product = normalizeCommerceProduct(item);

				return product ? [product] : [];
			})
		: [];

export const findCommerceCartItem = (
	cart: CommerceCart,
	item: CommerceCatalogItemView,
): CommerceCartItem | null =>
	cart.items.find((cartItem) => cartItem.catalog_item_id === item.id) ?? null;

export const indexCommerceCartItems = (
	cart: CommerceCart,
): Record<string, { id: string; quantity: number }> =>
	Object.fromEntries(
		cart.items
			.filter((item) => item.catalog_item_id)
			.map((item) => [
				item.catalog_item_id,
				{
					id: item.id,
					quantity: item.quantity,
				},
			]),
	);

export const normalizeCommerceCart = (value: unknown): CommerceCart | null => {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const cart = value as CommerceCart;

	return Array.isArray(cart.items) && typeof cart.id === "string"
		? normalizeCommerceCartTotals(cart)
		: null;
};

export const getCommerceCartFromResources = (
	resources: Record<string, unknown>,
): CommerceCart | null => normalizeCommerceCart(resources.commerceCartSummary);

export const applyCommerceCartItemQuantity = (
	cart: CommerceCart,
	itemId: string,
	quantity: number,
): CommerceCart =>
	applyCommerceCartItemQuantityFromStore(cart, itemId, quantity);

export const emitCommerceCartUpdated = (cart: CommerceCart | null) => {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent("commerce-cart-updated", {
			detail: cart,
		}),
	);
};

export const formatCommerceMoney = (
	amount: null | number | string | undefined,
	currency = "KZT",
	locale = "en",
) =>
	new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(toCommerceAmountNumber(amount) / 100);
