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
} from "@init/ui";
import { CheckCircle2, X } from "lucide-react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { shallow } from "zustand/shallow";
import { useCommercePhotonClient } from "../client";
import { debounceCallback } from "../helpers/debounce";
import {
	commerceBlockClassNames as cx,
	emitCommerceCartUpdated,
	formatCommerceMoney,
} from "./shared";

export type CommerceCheckoutStepKind =
	| "cart"
	| "delivery"
	| "payment"
	| "review"
	| "confirm";

export type CommerceCheckoutStepConfig = {
	id: string;
	kind: CommerceCheckoutStepKind;
	enabled: boolean;
	label: string;
};

export type CommerceCheckoutPaymentTypeKind =
	| "cash"
	| "card-online"
	| "kaspi"
	| "custom";

export type CommerceCheckoutPaymentType = {
	id: string;
	label: string;
	kind: CommerceCheckoutPaymentTypeKind;
};

export type CommerceCheckoutDeliveryTypeKind = "delivery" | "pickup";

export type CommerceCheckoutDeliveryType = {
	id: string;
	label: string;
	kind: CommerceCheckoutDeliveryTypeKind;
};

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
	steps: CommerceCheckoutStepConfig[];
	paymentTypes: CommerceCheckoutPaymentType[];
	deliveryTypes: CommerceCheckoutDeliveryType[];
	mapEmbedUrl: string;
	promoEnabled: boolean;
	minOrderAmount: number;
	nextLabel?: string;
	prevLabel?: string;
	deliveryAddressLabel?: string;
	deliveryAddressPlaceholder?: string;
	pickupPointLabel?: string;
	pickupPointPlaceholder?: string;
	promoCodeLabel?: string;
	promoCodePlaceholder?: string;
	commentLabel?: string;
	commentPlaceholder?: string;
	reviewTitle?: string;
	reviewDeliveryLabel?: string;
	reviewPaymentLabel?: string;
	reviewContactLabel?: string;
	confirmCtaLabel?: string;
	confirmCtaHref?: string;
	minOrderWarningLabel?: string;
	cartHeadingLabel?: string;
	continueShoppingLabel?: string;
};

export type CommerceCheckoutFormData = {
	delivery: { typeId?: string; address?: string; pickupPointId?: string };
	payment: { typeId?: string; promoCode?: string };
	contact: { name?: string; phone?: string; email?: string; comment?: string };
};

const defaultCheckoutSteps: CommerceCheckoutStepConfig[] = [
	{ id: "cart", kind: "cart", enabled: true, label: "Cart" },
	{ id: "delivery", kind: "delivery", enabled: true, label: "Delivery" },
	{ id: "payment", kind: "payment", enabled: true, label: "Payment" },
	{ id: "review", kind: "review", enabled: true, label: "Review" },
	{ id: "confirm", kind: "confirm", enabled: true, label: "Confirm" },
];

type CheckoutFormDataAction =
	| {
			type: "set-delivery";
			value: Partial<CommerceCheckoutFormData["delivery"]>;
	  }
	| {
			type: "set-payment";
			value: Partial<CommerceCheckoutFormData["payment"]>;
	  }
	| {
			type: "set-contact";
			value: Partial<CommerceCheckoutFormData["contact"]>;
	  }
	| { type: "reset" };

const checkoutFormDataInitial: CommerceCheckoutFormData = {
	delivery: {},
	payment: {},
	contact: {},
};

const checkoutFormDataReducer = (
	state: CommerceCheckoutFormData,
	action: CheckoutFormDataAction,
): CommerceCheckoutFormData => {
	switch (action.type) {
		case "set-delivery":
			return { ...state, delivery: { ...state.delivery, ...action.value } };
		case "set-payment":
			return { ...state, payment: { ...state.payment, ...action.value } };
		case "set-contact":
			return { ...state, contact: { ...state.contact, ...action.value } };
		case "reset":
			return checkoutFormDataInitial;
		default:
			return state;
	}
};

type CheckoutValidation = {
	valid: boolean;
	errors: Record<string, string>;
};

const validateStep = (
	stepKind: CommerceCheckoutStepKind,
	formData: CommerceCheckoutFormData,
	deliveryTypes: CommerceCheckoutDeliveryType[],
	paymentTypes: CommerceCheckoutPaymentType[],
): CheckoutValidation => {
	const errors: Record<string, string> = {};

	if (stepKind === "delivery" && deliveryTypes.length > 0) {
		if (!formData.delivery.typeId) {
			errors.typeId = "Select a delivery option";
		} else {
			const selected = deliveryTypes.find(
				(item) => item.id === formData.delivery.typeId,
			);
			if (selected?.kind === "delivery" && !formData.delivery.address?.trim()) {
				errors.address = "Address is required";
			}
			if (
				selected?.kind === "pickup" &&
				!formData.delivery.pickupPointId?.trim()
			) {
				errors.pickupPointId = "Pickup point is required";
			}
		}
	}

	if (stepKind === "payment" && paymentTypes.length > 0) {
		if (!formData.payment.typeId) {
			errors.typeId = "Select a payment method";
		}
	}

	if (stepKind === "review") {
		if (!formData.contact.name?.trim()) {
			errors.name = "Name is required";
		}
		if (!formData.contact.phone?.trim()) {
			errors.phone = "Phone is required";
		}
	}

	return { valid: Object.keys(errors).length === 0, errors };
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


const readCheckoutStepIdFromLocation = (): string | null => {
	if (typeof window === "undefined") {
		return null;
	}

	return new URLSearchParams(window.location.search).get("checkoutStep");
};

const writeCheckoutStepToLocation = (
	stepId: string,
	method: "push" | "replace",
) => {
	if (typeof window === "undefined") {
		return;
	}

	const url = new URL(window.location.href);
	url.searchParams.set("checkoutStep", stepId);
	const nextHref = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;

	if (
		`${window.location.pathname}${window.location.search}${window.location.hash}` ===
		nextHref
	) {
		return;
	}

	if (method === "replace") {
		window.history.replaceState({ checkoutStep: stepId }, "", nextHref);
		return;
	}

	window.history.pushState({ checkoutStep: stepId }, "", nextHref);
};

const resolveEnabledCheckoutSteps = (
	steps: CommerceCheckoutStepConfig[] | undefined,
): CommerceCheckoutStepConfig[] => {
	const source = Array.isArray(steps) && steps.length > 0 ? steps : defaultCheckoutSteps;
	return source.filter((step) => step.enabled !== false);
};

const findCheckoutStepIndexById = (
	enabled: CommerceCheckoutStepConfig[],
	stepId: string | null,
): number => {
	if (!stepId) return -1;
	const directIndex = enabled.findIndex((step) => step.id === stepId);
	if (directIndex >= 0) return directIndex;
	const kindIndex = enabled.findIndex((step) => step.kind === stepId);
	return kindIndex;
};

type CartLineItemsProps = {
	items: CommerceCartItem[];
	currency: string;
	contentLocale: string;
	applyItemQuantity: (itemId: string, nextQuantity: number) => unknown;
	setItemQuantity: (itemId: string, nextQuantity: number) => void;
};

const CartLineItems = ({
	items,
	currency,
	contentLocale,
	applyItemQuantity,
	setItemQuantity,
}: CartLineItemsProps) => (
	<div className={`overflow-hidden ${cx.surface}`}>
		{items.map((item) => (
			<div
				key={item.id}
				className="grid gap-4 border-b border-[color:var(--photon-site-border)] p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
			>
				<div className="min-w-0">
					<div className={`font-semibold ${cx.strongText}`}>{item.name}</div>
					<div className={`mt-1 text-sm ${cx.mutedText}`}>
						{formatCommerceMoney(item.unit_price, currency, contentLocale)}
					</div>
					<div className="mt-4 flex items-center gap-3">
						<Counter
							value={item.quantity}
							min={0}
							valueLabel={item.name ?? "Quantity"}
							onValueChange={(nextQuantity) => {
								const nextCart = applyItemQuantity(item.id, nextQuantity);
								if (nextCart) {
									emitCommerceCartUpdated(nextCart as never);
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
					{formatCommerceMoney(item.line_total, currency, contentLocale)}
				</div>
			</div>
		))}
	</div>
);

type DeliveryStepProps = {
	deliveryTypes: CommerceCheckoutDeliveryType[];
	mapEmbedUrl: string;
	delivery: CommerceCheckoutFormData["delivery"];
	errors: Record<string, string>;
	addressLabel: string;
	addressPlaceholder: string;
	pickupLabel: string;
	pickupPlaceholder: string;
	onUpdate: (value: Partial<CommerceCheckoutFormData["delivery"]>) => void;
};

const DeliveryStep = ({
	deliveryTypes,
	mapEmbedUrl,
	delivery,
	errors,
	addressLabel,
	addressPlaceholder,
	pickupLabel,
	pickupPlaceholder,
	onUpdate,
}: DeliveryStepProps) => {
	const selected = deliveryTypes.find((item) => item.id === delivery.typeId);

	return (
		<div className="grid gap-5">
			{deliveryTypes.length === 0 ? (
				<div className={`${cx.empty} text-sm`}>
					{/* TODO: configure deliveryTypes via inspector */}
					No delivery options configured.
				</div>
			) : (
				<div className="flex flex-wrap gap-2">
					{deliveryTypes.map((item) => {
						const active = delivery.typeId === item.id;
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => onUpdate({ typeId: item.id })}
								className={
									active
										? cx.primaryButton
										: cx.secondaryButton
								}
							>
								{item.label}
							</button>
						);
					})}
				</div>
			)}
			{errors.typeId ? (
				<div className={`text-sm ${cx.errorText}`}>{errors.typeId}</div>
			) : null}

			{selected?.kind === "delivery" ? (
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{addressLabel}</span>
					<input
						type="text"
						value={delivery.address ?? ""}
						placeholder={addressPlaceholder}
						onChange={(event) => onUpdate({ address: event.target.value })}
						className={cx.input}
					/>
					{errors.address ? (
						<span className={`text-xs ${cx.errorText}`}>{errors.address}</span>
					) : null}
				</label>
			) : null}

			{selected?.kind === "pickup" ? (
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{pickupLabel}</span>
					{/* TODO: read pickup points from binding source `commerce.pickupPoints` */}
					<input
						type="text"
						value={delivery.pickupPointId ?? ""}
						placeholder={pickupPlaceholder}
						onChange={(event) => onUpdate({ pickupPointId: event.target.value })}
						className={cx.input}
					/>
					{errors.pickupPointId ? (
						<span className={`text-xs ${cx.errorText}`}>
							{errors.pickupPointId}
						</span>
					) : null}
				</label>
			) : null}

			{mapEmbedUrl ? (
				<iframe
					src={mapEmbedUrl}
					title="Delivery area map"
					className="h-72 w-full rounded-lg border border-[color:var(--photon-site-border)]"
				/>
			) : null}
		</div>
	);
};

type PaymentStepProps = {
	paymentTypes: CommerceCheckoutPaymentType[];
	promoEnabled: boolean;
	payment: CommerceCheckoutFormData["payment"];
	errors: Record<string, string>;
	promoLabel: string;
	promoPlaceholder: string;
	onUpdate: (value: Partial<CommerceCheckoutFormData["payment"]>) => void;
};

const PaymentStep = ({
	paymentTypes,
	promoEnabled,
	payment,
	errors,
	promoLabel,
	promoPlaceholder,
	onUpdate,
}: PaymentStepProps) => {
	const selected = paymentTypes.find((item) => item.id === payment.typeId);

	return (
		<div className="grid gap-5">
			{paymentTypes.length === 0 ? (
				<div className={`${cx.empty} text-sm`}>
					{/* TODO: configure paymentTypes via inspector */}
					No payment methods configured.
				</div>
			) : (
				<div className="grid gap-2">
					{paymentTypes.map((item) => {
						const active = payment.typeId === item.id;
						return (
							<label
								key={item.id}
								className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
									active
										? "border-[var(--photon-site-accent)] bg-[color-mix(in_oklab,var(--photon-site-accent)_8%,var(--photon-site-surface))]"
										: "border-[color:var(--photon-site-border)] bg-[var(--photon-site-surface)]"
								}`}
							>
								<input
									type="radio"
									name="commerce-checkout-payment"
									checked={active}
									onChange={() => onUpdate({ typeId: item.id })}
								/>
								<span className={cx.strongText}>{item.label}</span>
							</label>
						);
					})}
				</div>
			)}
			{errors.typeId ? (
				<div className={`text-sm ${cx.errorText}`}>{errors.typeId}</div>
			) : null}

			{selected?.kind === "card-online" ? (
				<div className={`${cx.surface} p-3 text-xs ${cx.mutedText}`}>
					{/* TODO: integrate payment provider */}
					Card payment integration pending.
				</div>
			) : null}

			{promoEnabled ? (
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{promoLabel}</span>
					<input
						type="text"
						value={payment.promoCode ?? ""}
						placeholder={promoPlaceholder}
						onChange={(event) => onUpdate({ promoCode: event.target.value })}
						className={cx.input}
					/>
				</label>
			) : null}
		</div>
	);
};

type ReviewStepProps = {
	formData: CommerceCheckoutFormData;
	deliveryTypes: CommerceCheckoutDeliveryType[];
	paymentTypes: CommerceCheckoutPaymentType[];
	cartTotal: number | string | null | undefined;
	currency: string;
	contentLocale: string;
	errors: Record<string, string>;
	deliveryLabel: string;
	paymentLabel: string;
	contactLabel: string;
	totalLabel: string;
	nameLabel: string;
	phoneLabel: string;
	emailLabel: string;
	commentLabel: string;
	commentPlaceholder: string;
	onUpdate: (value: Partial<CommerceCheckoutFormData["contact"]>) => void;
};

const ReviewStep = ({
	formData,
	deliveryTypes,
	paymentTypes,
	cartTotal,
	currency,
	contentLocale,
	errors,
	deliveryLabel,
	paymentLabel,
	contactLabel,
	totalLabel,
	nameLabel,
	phoneLabel,
	emailLabel,
	commentLabel,
	commentPlaceholder,
	onUpdate,
}: ReviewStepProps) => {
	const deliveryType = deliveryTypes.find(
		(item) => item.id === formData.delivery.typeId,
	);
	const paymentType = paymentTypes.find(
		(item) => item.id === formData.payment.typeId,
	);

	return (
		<div className="grid gap-5">
			<div className={`grid gap-3 p-4 ${cx.surface}`}>
				<div className={`text-xs uppercase tracking-wider ${cx.mutedText}`}>
					{deliveryLabel}
				</div>
				<div className={`text-sm ${cx.strongText}`}>
					{deliveryType?.label ?? "—"}
					{formData.delivery.address ? ` · ${formData.delivery.address}` : ""}
					{formData.delivery.pickupPointId
						? ` · ${formData.delivery.pickupPointId}`
						: ""}
				</div>
			</div>
			<div className={`grid gap-3 p-4 ${cx.surface}`}>
				<div className={`text-xs uppercase tracking-wider ${cx.mutedText}`}>
					{paymentLabel}
				</div>
				<div className={`text-sm ${cx.strongText}`}>
					{paymentType?.label ?? "—"}
					{formData.payment.promoCode ? ` · ${formData.payment.promoCode}` : ""}
				</div>
			</div>

			<div className={`grid gap-4 p-4 ${cx.surface}`}>
				<div className={`text-xs uppercase tracking-wider ${cx.mutedText}`}>
					{contactLabel}
				</div>
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{nameLabel}</span>
					<input
						type="text"
						value={formData.contact.name ?? ""}
						onChange={(event) => onUpdate({ name: event.target.value })}
						className={cx.input}
					/>
					{errors.name ? (
						<span className={`text-xs ${cx.errorText}`}>{errors.name}</span>
					) : null}
				</label>
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{phoneLabel}</span>
					<input
						type="tel"
						value={formData.contact.phone ?? ""}
						onChange={(event) => onUpdate({ phone: event.target.value })}
						className={cx.input}
					/>
					{errors.phone ? (
						<span className={`text-xs ${cx.errorText}`}>{errors.phone}</span>
					) : null}
				</label>
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{emailLabel}</span>
					<input
						type="email"
						value={formData.contact.email ?? ""}
						onChange={(event) => onUpdate({ email: event.target.value })}
						className={cx.input}
					/>
				</label>
				<label className={`grid gap-2 text-sm font-medium ${cx.mutedText}`}>
					<span className="font-medium">{commentLabel}</span>
					<textarea
						value={formData.contact.comment ?? ""}
						placeholder={commentPlaceholder}
						onChange={(event) => onUpdate({ comment: event.target.value })}
						className={`${cx.input} h-24 py-2`}
					/>
				</label>
			</div>

			<div
				className={`flex items-center justify-between rounded-lg p-4 ${cx.mutedSurface}`}
			>
				<div className={`text-sm ${cx.mutedText}`}>{totalLabel}</div>
				<div className={`text-2xl font-semibold ${cx.strongText}`}>
					{formatCommerceMoney(cartTotal, currency, contentLocale)}
				</div>
			</div>
		</div>
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
	const enabledSteps = useMemo(
		() => resolveEnabledCheckoutSteps(block.props.steps),
		[block.props.steps],
	);
	const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
		const fromQuery = readCheckoutStepIdFromLocation();
		const found = findCheckoutStepIndexById(enabledSteps, fromQuery);
		return found >= 0 ? found : 0;
	});
	const [formData, dispatchFormData] = useReducer(
		checkoutFormDataReducer,
		checkoutFormDataInitial,
	);
	const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
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
		nextLabel: ru ? "Далее" : "Next",
		prevLabel: ru ? "Назад" : "Back",
		deliveryAddressLabel: ru ? "Адрес доставки" : "Delivery address",
		deliveryAddressPlaceholder: ru ? "Введите адрес" : "Enter address",
		pickupPointLabel: ru ? "Точка самовывоза" : "Pickup point",
		pickupPointPlaceholder: ru ? "Выберите точку" : "Choose pickup point",
		promoCodeLabel: ru ? "Промокод" : "Promo code",
		promoCodePlaceholder: ru ? "Введите промокод" : "Enter promo code",
		commentLabel: ru ? "Комментарий" : "Comment",
		commentPlaceholder: ru ? "Пожелания к заказу" : "Order notes",
		reviewTitle: ru ? "Проверка заказа" : "Review",
		reviewDeliveryLabel: ru ? "Доставка" : "Delivery",
		reviewPaymentLabel: ru ? "Оплата" : "Payment",
		reviewContactLabel: ru ? "Контакты" : "Contact",
		confirmCtaLabel: ru ? "Заказ оформлен!" : "Order placed!",
		continueShoppingLabel: ru ? "Продолжить покупки" : "Continue shopping",
		minOrderWarningLabel: ru
			? "Минимальная сумма заказа не достигнута."
			: "Minimum order amount not reached.",
		cartHeadingLabel: ru ? "Ваша корзина" : "Your cart",
	};
	const getFallbackText = (key: keyof typeof fallbackText) =>
		String(block.props[key as keyof CommerceCheckoutFormProps] ?? fallbackText[key]);

	const items = cart?.items ?? [];
	const hasItems = items.length > 0;
	const cartTotal =
		typeof cart?.total_amount === "number" ? cart.total_amount : 0;
	const minOrderAmount =
		typeof block.props.minOrderAmount === "number" && block.props.minOrderAmount > 0
			? block.props.minOrderAmount
			: 0;
	const belowMinOrder = minOrderAmount > 0 && cartTotal < minOrderAmount;

	const goToIndex = useCallback(
		(nextIndex: number, method: "push" | "replace" = "push") => {
			const bounded = Math.max(0, Math.min(enabledSteps.length - 1, nextIndex));
			const step = enabledSteps[bounded];
			setCurrentStepIndex(bounded);
			setStepErrors({});
			if (step) {
				writeCheckoutStepToLocation(step.id, method);
			}
		},
		[enabledSteps],
	);

	const currentStep = enabledSteps[currentStepIndex] ?? enabledSteps[0];
	const currentStepKind = currentStep?.kind ?? "cart";

	const goNext = useCallback(() => {
		const validation = validateStep(
			currentStepKind,
			formData,
			block.props.deliveryTypes ?? [],
			block.props.paymentTypes ?? [],
		);
		if (!validation.valid) {
			setStepErrors(validation.errors);
			return;
		}
		setStepErrors({});
		goToIndex(currentStepIndex + 1);
	}, [currentStepIndex, currentStepKind, formData, block.props.deliveryTypes, block.props.paymentTypes, goToIndex]);

	const goPrev = useCallback(() => {
		setStepErrors({});
		goToIndex(currentStepIndex - 1);
	}, [currentStepIndex, goToIndex]);

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

		const syncStep = () => {
			const fromQuery = readCheckoutStepIdFromLocation();
			const found = findCheckoutStepIndexById(enabledSteps, fromQuery);
			if (found >= 0) {
				setCurrentStepIndex(found);
			}
		};
		window.addEventListener("popstate", syncStep);

		return () => window.removeEventListener("popstate", syncStep);
	}, [enabledSteps]);

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

	const setItemQuantity = (itemId: string, nextQuantity: number) => {
		desiredItemQuantitiesRef.current.set(itemId, nextQuantity);
		const nextCart = applyItemQuantity(itemId, nextQuantity);
		if (nextCart) {
			emitCommerceCartUpdated(nextCart);
		}
		syncItemQuantity(itemId, nextQuantity);
	};

	const cartHref = block.props.cartHref || "/checkout?checkoutStep=cart";
	const cartCatalogHref =
		typeof block.props.cartCatalogHref === "string" &&
		block.props.cartCatalogHref.trim()
			? block.props.cartCatalogHref
			: "/catalog";
	const continueShoppingHref =
		typeof block.props.confirmCtaHref === "string" &&
		block.props.confirmCtaHref.trim()
			? block.props.confirmCtaHref
			: "/";
	const summaryCurrency = cart?.currency ?? order?.currency ?? "KZT";

	const submitOrder = useCallback(async () => {
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
				throw new Error("Cannot place an order from an empty cart.");
			}

			// TODO: extend payload with delivery/payment details once backend supports
			// `cartService.postOrder(formData)` semantics.
			const customerSnapshot: Record<string, unknown> = {
				name: formData.contact.name,
				email: formData.contact.email,
				phone: formData.contact.phone,
				comment: formData.contact.comment,
				delivery: formData.delivery,
				payment: formData.payment,
			};

			const response = await client.checkout({
				cartId: checkoutCart.id,
				customerSnapshot,
			});
			setOrder(response.data);
			setCart(null);
			emitCommerceCartUpdated(null);
			setStatus("idle");
			// advance to next step (confirm) after success
			goToIndex(currentStepIndex + 1);
		} catch {
			setStatus("error");
		}
	}, [
		mode,
		isAuthenticated,
		requestAuth,
		cart,
		authResource,
		client,
		setCart,
		formData,
		goToIndex,
		currentStepIndex,
	]);

	const renderStepIndicator = () => (
		<ol className="mb-8 flex flex-wrap items-center gap-2 text-sm">
			{enabledSteps.map((step, index) => {
				const active = index === currentStepIndex;
				const finished = index < currentStepIndex;
				return (
					<li key={step.id} className="flex items-center gap-2">
						<span
							className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
								active
									? "border-[var(--photon-site-accent)] text-[var(--photon-site-accent)]"
									: finished
										? "border-[var(--photon-site-accent)] bg-[var(--photon-site-accent)] text-[var(--photon-site-background)]"
										: `border-[color:var(--photon-site-border)] ${cx.mutedText}`
							}`}
						>
							{finished ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
						</span>
						<span className={active || finished ? cx.strongText : cx.mutedText}>
							{step.label}
						</span>
						{index < enabledSteps.length - 1 ? (
							<span className={`mx-1 ${cx.mutedText}`}>→</span>
						) : null}
					</li>
				);
			})}
		</ol>
	);

	const nextLabel = getFallbackText("nextLabel");
	const prevLabel = getFallbackText("prevLabel");
	const isLastBeforeConfirm =
		enabledSteps[currentStepIndex + 1]?.kind === "confirm";
	const isReviewStep = currentStepKind === "review";

	let stepBody: ReactNode = null;

	if (currentStepKind === "cart") {
		stepBody = (
			<div className="grid gap-4">
				<EditableText
					blockId={block.id}
					path="cartTitle"
					as="h1"
					className="block text-3xl font-semibold leading-tight sm:text-4xl"
				/>
				{belowMinOrder ? (
					<div
						className={`rounded-lg border border-[color-mix(in_oklab,#ef4444_42%,var(--photon-site-border))] p-3 text-sm ${cx.errorText}`}
					>
						{getFallbackText("minOrderWarningLabel")} (
						{formatCommerceMoney(minOrderAmount, summaryCurrency, contentLocale)}
						)
					</div>
				) : null}
				{hasItems ? (
					<>
						<CartLineItems
							items={items}
							currency={summaryCurrency}
							contentLocale={contentLocale}
							applyItemQuantity={applyItemQuantity}
							setItemQuantity={setItemQuantity}
						/>
						<div
							className={`flex items-center justify-between rounded-lg p-4 ${cx.mutedSurface}`}
						>
							<div className={`text-sm ${cx.mutedText}`}>
								{getFallbackText("summaryTotalLabel")}
							</div>
							<div className={`text-2xl font-semibold ${cx.strongText}`}>
								{formatCommerceMoney(cartTotal, summaryCurrency, contentLocale)}
							</div>
						</div>
					</>
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
				)}
			</div>
		);
	} else if (currentStepKind === "delivery") {
		stepBody = (
			<DeliveryStep
				deliveryTypes={block.props.deliveryTypes ?? []}
				mapEmbedUrl={
					typeof block.props.mapEmbedUrl === "string" ? block.props.mapEmbedUrl : ""
				}
				delivery={formData.delivery}
				errors={stepErrors}
				addressLabel={getFallbackText("deliveryAddressLabel")}
				addressPlaceholder={getFallbackText("deliveryAddressPlaceholder")}
				pickupLabel={getFallbackText("pickupPointLabel")}
				pickupPlaceholder={getFallbackText("pickupPointPlaceholder")}
				onUpdate={(value) => dispatchFormData({ type: "set-delivery", value })}
			/>
		);
	} else if (currentStepKind === "payment") {
		stepBody = (
			<PaymentStep
				paymentTypes={block.props.paymentTypes ?? []}
				promoEnabled={Boolean(block.props.promoEnabled)}
				payment={formData.payment}
				errors={stepErrors}
				promoLabel={getFallbackText("promoCodeLabel")}
				promoPlaceholder={getFallbackText("promoCodePlaceholder")}
				onUpdate={(value) => dispatchFormData({ type: "set-payment", value })}
			/>
		);
	} else if (currentStepKind === "review") {
		stepBody = (
			<ReviewStep
				formData={formData}
				deliveryTypes={block.props.deliveryTypes ?? []}
				paymentTypes={block.props.paymentTypes ?? []}
				cartTotal={cartTotal}
				currency={summaryCurrency}
				contentLocale={contentLocale}
				errors={stepErrors}
				deliveryLabel={getFallbackText("reviewDeliveryLabel")}
				paymentLabel={getFallbackText("reviewPaymentLabel")}
				contactLabel={getFallbackText("reviewContactLabel")}
				totalLabel={getFallbackText("summaryTotalLabel")}
				nameLabel={String(
					block.props.nameLabel ?? (ru ? "Имя" : "Name"),
				)}
				phoneLabel={String(
					block.props.phoneLabel ?? (ru ? "Телефон" : "Phone"),
				)}
				emailLabel={String(block.props.emailLabel ?? "Email")}
				commentLabel={getFallbackText("commentLabel")}
				commentPlaceholder={getFallbackText("commentPlaceholder")}
				onUpdate={(value) => dispatchFormData({ type: "set-contact", value })}
			/>
		);
	} else if (currentStepKind === "confirm") {
		stepBody = (
			<div className={`${cx.successPanel} grid gap-4 p-6 text-center`}>
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--photon-site-accent)] text-[var(--photon-site-background)]">
					<CheckCircle2 className="h-7 w-7" />
				</div>
				<h2 className={`text-2xl font-semibold ${cx.strongText}`}>
					{getFallbackText("confirmCtaLabel")}
				</h2>
				<EditableTextarea
					blockId={block.id}
					path="successBody"
					placeholder={getFallbackText("successBody")}
					className={`mx-auto max-w-md text-sm ${cx.mutedText}`}
				/>
				{order ? (
					<div className="flex flex-wrap items-center justify-center gap-2 text-xs">
						<span className="rounded-full border border-[color-mix(in_oklab,var(--photon-site-accent)_42%,var(--photon-site-border))] px-3 py-1 font-semibold text-[var(--photon-site-accent)]">
							{order.number}
						</span>
						<span className={cx.mutedText}>{order.status ?? ""}</span>
					</div>
				) : null}
				<PhotonLink href={continueShoppingHref} className={cx.primaryButton}>
					{getFallbackText("continueShoppingLabel")}
				</PhotonLink>
			</div>
		);
	}

	const showPrev = currentStepIndex > 0 && currentStepKind !== "confirm";
	const showNext = currentStepKind !== "confirm";
	const nextDisabled =
		(currentStepKind === "cart" && (!hasItems || belowMinOrder)) ||
		status === "saving";
	const handleNextClick = () => {
		if (isReviewStep && isLastBeforeConfirm) {
			void submitOrder();
			return;
		}
		goNext();
	};

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto max-w-5xl">
				<Breadcrumb className="mb-8">
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
				</Breadcrumb>

				{enabledSteps.length > 1 ? renderStepIndicator() : null}

				<div className="grid gap-6">
					<div>{stepBody}</div>

					{showNext || showPrev ? (
						<div className="flex flex-wrap items-center justify-between gap-3">
							{showPrev ? (
								<button
									type="button"
									onClick={goPrev}
									className={cx.secondaryButton}
								>
									{prevLabel}
								</button>
							) : (
								<span />
							)}
							{showNext ? (
								<button
									type="button"
									onClick={handleNextClick}
									disabled={nextDisabled}
									className={cx.primaryButton}
								>
									{status === "saving"
										? getFallbackText("savingLabel")
										: isLastBeforeConfirm && isReviewStep
											? getFallbackText("submitLabel")
											: nextLabel}
								</button>
							) : null}
						</div>
					) : null}

					{status === "error" ? (
						<div className={`text-sm ${cx.errorText}`}>
							{getFallbackText("errorLabel")}
						</div>
					) : null}
				</div>
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
			steps: defaultCheckoutSteps,
			paymentTypes: [],
			deliveryTypes: [],
			mapEmbedUrl: "",
			promoEnabled: false,
			minOrderAmount: 0,
			nextLabel: createPhotonLocalizedDefault({ en: "Next", ru: "Далее" }),
			prevLabel: createPhotonLocalizedDefault({ en: "Back", ru: "Назад" }),
			deliveryAddressLabel: createPhotonLocalizedDefault({
				en: "Delivery address",
				ru: "Адрес доставки",
			}),
			deliveryAddressPlaceholder: createPhotonLocalizedDefault({
				en: "Enter address",
				ru: "Введите адрес",
			}),
			pickupPointLabel: createPhotonLocalizedDefault({
				en: "Pickup point",
				ru: "Точка самовывоза",
			}),
			pickupPointPlaceholder: createPhotonLocalizedDefault({
				en: "Choose pickup point",
				ru: "Выберите точку",
			}),
			promoCodeLabel: createPhotonLocalizedDefault({
				en: "Promo code",
				ru: "Промокод",
			}),
			promoCodePlaceholder: createPhotonLocalizedDefault({
				en: "Enter promo code",
				ru: "Введите промокод",
			}),
			commentLabel: createPhotonLocalizedDefault({
				en: "Comment",
				ru: "Комментарий",
			}),
			commentPlaceholder: createPhotonLocalizedDefault({
				en: "Order notes",
				ru: "Пожелания к заказу",
			}),
			reviewTitle: createPhotonLocalizedDefault({
				en: "Review",
				ru: "Проверка заказа",
			}),
			reviewDeliveryLabel: createPhotonLocalizedDefault({
				en: "Delivery",
				ru: "Доставка",
			}),
			reviewPaymentLabel: createPhotonLocalizedDefault({
				en: "Payment",
				ru: "Оплата",
			}),
			reviewContactLabel: createPhotonLocalizedDefault({
				en: "Contact",
				ru: "Контакты",
			}),
			confirmCtaLabel: createPhotonLocalizedDefault({
				en: "Order placed!",
				ru: "Заказ оформлен!",
			}),
			confirmCtaHref: "/",
			minOrderWarningLabel: createPhotonLocalizedDefault({
				en: "Minimum order amount not reached.",
				ru: "Минимальная сумма заказа не достигнута.",
			}),
			cartHeadingLabel: createPhotonLocalizedDefault({
				en: "Your cart",
				ru: "Ваша корзина",
			}),
			continueShoppingLabel: createPhotonLocalizedDefault({
				en: "Continue shopping",
				ru: "Продолжить покупки",
			}),
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
			{
				path: "steps",
				label: "Checkout steps",
				kind: "repeater",
				group: "layout",
				localization: "shared",
				itemLabelPath: "label",
				addLabel: "Add step",
				fields: [
					{ path: "id", label: "Id", kind: "text" },
					{
						path: "kind",
						label: "Kind",
						kind: "select",
						options: [
							{ value: "cart", label: "Cart" },
							{ value: "delivery", label: "Delivery" },
							{ value: "payment", label: "Payment" },
							{ value: "review", label: "Review" },
							{ value: "confirm", label: "Confirm" },
						],
					},
					{ path: "label", label: "Label", kind: "text" },
					{ path: "enabled", label: "Enabled", kind: "toggle" },
				],
			},
			{
				path: "deliveryTypes",
				label: "Delivery types",
				kind: "repeater",
				group: "data",
				localization: "shared",
				itemLabelPath: "label",
				addLabel: "Add delivery type",
				fields: [
					{ path: "id", label: "Id", kind: "text" },
					{ path: "label", label: "Label", kind: "text" },
					{
						path: "kind",
						label: "Kind",
						kind: "select",
						options: [
							{ value: "delivery", label: "Delivery" },
							{ value: "pickup", label: "Pickup" },
						],
					},
				],
			},
			{
				path: "paymentTypes",
				label: "Payment types",
				kind: "repeater",
				group: "data",
				localization: "shared",
				itemLabelPath: "label",
				addLabel: "Add payment type",
				fields: [
					{ path: "id", label: "Id", kind: "text" },
					{ path: "label", label: "Label", kind: "text" },
					{
						path: "kind",
						label: "Kind",
						kind: "select",
						options: [
							{ value: "cash", label: "Cash" },
							{ value: "card-online", label: "Card (online)" },
							{ value: "kaspi", label: "Kaspi" },
							{ value: "custom", label: "Custom" },
						],
					},
				],
			},
			{
				path: "mapEmbedUrl",
				label: "Map embed URL",
				kind: "url",
				group: "data",
				localization: "shared",
			},
			{
				path: "promoEnabled",
				label: "Enable promo code",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "minOrderAmount",
				label: "Minimum order amount (cents)",
				kind: "number",
				group: "data",
				localization: "shared",
				min: 0,
			},
			{
				path: "nextLabel",
				label: "Next button label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "prevLabel",
				label: "Back button label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "deliveryAddressLabel",
				label: "Delivery address label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "deliveryAddressPlaceholder",
				label: "Delivery address placeholder",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "pickupPointLabel",
				label: "Pickup point label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "pickupPointPlaceholder",
				label: "Pickup point placeholder",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "promoCodeLabel",
				label: "Promo code label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "promoCodePlaceholder",
				label: "Promo code placeholder",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "commentLabel",
				label: "Comment label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "commentPlaceholder",
				label: "Comment placeholder",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "reviewTitle",
				label: "Review title",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "reviewDeliveryLabel",
				label: "Review delivery label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "reviewPaymentLabel",
				label: "Review payment label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "reviewContactLabel",
				label: "Review contact label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "confirmCtaLabel",
				label: "Confirm CTA label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "confirmCtaHref",
				label: "Confirm CTA URL",
				kind: "text",
				group: "data",
				localization: "shared",
			},
			{
				path: "continueShoppingLabel",
				label: "Continue shopping label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "minOrderWarningLabel",
				label: "Minimum order warning label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "cartHeadingLabel",
				label: "Cart heading label",
				kind: "text",
				group: "content",
				localization: "localized",
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
				"nextLabel",
				"prevLabel",
				"deliveryAddressLabel",
				"deliveryAddressPlaceholder",
				"pickupPointLabel",
				"pickupPointPlaceholder",
				"promoCodeLabel",
				"promoCodePlaceholder",
				"commentLabel",
				"commentPlaceholder",
				"reviewTitle",
				"reviewDeliveryLabel",
				"reviewPaymentLabel",
				"reviewContactLabel",
				"confirmCtaLabel",
				"continueShoppingLabel",
				"minOrderWarningLabel",
				"cartHeadingLabel",
				"steps.*.label",
				"deliveryTypes.*.label",
				"paymentTypes.*.label",
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
				"confirmCtaHref",
				"mapEmbedUrl",
				"promoEnabled",
				"minOrderAmount",
				"steps.*.id",
				"steps.*.kind",
				"steps.*.enabled",
				"deliveryTypes.*.id",
				"deliveryTypes.*.kind",
				"paymentTypes.*.id",
				"paymentTypes.*.kind",
			],
		},
		component: CommerceCheckoutForm,
	});
