"use client";

import type { CommerceCartItem } from "@init/commerce";
import {
	EditableText,
	PhotonLink,
} from "@init/photon/public";
import { commerceBlockClassNames as cx, formatCommerceMoney } from "./shared";

type CommerceCheckoutSummaryProps = {
	blockId: string;
	cartHref: string;
	contentLocale: string;
	currency: string;
	emptyBody: string;
	items: CommerceCartItem[];
	returnLabel: string;
	title: string;
	total: null | number | string | undefined;
	totalLabel: string;
};

export const CommerceCheckoutSummary = ({
	blockId,
	cartHref,
	contentLocale,
	currency,
	emptyBody,
	items,
	returnLabel,
	title,
	total,
	totalLabel,
}: CommerceCheckoutSummaryProps) => (
	<aside className={`p-5 ${cx.surface}`}>
		<EditableText
			blockId={blockId}
			path="summaryTitle"
			placeholder={title}
			className={`text-sm font-semibold ${cx.strongText}`}
		/>
		{items.length > 0 ? (
			<>
				<div className="mt-4 grid gap-3">
					{items.map((item) => (
						<div key={item.id} className="flex justify-between gap-4 text-sm">
							<span className={`min-w-0 ${cx.mutedText}`}>
								{item.quantity} x {item.name}
							</span>
							<span className={`font-semibold ${cx.strongText}`}>
								{formatCommerceMoney(item.line_total, currency, contentLocale)}
							</span>
						</div>
					))}
				</div>
				<div className="mt-5 border-t border-[color:var(--photon-site-border)] pt-4">
					<div className="flex justify-between gap-4 text-base font-semibold">
						<EditableText
							blockId={blockId}
							path="summaryTotalLabel"
							placeholder={totalLabel}
							className="font-semibold"
						/>
						<span>{formatCommerceMoney(total, currency, contentLocale)}</span>
					</div>
				</div>
			</>
		) : (
			<div className={`mt-4 text-sm leading-7 ${cx.mutedText}`}>
				<EditableText
					blockId={blockId}
					path="summaryEmptyBody"
					placeholder={emptyBody}
					className={cx.mutedText}
				/>{" "}
				<PhotonLink href={cartHref}>
					<EditableText
						blockId={blockId}
						path="summaryReturnLabel"
						placeholder={returnLabel}
						className="font-medium"
					/>
				</PhotonLink>
				.
			</div>
		)}
	</aside>
);
