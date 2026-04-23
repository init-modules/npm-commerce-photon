"use client";

import {
	type CommerceOrder,
	createCommerceClient,
	getCommerceRequest,
} from "@init/commerce";
import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	EditableText,
	EditableTextarea,
	usePhoton,
	usePhotonI18n,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	PhotonLink,
} from "@init/photon/public";
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
	authLabel: string;
	catalogLabel: string;
	catalogHref: string;
	limit: number;
};

const normalizeCommerceOrders = (value: unknown): CommerceOrder[] | null => {
	const rawOrders =
		Array.isArray(value)
			? value
			: typeof value === "object" && value !== null
				? (value as { orders?: unknown }).orders
				: null;

	if (!Array.isArray(rawOrders)) {
		return null;
	}

	return rawOrders.filter((order): order is CommerceOrder => {
		if (typeof order !== "object" || order === null) {
			return false;
		}

		const candidate = order as Partial<CommerceOrder>;

		return (
			typeof candidate.id === "string" &&
			typeof candidate.number === "string" &&
			Array.isArray(candidate.items)
		);
	});
};

const CommerceOrderList = ({
	block,
}: PhotonBlockComponentProps<CommerceOrderListProps>) => {
	const { mode, requestAuth, resources } = usePhoton();
	const { contentLocale } = usePhotonI18n();
	const authResource = resources.auth as
		| { user?: null | Record<string, unknown> }
		| undefined;
	const isAuthenticated = Boolean(authResource?.user);
	const resourceOrders = useMemo(
		() => normalizeCommerceOrders(resources.commerceOrders),
		[resources.commerceOrders],
	);
	const [orders, setOrders] = useState<CommerceOrder[]>(
		() => resourceOrders ?? [],
	);
	const [status, setStatus] = useState<"idle" | "loading" | "ready">(() =>
		resourceOrders ? "ready" : "idle",
	);
	const client = useMemo(() => createCommerceClient(getCommerceRequest()), []);

	useEffect(() => {
		if (mode !== "preview" || !isAuthenticated) {
			setOrders([]);
			setStatus("idle");
			return;
		}

		if (resourceOrders) {
			setOrders(resourceOrders);
			setStatus("ready");
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

				setOrders([]);
				setStatus("ready");
			});

		return () => {
			alive = false;
		};
	}, [block.props.limit, client, isAuthenticated, mode, resourceOrders]);

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

				{mode === "preview" && !isAuthenticated ? (
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
						<button
							type="button"
							onClick={requestAuth}
							className={`mt-6 ${cx.secondaryButton}`}
						>
							{block.props.authLabel}
						</button>
					</div>
				) : orders.length > 0 ? (
					<div className={`mt-8 overflow-hidden ${cx.surface}`}>
						{orders.map((order) => (
							<div
								key={order.id}
								className="grid gap-4 border-b border-[color:var(--photon-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
							>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<div className={`font-semibold ${cx.strongText}`}>
											{block.props.orderLabel} {order.number}
										</div>
										{order.status ? (
											<span className={cx.pill}>{order.status}</span>
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
													className={`rounded-full border border-[color:var(--photon-site-border)] px-3 py-1 text-xs ${cx.mutedText}`}
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
									<div
										className={`mt-1 text-xl font-semibold ${cx.strongText}`}
									>
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
						<PhotonLink
							href={block.props.catalogHref}
							className={`mt-6 ${cx.secondaryButton}`}
						>
							{block.props.catalogLabel}
						</PhotonLink>
					</div>
				)}
			</div>
		</section>
	);
};

export const commerceOrderListDefinition: PhotonBlockDefinition<CommerceOrderListProps> =
	definePhotonBlockDefinition<CommerceOrderListProps>({
		type: "commerce-order-list",
		label: "Commerce Order List",
		labelKey: "commercePhoton.orderList.label",
		description: "Current customer order history for account pages.",
		descriptionKey: "commercePhoton.orderList.description",
		category: "Commerce",
		icon: "receipt",
		defaults: {
			eyebrow: createPhotonLocalizedDefault({
				en: "Account",
				ru: "Личный кабинет",
			}),
			title: createPhotonLocalizedDefault({
				en: "Your orders",
				ru: "Ваши заказы",
			}),
			emptyTitle: createPhotonLocalizedDefault({
				en: "No orders yet",
				ru: "Заказов пока нет",
			}),
			emptyBody: createPhotonLocalizedDefault({
				en: "Checkout your first cart to see order history here.",
				ru: "Оформите первую корзину, чтобы увидеть историю заказов.",
			}),
			orderLabel: createPhotonLocalizedDefault({
				en: "Order",
				ru: "Заказ",
			}),
			totalLabel: createPhotonLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			itemCountLabel: createPhotonLocalizedDefault({
				en: "items",
				ru: "позиций",
			}),
			authLabel: createPhotonLocalizedDefault({
				en: "Sign in",
				ru: "Войти",
			}),
			catalogLabel: createPhotonLocalizedDefault({
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
				path: "authLabel",
				label: "Auth label",
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
