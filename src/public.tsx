"use client";

import {
	createPhotonKit,
	type PhotonInstallableKit,
	type PhotonModule,
} from "@init/photon/public";
import {
	commerceAddToCartDefinition,
	commerceCartSummaryDefinition,
	commerceCheckoutFormDefinition,
	commerceOrderListDefinition,
	commerceProductDetailDefinition,
	commerceProductFiltersDefinition,
	commerceProductGridDefinition,
} from "./blocks";
import {
	commerceOrdersAccountTab,
	commercePhotonSiteFrameExtension,
} from "./sdk";

export const commercePublicPhotonModule: PhotonModule = {
	module: "commerce-photon",
	label: "Commerce Photon",
	labelKey: "commercePhoton.module.label",
	version: "0.1.0",
	blocks: [
		commerceProductGridDefinition,
		commerceProductFiltersDefinition,
		commerceProductDetailDefinition,
		commerceAddToCartDefinition,
		commerceCartSummaryDefinition,
		commerceCheckoutFormDefinition,
		commerceOrderListDefinition,
	],
};

export const commercePublicPhotonKit: PhotonInstallableKit =
	createPhotonKit({
		key: "commerce-photon",
		label: "Commerce Photon",
		modules: [commercePublicPhotonModule],
		siteFrameExtensions: [commercePhotonSiteFrameExtension],
		accountTabs: [commerceOrdersAccountTab],
	});
