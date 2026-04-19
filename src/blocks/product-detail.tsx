"use client";

import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	EditableText,
	useWebsiteBuilderI18n,
	useWebsiteBuilderValueAtPath,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import {
	commerceBlockClassNames as cx,
	formatCommerceMoney,
	normalizeCommerceProduct,
} from "./shared";

type CommerceProductDetailProps = {
	eyebrow: string;
	backLabel: string;
	showSku: boolean;
	showDescription: boolean;
	showImage: boolean;
};

const CommerceProductDetail = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceProductDetailProps>) => {
	const { contentLocale } = useWebsiteBuilderI18n();
	const product = normalizeCommerceProduct(
		useWebsiteBuilderValueAtPath(block.id, "product"),
	);

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				{block.props.showImage ? (
					<div className={`min-h-[320px] overflow-hidden ${cx.mediaSurface}`}>
						{product?.coverImage ? (
							<img
								src={product.coverImage}
								alt={product.name}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className={`flex h-full min-h-[320px] items-center justify-center px-8 text-center text-sm ${cx.mutedText}`}>
								Product media
							</div>
						)}
					</div>
				) : null}

				<div className="flex min-w-0 flex-col justify-center">
					{product?.catalogHref ? (
						<a
							href={product.catalogHref}
							className="mb-6 text-sm font-semibold text-[var(--wb-site-accent)] hover:opacity-80"
						>
							{block.props.backLabel}
						</a>
					) : null}
					<EditableText
						blockId={block.id}
						path="eyebrow"
						className={cx.eyebrow}
					/>
					<h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-6xl">
						{product?.name ?? "Product"}
					</h1>
					{block.props.showSku && product?.sku ? (
						<div className={`mt-4 text-sm uppercase tracking-[0.18em] ${cx.mutedText}`}>
							{product.sku}
						</div>
					) : null}
					<div className={`mt-6 text-2xl font-semibold ${cx.strongText}`}>
						{formatCommerceMoney(
							product?.publicPriceAmount,
							product?.currency ?? "KZT",
							contentLocale,
						)}
					</div>
					{block.props.showDescription && product?.description ? (
						<div className={`mt-6 max-w-2xl text-base leading-8 ${cx.mutedText}`}>
							{product.description}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
};

export const commerceProductDetailDefinition: WebsiteBuilderBlockDefinition<CommerceProductDetailProps> =
	defineWebsiteBuilderBlockDefinition<CommerceProductDetailProps>({
		type: "commerce-product-detail",
		label: "Commerce Product Detail",
		labelKey: "commerceWebsiteBuilder.productDetail.label",
		description: "Product hero bound to the current catalog item.",
		descriptionKey: "commerceWebsiteBuilder.productDetail.description",
		category: "Commerce",
		icon: "package",
		defaults: {
			eyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Product",
				ru: "Товар",
			}),
			backLabel: createWebsiteBuilderLocalizedDefault({
				en: "Back to catalog",
				ru: "Назад в каталог",
			}),
			showSku: true,
			showDescription: true,
			showImage: true,
		},
		bindings: {
			product: {
				source: "commerceProduct",
				path: "product",
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
				path: "backLabel",
				label: "Back label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "showSku",
				label: "Show SKU",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "showDescription",
				label: "Show description",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "showImage",
				label: "Show image",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
		],
		component: CommerceProductDetail,
	});
