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
	createWebsiteBuilderFormFieldsField,
	defineWebsiteBuilderForm,
	WebsiteBuilderForm,
	type WebsiteBuilderFormFieldDefinition,
} from "@init-modules/website-builder/forms";
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
	breadcrumbCartLabel: string;
	breadcrumbCheckoutLabel: string;
	cartEyebrow: string;
	cartTitle: string;
	cartCheckoutLabel: string;
	cartEmptyTitle: string;
	cartEmptyBody: string;
	cartStepTitle: string;
	cartStepDescription: string;
	checkoutStepTitle: string;
	checkoutStepDescription: string;
	doneStepTitle: string;
	doneStepDescription: string;
	summaryTitle: string;
	summaryTotalLabel: string;
	summaryEmptyBody: string;
	summaryReturnLabel: string;
	fields: WebsiteBuilderFormFieldDefinition[];
	nameLabel?: string;
	emailLabel?: string;
	phoneLabel?: string;
	submitLabel: string;
	savingLabel: string;
	errorLabel: string;
	successTitle: string;
	cartHref: string;
};

type CheckoutStepKey = "cart" | "checkout" | "done";

const checkoutStepKeys: CheckoutStepKey[] = ["cart", "checkout", "done"];

const checkoutDefaultFields: WebsiteBuilderFormFieldDefinition[] = [
		{
			id: "name",
			name: "name",
			type: "text",
			label: "Name",
			required: true,
			width: "full",
			locked: true,
			removable: false,
		},
		{
			id: "email",
			name: "email",
			type: "email",
			label: "Email",
			required: true,
			width: "full",
			locked: true,
			removable: false,
		},
		{
			id: "phone",
			name: "phone",
			type: "phone",
			label: "Phone",
			required: true,
			width: "full",
			locked: true,
			removable: false,
		},
	];

const checkoutFormDefinition = defineWebsiteBuilderForm({
	id: "commerce.checkout",
	mode: "extendable",
	defaultFields: checkoutDefaultFields,
	policy: {
		allowedFieldTypes: [
			"text",
			"email",
			"phone",
			"number",
			"textarea",
			"select",
			"checkbox",
			"date",
			"hidden",
		],
		requiredFieldIds: ["name", "email", "phone"],
		lockedFieldIds: ["name", "email", "phone"],
		allowAddFields: true,
		allowRemoveFields: false,
		allowReorder: true,
		allowEditFieldNames: false,
	},
});

const checkoutFormFieldsField = createWebsiteBuilderFormFieldsField("fields", {
	label: "Checkout fields",
	description:
		"Runtime checkout form schema. Required checkout identity fields stay enforced by the commerce form policy; additional fields can be added and reordered.",
	addLabel: "Add checkout field",
	allowedFieldTypes: [
		"text",
		"email",
		"phone",
		"number",
		"textarea",
		"select",
		"checkbox",
		"date",
		"hidden",
	],
	defaultItem: {
		id: "custom_field",
		name: "custom_field",
		type: "text",
		label: "Custom field",
		placeholder: "",
		helpText: "",
		required: false,
		width: "full",
		locked: false,
		removable: true,
	},
});

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

	const ru = contentLocale === "ru";
	const fallbackText = {
		breadcrumbCartLabel: ru ? "Корзина" : "Cart",
		breadcrumbCheckoutLabel: ru ? "Оформить заказ" : "Checkout",
		cartCheckoutLabel: ru ? "Оформить заказ" : "Checkout",
		cartEmptyBody: ru
			? "Добавьте товар из каталога, чтобы перейти к оформлению."
			: "Add a catalog item to start checkout.",
		cartEmptyTitle: ru ? "Корзина пуста" : "Your cart is empty",
		cartEyebrow: ru ? "Корзина" : "Cart",
		cartStepDescription: ru ? "Проверьте позиции" : "Review items",
		cartStepTitle: ru ? "Корзина" : "Cart",
		cartTitle: ru ? "Ваша корзина" : "Your cart",
		checkoutStepDescription: ru ? "Контакты и заказ" : "Contacts and order",
		checkoutStepTitle: ru ? "Оформление" : "Checkout",
		doneStepDescription: ru ? "Заказ создан" : "Order placed",
		doneStepTitle: ru ? "Готово" : "Done",
		errorLabel: ru ? "Не удалось разместить заказ" : "Unable to place order",
		savingLabel: ru ? "Размещаем..." : "Placing...",
		submitLabel: ru ? "Разместить заказ" : "Place order",
		successTitle: ru ? "Заказ создан" : "Order placed",
		summaryEmptyBody: ru ? "Корзина пуста." : "Cart is empty.",
		summaryReturnLabel: ru ? "Вернуться в корзину" : "Return to cart",
		summaryTitle: ru ? "Корзина" : "Cart",
		summaryTotalLabel: ru ? "Итого" : "Total",
	};
	const getFallbackText = (key: keyof typeof fallbackText) =>
		String(block.props[key] ?? fallbackText[key]);

	const steps = [
		{
			title: (
				<EditableText
					blockId={block.id}
					path="cartStepTitle"
					placeholder={getFallbackText("cartStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<EditableText
					blockId={block.id}
					path="cartStepDescription"
					placeholder={getFallbackText("cartStepDescription")}
					className="text-xs"
				/>
			),
		},
		{
			title: (
				<EditableText
					blockId={block.id}
					path="checkoutStepTitle"
					placeholder={getFallbackText("checkoutStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<EditableText
					blockId={block.id}
					path="checkoutStepDescription"
					placeholder={getFallbackText("checkoutStepDescription")}
					className="text-xs"
				/>
			),
		},
		{
			title: (
				<EditableText
					blockId={block.id}
					path="doneStepTitle"
					placeholder={getFallbackText("doneStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<EditableText
					blockId={block.id}
					path="doneStepDescription"
					placeholder={getFallbackText("doneStepDescription")}
					className="text-xs"
				/>
			),
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
	const checkoutFields =
		Array.isArray(block.props.fields) && block.props.fields.length > 0
			? block.props.fields
			: [
					{
						...checkoutDefaultFields[0]!,
						label: block.props.nameLabel ?? checkoutDefaultFields[0]!.label,
					},
					{
						...checkoutDefaultFields[1]!,
						label: block.props.emailLabel ?? checkoutDefaultFields[1]!.label,
					},
					{
						...checkoutDefaultFields[2]!,
						label: block.props.phoneLabel ?? checkoutDefaultFields[2]!.label,
					},
				];
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
							<EditableText
								blockId={block.id}
								path="summaryTotalLabel"
								placeholder={getFallbackText("summaryTotalLabel")}
								className={`block text-sm ${cx.mutedText}`}
							/>
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
							<EditableText
								blockId={block.id}
								path="cartCheckoutLabel"
								placeholder={getFallbackText("cartCheckoutLabel")}
								className="font-semibold"
							/>
						</button>
					</div>
				</>
			) : (
				<div className={cx.empty}>
					<EditableText
						blockId={block.id}
						path="cartEmptyTitle"
						placeholder={getFallbackText("cartEmptyTitle")}
						className={`text-lg font-semibold ${cx.strongText}`}
					/>
					<EditableTextarea
						blockId={block.id}
						path="cartEmptyBody"
						placeholder={getFallbackText("cartEmptyBody")}
						className={`mt-3 text-sm leading-7 ${cx.mutedText}`}
					/>
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
								<EditableText
									blockId={block.id}
									path="breadcrumbCartLabel"
									placeholder={getFallbackText("breadcrumbCartLabel")}
									className="font-medium"
								/>
							</WebsiteBuilderLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>
								<EditableText
									blockId={block.id}
									path="breadcrumbCheckoutLabel"
									placeholder={getFallbackText("breadcrumbCheckoutLabel")}
									className="font-medium"
								/>
							</BreadcrumbPage>
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
							<EditableText
								blockId={block.id}
								path="cartEyebrow"
								placeholder={getFallbackText("cartEyebrow")}
								className={cx.eyebrow}
							/>
							<EditableText
								blockId={block.id}
								path="cartTitle"
								placeholder={getFallbackText("cartTitle")}
								as="h1"
								className="mt-3 block text-3xl font-semibold leading-tight sm:text-5xl"
							/>
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
					{!isCartStep ? (
						<EditableTextarea
							blockId={block.id}
							path="body"
							className={`mt-4 max-w-2xl text-base leading-8 ${cx.mutedText}`}
						/>
					) : null}

					{order ? (
						<div className={`mt-8 p-5 ${cx.successPanel}`}>
							<EditableText
								blockId={block.id}
								path="successTitle"
								placeholder={getFallbackText("successTitle")}
								className="text-lg font-semibold"
							/>
							<div className={`mt-2 text-sm ${cx.mutedText}`}>
								{order.number}
							</div>
						</div>
					) : stepIndex === 0 ? (
						cartList
					) : (
						<WebsiteBuilderForm
							blockId={block.id}
							fieldsPath="fields"
							definition={checkoutFormDefinition}
							fields={checkoutFields}
							disabled={mode !== "preview" || status === "saving"}
							className="mt-8"
							classNames={{
								field: `grid gap-2 text-sm font-medium ${cx.mutedText}`,
								label: "font-medium",
								input: cx.input,
								helpText: `mt-1 text-xs leading-5 ${cx.mutedText}`,
								checkboxField: `flex items-center gap-3 text-sm font-medium ${cx.mutedText}`,
							}}
							onSubmitValues={async (values) => {
								if (mode !== "preview") {
									return;
								}

								if (!isAuthenticated) {
									requestAuth?.();
									return;
								}

								setStatus("saving");

								try {
									const response = await client.checkout({
										cartId: cart?.id,
										customerSnapshot: values,
									});
									setOrder(response.data);
									setStatus("idle");
									pushCheckoutStep(2);
								} catch {
									setStatus("error");
								}
							}}
						>
							<button
								type="submit"
								disabled={
									mode !== "preview" ||
									status === "saving" ||
									!cart ||
									cart.items.length === 0
								}
								className={`mt-2 sm:col-span-12 ${cx.primaryButton}`}
							>
								<EditableText
									blockId={block.id}
									path={status === "saving" ? "savingLabel" : "submitLabel"}
									placeholder={
										status === "saving"
											? getFallbackText("savingLabel")
											: getFallbackText("submitLabel")
									}
									className="font-semibold"
								/>
							</button>
							{status === "error" ? (
								<EditableText
									blockId={block.id}
									path="errorLabel"
									placeholder={getFallbackText("errorLabel")}
									className={`text-sm sm:col-span-12 ${cx.errorText}`}
								/>
							) : null}
						</WebsiteBuilderForm>
					)}
					</div>

					{isCartStep ? null : <aside className={`p-5 ${cx.surface}`}>
					<EditableText
						blockId={block.id}
						path="summaryTitle"
						placeholder={getFallbackText("summaryTitle")}
						className={`text-sm font-semibold ${cx.strongText}`}
					/>
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
									<EditableText
										blockId={block.id}
										path="summaryTotalLabel"
										placeholder={getFallbackText("summaryTotalLabel")}
										className="font-semibold"
									/>
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
							<EditableText
								blockId={block.id}
								path="summaryEmptyBody"
								placeholder={getFallbackText("summaryEmptyBody")}
								className={cx.mutedText}
							/>{" "}
							<WebsiteBuilderLink href={block.props.cartHref}>
								<EditableText
									blockId={block.id}
									path="summaryReturnLabel"
									placeholder={getFallbackText("summaryReturnLabel")}
									className="font-medium"
								/>
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
			breadcrumbCartLabel: createWebsiteBuilderLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			breadcrumbCheckoutLabel: createWebsiteBuilderLocalizedDefault({
				en: "Checkout",
				ru: "Оформить заказ",
			}),
			cartEyebrow: createWebsiteBuilderLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			cartTitle: createWebsiteBuilderLocalizedDefault({
				en: "Your cart",
				ru: "Ваша корзина",
			}),
			cartCheckoutLabel: createWebsiteBuilderLocalizedDefault({
				en: "Checkout",
				ru: "Оформить заказ",
			}),
			cartEmptyTitle: createWebsiteBuilderLocalizedDefault({
				en: "Your cart is empty",
				ru: "Корзина пуста",
			}),
			cartEmptyBody: createWebsiteBuilderLocalizedDefault({
				en: "Add a catalog item to start checkout.",
				ru: "Добавьте товар из каталога, чтобы перейти к оформлению.",
			}),
			cartStepTitle: createWebsiteBuilderLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			cartStepDescription: createWebsiteBuilderLocalizedDefault({
				en: "Review items",
				ru: "Проверьте позиции",
			}),
			checkoutStepTitle: createWebsiteBuilderLocalizedDefault({
				en: "Checkout",
				ru: "Оформление",
			}),
			checkoutStepDescription: createWebsiteBuilderLocalizedDefault({
				en: "Contacts and order",
				ru: "Контакты и заказ",
			}),
			doneStepTitle: createWebsiteBuilderLocalizedDefault({
				en: "Done",
				ru: "Готово",
			}),
			doneStepDescription: createWebsiteBuilderLocalizedDefault({
				en: "Order placed",
				ru: "Заказ создан",
			}),
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
			fields: createWebsiteBuilderLocalizedDefault({
				en: checkoutDefaultFields,
				ru: [
					{
						...checkoutDefaultFields[0]!,
						label: "Имя",
					},
					{
						...checkoutDefaultFields[1]!,
						label: "Email",
					},
					{
						...checkoutDefaultFields[2]!,
						label: "Телефон",
					},
				],
			}),
			summaryTitle: createWebsiteBuilderLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			summaryTotalLabel: createWebsiteBuilderLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			summaryEmptyBody: createWebsiteBuilderLocalizedDefault({
				en: "Cart is empty.",
				ru: "Корзина пуста.",
			}),
			summaryReturnLabel: createWebsiteBuilderLocalizedDefault({
				en: "Return to cart",
				ru: "Вернуться в корзину",
			}),
			submitLabel: createWebsiteBuilderLocalizedDefault({
				en: "Place order",
				ru: "Разместить заказ",
			}),
			savingLabel: createWebsiteBuilderLocalizedDefault({
				en: "Placing...",
				ru: "Размещаем...",
			}),
			errorLabel: createWebsiteBuilderLocalizedDefault({
				en: "Unable to place order",
				ru: "Не удалось разместить заказ",
			}),
			successTitle: createWebsiteBuilderLocalizedDefault({
				en: "Order placed",
				ru: "Заказ создан",
			}),
			cartHref: "/cart",
		},
		fields: [
			{
				path: "breadcrumbCartLabel",
				label: "Breadcrumb cart label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "breadcrumbCheckoutLabel",
				label: "Breadcrumb checkout label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartEyebrow",
				label: "Cart eyebrow",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartTitle",
				label: "Cart title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartCheckoutLabel",
				label: "Cart checkout label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartEmptyTitle",
				label: "Cart empty title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartEmptyBody",
				label: "Cart empty body",
				kind: "textarea",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartStepTitle",
				label: "Cart step title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartStepDescription",
				label: "Cart step description",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "checkoutStepTitle",
				label: "Checkout step title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "checkoutStepDescription",
				label: "Checkout step description",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "doneStepTitle",
				label: "Done step title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "doneStepDescription",
				label: "Done step description",
				kind: "text",
				group: "content",
				localization: "localized",
			},
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
				path: "summaryTitle",
				label: "Summary title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "summaryTotalLabel",
				label: "Summary total label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "summaryEmptyBody",
				label: "Summary empty body",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "summaryReturnLabel",
				label: "Summary return label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			checkoutFormFieldsField,
			{
				path: "submitLabel",
				label: "Submit label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "savingLabel",
				label: "Saving label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "errorLabel",
				label: "Error label",
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
		localizationSchema: {
			localized: [
				"body",
				"breadcrumbCartLabel",
				"breadcrumbCheckoutLabel",
				"cartCheckoutLabel",
				"cartEmptyBody",
				"cartEmptyTitle",
				"cartEyebrow",
				"cartStepDescription",
				"cartStepTitle",
				"cartTitle",
				"checkoutStepDescription",
				"checkoutStepTitle",
				"doneStepDescription",
				"doneStepTitle",
				"emailLabel",
				"errorLabel",
				"eyebrow",
				"fields.*.helpText",
				"fields.*.label",
				"fields.*.options.*.label",
				"fields.*.placeholder",
				"nameLabel",
				"phoneLabel",
				"savingLabel",
				"submitLabel",
				"successTitle",
				"summaryEmptyBody",
				"summaryReturnLabel",
				"summaryTitle",
				"summaryTotalLabel",
				"title",
			],
			shared: [
				"cartHref",
				"fields.*.id",
				"fields.*.locked",
				"fields.*.name",
				"fields.*.options.*.value",
				"fields.*.removable",
				"fields.*.required",
				"fields.*.type",
				"fields.*.width",
			],
		},
		component: CommerceCheckoutForm,
	});
