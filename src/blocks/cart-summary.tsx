"use client";

import {
	type CommerceCart,
	createCommerceClient,
	createFetchCommerceRequest,
} from "@init-modules/commerce";
import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	EditableText,
	EditableTextarea,
	useWebsiteBuilder,
	useWebsiteBuilderI18n,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import { useEffect, useMemo, useState } from "react";
import { commerceBlockClassNames as cx, formatCommerceMoney } from "./shared";

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

const CommerceCartSummary = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceCartSummaryProps>) => {
	const { mode } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const [cart, setCart] = useState<CommerceCart | null>(null);
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
		"idle",
	);
	const client = useMemo(
		() => createCommerceClient(createFetchCommerceRequest()),
		[],
	);

	useEffect(() => {
		if (mode !== "preview") {
			return;
		}

		let alive = true;
		setStatus("loading");

		client
			.getCurrentCart()
			.then((response) => {
				if (!alive) {
					return;
				}

				setCart(response.data);
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
	}, [client, mode]);

	const items = cart?.items ?? [];
	const hasItems = items.length > 0;

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
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
								className="grid gap-3 border-b border-[color:var(--wb-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div className="min-w-0">
									<div className={`font-semibold ${cx.strongText}`}>
										{item.name}
									</div>
									<div className={`mt-1 text-sm ${cx.mutedText}`}>
										{item.quantity} x{" "}
										{formatCommerceMoney(
											item.unit_price,
											cart?.currency ?? "KZT",
											contentLocale,
										)}
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
							<a
								href={block.props.checkoutHref}
								className={cx.primaryButton}
							>
								{block.props.checkoutLabel}
							</a>
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
						<a
							href={block.props.catalogHref}
							className={`mt-6 ${cx.secondaryButton}`}
						>
							{block.props.catalogLabel}
						</a>
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
