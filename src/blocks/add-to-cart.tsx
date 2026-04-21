"use client";

import {
	createCommerceClient,
	getCommerceRequest,
} from "@init-modules/commerce";
import { useCommerceCartStore } from "@init-modules/commerce/client";
import { Counter } from "@init-modules/ui";
import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	useWebsiteBuilder,
	useWebsiteBuilderValueAtPath,
	WebsiteBuilderLink,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder/public";
import debounce from "lodash-es/debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	findCommerceCartItem,
	normalizeCommerceProduct,
} from "./shared";

type CommerceAddToCartProps = {
	quantityLabel: string;
	buttonLabel: string;
	successLabel: string;
	cartHref: string;
};

const resolveCartLine = (
	cart: Parameters<typeof findCommerceCartItem>[0] | null | undefined,
	product: Parameters<typeof findCommerceCartItem>[1] | null,
) => {
	if (!cart || !product) {
		return null;
	}

	const line = findCommerceCartItem(cart, product);

	return line
		? {
				id: line.id,
				quantity: line.quantity,
			}
		: null;
};

const CommerceAddToCart = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceAddToCartProps>) => {
	const { mode } = useWebsiteBuilder();
	const product = normalizeCommerceProduct(
		useWebsiteBuilderValueAtPath(block.id, "product"),
	);
	const productId = product?.id ?? null;
	const { cart, setCart } = useCommerceCartStore(
		(state) => ({
			cart: state.cart,
			setCart: state.setCart,
		}),
		shallow,
	);
	const [cartLine, setCartLine] = useState<null | {
		id: string;
		quantity: number;
	}>(() => resolveCartLine(cart, product));
	const [status, setStatus] = useState<
		"idle" | "loading" | "error"
	>("idle");
	const cartLineRef = useRef(cartLine);
	const desiredQuantityRef = useRef<number | null>(null);
	const client = useMemo(
		() => createCommerceClient(getCommerceRequest()),
		[],
	);
	const interactive = mode === "preview";
	const disabled = !interactive || !product;
	const loadingLabel = block.props.buttonLabel;

	useEffect(() => {
		cartLineRef.current = cartLine;
	}, [cartLine]);

	useEffect(() => {
		if (desiredQuantityRef.current !== null) {
			return;
		}

		setCartLine(resolveCartLine(cart, product));
	}, [cart, product, productId]);

	useEffect(() => {
		if (!interactive || !productId || !product) {
			return;
		}

		if (cart) {
			return;
		}

		let active = true;

		client
			.getCurrentCart()
			.then((response) => {
				if (!active) {
					return;
				}

				if (desiredQuantityRef.current !== null) {
					return;
				}

				const line = findCommerceCartItem(response.data, product);
				setCart(response.data);
				setCartLine(
					line
						? {
								id: line.id,
								quantity: line.quantity,
							}
						: null,
				);
			})
			.catch(() => undefined);

		return () => {
			active = false;
		};
	}, [cart, client, interactive, product, productId, setCart]);

	const syncQuantityNow = useCallback(async (nextQuantity: number) => {
		if (!product || disabled) {
			return;
		}

		setStatus("loading");

		try {
			if (nextQuantity <= 0) {
				if (cartLineRef.current?.id) {
					const response = await client.removeCartItem(cartLineRef.current.id);
					if (desiredQuantityRef.current !== nextQuantity) {
						return;
					}
					const line = findCommerceCartItem(response.data, product);
					setCart(response.data);
					emitCommerceCartUpdated(response.data);
					setCartLine(
						line ? { id: line.id, quantity: line.quantity } : null,
					);
				} else {
					if (desiredQuantityRef.current !== nextQuantity) {
						return;
					}
					setCartLine(null);
				}
			} else if (cartLineRef.current?.id) {
				const response = await client.updateCartItem(cartLineRef.current.id, {
					quantity: nextQuantity,
				});
				if (desiredQuantityRef.current !== nextQuantity) {
					return;
				}
				const line = findCommerceCartItem(response.data, product);
				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setCartLine(
					line ? { id: line.id, quantity: line.quantity } : null,
				);
			} else {
				const response = await client.addCartItem({
					catalogItemId: product.id,
					quantity: nextQuantity,
					replace: true,
				});
				if (desiredQuantityRef.current !== nextQuantity) {
					return;
				}
				const line = findCommerceCartItem(response.data, product);
				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setCartLine(
					line ? { id: line.id, quantity: line.quantity } : null,
				);
			}

			desiredQuantityRef.current = null;
			setStatus("idle");
		} catch {
			if (desiredQuantityRef.current !== nextQuantity) {
				return;
			}

			setStatus("error");
		}
	}, [client, disabled, product, setCart]);

	const syncQuantity = useMemo(
		() =>
			debounce((nextQuantity: number) => {
				void syncQuantityNow(nextQuantity);
			}, 350),
		[syncQuantityNow],
	);

	useEffect(
		() => () => {
			syncQuantity.cancel();
		},
		[syncQuantity],
	);

	const queueQuantity = (nextQuantity: number) => {
		if (disabled) {
			return;
		}

		setCartLine((currentLine) =>
			currentLine
				? { ...currentLine, quantity: nextQuantity }
				: { id: "", quantity: nextQuantity },
		);
		desiredQuantityRef.current = nextQuantity;
		syncQuantity(nextQuantity);
	};

	return (
		<section className={`${cx.section} py-6`}>
			<div
				className={`mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${cx.surface}`}
			>
				<div className={`text-sm font-medium ${cx.mutedText}`}>
					{cartLine?.quantity ? block.props.successLabel : null}
				</div>
				<div className="flex flex-wrap items-center justify-end gap-3">
					{cartLine?.quantity ? (
						<Counter
							value={cartLine.quantity}
							min={0}
							disabled={!interactive}
							valueLabel={block.props.quantityLabel}
							onValueChange={(nextQuantity) => {
								setCartLine((currentLine) =>
									currentLine
										? { ...currentLine, quantity: nextQuantity }
										: { id: "", quantity: nextQuantity },
								);
								desiredQuantityRef.current = nextQuantity;
							}}
							onValueCommit={syncQuantity}
							className="min-w-36 border-[var(--wb-site-border)] bg-[color-mix(in_oklab,var(--wb-site-background)_86%,black)] text-[var(--wb-site-text)]"
							buttonClassName="hover:bg-[color-mix(in_oklab,var(--wb-site-accent)_18%,transparent)]"
						/>
					) : null}
					{cartLine?.quantity ? (
						<WebsiteBuilderLink
							href={block.props.cartHref}
							className={cx.secondaryButton}
						>
							{block.props.successLabel}
						</WebsiteBuilderLink>
					) : null}
					{!cartLine?.quantity ? (
						<button
							type="button"
							disabled={disabled}
							onClick={() => queueQuantity(1)}
							className={cx.primaryButton}
						>
							{status === "loading" ? loadingLabel : block.props.buttonLabel}
						</button>
					) : null}
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
