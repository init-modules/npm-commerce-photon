"use client";

import {
	type CommerceCatalogItemView,
} from "@init/commerce";
import { useCommerceCartStore } from "@init/commerce/client";
import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	EditableText,
	EditableTextarea,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	PhotonLink,
	usePhoton,
	usePhotonI18n,
	usePhotonValueAtPath,
} from "@init/photon/public";
import { Counter } from "@init/ui";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCommercePhotonClient } from "../client";
import { debounceCallback } from "../helpers/debounce";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	findCommerceCartItem,
	formatCommerceMoney,
	indexCommerceCartItems,
	normalizeCommerceProducts,
} from "./shared";

type CommerceProductGridCardVariant = "default" | "marketplace";
type CommerceProductGridSurface = "bare" | "beige";
type CommerceProductGridLayout = "grid" | "swiper";
type CommerceProductGridCardActions = "add-to-cart" | "link-only";

type CommerceProductGridProps = {
	eyebrow: string;
	title: string;
	body: string;
	emptyTitle: string;
	emptyBody: string;
	cardCtaLabel: string;
	addToCartLabel: string;
	columns: number;
	showDescription: boolean;
	cardVariant: CommerceProductGridCardVariant;
	surface: CommerceProductGridSurface;
	layout: CommerceProductGridLayout;
	cardActions: CommerceProductGridCardActions;
};

const getStockLabel = (locale: string, item: CommerceCatalogItemView) => {
	if (item.status === "active") {
		return locale === "ru" ? "В наличии" : "In stock";
	}

	return item.status ?? (locale === "ru" ? "Доступно" : "Available");
};

const DetailIcon = () => (
	<svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
		<path
			d="M4 10h9m-3-3 3 3-3 3"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.8"
		/>
	</svg>
);

const FavoriteIcon = () => (
	<svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
		<path
			d="M10 16.5 3.9 10.8C.6 7.6 5.1 2.4 10 7.4c4.9-5 9.4.2 6.1 3.4L10 16.5Z"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.55"
		/>
	</svg>
);

const CommerceProductGrid = ({
	block,
}: PhotonBlockComponentProps<CommerceProductGridProps>) => {
	const { contentLocale } = usePhotonI18n();
	const { mode } = usePhoton();
	const items = normalizeCommerceProducts(
		usePhotonValueAtPath(block.id, "items"),
	);
	const columns = Math.min(Math.max(Number(block.props.columns || 3), 1), 5);
	const addToCartLabel =
		block.props.addToCartLabel ||
		(contentLocale === "ru" ? "В корзину" : "Add to cart");
	const cardVariant: CommerceProductGridCardVariant =
		block.props.cardVariant === "marketplace" ? "marketplace" : "default";
	const surface: CommerceProductGridSurface =
		block.props.surface === "beige" ? "beige" : "bare";
	const layoutMode: CommerceProductGridLayout =
		block.props.layout === "swiper" ? "swiper" : "grid";
	const cardActionsMode: CommerceProductGridCardActions =
		block.props.cardActions === "link-only" ? "link-only" : "add-to-cart";
	const isMarketplace = cardVariant === "marketplace";
	const isBeige = surface === "beige";
	const isSwiper = layoutMode === "swiper";
	const isLinkOnly = cardActionsMode === "link-only";

	const swiperScrollRef = useRef<HTMLDivElement | null>(null);
	const slideRefs = useRef<Array<HTMLElement | null>>([]);
	const [activeSlide, setActiveSlide] = useState(0);
	const itemIds = items.map((item) => item.id).join("|");

	useEffect(() => {
		if (!isSwiper) {
			return;
		}
		const root = swiperScrollRef.current;
		if (!root) {
			return;
		}
		const slides = slideRefs.current.filter(
			(node): node is HTMLElement => Boolean(node),
		);
		if (slides.length === 0) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (!visible) return;
				const index = slides.indexOf(visible.target as HTMLElement);
				if (index >= 0) {
					setActiveSlide(index);
				}
			},
			{ root, threshold: [0.5, 0.75, 1] },
		);

		for (const slide of slides) {
			observer.observe(slide);
		}

		return () => observer.disconnect();
	}, [isSwiper, itemIds]);
	const client = useCommercePhotonClient();
	const cart = useCommerceCartStore((state) => state.cart);
	const setCart = useCommerceCartStore((state) => state.setCart);
	const [cartLines, setCartLines] = useState<
		Record<string, { id: string; quantity: number }>
	>(() => (cart ? indexCommerceCartItems(cart) : {}));
	const [itemStatuses, setItemStatuses] = useState<
		Record<string, "idle" | "loading" | "error">
	>({});
	const cartLinesRef = useRef(cartLines);
	const desiredItemQuantitiesRef = useRef(new Map<string, number>());
	const interactive = mode === "preview";

	useEffect(() => {
		cartLinesRef.current = cartLines;
	}, [cartLines]);

	useEffect(() => {
		if (desiredItemQuantitiesRef.current.size > 0) {
			return;
		}

		setCartLines(cart ? indexCommerceCartItems(cart) : {});
	}, [cart]);

	useEffect(() => {
		if (!interactive || items.length === 0) {
			return;
		}

		if (cart) {
			return;
		}

		let active = true;

		client
			.getCurrentCart()
			.then((response) => {
				if (active) {
					if (desiredItemQuantitiesRef.current.size > 0) {
						return;
					}

					setCart(response.data);
					setCartLines(indexCommerceCartItems(response.data));
				}
			})
			.catch(() => undefined);

		return () => {
			active = false;
		};
	}, [cart, client, interactive, itemIds, setCart]);

	const setItemStatus = (
		itemId: string,
		status: "idle" | "loading" | "error",
	) =>
		setItemStatuses((currentStatuses) => ({
			...currentStatuses,
			[itemId]: status,
		}));

	const syncItemQuantityNow = useCallback(
		async (item: CommerceCatalogItemView, nextQuantity: number) => {
			if (!interactive) {
				return;
			}

			setItemStatus(item.id, "loading");

			try {
				const currentLine = cartLinesRef.current[item.id];
				const response =
					nextQuantity <= 0
						? currentLine?.id
							? await client.removeCartItem(currentLine.id)
							: await client.getCurrentCart()
						: currentLine?.id
							? await client.updateCartItem(currentLine.id, {
									quantity: nextQuantity,
								})
							: await client.addCartItem({
									catalogItemId: item.id,
									quantity: nextQuantity,
									replace: true,
								});

				const line = findCommerceCartItem(response.data, item);

				if (desiredItemQuantitiesRef.current.get(item.id) !== nextQuantity) {
					return;
				}

				desiredItemQuantitiesRef.current.delete(item.id);
				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setCartLines((currentLines) => {
					const nextLines = { ...currentLines };

					if (line) {
						nextLines[item.id] = {
							id: line.id,
							quantity: line.quantity,
						};
					} else {
						delete nextLines[item.id];
					}

					return nextLines;
				});
				setItemStatus(item.id, "idle");
			} catch {
				if (desiredItemQuantitiesRef.current.get(item.id) !== nextQuantity) {
					return;
				}

				setItemStatus(item.id, "error");
			}
		},
		[client, interactive, setCart],
	);

	const syncItemQuantity = useMemo(
		() =>
			debounceCallback(
				(item: CommerceCatalogItemView, nextQuantity: number) => {
					void syncItemQuantityNow(item, nextQuantity);
				},
				350,
			),
		[syncItemQuantityNow],
	);

	useEffect(
		() => () => {
			syncItemQuantity.cancel();
		},
		[syncItemQuantity],
	);

	const queueItemQuantity = (
		item: CommerceCatalogItemView,
		nextQuantity: number,
	) => {
		if (!interactive) {
			return;
		}

		setCartLines((currentLines) => ({
			...currentLines,
			[item.id]: {
				id: currentLines[item.id]?.id ?? "",
				quantity: nextQuantity,
			},
		}));
		desiredItemQuantitiesRef.current.set(item.id, nextQuantity);
		syncItemQuantity(item, nextQuantity);
	};

	return (
		<section className={`${cx.section} py-12 sm:py-16`}>
			<div className="mx-auto max-w-[96rem]">
				<div className="flex items-start justify-between gap-6">
					<div className="max-w-3xl">
						<EditableText
							blockId={block.id}
							path="eyebrow"
							className={cx.eyebrow}
						/>
						<EditableText
							blockId={block.id}
							path="title"
							as="h1"
							className="mt-3 block text-3xl font-semibold leading-tight sm:text-5xl"
						/>
						<EditableTextarea
							blockId={block.id}
							path="body"
							className={`mt-4 max-w-2xl text-base leading-7 ${cx.mutedText}`}
						/>
					</div>
					<div className="hidden shrink-0 items-center gap-2 sm:flex">
						<button
							type="button"
							aria-label="Previous catalog items"
							className={`flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--photon-site-border)] ${cx.mutedText}`}
						>
							‹
						</button>
						<button
							type="button"
							aria-label="Next catalog items"
							className={`flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--photon-site-border)] ${cx.mutedText}`}
						>
							›
						</button>
					</div>
				</div>

				{items.length > 0 ? (
					<>
						<div
							ref={swiperScrollRef}
							className={
								isSwiper
									? "mt-10 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
									: "mt-10 grid justify-start gap-x-7 gap-y-10 [grid-template-columns:repeat(auto-fill,minmax(min(16rem,100%),18rem))] xl:grid-cols-[repeat(var(--commerce-grid-columns),minmax(0,1fr))] xl:justify-stretch"
							}
							style={
								isSwiper
									? undefined
									: ({
											"--commerce-grid-columns": columns,
										} as CSSProperties)
							}
						>
							{items.map((item, itemIndex) => {
								const line = cartLines[item.id];
								const status = itemStatuses[item.id] ?? "idle";
								const itemHref = item.href ?? `/catalog/${item.slug}`;

								const articleClass = [
									"group w-full min-w-0",
									isSwiper
										? "snap-start shrink-0 min-w-[260px] sm:min-w-[280px] md:min-w-[300px] max-w-[320px]"
										: "max-w-[18rem] xl:max-w-none",
									isBeige
										? "rounded-[var(--mp-radius-2xl,16px)] bg-[var(--mp-card-bg,#F5F4F2)] p-3 sm:p-4"
										: "",
								]
									.filter(Boolean)
									.join(" ");

								const imageWrapperClass = [
									"relative overflow-hidden",
									isMarketplace ? "aspect-[4/5]" : "aspect-[4/3]",
									isBeige
										? "rounded-[calc(var(--mp-radius-2xl,16px)-4px)]"
										: "rounded-md",
									cx.mutedSurface,
								].join(" ");

								const titleClass = isMarketplace
									? `mt-2 block min-h-10 text-sm font-normal leading-5 ${cx.strongText}`
									: `mt-2 block min-h-12 text-base font-medium leading-6 ${cx.strongText}`;

								const priceClass = isMarketplace
									? `text-lg font-bold tracking-tight text-[var(--photon-site-accent)]`
									: `text-xl font-semibold tracking-tight ${cx.strongText}`;

								return (
									<article
										key={item.id}
										ref={(node) => {
											slideRefs.current[itemIndex] = node;
										}}
										className={articleClass}
									>
										<PhotonLink href={itemHref} className="block min-w-0">
											<div className={imageWrapperClass}>
												{item.coverImage ? (
													<img
														src={item.coverImage}
														alt={item.name}
														className={`h-full w-full ${
															isMarketplace
																? "object-cover object-top"
																: "object-cover"
														} transition duration-300 group-hover:scale-[1.02]`}
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center bg-[color-mix(in_oklab,var(--photon-site-surface)_70%,var(--photon-site-accent))] p-6 text-center">
														<div
															className={`max-w-[12rem] text-xs font-semibold uppercase tracking-[0.2em] ${cx.mutedText}`}
														>
															{item.sku ?? item.name}
														</div>
													</div>
												)}
											</div>
										</PhotonLink>
										<div className={isMarketplace ? "mt-3" : "mt-5"}>
											{isMarketplace ? (
												<>
													<PhotonLink
														href={itemHref}
														className={titleClass}
													>
														<EditableText
															blockId={block.id}
															path={`items.${itemIndex}.name`}
															className="line-clamp-2"
														/>
													</PhotonLink>
													<div className={`mt-1 ${priceClass}`}>
														{formatCommerceMoney(
															item.publicPriceAmount,
															item.currency,
															contentLocale,
														)}
													</div>
												</>
											) : (
												<>
													<div className={priceClass}>
														{formatCommerceMoney(
															item.publicPriceAmount,
															item.currency,
															contentLocale,
														)}
													</div>
													<PhotonLink href={itemHref} className={titleClass}>
														<EditableText
															blockId={block.id}
															path={`items.${itemIndex}.name`}
															className="line-clamp-2"
														/>
													</PhotonLink>
												</>
											)}
											{block.props.showDescription && item.description ? (
												<EditableTextarea
													blockId={block.id}
													path={`items.${itemIndex}.description`}
													className={`mt-2 line-clamp-2 text-sm leading-6 ${cx.mutedText}`}
												/>
											) : null}
											{isLinkOnly ? (
												<div className="mt-3">
													<PhotonLink
														href={itemHref}
														aria-label={block.props.cardCtaLabel}
														className={`inline-flex items-center gap-1 text-sm font-medium ${cx.strongText} hover:text-[var(--photon-site-accent)]`}
													>
														{block.props.cardCtaLabel}
														<DetailIcon />
													</PhotonLink>
												</div>
											) : (
												<>
													<div
														className={`mt-3 flex items-center gap-3 text-sm ${cx.mutedText}`}
													>
														<span>☆ 0.0</span>
														<span className="inline-flex items-center gap-1 text-[var(--photon-site-accent)]">
															<span aria-hidden="true">⊙</span>
															{getStockLabel(contentLocale, item)}
														</span>
													</div>
													<div className="mt-4 flex min-h-11 items-center gap-3">
														{line?.quantity ? (
															<Counter
																value={line.quantity}
																min={0}
																disabled={!interactive}
																valueLabel={addToCartLabel}
																onValueChange={(nextQuantity) =>
																	setCartLines((currentLines) => ({
																		...currentLines,
																		[item.id]: {
																			id:
																				currentLines[item.id]?.id ?? "",
																			quantity: nextQuantity,
																		},
																	}))
																}
																onValueCommit={(nextQuantity) => {
																	desiredItemQuantitiesRef.current.set(
																		item.id,
																		nextQuantity,
																	);
																	syncItemQuantity(item, nextQuantity);
																}}
																className="h-10 min-w-32 bg-[var(--photon-site-text)] text-[var(--photon-site-background)]"
																buttonClassName="h-8 w-8 hover:bg-[color-mix(in_oklab,var(--photon-site-background)_14%,transparent)]"
																valueClassName="h-8"
															/>
														) : (
															<button
																type="button"
																disabled={!interactive}
																onClick={() => queueItemQuantity(item, 1)}
																className={cx.primaryButton}
															>
																{addToCartLabel}
															</button>
														)}
														<button
															type="button"
															aria-label={block.props.cardCtaLabel}
															className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:text-[var(--photon-site-accent)] ${cx.mutedText}`}
														>
															<FavoriteIcon />
														</button>
														<PhotonLink
															href={itemHref}
															aria-label={block.props.cardCtaLabel}
															className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:text-[var(--photon-site-accent)] ${cx.mutedText}`}
														>
															<DetailIcon />
														</PhotonLink>
													</div>
													{status === "error" ? (
														<div className={`mt-2 text-sm ${cx.errorText}`}>
															Unable to update cart
														</div>
													) : null}
												</>
											)}
										</div>
									</article>
								);
							})}
						</div>
						{isSwiper && items.length > 1 ? (
							<div className="mt-4 flex items-center justify-center gap-1.5">
								{items.map((item, dotIndex) => (
									<span
										key={item.id}
										aria-hidden="true"
										className={`h-1.5 rounded-full transition-all ${
											dotIndex === activeSlide
												? "w-5 bg-[var(--photon-site-accent)]"
												: "w-1.5 bg-[color-mix(in_oklab,var(--photon-site-text)_25%,transparent)]"
										}`}
									/>
								))}
							</div>
						) : null}
					</>
				) : (
					<div className={cx.empty}>
						<div className={`text-lg font-semibold ${cx.strongText}`}>
							{block.props.emptyTitle}
						</div>
						<div className={`mt-3 text-sm leading-7 ${cx.mutedText}`}>
							{block.props.emptyBody}
						</div>
					</div>
				)}
			</div>
		</section>
	);
};

export const commerceProductGridDefinition: PhotonBlockDefinition<CommerceProductGridProps> =
	definePhotonBlockDefinition<CommerceProductGridProps>({
		type: "commerce-product-grid",
		label: "Commerce Product Grid",
		labelKey: "commercePhoton.productGrid.label",
		description: "Live catalog cards with editable storefront copy.",
		descriptionKey: "commercePhoton.productGrid.description",
		category: "Commerce",
		icon: "shopping-bag",
		defaults: {
			eyebrow: createPhotonLocalizedDefault({
				en: "Catalog",
				ru: "Каталог",
			}),
			title: createPhotonLocalizedDefault({
				en: "Products and services",
				ru: "Товары и услуги",
			}),
			body: createPhotonLocalizedDefault({
				en: "Browse live catalog items managed by the commerce packages.",
				ru: "Просматривайте живые позиции каталога из commerce-пакетов.",
			}),
			emptyTitle: createPhotonLocalizedDefault({
				en: "No products yet",
				ru: "Товаров пока нет",
			}),
			emptyBody: createPhotonLocalizedDefault({
				en: "Add active catalog items to unlock this storefront section.",
				ru: "Добавьте активные позиции каталога, чтобы открыть этот раздел витрины.",
			}),
			cardCtaLabel: createPhotonLocalizedDefault({
				en: "View product",
				ru: "Открыть товар",
			}),
			addToCartLabel: createPhotonLocalizedDefault({
				en: "Add to cart",
				ru: "В корзину",
			}),
			columns: 3,
			showDescription: true,
			cardVariant: "default",
			surface: "bare",
			layout: "grid",
			cardActions: "add-to-cart",
		},
		bindings: {
			items: {
				source: "commerceCatalog",
				path: "items",
				mode: "write",
			},
		},
		fields: [
			{
				path: "eyebrow",
				label: "Eyebrow",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "title",
				label: "Title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "body",
				label: "Body",
				kind: "textarea",
				group: "content",
				localization: "localized",
			},
			{
				path: "emptyTitle",
				label: "Empty title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "emptyBody",
				label: "Empty body",
				kind: "textarea",
				group: "content",
				localization: "localized",
			},
			{
				path: "cardCtaLabel",
				label: "Card CTA label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "addToCartLabel",
				label: "Add to cart label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "columns",
				label: "Columns",
				kind: "number",
				group: "layout",
				localization: "shared",
				min: 1,
				max: 5,
			},
			{
				path: "showDescription",
				label: "Show description",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "cardVariant",
				label: "Card variant",
				kind: "select",
				group: "layout",
				localization: "shared",
				options: [
					{ value: "default", label: "Default" },
					{ value: "marketplace", label: "Marketplace" },
				],
			},
			{
				path: "surface",
				label: "Card surface",
				kind: "select",
				group: "layout",
				localization: "shared",
				options: [
					{ value: "bare", label: "Bare" },
					{ value: "beige", label: "Beige" },
				],
			},
			{
				path: "layout",
				label: "Layout",
				kind: "select",
				group: "layout",
				localization: "shared",
				options: [
					{ value: "grid", label: "Grid" },
					{ value: "swiper", label: "Swiper" },
				],
			},
			{
				path: "cardActions",
				label: "Card actions",
				kind: "select",
				group: "layout",
				localization: "shared",
				options: [
					{ value: "add-to-cart", label: "Add to cart" },
					{ value: "link-only", label: "Link only" },
				],
			},
		],
		component: CommerceProductGrid,
	});
