import type {
	WebsiteBuilderBlock,
	WebsiteBuilderDocument,
} from "@init-modules/website-builder/public";

export type CommerceWebsiteBuilderLocale = "en" | "ru";
export type CommerceProfileStarterPresetId =
	| "commerce-products-store"
	| "commerce-services-store";
export type CommerceDesignTemplateId =
	| "commerce-products-template"
	| "commerce-services-template";

type CommerceStorefrontKind = "products" | "services";
type CommerceCatalogBindingPath = "items" | "products" | "services";
type CommerceStarterSource =
	| { type: "preset"; sourceId?: string }
	| { type: "template"; sourceId?: string };

const updatedAt = "2026-04-18T00:00:00.000Z";

const copy = (locale: CommerceWebsiteBuilderLocale, en: string, ru: string) =>
	locale === "ru" ? ru : en;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const resolveKindFromSource = (
	source: CommerceStarterSource,
): CommerceStorefrontKind =>
	source.sourceId === "commerce-services-store" ||
	source.sourceId === "commerce-services-template"
		? "services"
		: "products";

const createCatalogBlock = (
	locale: CommerceWebsiteBuilderLocale,
	kind: CommerceStorefrontKind,
	path: CommerceCatalogBindingPath = kind,
): WebsiteBuilderBlock => ({
	id: "commerce-product-grid",
	module: "commerce-website-builder",
	type: "commerce-product-grid",
	props: {
		eyebrow: copy(locale, "Catalog", "Каталог"),
		title:
			kind === "services"
				? copy(locale, "Book services", "Запишитесь на услуги")
				: copy(locale, "Shop products", "Купите товары"),
		body:
			kind === "services"
				? copy(
						locale,
						"Browse live services, open a service card and add it to checkout.",
						"Просматривайте живые услуги, открывайте карточку и добавляйте услугу к оформлению.",
					)
				: copy(
						locale,
						"Browse live products, compare prices and add items to cart.",
						"Просматривайте живые товары, сравнивайте цены и добавляйте позиции в корзину.",
					),
		emptyTitle:
			kind === "services"
				? copy(locale, "No services yet", "Услуг пока нет")
				: copy(locale, "No products yet", "Товаров пока нет"),
		emptyBody: copy(
			locale,
			"Add active catalog items to unlock this storefront section.",
			"Добавьте активные позиции каталога, чтобы открыть этот раздел витрины.",
		),
		cardCtaLabel:
			kind === "services"
				? copy(locale, "View service", "Открыть услугу")
				: copy(locale, "View product", "Открыть товар"),
		addToCartLabel:
			kind === "services"
				? copy(locale, "Book", "Записаться")
				: copy(locale, "Add to cart", "В корзину"),
		columns: kind === "services" ? 3 : 5,
		showDescription: true,
	},
	bindings: {
		items: {
			source: "commerceCatalog",
			path,
			mode: "write",
		},
	},
});

const createProductDetailBlocks = (
	locale: CommerceWebsiteBuilderLocale,
	kind: CommerceStorefrontKind,
): WebsiteBuilderBlock[] => [
	{
		id: "commerce-product-detail",
		module: "commerce-website-builder",
		type: "commerce-product-detail",
		props: {
			eyebrow:
				kind === "services"
					? copy(locale, "Service", "Услуга")
					: copy(locale, "Product", "Товар"),
			backLabel: copy(locale, "Back to catalog", "Назад в каталог"),
			showSku: true,
			showDescription: true,
			showImage: true,
		},
		bindings: {
			product: {
				source: "commerceProduct",
				path: "product",
				mode: "write",
			},
		},
	},
	{
		id: "commerce-add-to-cart",
		module: "commerce-website-builder",
		type: "commerce-add-to-cart",
		props: {
			quantityLabel: copy(locale, "Quantity", "Количество"),
			buttonLabel:
				kind === "services"
					? copy(locale, "Book service", "Записаться")
					: copy(locale, "Add to cart", "Добавить в корзину"),
			successLabel:
				kind === "services"
					? copy(locale, "Service added", "Услуга добавлена")
					: copy(locale, "Added to cart", "Добавлено в корзину"),
			cartHref: "/cart",
		},
		bindings: {
			product: {
				source: "commerceProduct",
				path: "product",
				mode: "read",
			},
		},
	},
];

const createDocument = (
	id: string,
	name: string,
	route: string,
	blocks: WebsiteBuilderDocument["blocks"],
): WebsiteBuilderDocument => ({
	id,
	name,
	route,
	updatedAt,
	blocks,
});

const createAccountShellBlock = (
	locale: CommerceWebsiteBuilderLocale,
	id: string,
	blocks: WebsiteBuilderBlock[],
): WebsiteBuilderBlock => ({
	id,
	module: "auth-website-builder",
	type: "auth-account-shell",
	props: {
		eyebrow: copy(locale, "Account", "Личный кабинет"),
		title: copy(locale, "Manage your account", "Управляйте аккаунтом"),
		body: copy(
			locale,
			"Review profile details and open package-provided workspace tabs.",
			"Проверьте данные профиля и откройте вкладки, которые предоставляют пакеты.",
		),
		signedOutTitle: copy(locale, "Sign in to continue", "Войдите, чтобы продолжить"),
		signedOutBody: copy(
			locale,
			"Your account page is available after authentication.",
			"Личный кабинет доступен после авторизации.",
		),
		signInLabel: copy(locale, "Sign in", "Войти"),
		disabledTabIds: [],
	},
	areas: [
		{
			id: "content",
			label: copy(locale, "Account content", "Содержимое кабинета"),
			blocks,
		},
	],
});

export const createCommerceStorefrontDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
	kind: CommerceStorefrontKind = "products",
): WebsiteBuilderDocument =>
	createDocument(
		`commerce-${kind}-home`,
		kind === "services"
			? copy(locale, "Services Storefront", "Витрина услуг")
			: copy(locale, "Products Storefront", "Витрина товаров"),
		"/",
		[createCatalogBlock(locale, kind)],
	);

export const createCommerceCatalogDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
	kind: CommerceStorefrontKind = "products",
	path: CommerceCatalogBindingPath = kind,
	route: "/products" | "/services" | "/catalog" = "/catalog",
): WebsiteBuilderDocument =>
	createDocument(
		`commerce-${path}-catalog`,
		path === "services"
			? copy(locale, "Services", "Услуги")
			: path === "products"
				? copy(locale, "Products", "Товары")
				: copy(locale, "Catalog", "Каталог"),
		route,
		[createCatalogBlock(locale, kind, path)],
	);

export const createCommerceProductTemplateDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
	kind: CommerceStorefrontKind = "products",
): WebsiteBuilderDocument =>
	createDocument(
		`commerce-${kind}-detail-template`,
		kind === "services"
			? copy(locale, "Service Template", "Шаблон услуги")
			: copy(locale, "Product Template", "Шаблон товара"),
		"/catalog/{slug}",
		createProductDetailBlocks(locale, kind),
	);

export const createCommerceCartDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
): WebsiteBuilderDocument =>
	createDocument("commerce-cart", copy(locale, "Cart", "Корзина"), "/cart", [
		{
			id: "commerce-cart-summary",
			module: "commerce-website-builder",
			type: "commerce-cart-summary",
			props: {
				eyebrow: copy(locale, "Cart", "Корзина"),
				title: copy(locale, "Your cart", "Ваша корзина"),
				emptyTitle: copy(locale, "Your cart is empty", "Корзина пуста"),
				emptyBody: copy(
					locale,
					"Add a catalog item to start checkout.",
					"Добавьте позицию из каталога, чтобы перейти к оформлению.",
				),
				checkoutLabel: copy(locale, "Checkout", "Оформить заказ"),
				catalogLabel: copy(locale, "Continue shopping", "Продолжить покупки"),
				catalogHref: "/products",
				checkoutHref: "/checkout",
			},
		},
	]);

export const createCommerceCheckoutDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
): WebsiteBuilderDocument =>
	createDocument(
		"commerce-checkout",
		copy(locale, "Checkout", "Оформление заказа"),
		"/checkout",
		[
			{
				id: "commerce-checkout-form",
				module: "commerce-website-builder",
				type: "commerce-checkout-form",
				props: {
					eyebrow: copy(locale, "Checkout", "Оформление"),
					title: copy(locale, "Place your order", "Оформить заказ"),
					body: copy(
						locale,
						"Review your active cart and leave contact details for the order snapshot.",
						"Проверьте активную корзину и оставьте контактные данные для снимка заказа.",
					),
					nameLabel: copy(locale, "Name", "Имя"),
					emailLabel: "Email",
					phoneLabel: copy(locale, "Phone", "Телефон"),
					submitLabel: copy(locale, "Place order", "Разместить заказ"),
					successTitle: copy(locale, "Order confirmed", "Заказ оформлен"),
					successBody: copy(
						locale,
						"We saved your order and will keep its status updated in your account.",
						"Мы сохранили заказ и будем обновлять его статус в личном кабинете.",
					),
					orderDetailsTitle: copy(locale, "Order details", "Детали заказа"),
					orderNumberLabel: copy(locale, "Order number", "Номер заказа"),
					orderStatusLabel: copy(locale, "Status", "Статус"),
					orderTotalLabel: copy(locale, "Total", "Итого"),
					trackOrderLabel: copy(
						locale,
						"Track order status in your account",
						"Отслеживать статус заказа в личном кабинете",
					),
					cartHref: "/cart",
					accountOrdersHref: "/account/orders",
				},
			},
		],
	);

export const createCommerceAccountOrdersDocument = (
	locale: CommerceWebsiteBuilderLocale = "en",
): WebsiteBuilderDocument =>
	createDocument(
		"commerce-account-orders",
		copy(locale, "Account Orders", "Заказы в личном кабинете"),
		"/account/orders",
		[
			createAccountShellBlock(locale, "commerce-account-orders-shell", [
				{
					id: "commerce-order-list",
					module: "commerce-website-builder",
					type: "commerce-order-list",
					props: {
						eyebrow: copy(locale, "Account", "Личный кабинет"),
						title: copy(locale, "Your orders", "Ваши заказы"),
						emptyTitle: copy(locale, "No orders yet", "Заказов пока нет"),
						emptyBody: copy(
							locale,
							"Checkout your first cart to see order history here.",
							"Оформите первую корзину, чтобы увидеть историю заказов.",
						),
						orderLabel: copy(locale, "Order", "Заказ"),
						totalLabel: copy(locale, "Total", "Итого"),
						itemCountLabel: copy(locale, "items", "позиций"),
						catalogLabel: copy(locale, "Open catalog", "Открыть каталог"),
						catalogHref: "/products",
						limit: 20,
					},
				},
			]),
		],
	);

const createPageEntry = (document: WebsiteBuilderDocument) => ({
	document: clone(document),
	settings: {
		page: {
			name: document.name,
			path: document.route,
		},
		template: {},
		record: {},
	},
	resources: {},
	seo: {
		page: {
			title: document.name,
		},
		template: {},
		record: {},
	},
});

const createSiteRegionDocument = (
	locale: CommerceWebsiteBuilderLocale,
	key: "header" | "footer",
	kind: CommerceStorefrontKind,
) =>
	key === "header"
		? createDocument(
				"commerce-site-header",
				copy(locale, "Header", "Хедер"),
				"/_site/header",
				[
					{
						id: "site-header-shell",
						module: "website-builder-system",
						type: "site-header-shell",
						props: {
							variant: "commerce-inline",
							brandLabel:
								kind === "services"
									? copy(locale, "Service Studio", "Студия услуг")
									: copy(locale, "Product Store", "Магазин товаров"),
							brandHref: "/",
							logoImage: null,
							utilityLinks: [
								{
									label: copy(locale, "Orders", "Заказы"),
									href: "/account/orders",
								},
							],
							catalogLabel: copy(locale, "Catalog", "Каталог"),
							searchPlaceholder: copy(
								locale,
								"Search catalog",
								"Поиск по каталогу",
							),
							contactValue: "+7 (707) 040-43-43",
							contactCaption: copy(
								locale,
								"Daily support",
								"Поддержка каждый день",
							),
							primaryCtaLabel:
								kind === "services"
									? copy(locale, "Book now", "Записаться")
									: copy(locale, "Shop now", "Купить"),
							primaryCtaHref: kind === "services" ? "/services" : "/products",
							secondaryCtaLabel: copy(locale, "Orders", "Заказы"),
							secondaryCtaHref: "/account/orders",
							showLoginAction: true,
							loginLabel: copy(locale, "Sign in", "Войти"),
							sticky: true,
							compactOnScroll: true,
							categoryLinks: [
								{ label: copy(locale, "Products", "Товары"), href: "/products" },
								{ label: copy(locale, "Services", "Услуги"), href: "/services" },
							],
						},
					},
				],
			)
		: createDocument(
				"commerce-site-footer",
				copy(locale, "Footer", "Футер"),
				"/_site/footer",
				[
					{
						id: "site-footer-shell",
						module: "website-builder-system",
						type: "site-footer-shell",
						props: {
							variant: "classic-dark",
							brandTitle:
								kind === "services"
									? copy(locale, "Service Studio", "Студия услуг")
									: copy(locale, "Product Store", "Магазин товаров"),
							brandBody:
								kind === "services"
									? copy(
											locale,
											"Service catalog, booking cart and order history.",
											"Каталог услуг, корзина записи и история заказов.",
										)
									: copy(
											locale,
											"Product catalog, shopping cart and order history.",
											"Каталог товаров, корзина покупок и история заказов.",
										),
							logoImage: null,
							subscriptionTitle: copy(locale, "Stay updated", "Будьте в курсе"),
							subscriptionBody: copy(
								locale,
								"Get storefront updates and new offers.",
								"Получайте обновления витрины и новые предложения.",
							),
							subscriptionPlaceholder: copy(locale, "Email", "Email"),
							subscriptionButtonLabel: copy(locale, "Subscribe", "Подписаться"),
							navigationColumns: [
								{
									title: copy(locale, "Storefront", "Витрина"),
									links: [
										{
											label: copy(locale, "Products", "Товары"),
											href: "/products",
										},
										{
											label: copy(locale, "Services", "Услуги"),
											href: "/services",
										},
										{ label: copy(locale, "Cart", "Корзина"), href: "/cart" },
										{
											label: copy(locale, "Orders", "Заказы"),
											href: "/account/orders",
										},
									],
								},
							],
							contactItems: ["+7 (707) 040-43-43", "hello@example.test"],
							legalLabel: copy(
								locale,
								"Privacy policy",
								"Политика конфиденциальности",
							),
							legalHref: "/privacy",
							copyrightLabel: "Commerce 2026",
							developerLabel: copy(locale, "Built by init", "Сделано init"),
							developerHref: "https://init.kz",
						},
					},
				],
			);

export const createCommerceStarterProfileTree = (
	locale: CommerceWebsiteBuilderLocale,
	source: CommerceStarterSource,
) => {
	const kind = resolveKindFromSource(source);
	const home = createCommerceStorefrontDocument(locale, kind);
	const products = createCommerceCatalogDocument(
		locale,
		"products",
		"products",
		"/products",
	);
	const services = createCommerceCatalogDocument(
		locale,
		"services",
		"services",
		"/services",
	);
	const catalog = createCommerceCatalogDocument(locale, kind, kind, "/catalog");
	const product = createCommerceProductTemplateDocument(locale, kind);
	const cart = createCommerceCartDocument(locale);
	const checkout = createCommerceCheckoutDocument(locale);
	const orders = createCommerceAccountOrdersDocument(locale);

	return {
		pages: {
			home: createPageEntry(home),
			catalog: createPageEntry(catalog),
			products: createPageEntry(products),
			services: createPageEntry(services),
			product: createPageEntry(product),
			cart: createPageEntry(cart),
			checkout: createPageEntry(checkout),
			accountOrders: createPageEntry(orders),
		},
		site: {
			regions: {
				header: {
					document: createSiteRegionDocument(locale, "header", kind),
				},
				footer: {
					document: createSiteRegionDocument(locale, "footer", kind),
				},
			},
			settings: {},
		},
		seo: {
			site: {
				title: home.name,
			},
		},
		settings: {
			publication: {
				locale,
			},
		},
		meta: {
			source: "commerce-website-builder-starter",
		},
	};
};

export const commerceProfileStarterPresets = [
	{
		id: "commerce-products-store",
		label: "Commerce Products Store",
		description:
			"Starter profile for product catalogs, carts, checkout and account order history.",
		starterRecipe: {
			type: "commerce-products-store",
		},
	},
	{
		id: "commerce-services-store",
		label: "Commerce Services Store",
		description:
			"Starter profile for service catalogs, booking-style carts, checkout and account order history.",
		starterRecipe: {
			type: "commerce-services-store",
		},
	},
] as const;

export const commerceDesignTemplates = [
	{
		id: "commerce-products-template",
		label: "Commerce Products Template",
		description:
			"Immutable product storefront template with catalog, product, cart, checkout and order history pages.",
		sourcePresetId: "commerce-products-store",
		previewRoute: "/template/commerce-products",
	},
	{
		id: "commerce-services-template",
		label: "Commerce Services Template",
		description:
			"Immutable service storefront template with service cards, booking cart, checkout and order history pages.",
		sourcePresetId: "commerce-services-store",
		previewRoute: "/template/commerce-services",
	},
] as const;

export const commerceWebsiteBuilderDocuments = {
	"commerce-products-template": createCommerceStorefrontDocument(
		"en",
		"products",
	),
	"commerce-services-template": createCommerceStorefrontDocument(
		"en",
		"services",
	),
};
