"use client";

import { createCommerceClient, getCommerceRequest } from "@init/commerce";
import { useCommerceCartStore } from "@init/commerce/client";
import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	PhotonLink,
	usePhoton,
	usePhotonValueAtPath,
} from "@init/photon/public";
import { Counter } from "@init/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import { debounceCallback } from "../helpers/debounce";
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
}: PhotonBlockComponentProps<CommerceAddToCartProps>) => {
	const { mode } = usePhoton();
	const rawProduct = usePhotonValueAtPath(block.id, "product");
	const product = useMemo(
		() => normalizeCommerceProduct(rawProduct),
		[rawProduct],
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
	const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
	const cartLineRef = useRef(cartLine);
	const desiredQuantityRef = useRef<number | null>(null);
	const client = useMemo(() => createCommerceClient(getCommerceRequest()), []);
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

	const syncQuantityNow = useCallback(
		async (nextQuantity: number) => {
			if (!product || disabled) {
				return;
			}

			setStatus("loading");

			try {
				if (nextQuantity <= 0) {
					if (cartLineRef.current?.id) {
						const response = await client.removeCartItem(
							cartLineRef.current.id,
						);
						if (desiredQuantityRef.current !== nextQuantity) {
							return;
						}
						const line = findCommerceCartItem(response.data, product);
						setCart(response.data);
						emitCommerceCartUpdated(response.data);
						setCartLine(line ? { id: line.id, quantity: line.quantity } : null);
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
					setCartLine(line ? { id: line.id, quantity: line.quantity } : null);
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
					setCartLine(line ? { id: line.id, quantity: line.quantity } : null);
				}

				desiredQuantityRef.current = null;
				setStatus("idle");
			} catch {
				if (desiredQuantityRef.current !== nextQuantity) {
					return;
				}

				setStatus("error");
			}
		},
		[client, disabled, product, setCart],
	);

	const syncQuantity = useMemo(
		() =>
			debounceCallback((nextQuantity: number) => {
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

	const queueQuantity = (
		nextQuantity: number,
		options: { immediate?: boolean } = {},
	) => {
		if (disabled) {
			return;
		}

		setCartLine((currentLine) =>
			currentLine
				? { ...currentLine, quantity: nextQuantity }
				: { id: "", quantity: nextQuantity },
		);
		desiredQuantityRef.current = nextQuantity;
		if (options.immediate) {
			void syncQuantityNow(nextQuantity);
			return;
		}

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
							className="min-w-36 border-[var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-background)_86%,black)] text-[var(--photon-site-text)]"
							buttonClassName="hover:bg-[color-mix(in_oklab,var(--photon-site-accent)_18%,transparent)]"
						/>
					) : null}
					{cartLine?.quantity ? (
						<PhotonLink
							href={block.props.cartHref}
							className={cx.secondaryButton}
						>
							{block.props.successLabel}
						</PhotonLink>
					) : null}
					{!cartLine?.quantity ? (
						<button
							type="button"
							disabled={disabled}
							onClick={() => queueQuantity(1, { immediate: true })}
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

export const commerceAddToCartDefinition: PhotonBlockDefinition<CommerceAddToCartProps> =
	definePhotonBlockDefinition<CommerceAddToCartProps>({
		type: "commerce-add-to-cart",
		label: "Commerce Add To Cart",
		labelKey: "commercePhoton.addToCart.label",
		description: "Add the current product to the active commerce cart.",
		descriptionKey: "commercePhoton.addToCart.description",
		category: "Commerce",
		icon: "shopping-cart",
		defaults: {
			quantityLabel: createPhotonLocalizedDefault({
				en: "Quantity",
				ru: "Количество",
			}),
			buttonLabel: createPhotonLocalizedDefault({
				en: "Add to cart",
				ru: "Добавить в корзину",
			}),
			successLabel: createPhotonLocalizedDefault({
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
