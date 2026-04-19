"use client";

import {
	createCommerceClient,
	createFetchCommerceRequest,
} from "@init-modules/commerce";
import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	useWebsiteBuilder,
	useWebsiteBuilderValueAtPath,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import { useMemo, useState } from "react";
import { commerceBlockClassNames as cx, normalizeCommerceProduct } from "./shared";

type CommerceAddToCartProps = {
	quantityLabel: string;
	buttonLabel: string;
	successLabel: string;
	cartHref: string;
};

const CommerceAddToCart = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceAddToCartProps>) => {
	const { mode } = useWebsiteBuilder();
	const product = normalizeCommerceProduct(
		useWebsiteBuilderValueAtPath(block.id, "product"),
	);
	const [quantity, setQuantity] = useState(1);
	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const client = useMemo(
		() => createCommerceClient(createFetchCommerceRequest()),
		[],
	);
	const disabled = mode !== "preview" || !product || status === "loading";

	return (
		<section className={`${cx.section} py-6`}>
			<div
				className={`mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between ${cx.surface}`}
			>
				<label className={`flex max-w-[160px] flex-col gap-2 text-sm font-medium ${cx.mutedText}`}>
					{block.props.quantityLabel}
					<input
						type="number"
						min={1}
						value={quantity}
						disabled={mode !== "preview"}
						onChange={(event) =>
							setQuantity(Math.max(1, Number(event.currentTarget.value) || 1))
						}
						className={cx.input}
					/>
				</label>
				<div className="flex flex-wrap items-center gap-3">
					{status === "success" ? (
						<a
							href={block.props.cartHref}
							className={cx.secondaryButton}
						>
							{block.props.successLabel}
						</a>
					) : null}
					<button
						type="button"
						disabled={disabled}
						onClick={async () => {
							if (!product) {
								return;
							}

							setStatus("loading");

							try {
								await client.addCartItem({
									catalogItemId: product.id,
									catalogItemType: product.type,
									quantity,
								});
								setStatus("success");
							} catch {
								setStatus("error");
							}
						}}
						className={cx.primaryButton}
					>
						{status === "loading" ? "Adding..." : block.props.buttonLabel}
					</button>
					{status === "error" ? (
						<span className={`text-sm ${cx.errorText}`}>
							Unable to update cart
						</span>
					) : null}
				</div>
			</div>
		</section>
	);
};

export const commerceAddToCartDefinition: WebsiteBuilderBlockDefinition<CommerceAddToCartProps> =
	defineWebsiteBuilderBlockDefinition<CommerceAddToCartProps>({
		type: "commerce-add-to-cart",
		label: "Commerce Add To Cart",
		labelKey: "commerceWebsiteBuilder.addToCart.label",
		description: "Add the current product to the active commerce cart.",
		descriptionKey: "commerceWebsiteBuilder.addToCart.description",
		category: "Commerce",
		icon: "shopping-cart",
		defaults: {
			quantityLabel: createWebsiteBuilderLocalizedDefault({
				en: "Quantity",
				ru: "Количество",
			}),
			buttonLabel: createWebsiteBuilderLocalizedDefault({
				en: "Add to cart",
				ru: "Добавить в корзину",
			}),
			successLabel: createWebsiteBuilderLocalizedDefault({
				en: "Added to cart",
				ru: "Добавлено в корзину",
			}),
			cartHref: "/cart",
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
				path: "quantityLabel",
				label: "Quantity label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "buttonLabel",
				label: "Button label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "successLabel",
				label: "Success label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartHref",
				label: "Cart URL",
				kind: "text",
				group: "data",
				localization: "shared",
			},
		],
		component: CommerceAddToCart,
	});
