import { useCommerceCartStore } from "@init/commerce/client";
import {
	definePhotonSiteFrameContribution,
	type PhotonBlock,
	type PhotonSiteFrameContributionContext,
	type PhotonSiteFrameContributionRenderProps,
	footerNavigationSlot,
	headerActionsSlot,
	headerProminentSlot,
} from "@init/photon";
import { PhotonLink } from "@init/photon/public";
import { ShoppingCart } from "lucide-react";
import { formatCommerceMoney } from "./blocks/shared";

const commerceCheckoutCartHref = "/checkout?checkoutStep=cart";

const pickLocalized = (
	value: Record<string, string> | undefined,
	fallback: string,
): string => {
	if (!value) return fallback;
	return value.en ?? value.ru ?? Object.values(value)[0] ?? fallback;
};

const getCommerceCartQuantity = (
	cart: { items_quantity?: unknown; item_count?: unknown } | null | undefined,
) => {
	const quantity = Number(cart?.items_quantity ?? cart?.item_count ?? 0);
	return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
};

const hasCommerceBlock = (
	blocks: readonly PhotonBlock[] | undefined,
): boolean =>
	(blocks ?? []).some((item) => {
		if (item.module === "commerce-photon") {
			return true;
		}
		return (item.areas ?? []).some((area) => hasCommerceBlock(area.blocks));
	});

const hasCommerceRuntimeResource = (
	context: PhotonSiteFrameContributionContext,
) => {
	const resources = context?.resources;
	if (!resources) return false;
	return (
		[
			"commerceCatalog",
			"commerceCatalogItem",
			"commerceProduct",
			"commerceCheckout",
			"commerceOrder",
		].some((key) => resources[key] !== undefined) ||
		getCommerceCartQuantity(
			resources.commerceCartSummary as
				| { items_quantity?: unknown; item_count?: unknown }
				| null
				| undefined,
		) > 0
	);
};

const isCommerceSiteFrameVisible = (
	context: PhotonSiteFrameContributionContext,
) => {
	if (!context) return false;
	const documentBlocks = context.document?.blocks;
	const siteRegions = context.site?.regions;
	return (
		hasCommerceBlock(documentBlocks) ||
		(siteRegions
			? Object.values(siteRegions).some((region) =>
					hasCommerceBlock(region?.document?.blocks),
				)
			: false) ||
		hasCommerceRuntimeResource(context)
	);
};

// --- Catalog link (header.prominent) ----------------------------------

type CatalogLinkDefaults = {
	enabled?: boolean;
	order?: number;
	label?: Record<string, string>;
	href?: string;
};

const CommerceCatalogLinkComponent = (
	props: PhotonSiteFrameContributionRenderProps<CatalogLinkDefaults>,
) => (
	<PhotonLink href={props.href ?? "/catalog"}>
		<span>{pickLocalized(props.label, "Catalog")}</span>
	</PhotonLink>
);

export const commerceCatalogLinkContribution =
	definePhotonSiteFrameContribution({
		id: "commerce.catalog-link",
		packageName: "commerce-photon",
		slot: headerProminentSlot,
		defaults: {
			enabled: true,
			order: 10,
			label: { ru: "Каталог", en: "Catalog" },
			href: "/catalog",
		} satisfies CatalogLinkDefaults,
		configurable: {
			enabled: { kind: "toggle", label: "Show catalog link" },
			label: { kind: "localized-text", label: "Catalog label" },
			order: { kind: "order" },
		},
		isAvailable: isCommerceSiteFrameVisible,
		component: CommerceCatalogLinkComponent,
	});

// --- Cart action (header.actions) -------------------------------------

type CartActionVariant = "icon" | "qty-total";

type CartActionDefaults = {
	enabled?: boolean;
	order?: number;
	label?: Record<string, string>;
	href?: string;
	variant?: CartActionVariant;
};

const CommerceCartActionComponent = (
	props: PhotonSiteFrameContributionRenderProps<CartActionDefaults>,
) => {
	const cart = useCommerceCartStore((state) => state.cart);
	const quantity = getCommerceCartQuantity(cart);
	const ariaLabel = pickLocalized(props.label, "Cart");
	const variant: CartActionVariant = props.variant ?? "qty-total";
	const href = props.href ?? commerceCheckoutCartHref;

	if (variant === "qty-total") {
		const currency =
			typeof cart?.currency === "string" && cart.currency.length > 0
				? cart.currency
				: "KZT";
		const total = formatCommerceMoney(
			cart?.total_amount ?? cart?.subtotal_amount ?? 0,
			currency,
		);

		return (
			<PhotonLink
				href={href}
				aria-label={ariaLabel}
				data-photon-header-cart-link="true"
				data-photon-header-cart-variant="qty-total"
				className="inline-flex items-center gap-2 rounded-full border border-[var(--photon-site-border)] px-3 py-1.5 text-sm text-[var(--photon-site-text)] transition hover:border-[var(--photon-site-accent)] hover:text-[var(--photon-site-accent)]"
			>
				<ShoppingCart className="h-4 w-4" />
				<span className="tabular-nums font-medium">{quantity}</span>
				<span aria-hidden="true" className="opacity-60">
					·
				</span>
				<span className="tabular-nums font-semibold">{total}</span>
			</PhotonLink>
		);
	}

	return (
		<PhotonLink
			href={href}
			aria-label={ariaLabel}
			data-photon-header-cart-link="true"
			data-photon-header-cart-variant="icon"
			className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--photon-site-border)] text-[var(--photon-site-text)] transition hover:border-[var(--photon-site-accent)] hover:text-[var(--photon-site-accent)]"
		>
			<ShoppingCart className="h-5 w-5" />
			{quantity > 0 ? (
				<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--photon-site-accent)] px-1 text-[10px] font-bold leading-none text-white">
					{quantity > 99 ? "99+" : quantity}
				</span>
			) : null}
		</PhotonLink>
	);
};

export const commerceCartContribution = definePhotonSiteFrameContribution({
	id: "commerce.cart",
	packageName: "commerce-photon",
	slot: headerActionsSlot,
	defaults: {
		enabled: true,
		order: 20,
		label: { ru: "Корзина", en: "Cart" },
		href: commerceCheckoutCartHref,
		variant: "qty-total",
	} satisfies CartActionDefaults,
	configurable: {
		enabled: { kind: "toggle", label: "Show cart" },
		label: { kind: "localized-text", label: "Cart label" },
		order: { kind: "order" },
	},
	isAvailable: isCommerceSiteFrameVisible,
	component: CommerceCartActionComponent,
});

// --- Footer Shop column (footer.navigation) ---------------------------

type FooterShopColumnDefaults = {
	enabled?: boolean;
	order?: number;
	title?: Record<string, string>;
	links?: ReadonlyArray<{
		id: string;
		label: Record<string, string>;
		href: string;
	}>;
};

const CommerceFooterShopColumnComponent = (
	props: PhotonSiteFrameContributionRenderProps<FooterShopColumnDefaults>,
) => (
	<section>
		<h3>{pickLocalized(props.title, "Shop")}</h3>
		<ul>
			{(props.links ?? []).map((link) => (
				<li key={link.id}>
					<PhotonLink href={link.href}>
						{pickLocalized(link.label, link.id)}
					</PhotonLink>
				</li>
			))}
		</ul>
	</section>
);

export const commerceFooterShopColumnContribution =
	definePhotonSiteFrameContribution({
		id: "commerce.footer-shop-column",
		packageName: "commerce-photon",
		slot: footerNavigationSlot,
		defaults: {
			enabled: true,
			order: 20,
			title: { ru: "Магазин", en: "Shop" },
			links: [
				{
					id: "commerce.footer.catalog",
					label: { ru: "Каталог", en: "Catalog" },
					href: "/catalog",
				},
				{
					id: "commerce.footer.cart",
					label: { ru: "Корзина", en: "Cart" },
					href: commerceCheckoutCartHref,
				},
				{
					id: "commerce.footer.orders",
					label: { ru: "Заказы", en: "Orders" },
					href: "/account/orders",
				},
			],
		} satisfies FooterShopColumnDefaults,
		configurable: {
			enabled: { kind: "toggle", label: "Show Shop footer column" },
			title: { kind: "localized-text", label: "Column title" },
			order: { kind: "order" },
		},
		isAvailable: isCommerceSiteFrameVisible,
		component: CommerceFooterShopColumnComponent,
	});
