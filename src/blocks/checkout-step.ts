export type CommerceCheckoutStepKey = "cart" | "checkout" | "done";

export const commerceCheckoutStepKeys: CommerceCheckoutStepKey[] = [
	"cart",
	"checkout",
	"done",
];

export const toCommerceCheckoutStepKey = (
	value: unknown,
): CommerceCheckoutStepKey | null =>
	typeof value === "string" &&
	commerceCheckoutStepKeys.includes(value as CommerceCheckoutStepKey)
		? (value as CommerceCheckoutStepKey)
		: null;

export const resolveCommerceCheckoutStep = ({
	hasItems,
	hasOrder,
	requestedStep,
}: {
	hasItems: boolean;
	hasOrder: boolean;
	requestedStep: CommerceCheckoutStepKey | null;
}): CommerceCheckoutStepKey => {
	if (hasOrder) {
		return "done";
	}

	if (requestedStep === "cart") {
		return "cart";
	}

	if (requestedStep === "checkout" && hasItems) {
		return "checkout";
	}

	return hasItems ? "checkout" : "cart";
};
