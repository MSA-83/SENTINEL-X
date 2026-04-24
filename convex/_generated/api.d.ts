/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ViktorSpacesEmail from "../ViktorSpacesEmail.js";
import type * as _revokeLegacyTestAuth from "../_revokeLegacyTestAuth.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as cases from "../cases.js";
import type * as configApi from "../configApi.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as diagnostics from "../diagnostics.js";
import type * as entities from "../entities.js";
import type * as entitiesInternal from "../entitiesInternal.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as integrations_adsb from "../integrations/adsb.js";
import type * as integrations_avwx from "../integrations/avwx.js";
import type * as integrations_celestrak from "../integrations/celestrak.js";
import type * as integrations_cisa from "../integrations/cisa.js";
import type * as integrations_copernicus from "../integrations/copernicus.js";
import type * as integrations_cyberfeeds from "../integrations/cyberfeeds.js";
import type * as integrations_firms from "../integrations/firms.js";
import type * as integrations_gdacs from "../integrations/gdacs.js";
import type * as integrations_gdelt from "../integrations/gdelt.js";
import type * as integrations_gfw from "../integrations/gfw.js";
import type * as integrations_helpers from "../integrations/helpers.js";
import type * as integrations_iss from "../integrations/iss.js";
import type * as integrations_n2yo from "../integrations/n2yo.js";
import type * as integrations_newsapi from "../integrations/newsapi.js";
import type * as integrations_openweather from "../integrations/openweather.js";
import type * as integrations_planet from "../integrations/planet.js";
import type * as integrations_reddit from "../integrations/reddit.js";
import type * as integrations_shodan from "../integrations/shodan.js";
import type * as integrations_spacetrack from "../integrations/spacetrack.js";
import type * as integrations_threatEngine from "../integrations/threatEngine.js";
import type * as integrations_triggerAll from "../integrations/triggerAll.js";
import type * as integrations_usgs from "../integrations/usgs.js";
import type * as knowledgeGraph from "../knowledgeGraph.js";
import type * as lib_envHelper from "../lib/envHelper.js";
import type * as seed from "../seed.js";
import type * as seedPhase14 from "../seedPhase14.js";
import type * as seedTestUser from "../seedTestUser.js";
import type * as seedTrigger from "../seedTrigger.js";
import type * as testAuth from "../testAuth.js";
import type * as threatQueries from "../threatQueries.js";
import type * as users from "../users.js";
import type * as viktorTools from "../viktorTools.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ViktorSpacesEmail: typeof ViktorSpacesEmail;
  _revokeLegacyTestAuth: typeof _revokeLegacyTestAuth;
  admin: typeof admin;
  auth: typeof auth;
  cases: typeof cases;
  configApi: typeof configApi;
  constants: typeof constants;
  crons: typeof crons;
  diagnostics: typeof diagnostics;
  entities: typeof entities;
  entitiesInternal: typeof entitiesInternal;
  http: typeof http;
  init: typeof init;
  "integrations/adsb": typeof integrations_adsb;
  "integrations/avwx": typeof integrations_avwx;
  "integrations/celestrak": typeof integrations_celestrak;
  "integrations/cisa": typeof integrations_cisa;
  "integrations/copernicus": typeof integrations_copernicus;
  "integrations/cyberfeeds": typeof integrations_cyberfeeds;
  "integrations/firms": typeof integrations_firms;
  "integrations/gdacs": typeof integrations_gdacs;
  "integrations/gdelt": typeof integrations_gdelt;
  "integrations/gfw": typeof integrations_gfw;
  "integrations/helpers": typeof integrations_helpers;
  "integrations/iss": typeof integrations_iss;
  "integrations/n2yo": typeof integrations_n2yo;
  "integrations/newsapi": typeof integrations_newsapi;
  "integrations/openweather": typeof integrations_openweather;
  "integrations/planet": typeof integrations_planet;
  "integrations/reddit": typeof integrations_reddit;
  "integrations/shodan": typeof integrations_shodan;
  "integrations/spacetrack": typeof integrations_spacetrack;
  "integrations/threatEngine": typeof integrations_threatEngine;
  "integrations/triggerAll": typeof integrations_triggerAll;
  "integrations/usgs": typeof integrations_usgs;
  knowledgeGraph: typeof knowledgeGraph;
  "lib/envHelper": typeof lib_envHelper;
  seed: typeof seed;
  seedPhase14: typeof seedPhase14;
  seedTestUser: typeof seedTestUser;
  seedTrigger: typeof seedTrigger;
  testAuth: typeof testAuth;
  threatQueries: typeof threatQueries;
  users: typeof users;
  viktorTools: typeof viktorTools;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
