"use client";

import {
	createWebsiteBuilderKit,
	type WebsiteBuilderInstallableKit,
	type WebsiteBuilderModule,
} from "@init-modules/website-builder";
import {
	commerceAddToCartDefinition,
	commerceCartSummaryDefinition,
	commerceCheckoutFormDefinition,
	commerceOrderListDefinition,
	commerceProductDetailDefinition,
	commerceProductGridDefinition,
} from "./blocks";
import { commerceWebsiteBuilderDocuments } from "./documents";
import {
	commerceOrdersAccountTab,
	commerceWebsiteBuilderSiteFrameExtension,
} from "./sdk";

export const commerceWebsiteBuilderModule: WebsiteBuilderModule = {
	module: "commerce-website-builder",
	label: "Commerce Website Builder",
	labelKey: "commerceWebsiteBuilder.module.label",
	version: "0.1.0",
	blocks: [
		commerceProductGridDefinition,
		commerceProductDetailDefinition,
		commerceAddToCartDefinition,
		commerceCartSummaryDefinition,
		commerceCheckoutFormDefinition,
		commerceOrderListDefinition,
	],
};

export const commerceWebsiteBuilderKit: WebsiteBuilderInstallableKit =
	createWebsiteBuilderKit({
		key: "commerce-website-builder",
		label: "Commerce Website Builder",
		modules: [commerceWebsiteBuilderModule],
		documents: commerceWebsiteBuilderDocuments,
		siteFrameExtensions: [commerceWebsiteBuilderSiteFrameExtension],
		accountTabs: [commerceOrdersAccountTab],
	});
