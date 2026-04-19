"use client";

import {
	type CommerceCart,
	type CommerceOrder,
	createCommerceClient,
	createFetchCommerceRequest,
} from "@init-modules/commerce";
import {
	createWebsiteBuilderLocalizedDefault,
	defineWebsiteBuilderBlockDefinition,
	EditableText,
	EditableTextarea,
	useWebsiteBuilder,
	useWebsiteBuilderI18n,
	type WebsiteBuilderBlockComponentProps,
	type WebsiteBuilderBlockDefinition,
} from "@init-modules/website-builder";
import { useEffect, useMemo, useState } from "react";
import { commerceBlockClassNames as cx, formatCommerceMoney } from "./shared";

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

const CommerceCheckoutForm = ({
	block,
}: WebsiteBuilderBlockComponentProps<CommerceCheckoutFormProps>) => {
	const { mode } = useWebsiteBuilder();
	const { contentLocale } = useWebsiteBuilderI18n();
	const [cart, setCart] = useState<CommerceCart | null>(null);
	const [order, setOrder] = useState<CommerceOrder | null>(null);
	const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
		"idle",
	);
	const client = useMemo(
		() => createCommerceClient(createFetchCommerceRequest()),
		[],
	);

	useEffect(() => {
		if (mode !== "preview") {
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
	}, [client, mode]);

	return (
		<section className={`${cx.section} py-12`}>
			<div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<div>
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
					<EditableTextarea
						blockId={block.id}
						path="body"
						className={`mt-4 max-w-2xl text-base leading-8 ${cx.mutedText}`}
					/>

					{order ? (
						<div className={`mt-8 p-5 ${cx.successPanel}`}>
							<div className="text-lg font-semibold">
								{block.props.successTitle}
							</div>
							<div className={`mt-2 text-sm ${cx.mutedText}`}>
								{order.number}
							</div>
						</div>
					) : (
						<form
							className="mt-8 grid gap-4"
							onSubmit={async (event) => {
								event.preventDefault();

								if (mode !== "preview") {
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

				<aside className={`p-5 ${cx.surface}`}>
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
							Cart is empty. <a href={block.props.cartHref}>Return to cart</a>.
						</div>
					)}
				</aside>
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
