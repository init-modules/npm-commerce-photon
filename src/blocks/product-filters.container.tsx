"use client";

import {
	createPhotonLocalizedDefault,
	definePhotonBlockDefinition,
	type PhotonBlockComponentProps,
	type PhotonBlockDefinition,
	usePhoton,
} from "@init/photon/public";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	COMMERCE_TAXONOMY_INGREDIENTS_SOURCE,
	type CommerceTaxonomyTermView,
} from "../bindings";
import { commerceBlockClassNames as cx } from "./shared";

// TODO: commerce-product-grid should consume URL filter params via useSearchParams()

type CommerceProductFiltersProps = {
	heading: string;
	ingredientHeading: string;
	priceHeading: string;
	applyLabel: string;
	resetLabel: string;
	showIngredients: boolean;
	showPriceRange: boolean;
	priceMin: number;
	priceMax: number;
	priceStep: number;
};

const coerceTermList = (value: unknown): CommerceTaxonomyTermView[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry): CommerceTaxonomyTermView[] => {
		if (!entry || typeof entry !== "object") {
			return [];
		}

		const record = entry as Record<string, unknown>;
		const id = typeof record.id === "string" ? record.id : null;
		const slug = typeof record.slug === "string" ? record.slug : null;
		const label = typeof record.label === "string" ? record.label : null;
		const href = typeof record.href === "string" ? record.href : "";

		if (!id || !slug || !label) {
			return [];
		}

		const icon = typeof record.icon === "string" ? record.icon : undefined;

		return [{ id, slug, label, icon, href }];
	});
};

const readIngredientTerms = (
	resources: Record<string, unknown>,
	taxonomySlug: string,
): CommerceTaxonomyTermView[] => {
	const raw = resources[COMMERCE_TAXONOMY_INGREDIENTS_SOURCE];

	if (!raw || typeof raw !== "object") {
		return [];
	}

	return coerceTermList((raw as Record<string, unknown>)[taxonomySlug]);
};

const parseSelectedSlugs = (param: null | string): Set<string> => {
	if (!param) {
		return new Set();
	}

	return new Set(
		param
			.split(",")
			.map((slug) => slug.trim())
			.filter((slug) => slug.length > 0),
	);
};

const parseNumber = (param: null | string, fallback: number): number => {
	if (!param) {
		return fallback;
	}

	const parsed = Number(param);

	return Number.isFinite(parsed) ? parsed : fallback;
};

const CommerceProductFilters = ({
	block,
}: PhotonBlockComponentProps<CommerceProductFiltersProps>) => {
	const { resources } = usePhoton();
	const router = useRouter();
	const searchParams = useSearchParams();

	const ingredientBinding = block.bindings?.ingredients;
	const ingredientTaxonomySlug =
		ingredientBinding && typeof ingredientBinding.path === "string"
			? ingredientBinding.path
			: "";

	const ingredientTerms = useMemo(
		() =>
			ingredientTaxonomySlug.length > 0
				? readIngredientTerms(
						resources as Record<string, unknown>,
						ingredientTaxonomySlug,
					)
				: [],
		[resources, ingredientTaxonomySlug],
	);

	const renderIngredients =
		block.props.showIngredients && ingredientTerms.length > 0;
	const renderPrice = block.props.showPriceRange;

	const priceMinDefault = Number.isFinite(block.props.priceMin)
		? block.props.priceMin
		: 0;
	const priceMaxDefault = Number.isFinite(block.props.priceMax)
		? block.props.priceMax
		: 100;
	const priceStep = Number.isFinite(block.props.priceStep)
		? Math.max(1, block.props.priceStep)
		: 1;

	const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
		() => parseSelectedSlugs(searchParams?.get("ingredients") ?? null),
	);
	const [priceMin, setPriceMin] = useState<number>(() =>
		parseNumber(searchParams?.get("priceMin") ?? null, priceMinDefault),
	);
	const [priceMax, setPriceMax] = useState<number>(() =>
		parseNumber(searchParams?.get("priceMax") ?? null, priceMaxDefault),
	);

	useEffect(() => {
		if (!searchParams) {
			return;
		}

		setSelectedIngredients(
			parseSelectedSlugs(searchParams.get("ingredients")),
		);
		setPriceMin(parseNumber(searchParams.get("priceMin"), priceMinDefault));
		setPriceMax(parseNumber(searchParams.get("priceMax"), priceMaxDefault));
	}, [priceMinDefault, priceMaxDefault, searchParams]);

	const toggleIngredient = (slug: string) => {
		setSelectedIngredients((current) => {
			const next = new Set(current);

			if (next.has(slug)) {
				next.delete(slug);
			} else {
				next.add(slug);
			}

			return next;
		});
	};

	const handlePriceMinChange = (value: number) => {
		setPriceMin(Math.min(value, priceMax));
	};

	const handlePriceMaxChange = (value: number) => {
		setPriceMax(Math.max(value, priceMin));
	};

	const buildNextSearch = (): string => {
		const next = new URLSearchParams(searchParams?.toString() ?? "");

		if (selectedIngredients.size > 0) {
			next.set("ingredients", Array.from(selectedIngredients).join(","));
		} else {
			next.delete("ingredients");
		}

		if (renderPrice) {
			if (priceMin !== priceMinDefault) {
				next.set("priceMin", String(priceMin));
			} else {
				next.delete("priceMin");
			}

			if (priceMax !== priceMaxDefault) {
				next.set("priceMax", String(priceMax));
			} else {
				next.delete("priceMax");
			}
		} else {
			next.delete("priceMin");
			next.delete("priceMax");
		}

		const search = next.toString();

		return search.length > 0 ? `?${search}` : "";
	};

	const handleApply = () => {
		const search = buildNextSearch();
		const path =
			typeof window !== "undefined" ? window.location.pathname : "";

		router.push(`${path}${search}`);
	};

	const handleReset = () => {
		setSelectedIngredients(new Set());
		setPriceMin(priceMinDefault);
		setPriceMax(priceMaxDefault);

		const next = new URLSearchParams(searchParams?.toString() ?? "");
		next.delete("ingredients");
		next.delete("priceMin");
		next.delete("priceMax");

		const search = next.toString();
		const path =
			typeof window !== "undefined" ? window.location.pathname : "";

		router.push(`${path}${search.length > 0 ? `?${search}` : ""}`);
	};

	if (!renderIngredients && !renderPrice) {
		return null;
	}

	return (
		<aside className="hidden md:block sticky top-24">
			<div
				className={`${cx.surface} flex flex-col gap-4 p-5`}
				aria-label={block.props.heading}
			>
				<div className={`text-sm font-semibold ${cx.strongText}`}>
					{block.props.heading}
				</div>

				{renderIngredients ? (
					<details
						open
						className="border-t border-[color:var(--photon-site-border)] pt-3"
					>
						<summary
							className={`flex cursor-pointer items-center justify-between text-sm font-semibold ${cx.strongText}`}
						>
							<span>{block.props.ingredientHeading}</span>
							<span className={`text-xs ${cx.mutedText}`} aria-hidden="true">
								▾
							</span>
						</summary>
						<ul className="mt-3 flex flex-col gap-2">
							{ingredientTerms.map((term) => {
								const checked = selectedIngredients.has(term.slug);
								return (
									<li
										key={term.id}
										className="flex items-center justify-between gap-2 text-sm"
									>
										<label className="flex cursor-pointer items-center gap-2">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleIngredient(term.slug)}
												className="h-4 w-4 cursor-pointer accent-[var(--photon-site-accent)]"
											/>
											<span className={cx.strongText}>{term.label}</span>
										</label>
									</li>
								);
							})}
						</ul>
					</details>
				) : null}

				{renderPrice ? (
					<details
						open
						className="border-t border-[color:var(--photon-site-border)] pt-3"
					>
						<summary
							className={`flex cursor-pointer items-center justify-between text-sm font-semibold ${cx.strongText}`}
						>
							<span>{block.props.priceHeading}</span>
							<span className={`text-xs ${cx.mutedText}`} aria-hidden="true">
								▾
							</span>
						</summary>
						<div className="mt-3 flex flex-col gap-3">
							<div className="relative h-6">
								<input
									type="range"
									min={priceMinDefault}
									max={priceMaxDefault}
									step={priceStep}
									value={priceMin}
									onChange={(event) =>
										handlePriceMinChange(Number(event.target.value))
									}
									aria-label={`${block.props.priceHeading} min`}
									className="pointer-events-auto absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent accent-[var(--photon-site-accent)]"
								/>
								<input
									type="range"
									min={priceMinDefault}
									max={priceMaxDefault}
									step={priceStep}
									value={priceMax}
									onChange={(event) =>
										handlePriceMaxChange(Number(event.target.value))
									}
									aria-label={`${block.props.priceHeading} max`}
									className="pointer-events-auto absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent accent-[var(--photon-site-accent)]"
								/>
							</div>
							<div
								className={`flex items-center justify-between text-sm ${cx.mutedText}`}
							>
								<span>{priceMin} ₸</span>
								<span aria-hidden="true">—</span>
								<span>{priceMax} ₸</span>
							</div>
						</div>
					</details>
				) : null}

				<div className="flex items-center gap-2 pt-2">
					<button
						type="button"
						onClick={handleApply}
						className={cx.primaryButton}
					>
						{block.props.applyLabel}
					</button>
					<button
						type="button"
						onClick={handleReset}
						className={cx.secondaryButton}
					>
						{block.props.resetLabel}
					</button>
				</div>
			</div>
		</aside>
	);
};

export const commerceProductFiltersDefinition: PhotonBlockDefinition<CommerceProductFiltersProps> =
	definePhotonBlockDefinition<CommerceProductFiltersProps>({
		type: "commerce-product-filters",
		label: "Commerce Product Filters",
		labelKey: "commercePhoton.productFilters.label",
		description: "Sticky catalog sidebar with ingredient and price filters.",
		descriptionKey: "commercePhoton.productFilters.description",
		category: "Commerce",
		icon: "filter",
		defaults: {
			heading: createPhotonLocalizedDefault({
				en: "",
				ru: "",
			}),
			ingredientHeading: createPhotonLocalizedDefault({
				en: "",
				ru: "",
			}),
			priceHeading: createPhotonLocalizedDefault({
				en: "",
				ru: "",
			}),
			applyLabel: createPhotonLocalizedDefault({
				en: "",
				ru: "",
			}),
			resetLabel: createPhotonLocalizedDefault({
				en: "",
				ru: "",
			}),
			showIngredients: false,
			showPriceRange: false,
			priceMin: 0,
			priceMax: 100,
			priceStep: 0,
		},
		bindings: {
			ingredients: {
				source: COMMERCE_TAXONOMY_INGREDIENTS_SOURCE,
				path: "",
				mode: "read",
			},
		},
		fields: [
			{
				path: "heading",
				label: "Heading",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "ingredientHeading",
				label: "Ingredient heading",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "priceHeading",
				label: "Price heading",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "applyLabel",
				label: "Apply label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "resetLabel",
				label: "Reset label",
				kind: "text",
				group: "content",
				localization: "localized",
			},
			{
				path: "showIngredients",
				label: "Show ingredients",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "showPriceRange",
				label: "Show price range",
				kind: "toggle",
				group: "layout",
				localization: "shared",
			},
			{
				path: "priceMin",
				label: "Price min",
				kind: "number",
				group: "layout",
				localization: "shared",
			},
			{
				path: "priceMax",
				label: "Price max",
				kind: "number",
				group: "layout",
				localization: "shared",
			},
			{
				path: "priceStep",
				label: "Price step",
				kind: "number",
				group: "layout",
				localization: "shared",
			},
		],
		component: CommerceProductFilters,
	});
