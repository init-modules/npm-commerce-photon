"use client";

import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	EditableText,
	EditableTextarea,
	useWebsiteBuilder,
	useWebsiteBuilderI18n,
	useWebsiteBuilderValueAtPath,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import {
	commerceBlockClassNames as cx,
	formatCommerceMoney,
	normalizeCommerceProducts,
} from "./shared";

type CommerceProductGridProps = {
	eyebrow: string;
	title: string;
	body: string;
	emptyTitle: string;
	emptyBody: string;
	cardCtaLabel: string;
	columns: number;
	showDescription: boolean;
};

const CommerceProductGrid = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceProductGridProps>) => {
	const { mode } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const items = normalizeCommerceProducts(
		useWebsiteBuilderValueAtPath(block.id, "items"),
	);
	const columns = Math.min(Math.max(Number(block.props.columns || 3), 1), 4);

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-6xl">
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

				{items.length > 0 ? (
					<div
						className="mt-8 grid gap-4"
						style={{
							gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
						}}
					>
						{items.map((item) => (
							<a
								key={item.id}
								href={item.href ?? `/catalog/${item.slug}`}
								onClick={(event) => {
									if (mode !== "preview") {
										event.preventDefault();
									}
								}}
								className={cx.card}
							>
								{item.coverImage ? (
									<div className={`aspect-[4/3] ${cx.mutedSurface}`}>
										<img
											src={item.coverImage}
											alt={item.name}
											className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
										/>
									</div>
								) : null}
								<div className="flex flex-1 flex-col p-5">
									{item.sku ? (
										<div className={`text-xs font-medium uppercase tracking-[0.18em] ${cx.mutedText}`}>
											{item.sku}
										</div>
									) : null}
									<div className={`mt-2 text-lg font-semibold leading-7 ${cx.strongText}`}>
										{item.name}
									</div>
									{block.props.showDescription && item.description ? (
										<div className={`mt-3 line-clamp-3 text-sm leading-6 ${cx.mutedText}`}>
											{item.description}
										</div>
									) : null}
									<div className="mt-auto flex items-center justify-between gap-4 pt-5">
										<div className={`text-base font-semibold ${cx.strongText}`}>
											{formatCommerceMoney(
												item.publicPriceAmount,
												item.currency,
												contentLocale,
											)}
										</div>
										<div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--wb-site-accent)]">
											{block.props.cardCtaLabel}
										</div>
									</div>
								</div>
							</a>
						))}
					</div>
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

export const commerceProductGridDefinition: WebsiteBuilderBlockDefinition<CommerceProductGridProps> =
	defineWebsiteBuilderBlockDefinition<CommerceProductGridProps>({
		type: "commerce-product-grid",
		label: "Commerce Product Grid",
		labelKey: "commerceWebsiteBuilder.productGrid.label",
		description: "Live catalog cards with editable storefront copy.",
		descriptionKey: "commerceWebsiteBuilder.productGrid.description",
		category: "Commerce",
		icon: "shopping-bag",
		defaults: {
			eyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Catalog",
				ru: "Каталог",
			}),
			title: createWebsiteBuilderLocalizedDefault({
				en: "Products and services",
				ru: "Товары и услуги",
			}),
			body: createWebsiteBuilderLocalizedDefault({
				en: "Browse live catalog items managed by the commerce packages.",
				ru: "Просматривайте живые позиции каталога из commerce-пакетов.",
			}),
			emptyTitle: createWebsiteBuilderLocalizedDefault({
				en: "No products yet",
				ru: "Товаров пока нет",
			}),
			emptyBody: createWebsiteBuilderLocalizedDefault({
				en: "Add active catalog items to unlock this storefront section.",
				ru: "Добавьте активные позиции каталога, чтобы открыть этот раздел витрины.",
			}),
			cardCtaLabel: createWebsiteBuilderLocalizedDefault({
				en: "View product",
				ru: "Открыть товар",
			}),
			columns: 3,
			showDescription: true,
		},
		bindings: {
			items: {
				source: "commerceCatalog",
				path: "items",
				mode: "read",
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
				path: "columns",
				label: "Columns",
				kind: "number",
				group: "layout",
				localization: "shared",
				min: 1,
				max: 4,
			},
			{
				path: "showDescription",
				label: "Show description",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
		],
		component: CommerceProductGrid,
	});
