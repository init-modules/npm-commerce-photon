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
) =>
	[
		"commerceCatalog",
		"commerceCatalogItem",
		"commerceProduct",
		"commerceCheckout",
		"commerceOrder",
	].some((key) => context.resources[key] !== undefined) ||
	getCommerceCartQuantity(
		context.resources.commerceCartSummary as
			| { items_quantity?: unknown; item_count?: unknown }
			| null
			| undefined,
	) > 0;

const isCommerceSiteFrameVisible = (
	context: PhotonSiteFrameContributionContext,
) =>
	hasCommerceBlock(context.document.blocks) ||
	Object.values(context.site.regions).some((region) =>
		hasCommerceBlock(region.document.blocks),
	) ||
	hasCommerceRuntimeResource(context);

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

type CartActionDefaults = {
	enabled?: boolean;
	order?: number;
	label?: Record<string, string>;
	href?: string;
};

const CommerceCartActionComponent = (
	props: PhotonSiteFrameContributionRenderProps<CartActionDefaults>,
) => {
	const cart = useCommerceCartStore((state) => state.cart);
	const quantity = getCommerceCartQuantity(cart);
	const ariaLabel = pickLocalized(props.label, "Cart");

	return (
		<PhotonLink
			href={props.href ?? commerceCheckoutCartHref}
			aria-label={ariaLabel}
			data-photon-header-cart-link="true"
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
