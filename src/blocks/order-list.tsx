"use client";

import {
	type CommerceOrder,
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

type CommerceOrderListProps = {
	eyebrow: string;
	title: string;
	emptyTitle: string;
	emptyBody: string;
	orderLabel: string;
	totalLabel: string;
	itemCountLabel: string;
	catalogLabel: string;
	catalogHref: string;
	limit: number;
};

const CommerceOrderList = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceOrderListProps>) => {
	const { mode } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const [orders, setOrders] = useState<CommerceOrder[]>([]);
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
			.listOrders({ limit: block.props.limit })
			.then((response) => {
				if (!alive) {
					return;
				}

				setOrders(response.data);
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
	}, [block.props.limit, client, mode]);

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

				{orders.length > 0 ? (
					<div className={`mt-8 overflow-hidden ${cx.surface}`}>
						{orders.map((order) => (
							<div
								key={order.id}
								className="grid gap-4 border-b border-[color:var(--wb-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<div className={`font-semibold ${cx.strongText}`}>
											{block.props.orderLabel} {order.number}
										</div>
										{order.status ? (
											<span className={cx.pill}>
												{order.status}
											</span>
										) : null}
									</div>
									<div className={`mt-2 text-sm ${cx.mutedText}`}>
										{order.items_quantity} {block.props.itemCountLabel}
										{order.placed_at
											? ` · ${new Date(order.placed_at).toLocaleDateString(contentLocale)}`
											: ""}
									</div>
									{order.items.length > 0 ? (
										<div className="mt-3 flex flex-wrap gap-2">
											{order.items.slice(0, 4).map((item) => (
												<span
													key={item.id}
													className={`rounded-full border border-[color:var(--wb-site-border)] px-3 py-1 text-xs ${cx.mutedText}`}
												>
													{item.name ?? item.sku ?? item.catalog_item_id}
												</span>
											))}
										</div>
									) : null}
								</div>
								<div className="text-left sm:text-right">
									<div className={`text-sm ${cx.mutedText}`}>
										{block.props.totalLabel}
									</div>
									<div className={`mt-1 text-xl font-semibold ${cx.strongText}`}>
										{formatCommerceMoney(
											order.total_amount,
											order.currency,
											contentLocale,
										)}
									</div>
								</div>
							</div>
						))}
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
						Unable to load orders
					</div>
				) : null}
			</div>
		</section>
	);
};

export const commerceOrderListDefinition: WebsiteBuilderBlockDefinition<CommerceOrderListProps> =
	defineWebsiteBuilderBlockDefinition<CommerceOrderListProps>({
		type: "commerce-order-list",
		label: "Commerce Order List",
		labelKey: "commerceWebsiteBuilder.orderList.label",
		description: "Current customer order history for account pages.",
		descriptionKey: "commerceWebsiteBuilder.orderList.description",
		category: "Commerce",
		icon: "receipt",
		defaults: {
			eyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Account",
				ru: "Личный кабинет",
			}),
			title: createWebsiteBuilderLocalizedDefault({
				en: "Your orders",
				ru: "Ваши заказы",
			}),
			emptyTitle: createWebsiteBuilderLocalizedDefault({
				en: "No orders yet",
				ru: "Заказов пока нет",
			}),
			emptyBody: createWebsiteBuilderLocalizedDefault({
				en: "Checkout your first cart to see order history here.",
				ru: "Оформите первую корзину, чтобы увидеть историю заказов.",
			}),
			orderLabel: createWebsiteBuilderLocalizedDefault({
				en: "Order",
				ru: "Заказ",
			}),
			totalLabel: createWebsiteBuilderLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			itemCountLabel: createWebsiteBuilderLocalizedDefault({
				en: "items",
				ru: "позиций",
			}),
			catalogLabel: createWebsiteBuilderLocalizedDefault({
				en: "Open catalog",
				ru: "Открыть каталог",
			}),
			catalogHref: "/catalog",
			limit: 20,
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
				path: "orderLabel",
				label: "Order label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "totalLabel",
				label: "Total label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "itemCountLabel",
				label: "Item count label",
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
				path: "limit",
				label: "Limit",
				kind: "number",
				group: "data",
				localization: "shared",
				min: 1,
				max: 50,
			},
		],
		component: CommerceOrderList,
	});
