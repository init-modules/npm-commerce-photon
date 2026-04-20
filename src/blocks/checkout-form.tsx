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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	formatCommerceMoney,
} from "./shared";
import {
	commerceCheckoutStepKeys,
	resolveCommerceCheckoutStep,
	toCommerceCheckoutStepKey,
	type CommerceCheckoutStepKey,
} from "./checkout-step";

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
	successBody: string;
	orderDetailsTitle: string;
	orderNumberLabel: string;
	orderStatusLabel: string;
	orderTotalLabel: string;
	trackOrderLabel: string;
	cartHref: string;
	accountOrdersHref: string;
};

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

const readCheckoutStepFromLocation = (): CommerceCheckoutStepKey | null => {
	if (typeof window === "undefined") {
		return null;
	}

	return toCommerceCheckoutStepKey(
		new URLSearchParams(window.location.search).get("checkoutStep"),
	);
};

const readCheckoutStepFromResources = (
	resources: Record<string, unknown>,
): CommerceCheckoutStepKey | null => {
	const commerceCheckout = resources.commerceCheckout;

	if (typeof commerceCheckout !== "object" || commerceCheckout === null) {
		return null;
	}

	return toCommerceCheckoutStepKey(
		(commerceCheckout as { requestedStep?: unknown }).requestedStep,
	);
};

const CommerceCheckoutForm = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceCheckoutFormProps>) => {
	const { mode, requestAuth, resources } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const authResource = resources.auth as
		| { user?: null | Record<string, unknown> }
		| undefined;
	const resourceRequestedStep = readCheckoutStepFromResources(resources);
	const [requestedStep, setRequestedStep] =
		useState<CommerceCheckoutStepKey | null>(() => resourceRequestedStep);
	const { applyItemQuantity, cart, setCart } = useCommerceCartStore(
		(state) => ({
			applyItemQuantity: state.applyItemQuantity,
			cart: state.cart,
			setCart: state.setCart,
		}),
		shallow,
	);
	const isAuthenticated =
		Boolean(authResource?.user) || Boolean(cart?.actor?.authenticated);
	const [order, setOrder] = useState<CommerceOrder | null>(null);
	const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
		cart ? "idle" : "loading",
	);
	const desiredItemQuantitiesRef = useRef(new Map<string, number>());
	const client = useMemo(
		() => createCommerceClient(getCommerceRequest()),
		[],
	);
	const writeCheckoutStep = useCallback(
		(nextIndex: number, method: "push" | "replace") => {
			const boundedIndex = Math.max(
				0,
				Math.min(commerceCheckoutStepKeys.length - 1, nextIndex),
			);
			const step = commerceCheckoutStepKeys[boundedIndex] ?? "checkout";
			setRequestedStep(step);

			if (typeof window === "undefined") {
				return;
			}

			const url = new URL(window.location.href);
			url.searchParams.set("checkoutStep", step);
			const nextHref = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;

			if (
				`${window.location.pathname}${window.location.search}${window.location.hash}` ===
				nextHref
			) {
				return;
			}

			if (method === "replace") {
				window.history.replaceState({ checkoutStep: step }, "", nextHref);
				return;
			}

			window.history.pushState({ checkoutStep: step }, "", nextHref);
		},
		[],
	);
	const pushCheckoutStep = useCallback(
		(nextIndex: number) => writeCheckoutStep(nextIndex, "push"),
		[writeCheckoutStep],
	);
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

				if (desiredItemQuantitiesRef.current.get(itemId) !== nextQuantity) {
					return;
				}

				desiredItemQuantitiesRef.current.delete(itemId);
				setCart(response.data);
				emitCommerceCartUpdated(response.data);
				setStatus("idle");
			} catch {
				if (desiredItemQuantitiesRef.current.get(itemId) !== nextQuantity) {
					return;
				}

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

		const syncStep = () => setRequestedStep(readCheckoutStepFromLocation());
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

		if (order) {
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
	}, [cart, client, mode, order, setCart]);

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
		doneStepTitle: ru ? "Заказ оформлен" : "Order confirmed",
		errorLabel: ru ? "Не удалось разместить заказ" : "Unable to place order",
		orderDetailsTitle: ru ? "Детали заказа" : "Order details",
		orderNumberLabel: ru ? "Номер заказа" : "Order number",
		orderStatusLabel: ru ? "Статус" : "Status",
		orderTotalLabel: ru ? "Итого" : "Total",
		savingLabel: ru ? "Размещаем..." : "Placing...",
		submitLabel: ru ? "Разместить заказ" : "Place order",
		successBody: ru
			? "Мы сохранили заказ и будем обновлять его статус в личном кабинете."
			: "We saved your order and will keep its status updated in your account.",
		successTitle: ru ? "Заказ оформлен" : "Order confirmed",
		summaryEmptyBody: ru ? "Корзина пуста." : "Cart is empty.",
		summaryReturnLabel: ru ? "Вернуться в корзину" : "Return to cart",
		summaryTitle: ru ? "Корзина" : "Cart",
		summaryTotalLabel: ru ? "Итого" : "Total",
		trackOrderLabel: ru
			? "Отслеживать статус заказа в личном кабинете"
			: "Track order status in your account",
	};
	const getFallbackText = (key: keyof typeof fallbackText) =>
		String(block.props[key] ?? fallbackText[key]);
	const items = cart?.items ?? [];
	const hasItems = items.length > 0;
	const activeStep = resolveCommerceCheckoutStep({
		hasItems,
		hasOrder: Boolean(order),
		requestedStep,
	});
	const activeStepIndex = commerceCheckoutStepKeys.indexOf(activeStep);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const browserRequestedStep = readCheckoutStepFromLocation();

		if (browserRequestedStep && browserRequestedStep !== activeStep) {
			writeCheckoutStep(activeStepIndex, "replace");
		}
	}, [activeStep, activeStepIndex, writeCheckoutStep]);

	const steps = [
		{
			disabled: Boolean(order),
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
			disabled: Boolean(order) || !hasItems,
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
			disabled: !order,
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
		desiredItemQuantitiesRef.current.set(itemId, nextQuantity);
		const nextCart = applyItemQuantity(itemId, nextQuantity);
		if (nextCart) {
			emitCommerceCartUpdated(nextCart);
		}
		syncItemQuantity(itemId, nextQuantity);
	};
	const isDoneStep = activeStep === "done";
	const isCartStep = activeStep === "cart";
	const cartHref =
		typeof block.props.cartHref === "string" && block.props.cartHref.trim()
			? block.props.cartHref
			: "/cart";
	const accountOrdersHref =
		typeof block.props.accountOrdersHref === "string" &&
		block.props.accountOrdersHref.trim()
			? block.props.accountOrdersHref
			: "/account/orders";
	const orderItems = order?.items ?? [];
	const orderCurrency = order?.currency ?? cart?.currency ?? "KZT";
	const orderTotal = order?.total_amount ?? cart?.total_amount ?? 0;
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
	const cartList = hasItems ? (
		<div className={`mt-8 overflow-hidden ${cx.surface}`}>
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
		</div>
	) : (
		<div className={`mt-8 rounded-lg bg-[color-mix(in_oklab,var(--wb-site-surface)_58%,var(--wb-site-background))] px-6 py-10 text-center`}>
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
	);

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
				<Breadcrumb className="mb-8">
					<BreadcrumbList>
						<BreadcrumbItem>
							<WebsiteBuilderLink href={cartHref}>
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
					current={activeStepIndex}
					className="mb-8"
					items={steps}
					onChange={
						mode === "preview"
							? (nextStep) => {
									if (order && nextStep !== 2) {
										return;
									}

									if ((nextStep > 0 && !hasItems) || (nextStep === 2 && !order)) {
										return;
									}

									pushCheckoutStep(nextStep);
								}
							: undefined
					}
				/>
				<div className={isCartStep || isDoneStep ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"}>
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
					) : isDoneStep ? (
						<>
							<EditableText
								blockId={block.id}
								path="eyebrow"
								className={cx.eyebrow}
							/>
							<EditableText
								blockId={block.id}
								path="successTitle"
								placeholder={getFallbackText("successTitle")}
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
					{!isCartStep && !isDoneStep ? (
						<EditableTextarea
							blockId={block.id}
							path="body"
							className={`mt-4 max-w-2xl text-base leading-8 ${cx.mutedText}`}
						/>
					) : null}

					{order ? (
						<div className="mt-8 grid gap-6">
							<div className={`p-5 ${cx.successPanel}`}>
								<EditableTextarea
									blockId={block.id}
									path="successBody"
									placeholder={getFallbackText("successBody")}
									className={`max-w-2xl text-base leading-7 ${cx.mutedText}`}
								/>
								<div className="mt-5">
									<WebsiteBuilderLink
										href={accountOrdersHref}
										className={cx.primaryButton}
									>
										<EditableText
											blockId={block.id}
											path="trackOrderLabel"
											placeholder={getFallbackText("trackOrderLabel")}
											className="font-semibold"
										/>
									</WebsiteBuilderLink>
								</div>
							</div>
							<div className={`overflow-hidden ${cx.surface}`}>
								<div className="border-b border-[color:var(--wb-site-border)] p-5">
									<EditableText
										blockId={block.id}
										path="orderDetailsTitle"
										placeholder={getFallbackText("orderDetailsTitle")}
										className={`text-lg font-semibold ${cx.strongText}`}
									/>
									<dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
										<div>
											<dt className={cx.mutedText}>
												<EditableText
													blockId={block.id}
													path="orderNumberLabel"
													placeholder={getFallbackText("orderNumberLabel")}
												/>
											</dt>
											<dd className={`mt-1 font-semibold ${cx.strongText}`}>
												{order.number}
											</dd>
										</div>
										<div>
											<dt className={cx.mutedText}>
												<EditableText
													blockId={block.id}
													path="orderStatusLabel"
													placeholder={getFallbackText("orderStatusLabel")}
												/>
											</dt>
											<dd className={`mt-1 font-semibold ${cx.strongText}`}>
												{order.status ?? getFallbackText("doneStepTitle")}
											</dd>
										</div>
										<div>
											<dt className={cx.mutedText}>
												<EditableText
													blockId={block.id}
													path="orderTotalLabel"
													placeholder={getFallbackText("orderTotalLabel")}
												/>
											</dt>
											<dd className={`mt-1 font-semibold ${cx.strongText}`}>
												{formatCommerceMoney(
													order.total_amount,
													order.currency,
													contentLocale,
												)}
											</dd>
										</div>
									</dl>
								</div>
								<div className="divide-y divide-[color:var(--wb-site-border)]">
									{order.items.map((item) => (
										<div
											key={item.id}
											className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto]"
										>
											<div className="min-w-0">
												<div className={`font-semibold ${cx.strongText}`}>
													{item.name}
												</div>
												<div className={`mt-1 text-sm ${cx.mutedText}`}>
													{item.quantity} x{" "}
													{formatCommerceMoney(
														item.unit_price,
														order.currency,
														contentLocale,
													)}
												</div>
											</div>
											<div className={`font-semibold ${cx.strongText}`}>
												{formatCommerceMoney(
													item.line_total,
													order.currency,
													contentLocale,
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					) : isCartStep ? (
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
									setCart(null);
									emitCommerceCartUpdated(null);
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

					{isCartStep || isDoneStep ? null : <aside className={`p-5 ${cx.surface}`}>
					<EditableText
						blockId={block.id}
						path="summaryTitle"
						placeholder={getFallbackText("summaryTitle")}
						className={`text-sm font-semibold ${cx.strongText}`}
					/>
					{cart && cart.items.length > 0 ? (
						<>
							<div className="mt-4 grid gap-3">
								{orderItems.map((item) => (
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
												orderCurrency,
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
											orderTotal,
											orderCurrency,
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
							<WebsiteBuilderLink href={cartHref}>
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
				en: "Order confirmed",
				ru: "Заказ оформлен",
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
				en: "Order confirmed",
				ru: "Заказ оформлен",
			}),
			successBody: createWebsiteBuilderLocalizedDefault({
				en: "We saved your order and will keep its status updated in your account.",
				ru: "Мы сохранили заказ и будем обновлять его статус в личном кабинете.",
			}),
			orderDetailsTitle: createWebsiteBuilderLocalizedDefault({
				en: "Order details",
				ru: "Детали заказа",
			}),
			orderNumberLabel: createWebsiteBuilderLocalizedDefault({
				en: "Order number",
				ru: "Номер заказа",
			}),
			orderStatusLabel: createWebsiteBuilderLocalizedDefault({
				en: "Status",
				ru: "Статус",
			}),
			orderTotalLabel: createWebsiteBuilderLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			trackOrderLabel: createWebsiteBuilderLocalizedDefault({
				en: "Track order status in your account",
				ru: "Отслеживать статус заказа в личном кабинете",
			}),
			cartHref: "/cart",
			accountOrdersHref: "/account/orders",
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
				path: "successBody",
				label: "Success body",
				kind: "textarea",
				group: "content",
				localization: "localized",
			},
			{
				path: "orderDetailsTitle",
				label: "Order details title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "orderNumberLabel",
				label: "Order number label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "orderStatusLabel",
				label: "Order status label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "orderTotalLabel",
				label: "Order total label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "trackOrderLabel",
				label: "Track order label",
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
			{
				path: "accountOrdersHref",
				label: "Account orders URL",
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
				"orderDetailsTitle",
				"orderNumberLabel",
				"orderStatusLabel",
				"orderTotalLabel",
				"phoneLabel",
				"savingLabel",
				"submitLabel",
				"successBody",
				"successTitle",
				"summaryEmptyBody",
				"summaryReturnLabel",
				"summaryTitle",
				"summaryTotalLabel",
				"title",
				"trackOrderLabel",
			],
			shared: [
				"accountOrdersHref",
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
