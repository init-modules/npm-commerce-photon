import {
	createWebsiteBuilderAccountTabExtension,
	createWebsiteBuilderSiteFrameExtension,
	type WebsiteBuilderAccountTabExtension,
	type WebsiteBuilderSiteFrameExtension,
} from "@init-modules/website-builder";

export const commerceWebsiteBuilderSiteFrameExtension: WebsiteBuilderSiteFrameExtension =
	createWebsiteBuilderSiteFrameExtension({
		id: "commerce",
		label: "Commerce",
		order: 20,
		header: {
			categoryLinks: [
				{
					id: "commerce:catalog-link",
					label: "Catalog",
					href: "/catalog",
					order: 10,
				},
			],
			actions: [
				{
					id: "commerce:cart-action",
					label: "Cart",
					href: "/cart",
					appearance: "secondary",
					order: 20,
				},
			],
		},
		footer: {
			navigationColumns: [
				{
					id: "commerce:footer-shop",
					title: "Shop",
					order: 20,
					links: [
						{ id: "commerce:footer-catalog", label: "Catalog", href: "/catalog" },
						{ id: "commerce:footer-cart", label: "Cart", href: "/cart" },
						{ id: "commerce:footer-orders", label: "Orders", href: "/orders" },
					],
				},
			],
		},
	});

export const commerceOrdersAccountTab: WebsiteBuilderAccountTabExtension =
	createWebsiteBuilderAccountTabExtension({
		id: "commerce:orders",
		label: "Orders",
		href: "/account/orders",
		order: 30,
	});
