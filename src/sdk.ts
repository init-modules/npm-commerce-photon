"use client";

import { useCommerceCartStore } from "@init/commerce/client";
import {
	createPhotonAccountTabExtension,
	createPhotonSiteFrameExtension,
	PhotonLink,
	type PhotonBlock,
	type PhotonAccountTabExtension,
	type PhotonSiteFrameActionComponentProps,
	type PhotonSiteFrameExtensionContext,
	type PhotonSiteFrameExtension,
} from "@init/photon/public";
import { ShoppingCart } from "lucide-react";
import { createElement } from "react";

const commerceCheckoutCartHref = "/checkout?checkoutStep=cart";

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
	context: PhotonSiteFrameExtensionContext,
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
	context: PhotonSiteFrameExtensionContext,
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

const CommerceHeaderCartAction = ({
	action,
}: PhotonSiteFrameActionComponentProps) => {
	const cart = useCommerceCartStore((state) => state.cart);
	const quantity = getCommerceCartQuantity(cart);

	return createElement(
		PhotonLink,
		{
			href: action.href,
			"aria-label": action.label,
			"data-photon-header-cart-link": "true",
			className:
				"relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--photon-site-border)] text-[var(--photon-site-text)] transition hover:border-[var(--photon-site-accent)] hover:text-[var(--photon-site-accent)]",
		},
		createElement(ShoppingCart, { className: "h-5 w-5" }),
		quantity > 0
			? createElement(
					"span",
					{
						className:
							"absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--photon-site-accent)] px-1 text-[10px] font-bold leading-none text-white",
					},
					quantity > 99 ? "99+" : quantity,
				)
			: null,
	);
};

export const commercePhotonSiteFrameExtension: PhotonSiteFrameExtension =
	createPhotonSiteFrameExtension({
		id: "commerce",
		label: "Commerce",
		order: 20,
		header: {
			slots: {
				prominent: {
					links: [
						{
							id: "commerce:catalog-link",
							label: "Catalog",
							href: "/catalog",
							isVisible: isCommerceSiteFrameVisible,
							order: 10,
						},
					],
				},
				actions: {
					actions: [
						{
							id: "commerce:cart-action",
							label: "Cart",
							href: commerceCheckoutCartHref,
							appearance: "secondary",
							component: CommerceHeaderCartAction,
							isVisible: isCommerceSiteFrameVisible,
							order: 20,
						},
					],
				},
			},
		},
		footer: {
			slots: {
				navigation: {
					navigationColumns: [
						{
							id: "commerce:footer-shop",
							title: "Shop",
							order: 20,
							links: [
								{
									id: "commerce:footer-catalog",
									label: "Catalog",
									href: "/catalog",
								},
								{
									id: "commerce:footer-cart",
									label: "Cart",
									href: commerceCheckoutCartHref,
								},
								{
									id: "commerce:footer-orders",
									label: "Orders",
									href: "/account/orders",
								},
							],
						},
					],
				},
			},
		},
	});

export const commerceOrdersAccountTab: PhotonAccountTabExtension =
	createPhotonAccountTabExtension({
		id: "commerce:orders",
		label: "Orders",
		href: "/account/orders",
		icon: "receipt",
		match: {
			type: "prefix",
			href: "/account/orders",
		},
		order: 30,
	});
