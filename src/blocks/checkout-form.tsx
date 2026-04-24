"use client";

import type { CommerceCartItem, CommerceOrder } from "@init/commerce";
import { useCommerceCartStore } from "@init/commerce/client";
import {
	createPhotonFormFieldsField,
	definePhotonForm,
	PhotonForm,
	type PhotonFormFieldDefinition,
} from "@init/photon/forms";
import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	EditableText,
	EditableTextarea,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	PhotonLink,
	usePhoton,
	usePhotonCanEdit,
	usePhotonI18n,
	usePhotonValueAtPath,
} from "@init/photon/public";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Counter,
	type StepItem,
	Steps,
} from "@init/ui";
import { CheckCircle2, ReceiptText, X } from "lucide-react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import { useCommercePhotonClient } from "../client";
import { debounceCallback } from "../helpers/debounce";
import {
	type CommerceCheckoutStepKey,
	commerceCheckoutStepKeys,
	resolveCommerceCheckoutStep,
	toCommerceCheckoutStepKey,
} from "./checkout-step";
import { CommerceCheckoutSummary } from "./checkout-summary";
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
	cartCatalogLabel: string;
	cartCatalogHref: string;
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
	fields: PhotonFormFieldDefinition[];
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

const checkoutDefaultFields: PhotonFormFieldDefinition[] = [
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
const [checkoutNameField, checkoutEmailField, checkoutPhoneField] =
	checkoutDefaultFields as [
		PhotonFormFieldDefinition,
		PhotonFormFieldDefinition,
		PhotonFormFieldDefinition,
	];

const checkoutFormDefinition = definePhotonForm({
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

const checkoutFormFieldsField = createPhotonFormFieldsField("fields", {
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

const createCartSummarySteps = (locale: string) =>
	[
		{
			title: locale === "ru" ? "Корзина" : "Cart",
			description: locale === "ru" ? "Проверьте позиции" : "Review items",
		},
		{
			title: locale === "ru" ? "Оформление" : "Checkout",
			description: locale === "ru" ? "Контакты и заказ" : "Contacts and order",
		},
		{
			title: locale === "ru" ? "Готово" : "Done",
			description: locale === "ru" ? "Заказ создан" : "Order placed",
		},
	] as const;

const checkoutCartStepHref = "/checkout?checkoutStep=cart";

const isLegacyCartPageHref = (href: string) => {
	const [pathname] = href.split(/[?#]/);
	const pathSegments = (pathname ?? "").split("/").filter(Boolean);

	return pathSegments.length === 1 && pathSegments[0] === "cart";
};

const normalizeCheckoutCartHref = (href: unknown) => {
	if (typeof href !== "string") {
		return checkoutCartStepHref;
	}

	const normalizedHref = href.trim();

	return normalizedHref && !isLegacyCartPageHref(normalizedHref)
		? normalizedHref
		: checkoutCartStepHref;
};

const commerceItemImageKeys = [
	"coverImage",
	"cover_image",
	"image",
	"image_url",
	"thumbnail",
	"thumbnail_url",
	"media_url",
] as const;

const commerceItemImageObjectKeys = [
	"cover",
	"image",
	"thumbnail",
	"media",
] as const;

const readRecordString = (
	record: Record<string, unknown> | null | undefined,
	key: string,
) => {
	const value = record?.[key];

	return typeof value === "string" && value.trim() ? value.trim() : null;
};

const readImageFromRecord = (
	record: Record<string, unknown> | null | undefined,
) => {
	if (!record) {
		return null;
	}

	for (const key of commerceItemImageKeys) {
		const value = readRecordString(record, key);

		if (value) {
			return value;
		}
	}

	for (const key of commerceItemImageObjectKeys) {
		const value = record[key];

		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}

		if (typeof value === "object" && value !== null) {
			const nested = value as Record<string, unknown>;
			const nestedValue =
				readRecordString(nested, "url") ??
				readRecordString(nested, "src") ??
				readRecordString(nested, "path");

			if (nestedValue) {
				return nestedValue;
			}
		}
	}

	return null;
};

const resolveCommerceItemImage = (item: CommerceCartItem) => {
	const itemRecord = item as CommerceCartItem & Record<string, unknown>;

	return (
		readImageFromRecord(itemRecord) ??
		readImageFromRecord(item.catalog_snapshot) ??
		readImageFromRecord(item.pricing_snapshot) ??
		readImageFromRecord(item.meta)
	);
};

const CommerceOrderItemMedia = ({ item }: { item: CommerceCartItem }) => {
	const image = resolveCommerceItemImage(item);
	const name = item.name?.trim() || "Item";
	const fallbackInitial = name.slice(0, 1).toUpperCase();

	if (image) {
		return (
			<img
				src={image}
				alt=""
				className="h-14 w-14 shrink-0 rounded-md border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_72%,var(--photon-site-background))] object-cover sm:h-16 sm:w-16"
			/>
		);
	}

	return (
		<div
			aria-hidden="true"
			className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-surface)_72%,var(--photon-site-background))] text-sm font-semibold text-[var(--photon-site-accent)] sm:h-16 sm:w-16"
		>
			{fallbackInitial}
		</div>
	);
};

type CheckoutTextProps = HTMLAttributes<HTMLElement> & {
	blockId: string;
	path: string;
	as?: ElementType;
	placeholder: string;
};

const CheckoutText = ({
	blockId,
	path,
	as: Tag = "span",
	placeholder,
	className,
	...rest
}: CheckoutTextProps) => {
	const canEdit = usePhotonCanEdit();
	const value = usePhotonValueAtPath(blockId, path);
	const hasValue =
		typeof value === "string" ? value.trim() !== "" : value != null;

	if (canEdit || hasValue) {
		return (
			<EditableText
				blockId={blockId}
				path={path}
				as={Tag}
				placeholder={placeholder}
				className={className}
				{...rest}
			/>
		);
	}

	return (
		<Tag className={className} {...rest}>
			{placeholder}
		</Tag>
	);
};

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
}: PhotonBlockComponentProps<CommerceCheckoutFormProps>) => {
	const { mode, requestAuth, resources } = usePhoton();
	const { contentLocale } = usePhotonI18n();
	const authResource = resources.auth as
		| { user?: null | Record<string, unknown> }
		| undefined;
	const resourceRequestedStep = readCheckoutStepFromResources(resources);
	const [requestedStep, setRequestedStep] =
		useState<CommerceCheckoutStepKey | null>(() => resourceRequestedStep);
	const [useCompactSteps, setUseCompactSteps] = useState(false);
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
	const client = useCommercePhotonClient();
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
			debounceCallback((itemId: string, nextQuantity: number) => {
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

		const mediaQuery = window.matchMedia("(max-width: 639px)");
		const syncCompactSteps = () => setUseCompactSteps(mediaQuery.matches);

		syncCompactSteps();
		mediaQuery.addEventListener("change", syncCompactSteps);

		return () => mediaQuery.removeEventListener("change", syncCompactSteps);
	}, []);

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
		cartCatalogLabel: ru ? "Назад в каталог" : "Back to catalog",
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

	const steps: StepItem[] = [
		{
			disabled: Boolean(order),
			title: (
				<CheckoutText
					blockId={block.id}
					path="cartStepTitle"
					placeholder={getFallbackText("cartStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<CheckoutText
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
				<CheckoutText
					blockId={block.id}
					path="checkoutStepTitle"
					placeholder={getFallbackText("checkoutStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<CheckoutText
					blockId={block.id}
					path="checkoutStepDescription"
					placeholder={getFallbackText("checkoutStepDescription")}
					className="text-xs"
				/>
			),
		},
		{
			disabled: !order,
			status: order ? "finish" : undefined,
			title: (
				<CheckoutText
					blockId={block.id}
					path="doneStepTitle"
					placeholder={getFallbackText("doneStepTitle")}
					className="font-semibold"
				/>
			),
			description: (
				<CheckoutText
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
	const cartHref = normalizeCheckoutCartHref(block.props.cartHref);
	const checkoutStepHref = "/checkout?checkoutStep=checkout";
	const cartCatalogHref =
		typeof block.props.cartCatalogHref === "string" &&
		block.props.cartCatalogHref.trim()
			? block.props.cartCatalogHref
			: "/catalog";
	const accountOrdersHref =
		typeof block.props.accountOrdersHref === "string" &&
		block.props.accountOrdersHref.trim()
			? block.props.accountOrdersHref
			: "/account/orders";
	const summaryItems = cart?.items ?? [];
	const summaryCurrency = cart?.currency ?? order?.currency ?? "KZT";
	const summaryTotal = cart?.total_amount ?? order?.total_amount ?? 0;
	const orderItemNameLabel = contentLocale === "ru" ? "Наименование" : "Name";
	const orderItemQuantityLabel =
		contentLocale === "ru" ? "Количество" : "Quantity";
	const orderItemPriceLabel = contentLocale === "ru" ? "Цена" : "Price";
	const checkoutFields =
		Array.isArray(block.props.fields) && block.props.fields.length > 0
			? block.props.fields
			: [
					{
						...checkoutNameField,
						label: block.props.nameLabel ?? checkoutNameField.label,
					},
					{
						...checkoutEmailField,
						label: block.props.emailLabel ?? checkoutEmailField.label,
					},
					{
						...checkoutPhoneField,
						label: block.props.phoneLabel ?? checkoutPhoneField.label,
					},
				];
	const cartList = hasItems ? (
		<div className={`mt-8 overflow-hidden ${cx.surface}`}>
			{items.map((item) => (
				<div
					key={item.id}
					className="grid gap-4 border-b border-[color:var(--photon-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
				>
					<div className="min-w-0">
						<div className={`font-semibold ${cx.strongText}`}>{item.name}</div>
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
									const nextCart = applyItemQuantity(item.id, nextQuantity);

									if (nextCart) {
										emitCommerceCartUpdated(nextCart);
									}
								}}
								onValueCommit={(nextQuantity) =>
									setItemQuantity(item.id, nextQuantity)
								}
								className="h-10 min-w-32 border-[var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-background)_86%,black)] text-[var(--photon-site-text)]"
								buttonClassName="h-8 w-8 hover:bg-[color-mix(in_oklab,var(--photon-site-accent)_18%,transparent)]"
								valueClassName="h-8"
							/>
							<button
								type="button"
								aria-label="Remove item"
								onClick={() => setItemQuantity(item.id, 0)}
								className={`flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--photon-site-border)] transition hover:border-[var(--photon-site-accent)] hover:text-[var(--photon-site-accent)] ${cx.mutedText}`}
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
			<div
				className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${cx.mutedSurface}`}
			>
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
				<PhotonLink
					href={checkoutStepHref}
					onClick={(event) => {
						event.preventDefault();
						pushCheckoutStep(1);
					}}
					className={cx.primaryButton}
				>
					{getFallbackText("cartCheckoutLabel")}
				</PhotonLink>
			</div>
		</div>
	) : (
		<div className={cx.empty}>
			<EditableText
				blockId={block.id}
				path="cartEmptyTitle"
				className={`text-lg font-semibold ${cx.strongText}`}
			/>
			<EditableTextarea
				blockId={block.id}
				path="cartEmptyBody"
				className={`mt-3 text-sm leading-7 ${cx.mutedText}`}
			/>
			<PhotonLink
				href={cartCatalogHref}
				className={`mt-6 ${cx.secondaryButton}`}
			>
				{getFallbackText("cartCatalogLabel")}
			</PhotonLink>
		</div>
	);
	const stepItems: readonly StepItem[] = isCartStep
		? createCartSummarySteps(contentLocale)
		: steps;
	const handleStepChange =
		mode === "preview" && !isCartStep
			? (nextStep: number) => {
					if (order && nextStep !== 2) {
						return;
					}

					if ((nextStep > 0 && !hasItems) || (nextStep === 2 && !order)) {
						return;
					}

					pushCheckoutStep(nextStep);
				}
			: undefined;
	const renderCompactStep = (item: StepItem, index: number) => {
		const isActive = index === activeStepIndex;
		const isFinished = item.status === "finish" || index < activeStepIndex;
		const isDisabled = Boolean(item.disabled) || !handleStepChange;
		const clickable = !isDisabled && !isActive;
		const indicatorClass = isActive
			? "border-[var(--photon-site-accent)] text-[var(--photon-site-accent)]"
			: isFinished
				? "border-[var(--photon-site-accent)] bg-[var(--photon-site-accent)] text-[var(--photon-site-background)]"
				: "border-[color:var(--photon-site-border)] text-[var(--photon-site-muted-text)]";
		const textClass = isActive || isFinished ? cx.strongText : cx.mutedText;
		const headerClass = `relative z-10 flex w-full items-start gap-3 text-left ${clickable ? "cursor-pointer" : ""}`;
		const headerContent = (
			<>
				<span
					className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${indicatorClass}`}
				>
					{isFinished ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
				</span>
				<span className="min-w-0 pt-0.5">
					<span className={`block text-sm font-semibold ${textClass}`}>
						{item.title}
					</span>
					{item.description ? (
						<span className={`mt-1 block text-xs ${cx.mutedText}`}>
							{item.description}
						</span>
					) : null}
				</span>
			</>
		);

		return (
			<li key={index} className="relative pb-4 last:pb-0">
				{index < stepItems.length - 1 ? (
					<div className="absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px bg-[color:var(--photon-site-border)]" />
				) : null}
				{clickable ? (
					<button
						type="button"
						onClick={() => handleStepChange?.(index)}
						className={headerClass}
					>
						{headerContent}
					</button>
				) : (
					<div className={headerClass}>{headerContent}</div>
				)}
			</li>
		);
	};
	const renderCompactSteps = (from: number, to: number): ReactNode => {
		const visibleSteps = stepItems
			.map((item, index) => ({ item, index }))
			.filter(({ index }) => index >= from && index <= to);

		return visibleSteps.length > 0 ? (
			<ol className="grid gap-0 sm:hidden">
				{visibleSteps.map(({ item, index }) => renderCompactStep(item, index))}
			</ol>
		) : null;
	};

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
				<Breadcrumb className="mb-8">
					{isCartStep ? (
						<BreadcrumbList>
							<BreadcrumbItem>
								<PhotonLink href={cartCatalogHref}>
									{getFallbackText("cartCatalogLabel")}
								</PhotonLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{getFallbackText("cartTitle")}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					) : (
						<BreadcrumbList>
							<BreadcrumbItem>
								<PhotonLink href={cartHref}>
									<CheckoutText
										blockId={block.id}
										path="breadcrumbCartLabel"
										placeholder={getFallbackText("breadcrumbCartLabel")}
										className="font-medium"
									/>
								</PhotonLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>
									<CheckoutText
										blockId={block.id}
										path="breadcrumbCheckoutLabel"
										placeholder={getFallbackText("breadcrumbCheckoutLabel")}
										className="font-medium"
									/>
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					)}
				</Breadcrumb>
				{useCompactSteps ? (
					renderCompactSteps(0, activeStepIndex)
				) : (
					<Steps
						current={activeStepIndex}
						className="mb-8"
						items={stepItems}
						onChange={handleStepChange}
					/>
				)}
				<div
					className={
						useCompactSteps
							? "mb-6 ml-4 border-l border-[color:var(--photon-site-border)] pb-2 pl-5"
							: isCartStep || isDoneStep
								? ""
								: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
					}
				>
					<div>
						{isCartStep ? (
							<>
								<EditableText
									blockId={block.id}
									path="cartEyebrow"
									className={cx.eyebrow}
								/>
								<EditableText
									blockId={block.id}
									path="cartTitle"
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
								<div className="overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--photon-site-accent)_58%,var(--photon-site-border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--photon-site-accent)_18%,var(--photon-site-surface)),color-mix(in_oklab,var(--photon-site-surface)_82%,var(--photon-site-background)))]">
									<div className="grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
										<div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--photon-site-accent)] text-[var(--photon-site-background)]">
											<CheckCircle2 className="h-7 w-7" />
										</div>
										<div className="min-w-0">
											<EditableTextarea
												blockId={block.id}
												path="successBody"
												placeholder={getFallbackText("successBody")}
												className={`max-w-2xl text-base leading-7 ${cx.mutedText}`}
											/>
											<div className="mt-4 flex flex-wrap items-center gap-2">
												<span className="rounded-full border border-[color-mix(in_oklab,var(--photon-site-accent)_42%,var(--photon-site-border))] bg-[color-mix(in_oklab,var(--photon-site-background)_64%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--photon-site-accent)]">
													{order.number}
												</span>
												<span className={`text-xs ${cx.mutedText}`}>
													{order.status ?? getFallbackText("doneStepTitle")}
												</span>
											</div>
										</div>
										<PhotonLink
											href={accountOrdersHref}
											className={cx.primaryButton}
										>
											{getFallbackText("trackOrderLabel")}
										</PhotonLink>
									</div>
								</div>

								<div className={`overflow-hidden ${cx.surface}`}>
									<div className="flex flex-col gap-5 border-b border-[color:var(--photon-site-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
										<div className="flex min-w-0 items-start gap-3">
											<div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-background)_72%,transparent)] text-[var(--photon-site-accent)]">
												<ReceiptText className="h-5 w-5" />
											</div>
											<div className="min-w-0">
												<EditableText
													blockId={block.id}
													path="orderDetailsTitle"
													placeholder={getFallbackText("orderDetailsTitle")}
													className={`text-lg font-semibold ${cx.strongText}`}
												/>
												<div className={`mt-1 text-sm ${cx.mutedText}`}>
													{order.items.length}{" "}
													{contentLocale === "ru" ? "позиций" : "items"}
												</div>
											</div>
										</div>
										<div className="text-left sm:text-right">
											<div className={`text-sm ${cx.mutedText}`}>
												<EditableText
													blockId={block.id}
													path="orderTotalLabel"
													placeholder={getFallbackText("orderTotalLabel")}
												/>
											</div>
											<div
												className={`mt-1 text-2xl font-semibold ${cx.strongText}`}
											>
												{formatCommerceMoney(
													order.total_amount,
													order.currency,
													contentLocale,
												)}
											</div>
										</div>
									</div>

									<div className="divide-y divide-[color:var(--photon-site-border)]">
										<div
											className={`hidden grid-cols-[minmax(0,1fr)_7rem_11rem] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] sm:grid ${cx.mutedText}`}
										>
											<div>{orderItemNameLabel}</div>
											<div className="text-center">
												{orderItemQuantityLabel}
											</div>
											<div className="text-right">{orderItemPriceLabel}</div>
										</div>
										{order.items.map((item) => (
											<div
												key={item.id}
												className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_7rem_11rem] sm:items-center sm:p-5"
											>
												<div className="flex min-w-0 items-center gap-3">
													<CommerceOrderItemMedia item={item} />
													<div className="min-w-0">
														<div
															className={`truncate font-semibold ${cx.strongText}`}
														>
															{item.name}
														</div>
														{item.sku ? (
															<div className={`mt-1 text-xs ${cx.mutedText}`}>
																{item.sku}
															</div>
														) : null}
													</div>
												</div>
												<div className="grid grid-cols-2 gap-3 rounded-md border border-[color:var(--photon-site-border)] bg-[color-mix(in_oklab,var(--photon-site-background)_42%,transparent)] p-3 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-center">
													<div className={`text-xs sm:hidden ${cx.mutedText}`}>
														{orderItemQuantityLabel}
													</div>
													<div
														className={`text-right font-semibold sm:text-center ${cx.strongText}`}
													>
														{item.quantity}
													</div>
													<div className={`text-xs sm:hidden ${cx.mutedText}`}>
														{orderItemPriceLabel}
													</div>
													<div className="text-right sm:hidden">
														<div
															className={`text-base font-semibold ${cx.strongText}`}
														>
															{formatCommerceMoney(
																item.line_total,
																order.currency,
																contentLocale,
															)}
														</div>
														<div className={`mt-1 text-xs ${cx.mutedText}`}>
															{formatCommerceMoney(
																item.unit_price,
																order.currency,
																contentLocale,
															)}{" "}
															/ {contentLocale === "ru" ? "шт." : "unit"}
														</div>
													</div>
												</div>
												<div className="hidden text-right sm:block">
													<div
														className={`text-lg font-semibold ${cx.strongText}`}
													>
														{formatCommerceMoney(
															item.line_total,
															order.currency,
															contentLocale,
														)}
													</div>
													<div className={`mt-1 text-xs ${cx.mutedText}`}>
														{formatCommerceMoney(
															item.unit_price,
															order.currency,
															contentLocale,
														)}{" "}
														/ {contentLocale === "ru" ? "шт." : "unit"}
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						) : isCartStep ? (
							cartList
						) : (
							<PhotonForm
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
										let checkoutCart = cart;

										if (
											authResource?.user &&
											checkoutCart &&
											!checkoutCart.actor?.authenticated
										) {
											const syncResponse = await client.syncCurrentCart();
											checkoutCart = syncResponse.data;
											setCart(checkoutCart);
											emitCommerceCartUpdated(checkoutCart);
										}

										if (!checkoutCart || checkoutCart.items.length === 0) {
											throw new Error(
												"Cannot place an order from an empty cart.",
											);
										}

										const response = await client.checkout({
											cartId: checkoutCart.id,
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
										status === "saving" || !cart || cart.items.length === 0
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
							</PhotonForm>
						)}
					</div>

					{isCartStep || isDoneStep ? null : (
						<CommerceCheckoutSummary
							blockId={block.id}
							cartHref={cartHref}
							contentLocale={contentLocale}
							currency={summaryCurrency}
							emptyBody={getFallbackText("summaryEmptyBody")}
							items={summaryItems}
							returnLabel={getFallbackText("summaryReturnLabel")}
							title={getFallbackText("summaryTitle")}
							total={summaryTotal}
							totalLabel={getFallbackText("summaryTotalLabel")}
						/>
					)}
				</div>
				{useCompactSteps
					? renderCompactSteps(activeStepIndex + 1, stepItems.length - 1)
					: null}
			</div>
		</section>
	);
};

export const commerceCheckoutFormDefinition: PhotonBlockDefinition<CommerceCheckoutFormProps> =
	definePhotonBlockDefinition<CommerceCheckoutFormProps>({
		type: "commerce-checkout-form",
		label: "Commerce Checkout Form",
		labelKey: "commercePhoton.checkoutForm.label",
		description: "Checkout form that places an order from the active cart.",
		descriptionKey: "commercePhoton.checkoutForm.description",
		category: "Commerce",
		icon: "credit-card",
		defaults: {
			breadcrumbCartLabel: createPhotonLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			breadcrumbCheckoutLabel: createPhotonLocalizedDefault({
				en: "Checkout",
				ru: "Оформить заказ",
			}),
			cartEyebrow: createPhotonLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			cartTitle: createPhotonLocalizedDefault({
				en: "Your cart",
				ru: "Ваша корзина",
			}),
			cartCheckoutLabel: createPhotonLocalizedDefault({
				en: "Checkout",
				ru: "Оформить заказ",
			}),
			cartEmptyTitle: createPhotonLocalizedDefault({
				en: "Your cart is empty",
				ru: "Корзина пуста",
			}),
			cartEmptyBody: createPhotonLocalizedDefault({
				en: "Add a catalog item to start checkout.",
				ru: "Добавьте товар из каталога, чтобы перейти к оформлению.",
			}),
			cartCatalogLabel: createPhotonLocalizedDefault({
				en: "Back to catalog",
				ru: "Назад в каталог",
			}),
			cartCatalogHref: "/catalog",
			cartStepTitle: createPhotonLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			cartStepDescription: createPhotonLocalizedDefault({
				en: "Review items",
				ru: "Проверьте позиции",
			}),
			checkoutStepTitle: createPhotonLocalizedDefault({
				en: "Checkout",
				ru: "Оформление",
			}),
			checkoutStepDescription: createPhotonLocalizedDefault({
				en: "Contacts and order",
				ru: "Контакты и заказ",
			}),
			doneStepTitle: createPhotonLocalizedDefault({
				en: "Order confirmed",
				ru: "Заказ оформлен",
			}),
			doneStepDescription: createPhotonLocalizedDefault({
				en: "Order placed",
				ru: "Заказ создан",
			}),
			eyebrow: createPhotonLocalizedDefault({
				en: "Checkout",
				ru: "Оформление",
			}),
			title: createPhotonLocalizedDefault({
				en: "Place your order",
				ru: "Оформить заказ",
			}),
			body: createPhotonLocalizedDefault({
				en: "Review your active cart and leave contact details for the order snapshot.",
				ru: "Проверьте активную корзину и оставьте контактные данные для снимка заказа.",
			}),
			nameLabel: createPhotonLocalizedDefault({
				en: "Name",
				ru: "Имя",
			}),
			emailLabel: "Email",
			phoneLabel: createPhotonLocalizedDefault({
				en: "Phone",
				ru: "Телефон",
			}),
			fields: createPhotonLocalizedDefault({
				en: checkoutDefaultFields,
				ru: [
					{
						...checkoutNameField,
						label: "Имя",
					},
					{
						...checkoutEmailField,
						label: "Email",
					},
					{
						...checkoutPhoneField,
						label: "Телефон",
					},
				],
			}),
			summaryTitle: createPhotonLocalizedDefault({
				en: "Cart",
				ru: "Корзина",
			}),
			summaryTotalLabel: createPhotonLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			summaryEmptyBody: createPhotonLocalizedDefault({
				en: "Cart is empty.",
				ru: "Корзина пуста.",
			}),
			summaryReturnLabel: createPhotonLocalizedDefault({
				en: "Return to cart",
				ru: "Вернуться в корзину",
			}),
			submitLabel: createPhotonLocalizedDefault({
				en: "Place order",
				ru: "Разместить заказ",
			}),
			savingLabel: createPhotonLocalizedDefault({
				en: "Placing...",
				ru: "Размещаем...",
			}),
			errorLabel: createPhotonLocalizedDefault({
				en: "Unable to place order",
				ru: "Не удалось разместить заказ",
			}),
			successTitle: createPhotonLocalizedDefault({
				en: "Order confirmed",
				ru: "Заказ оформлен",
			}),
			successBody: createPhotonLocalizedDefault({
				en: "We saved your order and will keep its status updated in your account.",
				ru: "Мы сохранили заказ и будем обновлять его статус в личном кабинете.",
			}),
			orderDetailsTitle: createPhotonLocalizedDefault({
				en: "Order details",
				ru: "Детали заказа",
			}),
			orderNumberLabel: createPhotonLocalizedDefault({
				en: "Order number",
				ru: "Номер заказа",
			}),
			orderStatusLabel: createPhotonLocalizedDefault({
				en: "Status",
				ru: "Статус",
			}),
			orderTotalLabel: createPhotonLocalizedDefault({
				en: "Total",
				ru: "Итого",
			}),
			trackOrderLabel: createPhotonLocalizedDefault({
				en: "Track order status in your account",
				ru: "Отслеживать статус заказа в личном кабинете",
			}),
			cartHref: "/checkout?checkoutStep=cart",
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
				path: "cartCatalogLabel",
				label: "Cart catalog label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartCatalogHref",
				label: "Cart catalog URL",
				kind: "text",
				group: "data",
				localization: "shared",
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
				"cartCatalogLabel",
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
				"cartCatalogHref",
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
