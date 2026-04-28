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
import { commercePhotonDocuments } from "./documents";
import {
	commerceOrdersAccountTab,
	commercePhotonSiteFrameExtension,
} from "./sdk";

export const commercePhotonModule: PhotonModule = {
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

export const commercePhotonKit: PhotonInstallableKit =
	createPhotonKit({
		key: "commerce-photon",
		label: "Commerce Photon",
		modules: [commercePhotonModule],
		documents: commercePhotonDocuments,
		siteFrameExtensions: [commercePhotonSiteFrameExtension],
		accountTabs: [commerceOrdersAccountTab],
	});
