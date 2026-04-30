import { coerceInterfaceLocale } from "@init/photon/shared";
import {
	createPhotonAppModule,
	createPhotonSourceIdProfileTreeResolver,
	type PhotonAppModule,
	type PhotonAppModuleServiceMap,
} from "@init/photon-nextjs";
import {
	commerceProfileDesignTemplates,
	commerceProfileTemplatePresets,
	createCommerceProfileTemplateTree,
	isCommerceProfileTemplateSource,
} from "@init/commerce-profile-templates/documents";
import {
	commerceCartContribution,
	commerceCatalogLinkContribution,
	commerceFooterShopColumnContribution,
} from "./contributions";
import {
	commerceDesignTemplates,
	commerceProfileStarterPresets,
	createCommerceAccountOrdersDocument,
	createCommerceStarterProfileTree,
	type CommercePhotonLocale,
} from "./documents";

const COMMERCE_PHOTON_SUPPORTED_LOCALES: readonly CommercePhotonLocale[] = [
	"en",
	"ru",
];

const coerceCommercePhotonLocale = (locale: string): CommercePhotonLocale =>
	coerceInterfaceLocale(locale, {
		supported: COMMERCE_PHOTON_SUPPORTED_LOCALES,
		fallback: "en",
	}) as CommercePhotonLocale;

export type CreateCommercePhotonAppModuleOptions = {
	services?: PhotonAppModuleServiceMap;
};

export const createCommercePhotonAppModule = (
	options: CreateCommercePhotonAppModuleOptions = {},
): PhotonAppModule =>
	createPhotonAppModule({
		name: "commerce-photon",
		services: {
			http: "inherit",
			...(options.services ?? {}),
		},
		packagedDocuments: {
			documents: {
				commerceAccountOrders: createCommerceAccountOrdersDocument("en"),
			},
		},
		siteFrameContributions: [
			commerceCatalogLinkContribution,
			commerceCartContribution,
			commerceFooterShopColumnContribution,
		],
		profileSources: {
			presets: [
				...commerceProfileStarterPresets,
				...commerceProfileTemplatePresets,
			],
			templates: [
				...commerceDesignTemplates,
				...commerceProfileDesignTemplates,
			],
		},
		profileTreeResolvers: [
			{
				match: (source) =>
					(source.type === "preset" || source.type === "template") &&
					isCommerceProfileTemplateSource(source),
				createTree: (locale, source) =>
					createCommerceProfileTemplateTree(
						coerceCommercePhotonLocale(locale),
						source as Parameters<typeof createCommerceProfileTemplateTree>[1],
					),
			},
			createPhotonSourceIdProfileTreeResolver(
				[
					...commerceProfileStarterPresets.map((preset) => preset.id),
					...commerceDesignTemplates.map((template) => template.id),
				],
				(locale, source) =>
					createCommerceStarterProfileTree(
						coerceCommercePhotonLocale(locale),
						source as Parameters<typeof createCommerceStarterProfileTree>[1],
					),
			),
		],
	});
