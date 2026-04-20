"use client";

import {
	type CommerceOrder,
	createCommerceClient,
	getCommerceRequest,
} from "@init-modules/commerce";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { shallow } from "zustand/shallow";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	formatCommerceMoney,
} from "./shared";

type CommerceCheckoutFormProps = {
	eyebrow: string;
	title: string;
	body: string;
	nameLabel: string;
	emailLabel: string;
	phoneLabel: string;
	submitLabel: string;
	successTitle: string;
	cartHref: string;
};

type CheckoutStepKey = "cart" | "checkout" | "done";

const checkoutStepKeys: CheckoutStepKey[] = ["cart", "checkout", "done"];

const readCheckoutStepIndex = () => {
	if (typeof window === "undefined") {
		return 1;
	}

	const step = new URLSearchParams(window.location.search).get("checkoutStep");
	const index = checkoutStepKeys.indexOf(step as CheckoutStepKey);

	return index >= 0 ? index : 1;
};

const CommerceCheckoutForm = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceCheckoutFormProps>) => {
	const { mode, requestAuth, resources } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const authResource = resources.auth as
		| { user?: null | Record<string, unknown> }
		| undefined;
	const isAuthenticated = Boolean(authResource?.user);
	const { applyItemQuantity, cart, setCart } = useCommerceCartStore(
		(state) => ({
			applyItemQuantity: state.applyItemQuantity,
			cart: state.cart,
			setCart: state.setCart,
		}),
		shallow,
	);
	const [order, setOrder] = useState<CommerceOrder | null>(null);
	const [stepIndex, setStepIndex] = useState(readCheckoutStepIndex);
	const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
		cart ? "idle" : "loading",
	);
	const client = useMemo(
		() => createCommerceClient(getCommerceRequest()),
		[],
	);
	const pushCheckoutStep = useCallback((nextIndex: number) => {
		const boundedIndex = Math.max(0, Math.min(checkoutStepKeys.length - 1, nextIndex));
		setStepIndex(boundedIndex);

		if (typeof window === "undefined") {
			return;
		}

		const url = new URL(window.location.href);
		url.searchParams.set("checkoutStep", checkoutStepKeys[boundedIndex]);
		window.history.pushState({ checkoutStep: checkoutStepKeys[boundedIndex] }, "", `${url.pathname}?${url.searchParams.toString()}`);
	}, []);
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
				setStatus("idle");
			} catch {
				setStatus("error");
			}
		},
		[client, mode, setCart],
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

	useEffect(() => {
		if (cart && status === "loading") {
			setStatus("idle");
		}
	}, [cart, status]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncStep = () => setStepIndex(readCheckoutStepIndex());
		window.addEventListener("popstate", syncStep);

		return () => window.removeEventListener("popstate", syncStep);
	}, []);

	useEffect(() => {
		if (mode !== "preview") {
			return;
		}

		if (cart) {
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
				emitCommerceCartUpdated(response.data);
				setStatus("idle");
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
	}, [cart, client, mode, setCart]);

	const steps = [
		{
			title: contentLocale === "ru" ? "Корзина" : "Cart",
			description:
				contentLocale === "ru" ? "Проверьте позиции" : "Review items",
		},
		{
			title: contentLocale === "ru" ? "Оформление" : "Checkout",
			description:
				contentLocale === "ru" ? "Контакты и заказ" : "Contacts and order",
		},
		{
			title: contentLocale === "ru" ? "Готово" : "Done",
			description:
				contentLocale === "ru" ? "Заказ создан" : "Order placed",
		},
	];
	const setItemQuantity = (itemId: string, nextQuantity: number) => {
		const nextCart = applyItemQuantity(itemId, nextQuantity);
		if (nextCart) {
			emitCommerceCartUpdated(nextCart);
		}
		syncItemQuantity(itemId, nextQuantity);
	};
	const items = cart?.items ?? [];
	const hasItems = items.length > 0;
	const isCartStep = !order && stepIndex === 0;
	const headerEyebrow = isCartStep
		? contentLocale === "ru"
			? "Корзина"
			: "Cart"
		: block.props.eyebrow;
	const headerTitle = isCartStep
		? contentLocale === "ru"
			? "Ваша корзина"
			: "Your cart"
		: block.props.title;
	const headerBody = isCartStep ? null : block.props.body;
	const cartList = (
		<div className={`mt-8 overflow-hidden ${cx.surface}`}>
			{hasItems ? (
				<>
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
						<button
							type="button"
							onClick={() => pushCheckoutStep(1)}
							className={cx.primaryButton}
						>
							{contentLocale === "ru" ? "Оформить заказ" : "Checkout"}
						</button>
					</div>
				</>
			) : (
				<div className={cx.empty}>
					<div className={`text-lg font-semibold ${cx.strongText}`}>
						{contentLocale === "ru" ? "Корзина пуста" : "Your cart is empty"}
					</div>
					<div className={`mt-3 text-sm leading-7 ${cx.mutedText}`}>
						{contentLocale === "ru"
							? "Добавьте товар из каталога, чтобы перейти к оформлению."
							: "Add a catalog item to start checkout."}
					</div>
				</div>
			)}
		</div>
	);

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
				<Breadcrumb className="mb-8">
					<BreadcrumbList>
						<BreadcrumbItem>
							<WebsiteBuilderLink href={block.props.cartHref}>
								{contentLocale === "ru" ? "Корзина" : "Cart"}
							</WebsiteBuilderLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{block.props.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Steps
					current={order ? 2 : stepIndex}
					className="mb-8"
					items={steps}
					onChange={(nextStep) => {
						if (nextStep === 2 && !order) {
							return;
						}

						pushCheckoutStep(nextStep);
					}}
				/>
				<div className={isCartStep ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"}>
					<div>
					{isCartStep ? (
						<>
							<div className={cx.eyebrow}>{headerEyebrow}</div>
							<h1 className="mt-3 block text-3xl font-semibold leading-tight sm:text-5xl">
								{headerTitle}
							</h1>
						</>
					) : (
						<>
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
						</>
					)}
					{headerBody ? (
						<EditableTextarea
							blockId={block.id}
							path="body"
							className={`mt-4 max-w-2xl text-base leading-8 ${cx.mutedText}`}
						/>
					) : null}

					{order ? (
						<div className={`mt-8 p-5 ${cx.successPanel}`}>
							<div className="text-lg font-semibold">
								{block.props.successTitle}
							</div>
							<div className={`mt-2 text-sm ${cx.mutedText}`}>
								{order.number}
							</div>
						</div>
					) : stepIndex === 0 ? (
						cartList
					) : (
						<form
							className="mt-8 grid gap-4"
							onSubmit={async (event) => {
								event.preventDefault();

								if (mode !== "preview") {
									return;
								}

								if (!isAuthenticated) {
									requestAuth?.();
									return;
								}

								const form = new FormData(event.currentTarget);
								setStatus("saving");

								try {
									const response = await client.checkout({
										cartId: cart?.id,
										customerSnapshot: {
											name: String(form.get("name") ?? ""),
											email: String(form.get("email") ?? ""),
											phone: String(form.get("phone") ?? ""),
										},
									});
									setOrder(response.data);
									setStatus("idle");
									pushCheckoutStep(2);
								} catch {
									setStatus("error");
								}
							}}
						>
							{[
								["name", block.props.nameLabel, "text"],
								["email", block.props.emailLabel, "email"],
								["phone", block.props.phoneLabel, "tel"],
							].map(([name, label, type]) => (
								<label
									key={name}
									className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}
								>
									{label}
									<input
										name={name}
										type={type}
										disabled={mode !== "preview" || status === "saving"}
										className={cx.input}
									/>
								</label>
							))}
							<button
								type="submit"
								disabled={
									mode !== "preview" ||
									status === "saving" ||
									!cart ||
									cart.items.length === 0
								}
								className={`mt-2 ${cx.primaryButton}`}
							>
								{status === "saving" ? "Placing..." : block.props.submitLabel}
							</button>
							{status === "error" ? (
								<div className={`text-sm ${cx.errorText}`}>
									Unable to place order
								</div>
							) : null}
						</form>
					)}
					</div>

					{isCartStep ? null : <aside className={`p-5 ${cx.surface}`}>
					<div className={`text-sm font-semibold ${cx.strongText}`}>Cart</div>
					{cart && cart.items.length > 0 ? (
						<>
							<div className="mt-4 grid gap-3">
								{cart.items.map((item) => (
									<div
										key={item.id}
										className="flex justify-between gap-4 text-sm"
									>
										<span className={`min-w-0 ${cx.mutedText}`}>
											{item.quantity} x {item.name}
										</span>
										<span className={`font-semibold ${cx.strongText}`}>
											{formatCommerceMoney(
												item.line_total,
												cart.currency,
												contentLocale,
											)}
										</span>
									</div>
								))}
							</div>
							<div className="mt-5 border-t border-[color:var(--wb-site-border)] pt-4">
								<div className="flex justify-between gap-4 text-base font-semibold">
									<span>Total</span>
									<span>
										{formatCommerceMoney(
											cart.total_amount,
											cart.currency,
											contentLocale,
										)}
									</span>
								</div>
							</div>
						</>
					) : (
						<div className={`mt-4 text-sm leading-7 ${cx.mutedText}`}>
							Cart is empty.{" "}
							<WebsiteBuilderLink href={block.props.cartHref}>
								Return to cart
							</WebsiteBuilderLink>
							.
						</div>
					)}
					</aside>}
				</div>
			</div>
		</section>
	);
};

export const commerceCheckoutFormDefinition: WebsiteBuilderBlockDefinition<CommerceCheckoutFormProps> =
	defineWebsiteBuilderBlockDefinition<CommerceCheckoutFormProps>({
		type: "commerce-checkout-form",
		label: "Commerce Checkout Form",
		labelKey: "commerceWebsiteBuilder.checkoutForm.label",
		description: "Checkout form that places an order from the active cart.",
		descriptionKey: "commerceWebsiteBuilder.checkoutForm.description",
		category: "Commerce",
		icon: "credit-card",
		defaults: {
			eyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Checkout",
				ru: "Оформление",
			}),
			title: createWebsiteBuilderLocalizedDefault({
				en: "Place your order",
				ru: "Оформить заказ",
			}),
			body: createWebsiteBuilderLocalizedDefault({
				en: "Review your active cart and leave contact details for the order snapshot.",
				ru: "Проверьте активную корзину и оставьте контактные данные для снимка заказа.",
			}),
			nameLabel: createWebsiteBuilderLocalizedDefault({
				en: "Name",
				ru: "Имя",
			}),
			emailLabel: "Email",
			phoneLabel: createWebsiteBuilderLocalizedDefault({
				en: "Phone",
				ru: "Телефон",
			}),
			submitLabel: createWebsiteBuilderLocalizedDefault({
				en: "Place order",
				ru: "Разместить заказ",
			}),
			successTitle: createWebsiteBuilderLocalizedDefault({
				en: "Order placed",
				ru: "Заказ создан",
			}),
			cartHref: "/cart",
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
				path: "nameLabel",
				label: "Name label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "emailLabel",
				label: "Email label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "phoneLabel",
				label: "Phone label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "submitLabel",
				label: "Submit label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "successTitle",
				label: "Success title",
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
		component: CommerceCheckoutForm,
	});
