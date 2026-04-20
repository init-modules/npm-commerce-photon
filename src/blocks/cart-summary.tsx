"use client";

import { createCommerceClient, getCommerceRequest } from "@init-modules/commerce";
import { useCommerceCartStore } from "@init-modules/commerce/client";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Counter,
	Steps,
} from "@init-modules/ui";
import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	EditableText,
	EditableTextarea,
	useWebsiteBuilder,
	useWebsiteBuilderI18n,
	WebsiteBuilderLink,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import debounce from "lodash-es/debounce";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { shallow } from "zustand/shallow";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	formatCommerceMoney,
} from "./shared";

type CommerceCartSummaryProps = {
	eyebrow: string;
	title: string;
	emptyTitle: string;
	emptyBody: string;
	checkoutLabel: string;
	catalogLabel: string;
	catalogHref: string;
	checkoutHref: string;
};

const createCheckoutSteps = (locale: string, current: number) => [
	{
		title: locale === "ru" ? "Корзина" : "Cart",
		description: locale === "ru" ? "Проверьте позиции" : "Review items",
	},
	{
		title: locale === "ru" ? "Оформление" : "Checkout",
		description: locale === "ru" ? "Контакты и заказ" : "Contacts and order",
	},
	{
		title: locale === "ru" ? "Готово" : "Done",
		description: locale === "ru" ? "Заказ создан" : "Order placed",
		status: current > 1 ? "finish" : undefined,
	},
] as const;

const CommerceCartSummary = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceCartSummaryProps>) => {
	const { mode } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const { applyItemQuantity, cart, setCart, setStatus, status } =
		useCommerceCartStore(
			(state) => ({
				applyItemQuantity: state.applyItemQuantity,
				cart: state.cart,
				setCart: state.setCart,
				setStatus: state.setStatus,
				status: state.status,
			}),
			shallow,
		);
	const isCartLoaded = cart !== null;
	const client = useMemo(
		() => createCommerceClient(getCommerceRequest()),
		[],
	);

	useEffect(() => {
		if (mode !== "preview") {
			return;
		}

		if (isCartLoaded) {
			return;
		}

		let alive = true;
		if (status !== "ready") {
			setStatus("loading");
		}

		client
			.getCurrentCart()
			.then((response) => {
				if (!alive) {
					return;
				}

				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setStatus("ready");
			})
			.catch(() => {
				if (!alive) {
					return;
				}

				setStatus("error");
			});

		return () => {
			alive = false;
		};
	}, [client, isCartLoaded, mode, setCart, setStatus, status]);

	const syncItemQuantityNow = useCallback(
		async (itemId: string, nextQuantity: number) => {
			if (mode !== "preview") {
				return;
			}

			setStatus("loading");

			try {
				const response =
					nextQuantity <= 0
						? await client.removeCartItem(itemId)
						: await client.updateCartItem(itemId, {
								quantity: nextQuantity,
							});

				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setStatus("ready");
			} catch {
				setStatus("error");
			}
		},
		[client, mode, setCart, setStatus],
	);

	const syncItemQuantity = useMemo(
		() =>
			debounce((itemId: string, nextQuantity: number) => {
				void syncItemQuantityNow(itemId, nextQuantity);
			}, 350),
		[syncItemQuantityNow],
	);

	useEffect(
		() => () => {
			syncItemQuantity.cancel();
		},
		[syncItemQuantity],
	);

	const setItemQuantity = (itemId: string, nextQuantity: number) => {
		const nextCart = applyItemQuantity(itemId, nextQuantity);
		if (nextCart) {
			emitCommerceCartUpdated(nextCart);
		}
		syncItemQuantity(itemId, nextQuantity);
	};

	const items = cart?.items ?? [];
	const hasItems = items.length > 0;

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
				<Breadcrumb className="mb-8">
					<BreadcrumbList>
						<BreadcrumbItem>
							<WebsiteBuilderLink href={block.props.catalogHref}>
								{block.props.catalogLabel}
							</WebsiteBuilderLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{block.props.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Steps
					current={0}
					className="mb-8"
					items={createCheckoutSteps(contentLocale, 0)}
				/>
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

				{hasItems ? (
					<div className={`mt-8 overflow-hidden ${cx.surface}`}>
						{items.map((item) => (
							<div
								key={item.id}
								className="grid gap-4 border-b border-[color:var(--wb-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div className="min-w-0">
									<div className={`font-semibold ${cx.strongText}`}>
										{item.name}
									</div>
									<div className={`mt-1 text-sm ${cx.mutedText}`}>
										{formatCommerceMoney(
											item.unit_price,
											cart?.currency ?? "KZT",
											contentLocale,
										)}
									</div>
									<div className="mt-4 flex items-center gap-3">
										<Counter
											value={item.quantity}
											min={0}
											valueLabel={item.name ?? "Quantity"}
											onValueChange={(nextQuantity) => {
												const nextCart = applyItemQuantity(
													item.id,
													nextQuantity,
												);

												if (nextCart) {
													emitCommerceCartUpdated(nextCart);
												}
											}}
											onValueCommit={(nextQuantity) =>
												setItemQuantity(item.id, nextQuantity)
											}
											className="h-10 min-w-32 border-[var(--wb-site-border)] bg-[color-mix(in_oklab,var(--wb-site-background)_86%,black)] text-[var(--wb-site-text)]"
											buttonClassName="h-8 w-8 hover:bg-[color-mix(in_oklab,var(--wb-site-accent)_18%,transparent)]"
											valueClassName="h-8"
										/>
										<button
											type="button"
											aria-label="Remove item"
											onClick={() => setItemQuantity(item.id, 0)}
											className={`flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--wb-site-border)] transition hover:border-[var(--wb-site-accent)] hover:text-[var(--wb-site-accent)] ${cx.mutedText}`}
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								</div>
								<div className={`font-semibold ${cx.strongText}`}>
									{formatCommerceMoney(
										item.line_total,
										cart?.currency ?? "KZT",
										contentLocale,
									)}
								</div>
							</div>
						))}
						<div className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${cx.mutedSurface}`}>
							<div>
								<div className={`text-sm ${cx.mutedText}`}>Total</div>
								<div className="text-2xl font-semibold">
									{formatCommerceMoney(
										cart?.total_amount,
										cart?.currency ?? "KZT",
										contentLocale,
									)}
								</div>
							</div>
							<WebsiteBuilderLink
								href={block.props.checkoutHref}
								className={cx.primaryButton}
							>
								{block.props.checkoutLabel}
							</WebsiteBuilderLink>
						</div>
					</div>
				) : (
					<div className={cx.empty}>
						<EditableText
							blockId={block.id}
							path="emptyTitle"
							className={`text-lg font-semibold ${cx.strongText}`}
						/>
						<EditableTextarea
							blockId={block.id}
							path="emptyBody"
							className={`mt-3 text-sm leading-7 ${cx.mutedText}`}
						/>
						<WebsiteBuilderLink
							href={block.props.catalogHref}
							className={`mt-6 ${cx.secondaryButton}`}
						>
							{block.props.catalogLabel}
						</WebsiteBuilderLink>
					</div>
				)}

				{status === "error" ? (
					<div className={`mt-4 text-sm ${cx.errorText}`}>
						Unable to load cart
					</div>
				) : null}
			</div>
		</section>
	);
};

export const commerceCartSummaryDefinition: WebsiteBuilderBlockDefinition<CommerceCartSummaryProps> =
	defineWebsiteBuilderBlockDefinition<CommerceCartSummaryProps>({
		type: "commerce-cart-summary",
		label: "Commerce Cart Summary",
		labelKey: "commerceWebsiteBuilder.cartSummary.label",
		description: "Active cart lines and totals.",
		descriptionKey: "commerceWebsiteBuilder.cartSummary.description",
		category: "Commerce",
		icon: "shopping-cart",
		defaults: {
			eyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			title: createWebsiteBuilderLocalizedDefault({
				en: "Your cart",
				ru: "Ваша корзина",
			}),
			emptyTitle: createWebsiteBuilderLocalizedDefault({
				en: "Your cart is empty",
				ru: "Корзина пуста",
			}),
			emptyBody: createWebsiteBuilderLocalizedDefault({
				en: "Add a catalog item to start checkout.",
				ru: "Добавьте товар из каталога, чтобы перейти к оформлению.",
			}),
			checkoutLabel: createWebsiteBuilderLocalizedDefault({
				en: "Checkout",
				ru: "Оформить заказ",
			}),
			catalogLabel: createWebsiteBuilderLocalizedDefault({
				en: "Continue shopping",
				ru: "Продолжить покупки",
			}),
			catalogHref: "/catalog",
			checkoutHref: "/checkout",
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
				path: "checkoutLabel",
				label: "Checkout label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "catalogLabel",
				label: "Catalog label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "catalogHref",
				label: "Catalog URL",
				kind: "text",
				group: "data",
				localization: "shared",
			},
			{
				path: "checkoutHref",
				label: "Checkout URL",
				kind: "text",
				group: "data",
				localization: "shared",
			},
		],
		component: CommerceCartSummary,
	});
