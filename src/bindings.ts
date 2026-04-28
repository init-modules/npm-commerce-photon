import type { PhotonResources } from "@init/photon";

/**
 * Stable binding source key for commerce taxonomy categories.
 *
 * Blocks declare:
 *
 *   bindings: {
 *     categories: {
 *       source: COMMERCE_TAXONOMY_CATEGORIES_SOURCE,
 *       path: "<taxonomy-slug>", // e.g. "category", "ingredient", ...
 *       mode: "read",
 *     },
 *   }
 *
 * The runtime resolves `binding.source in resources` against the
 * key registered here, and reads `path` (the taxonomy slug) to obtain the
 * matching `CommerceTaxonomyTermView[]`.
 */
export const COMMERCE_TAXONOMY_CATEGORIES_SOURCE = "commerce.taxonomy.categories";

/**
 * Public shape of a single taxonomy term as exposed to header / footer /
 * filters / breadcrumb consumers via the `commerce.taxonomy.categories`
 * binding source.
 */
export type CommerceTaxonomyTermView = {
	id: string;
	slug: string;
	label: string;
	icon?: string;
	href: string;
};

/**
 * Optional configuration that consumers may attach to the binding
 * descriptor. The runtime resolver inspects `taxonomy` (also exposed as
 * `binding.path`), `limit`, and `rootSlug` when computing the resolved
 * value array.
 */
export type CommerceTaxonomyCategoriesBindingConfig = {
	taxonomy: string;
	limit?: number;
	rootSlug?: string;
};

/**
 * Shape stored under `resources[COMMERCE_TAXONOMY_CATEGORIES_SOURCE]`.
 *
 * Keys are taxonomy slugs (matching `binding.path`); values are flat term
 * arrays already projected for public consumption.
 */
export type CommerceTaxonomyCategoriesResource = Record<
	string,
	readonly CommerceTaxonomyTermView[]
>;

/**
 * Read the full taxonomy resource map from a resolved page's
 * `resources` bag. Returns an empty object if hydration is missing so
 * consumers can fall back gracefully (e.g. to author-supplied props).
 */
export const getCommerceTaxonomyCategoriesResource = (
	resources: PhotonResources | undefined,
): CommerceTaxonomyCategoriesResource => {
	const raw = resources?.[COMMERCE_TAXONOMY_CATEGORIES_SOURCE];

	if (!raw || typeof raw !== "object") {
		return {};
	}

	return raw as CommerceTaxonomyCategoriesResource;
};

/**
 * Read a single taxonomy's term list from a resolved page's
 * `resources` bag, applying optional `limit` and `rootSlug` filters.
 *
 * Returns `[]` if the taxonomy is missing from runtime data so that
 * consumers can degrade gracefully.
 */
export const resolveCommerceTaxonomyCategories = (
	resources: PhotonResources | undefined,
	config: CommerceTaxonomyCategoriesBindingConfig,
): readonly CommerceTaxonomyTermView[] => {
	const map = getCommerceTaxonomyCategoriesResource(resources);
	const terms = map[config.taxonomy] ?? [];

	const filtered =
		typeof config.rootSlug === "string" && config.rootSlug.length > 0
			? terms.filter((term) => term.slug !== config.rootSlug)
			: terms;

	const limited =
		typeof config.limit === "number" && Number.isFinite(config.limit)
			? filtered.slice(0, Math.max(0, Math.floor(config.limit)))
			: filtered;

	return limited;
};

/**
 * Merge a taxonomy term array into the resource bag under the
 * `commerce.taxonomy.categories` source. Used by the Next.js page
 * decorator to hydrate runtime data from the Laravel backend.
 *
 * Existing entries for other taxonomies are preserved; the entry for
 * `taxonomy` is overwritten with the supplied terms.
 */
export const writeCommerceTaxonomyCategoriesResource = (
	resources: PhotonResources,
	taxonomy: string,
	terms: readonly CommerceTaxonomyTermView[],
): PhotonResources => {
	const previous = getCommerceTaxonomyCategoriesResource(resources);

	return {
		...resources,
		[COMMERCE_TAXONOMY_CATEGORIES_SOURCE]: {
			...previous,
			[taxonomy]: terms,
		},
	};
};

/**
 * Stable binding source key for commerce taxonomy ingredients.
 *
 * Mirrors `commerce.taxonomy.categories` but is used by filter blocks
 * that need to bind specifically to ingredient-style taxonomies.
 *
 * Blocks declare:
 *
 *   bindings: {
 *     ingredients: {
 *       source: COMMERCE_TAXONOMY_INGREDIENTS_SOURCE,
 *       path: "<ingredient-taxonomy-slug>",
 *       mode: "read",
 *     },
 *   }
 */
export const COMMERCE_TAXONOMY_INGREDIENTS_SOURCE =
	"commerce.taxonomy.ingredients";

/**
 * Optional configuration that consumers may attach to the binding
 * descriptor. Same shape as the categories binding config.
 */
export type CommerceTaxonomyIngredientsBindingConfig = {
	taxonomy: string;
	limit?: number;
	rootSlug?: string;
};

/**
 * Shape stored under `resources[COMMERCE_TAXONOMY_INGREDIENTS_SOURCE]`.
 *
 * Keys are taxonomy slugs (matching `binding.path`); values are flat term
 * arrays already projected for public consumption. Re-uses
 * `CommerceTaxonomyTermView`.
 */
export type CommerceTaxonomyIngredientsResource = Record<
	string,
	readonly CommerceTaxonomyTermView[]
>;

/**
 * Read the full ingredient taxonomy resource map from a resolved page's
 * `resources` bag. Returns an empty object if hydration is missing so
 * consumers can fall back gracefully (e.g. to author-supplied props).
 */
export const getCommerceTaxonomyIngredientsResource = (
	resources: PhotonResources | undefined,
): CommerceTaxonomyIngredientsResource => {
	const raw = resources?.[COMMERCE_TAXONOMY_INGREDIENTS_SOURCE];

	if (!raw || typeof raw !== "object") {
		return {};
	}

	return raw as CommerceTaxonomyIngredientsResource;
};

/**
 * Read a single ingredient taxonomy's term list from a resolved page's
 * `resources` bag, applying optional `limit` and `rootSlug` filters.
 *
 * Returns `[]` if the taxonomy is missing from runtime data so that
 * consumers can degrade gracefully.
 */
export const resolveCommerceTaxonomyIngredients = (
	resources: PhotonResources | undefined,
	config: CommerceTaxonomyIngredientsBindingConfig,
): readonly CommerceTaxonomyTermView[] => {
	const map = getCommerceTaxonomyIngredientsResource(resources);
	const terms = map[config.taxonomy] ?? [];

	const filtered =
		typeof config.rootSlug === "string" && config.rootSlug.length > 0
			? terms.filter((term) => term.slug !== config.rootSlug)
			: terms;

	const limited =
		typeof config.limit === "number" && Number.isFinite(config.limit)
			? filtered.slice(0, Math.max(0, Math.floor(config.limit)))
			: filtered;

	return limited;
};

/**
 * Merge a taxonomy term array into the resource bag under the
 * `commerce.taxonomy.ingredients` source. Used by the Next.js page
 * decorator to hydrate runtime data from the Laravel backend.
 *
 * Existing entries for other taxonomies are preserved; the entry for
 * `taxonomy` is overwritten with the supplied terms.
 */
export const writeCommerceTaxonomyIngredientsResource = (
	resources: PhotonResources,
	taxonomy: string,
	terms: readonly CommerceTaxonomyTermView[],
): PhotonResources => {
	const previous = getCommerceTaxonomyIngredientsResource(resources);

	return {
		...resources,
		[COMMERCE_TAXONOMY_INGREDIENTS_SOURCE]: {
			...previous,
			[taxonomy]: terms,
		},
	};
};
