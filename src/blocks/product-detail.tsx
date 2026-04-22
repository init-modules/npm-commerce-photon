"use client";

import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	EditableText,
	EditableTextarea,
	usePhoton,
	usePhotonI18n,
	usePhotonValueAtPath,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	PhotonLink,
} from "@init/photon/public";
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
}: PhotonBlockComponentProps<CommerceProductDetailProps>) => {
	const { contentLocale } = usePhotonI18n();
	const { resources } = usePhoton();
	const product = normalizeCommerceProduct(
		usePhotonValueAtPath(block.id, "product"),
	);
	const commerceProductResource =
		typeof resources.commerceProduct === "object" &&
		resources.commerceProduct !== null
			? (resources.commerceProduct as Record<string, unknown>)
			: null;
	const isMissingProduct = commerceProductResource?.status === "not-found";

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
						) : isMissingProduct ? (
							<div
								className={`flex h-full min-h-[320px] items-center justify-center px-8 text-center text-sm ${cx.mutedText}`}
							>
								Product not found
							</div>
						) : (
							<div
								className={`flex h-full min-h-[320px] items-center justify-center px-8 text-center text-sm ${cx.mutedText}`}
							>
								Product media
							</div>
						)}
					</div>
				) : null}

				<div className="flex min-w-0 flex-col justify-center">
					{product?.catalogHref ? (
						<PhotonLink
							href={product.catalogHref}
							className="mb-6 text-sm font-semibold text-[var(--photon-site-accent)] hover:opacity-80"
						>
							{block.props.backLabel}
						</PhotonLink>
					) : null}
					<EditableText
						blockId={block.id}
						path="eyebrow"
						className={cx.eyebrow}
					/>
					{isMissingProduct ? (
						<>
							<h1 className="mt-3 block text-4xl font-semibold leading-tight sm:text-6xl">
								Product not found
							</h1>
							<p
								className={`mt-6 max-w-2xl text-base leading-8 ${cx.mutedText}`}
							>
								This catalog item is no longer available.
							</p>
						</>
					) : (
						<>
							<EditableText
								blockId={block.id}
								path="product.name"
								as="h1"
								placeholder="Product"
								className="mt-3 block text-4xl font-semibold leading-tight sm:text-6xl"
							/>
							{block.props.showSku && product?.sku ? (
								<EditableText
									blockId={block.id}
									path="product.sku"
									className={`mt-4 block text-sm uppercase tracking-[0.18em] ${cx.mutedText}`}
								/>
							) : null}
							<div className={`mt-6 text-2xl font-semibold ${cx.strongText}`}>
								{formatCommerceMoney(
									product?.publicPriceAmount,
									product?.currency ?? "KZT",
									contentLocale,
								)}
							</div>
							{block.props.showDescription && product?.description ? (
								<EditableTextarea
									blockId={block.id}
									path="product.description"
									className={`mt-6 max-w-2xl text-base leading-8 ${cx.mutedText}`}
								/>
							) : null}
						</>
					)}
				</div>
			</div>
		</section>
	);
};

export const commerceProductDetailDefinition: PhotonBlockDefinition<CommerceProductDetailProps> =
	definePhotonBlockDefinition<CommerceProductDetailProps>({
		type: "commerce-product-detail",
		label: "Commerce Product Detail",
		labelKey: "commercePhoton.productDetail.label",
		description: "Product hero bound to the current catalog item.",
		descriptionKey: "commercePhoton.productDetail.description",
		category: "Commerce",
		icon: "package",
		defaults: {
			eyebrow: createPhotonLocalizedDefault({
				en: "Product",
				ru: "Товар",
			}),
			backLabel: createPhotonLocalizedDefault({
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
