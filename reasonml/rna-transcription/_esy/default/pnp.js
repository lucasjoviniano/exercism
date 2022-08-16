#!/usr/bin/env node
/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, $$BLACKLIST, $$SETUP_STATIC_TABLES */

// Used for the resolveUnqualified part of the resolution (ie resolving folder/index.js & file extensions)
// Deconstructed so that they aren't affected by any fs monkeypatching occuring later during the execution
const {statSync, lstatSync, readlinkSync, readFileSync, existsSync, realpathSync} = require('fs');

const Module = require('module');
const path = require('path');
const StringDecoder = require('string_decoder');

const $$BLACKLIST = null;
const ignorePattern = $$BLACKLIST ? new RegExp($$BLACKLIST) : null;

const pnpFile = path.resolve(__dirname, __filename);
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

const topLevelLocator = {name: null, reference: null};
const blacklistedLocator = {name: NaN, reference: NaN};

// Used for compatibility purposes - cf setupCompatibilityLayer
const patchedModules = new Map();
const fallbackLocators = [topLevelLocator];

// Matches backslashes of Windows paths
const backwardSlashRegExp = /\\/g;

// Matches if the path must point to a directory (ie ends with /)
const isDirRegExp = /\/$/;

// Matches if the path starts with a valid path qualifier (./, ../, /)
// eslint-disable-next-line no-unused-vars
const isStrictRegExp = /^\.{0,2}/;

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![A-Za-z]:)(?!\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

// Keep a reference around ("module" is a common name in this context, so better rename it to something more significant)
const pnpModule = module;

/**
 * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
 * a way to "reset" the environment temporarily)
 */

let enableNativeHooks = true;

/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

function makeError(code, message, data = {}) {
  const error = new Error(message);
  return Object.assign(error, {code, data});
}

/**
 * Ensures that the returned locator isn't a blacklisted one.
 *
 * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
 * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.
 *
 * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
 * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
 * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
 * will always have the same set of dependencies, provided the symlinks are correctly preserved.
 *
 * Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
 * dependencies based on the path of the file that makes the require calls. But since we've blacklisted those paths,
 * we're able to print a more helpful error message that points out that a third-party package is doing something
 * incompatible!
 */

// eslint-disable-next-line no-unused-vars
function blacklistCheck(locator) {
  if (locator === blacklistedLocator) {
    throw makeError(
      `BLACKLISTED`,
      [
        `A package has been resolved through a blacklisted path - this is usually caused by one of your tools calling`,
        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,
        `peer dependencies, they must be passed untransformed to "require".`,
      ].join(` `)
    );
  }

  return locator;
}

let packageInformationStores = new Map([
["@ampproject/remapping",
new Map([["2.2.0",
         {
           packageLocation: "/home/lucas/.esy/source/i/ampproject__s__remapping__2.2.0__f81d8b75/",
           packageDependencies: new Map([["@ampproject/remapping", "2.2.0"],
                                           ["@jridgewell/gen-mapping",
                                           "0.1.1"],
                                           ["@jridgewell/trace-mapping",
                                           "0.3.14"]])}]])],
  ["@babel/code-frame",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__code_frame__7.18.6__15c24586/",
             packageDependencies: new Map([["@babel/code-frame", "7.18.6"],
                                             ["@babel/highlight", "7.18.6"]])}]])],
  ["@babel/compat-data",
  new Map([["7.18.8",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__compat_data__7.18.8__7b58b877/",
             packageDependencies: new Map([["@babel/compat-data", "7.18.8"]])}]])],
  ["@babel/core",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__core__7.18.9__0c8a6787/",
             packageDependencies: new Map([["@ampproject/remapping", "2.2.0"],
                                             ["@babel/code-frame", "7.18.6"],
                                             ["@babel/core", "7.18.9"],
                                             ["@babel/generator", "7.18.9"],
                                             ["@babel/helper-compilation-targets",
                                             "7.18.9"],
                                             ["@babel/helper-module-transforms",
                                             "7.18.9"],
                                             ["@babel/helpers", "7.18.9"],
                                             ["@babel/parser", "7.18.9"],
                                             ["@babel/template", "7.18.6"],
                                             ["@babel/traverse", "7.18.9"],
                                             ["@babel/types", "7.18.9"],
                                             ["convert-source-map", "1.8.0"],
                                             ["debug", "4.3.4"],
                                             ["gensync", "1.0.0-beta.2"],
                                             ["json5", "2.2.1"],
                                             ["semver", "6.3.0"]])}]])],
  ["@babel/generator",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__generator__7.18.9__fb432c17/",
             packageDependencies: new Map([["@babel/generator", "7.18.9"],
                                             ["@babel/types", "7.18.9"],
                                             ["@jridgewell/gen-mapping",
                                             "0.3.2"],
                                             ["jsesc", "2.5.2"]])}]])],
  ["@babel/helper-compilation-targets",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_compilation_targets__7.18.9__814722fb/",
             packageDependencies: new Map([["@babel/compat-data", "7.18.8"],
                                             ["@babel/core", "7.18.9"],
                                             ["@babel/helper-compilation-targets",
                                             "7.18.9"],
                                             ["@babel/helper-validator-option",
                                             "7.18.6"],
                                             ["browserslist", "4.21.2"],
                                             ["semver", "6.3.0"]])}]])],
  ["@babel/helper-environment-visitor",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_environment_visitor__7.18.9__9e5b7c18/",
             packageDependencies: new Map([["@babel/helper-environment-visitor",
                                           "7.18.9"]])}]])],
  ["@babel/helper-function-name",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_function_name__7.18.9__4550610a/",
             packageDependencies: new Map([["@babel/helper-function-name",
                                           "7.18.9"],
                                             ["@babel/template", "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-hoist-variables",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_hoist_variables__7.18.6__e4954502/",
             packageDependencies: new Map([["@babel/helper-hoist-variables",
                                           "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-module-imports",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_module_imports__7.18.6__9ba15c30/",
             packageDependencies: new Map([["@babel/helper-module-imports",
                                           "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-module-transforms",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_module_transforms__7.18.9__0411f3bf/",
             packageDependencies: new Map([["@babel/helper-environment-visitor",
                                           "7.18.9"],
                                             ["@babel/helper-module-imports",
                                             "7.18.6"],
                                             ["@babel/helper-module-transforms",
                                             "7.18.9"],
                                             ["@babel/helper-simple-access",
                                             "7.18.6"],
                                             ["@babel/helper-split-export-declaration",
                                             "7.18.6"],
                                             ["@babel/helper-validator-identifier",
                                             "7.18.6"],
                                             ["@babel/template", "7.18.6"],
                                             ["@babel/traverse", "7.18.9"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-plugin-utils",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_plugin_utils__7.18.9__c84cb08d/",
             packageDependencies: new Map([["@babel/helper-plugin-utils",
                                           "7.18.9"]])}]])],
  ["@babel/helper-simple-access",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_simple_access__7.18.6__e95f8d00/",
             packageDependencies: new Map([["@babel/helper-simple-access",
                                           "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-split-export-declaration",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_split_export_declaration__7.18.6__419b17ea/",
             packageDependencies: new Map([["@babel/helper-split-export-declaration",
                                           "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/helper-validator-identifier",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_validator_identifier__7.18.6__f5b0b43e/",
             packageDependencies: new Map([["@babel/helper-validator-identifier",
                                           "7.18.6"]])}]])],
  ["@babel/helper-validator-option",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helper_validator_option__7.18.6__a2479f6c/",
             packageDependencies: new Map([["@babel/helper-validator-option",
                                           "7.18.6"]])}]])],
  ["@babel/helpers",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__helpers__7.18.9__c461fc4f/",
             packageDependencies: new Map([["@babel/helpers", "7.18.9"],
                                             ["@babel/template", "7.18.6"],
                                             ["@babel/traverse", "7.18.9"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/highlight",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__highlight__7.18.6__22428d3f/",
             packageDependencies: new Map([["@babel/helper-validator-identifier",
                                           "7.18.6"],
                                             ["@babel/highlight", "7.18.6"],
                                             ["chalk", "2.4.2"],
                                             ["js-tokens", "4.0.0"]])}]])],
  ["@babel/parser",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__parser__7.18.9__b95de411/",
             packageDependencies: new Map([["@babel/parser", "7.18.9"]])}]])],
  ["@babel/plugin-syntax-async-generators",
  new Map([["7.8.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_async_generators__7.8.4__e8a36b86/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-async-generators",
                                             "7.8.4"]])}]])],
  ["@babel/plugin-syntax-bigint",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_bigint__7.8.3__2b73dbf5/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-bigint",
                                             "7.8.3"]])}]])],
  ["@babel/plugin-syntax-class-properties",
  new Map([["7.12.13",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_class_properties__7.12.13__aced802e/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-class-properties",
                                             "7.12.13"]])}]])],
  ["@babel/plugin-syntax-import-meta",
  new Map([["7.10.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_import_meta__7.10.4__659b066d/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-import-meta",
                                             "7.10.4"]])}]])],
  ["@babel/plugin-syntax-json-strings",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_json_strings__7.8.3__caabb7e8/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-json-strings",
                                             "7.8.3"]])}]])],
  ["@babel/plugin-syntax-logical-assignment-operators",
  new Map([["7.10.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_logical_assignment_operators__7.10.4__8cdb093f/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-logical-assignment-operators",
                                             "7.10.4"]])}]])],
  ["@babel/plugin-syntax-nullish-coalescing-operator",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_nullish_coalescing_operator__7.8.3__e55fc3df/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-nullish-coalescing-operator",
                                             "7.8.3"]])}]])],
  ["@babel/plugin-syntax-numeric-separator",
  new Map([["7.10.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_numeric_separator__7.10.4__b2d0bb12/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-numeric-separator",
                                             "7.10.4"]])}]])],
  ["@babel/plugin-syntax-object-rest-spread",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_object_rest_spread__7.8.3__2693ed1f/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-object-rest-spread",
                                             "7.8.3"]])}]])],
  ["@babel/plugin-syntax-optional-catch-binding",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_optional_catch_binding__7.8.3__9c1a5a0e/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-optional-catch-binding",
                                             "7.8.3"]])}]])],
  ["@babel/plugin-syntax-optional-chaining",
  new Map([["7.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__plugin_syntax_optional_chaining__7.8.3__9e671e05/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/helper-plugin-utils",
                                             "7.18.9"],
                                             ["@babel/plugin-syntax-optional-chaining",
                                             "7.8.3"]])}]])],
  ["@babel/template",
  new Map([["7.18.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__template__7.18.6__72cd41cb/",
             packageDependencies: new Map([["@babel/code-frame", "7.18.6"],
                                             ["@babel/parser", "7.18.9"],
                                             ["@babel/template", "7.18.6"],
                                             ["@babel/types", "7.18.9"]])}]])],
  ["@babel/traverse",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__traverse__7.18.9__9b9cacd7/",
             packageDependencies: new Map([["@babel/code-frame", "7.18.6"],
                                             ["@babel/generator", "7.18.9"],
                                             ["@babel/helper-environment-visitor",
                                             "7.18.9"],
                                             ["@babel/helper-function-name",
                                             "7.18.9"],
                                             ["@babel/helper-hoist-variables",
                                             "7.18.6"],
                                             ["@babel/helper-split-export-declaration",
                                             "7.18.6"],
                                             ["@babel/parser", "7.18.9"],
                                             ["@babel/traverse", "7.18.9"],
                                             ["@babel/types", "7.18.9"],
                                             ["debug", "4.3.4"],
                                             ["globals", "11.12.0"]])}]])],
  ["@babel/types",
  new Map([["7.18.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel__s__types__7.18.9__7427cd40/",
             packageDependencies: new Map([["@babel/helper-validator-identifier",
                                           "7.18.6"],
                                             ["@babel/types", "7.18.9"],
                                             ["to-fast-properties", "2.0.0"]])}]])],
  ["@bcoe/v8-coverage",
  new Map([["0.2.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/bcoe__s__v8_coverage__0.2.3__09e145cc/",
             packageDependencies: new Map([["@bcoe/v8-coverage", "0.2.3"]])}]])],
  ["@cnakazawa/watch",
  new Map([["1.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/cnakazawa__s__watch__1.0.4__7661a2dc/",
             packageDependencies: new Map([["@cnakazawa/watch", "1.0.4"],
                                             ["exec-sh", "0.3.6"],
                                             ["minimist", "1.2.6"]])}]])],
  ["@esy-ocaml/substs",
  new Map([["0.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/esy_ocaml__s__substs__0.0.1__19de1ee1/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"]])}]])],
  ["@glennsl/bs-jest",
  new Map([["0.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/glennsl__s__bs_jest__0.5.1__2046b7a1/",
             packageDependencies: new Map([["@glennsl/bs-jest", "0.5.1"],
                                             ["jest", "25.5.4"]])}]])],
  ["@istanbuljs/load-nyc-config",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbuljs__s__load_nyc_config__1.1.0__d99934e0/",
             packageDependencies: new Map([["@istanbuljs/load-nyc-config",
                                           "1.1.0"],
                                             ["camelcase", "5.3.1"],
                                             ["find-up", "4.1.0"],
                                             ["get-package-type", "0.1.0"],
                                             ["js-yaml", "3.14.1"],
                                             ["resolve-from", "5.0.0"]])}]])],
  ["@istanbuljs/schema",
  new Map([["0.1.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbuljs__s__schema__0.1.3__c54ca3b9/",
             packageDependencies: new Map([["@istanbuljs/schema", "0.1.3"]])}]])],
  ["@jest/console",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__console__25.5.0__211aedcf/",
             packageDependencies: new Map([["@jest/console", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-util", "25.5.0"],
                                             ["slash", "3.0.0"]])}]])],
  ["@jest/core",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__core__25.5.4__6b36bff5/",
             packageDependencies: new Map([["@jest/console", "25.5.0"],
                                             ["@jest/core", "25.5.4"],
                                             ["@jest/reporters", "25.5.1"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/transform", "25.5.1"],
                                             ["@jest/types", "25.5.0"],
                                             ["ansi-escapes", "4.3.2"],
                                             ["chalk", "3.0.0"],
                                             ["exit", "0.1.2"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-changed-files", "25.5.0"],
                                             ["jest-config", "25.5.4"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-regex-util", "25.2.6"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-resolve-dependencies",
                                             "25.5.4"],
                                             ["jest-runner", "25.5.4"],
                                             ["jest-runtime", "25.5.4"],
                                             ["jest-snapshot", "25.5.1"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-validate", "25.5.0"],
                                             ["jest-watcher", "25.5.0"],
                                             ["micromatch", "4.0.5"],
                                             ["p-each-series", "2.2.0"],
                                             ["realpath-native", "2.0.0"],
                                             ["rimraf", "3.0.2"],
                                             ["slash", "3.0.0"],
                                             ["strip-ansi", "6.0.1"]])}]])],
  ["@jest/environment",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__environment__25.5.0__bf8c0583/",
             packageDependencies: new Map([["@jest/environment", "25.5.0"],
                                             ["@jest/fake-timers", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["jest-mock", "25.5.0"]])}]])],
  ["@jest/fake-timers",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__fake_timers__25.5.0__47ab4b84/",
             packageDependencies: new Map([["@jest/fake-timers", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-mock", "25.5.0"],
                                             ["jest-util", "25.5.0"],
                                             ["lolex", "5.1.2"]])}]])],
  ["@jest/globals",
  new Map([["25.5.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__globals__25.5.2__37315980/",
             packageDependencies: new Map([["@jest/environment", "25.5.0"],
                                             ["@jest/globals", "25.5.2"],
                                             ["@jest/types", "25.5.0"],
                                             ["expect", "25.5.0"]])}]])],
  ["@jest/reporters",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__reporters__25.5.1__0955b45c/",
             packageDependencies: new Map([["@bcoe/v8-coverage", "0.2.3"],
                                             ["@jest/console", "25.5.0"],
                                             ["@jest/reporters", "25.5.1"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/transform", "25.5.1"],
                                             ["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["collect-v8-coverage", "1.0.1"],
                                             ["exit", "0.1.2"],
                                             ["glob", "7.2.3"],
                                             ["graceful-fs", "4.2.10"],
                                             ["istanbul-lib-coverage",
                                             "3.2.0"],
                                             ["istanbul-lib-instrument",
                                             "4.0.3"],
                                             ["istanbul-lib-report", "3.0.0"],
                                             ["istanbul-lib-source-maps",
                                             "4.0.1"],
                                             ["istanbul-reports", "3.1.5"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-worker", "25.5.0"],
                                             ["node-notifier", "6.0.0"],
                                             ["slash", "3.0.0"],
                                             ["source-map", "0.6.1"],
                                             ["string-length", "3.1.0"],
                                             ["terminal-link", "2.1.1"],
                                             ["v8-to-istanbul", "4.1.4"]])}]])],
  ["@jest/source-map",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__source_map__25.5.0__7672fae3/",
             packageDependencies: new Map([["@jest/source-map", "25.5.0"],
                                             ["callsites", "3.1.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["source-map", "0.6.1"]])}]])],
  ["@jest/test-result",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__test_result__25.5.0__6364246c/",
             packageDependencies: new Map([["@jest/console", "25.5.0"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["@types/istanbul-lib-coverage",
                                             "2.0.4"],
                                             ["collect-v8-coverage", "1.0.1"]])}]])],
  ["@jest/test-sequencer",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__test_sequencer__25.5.4__5e6ef657/",
             packageDependencies: new Map([["@jest/test-result", "25.5.0"],
                                             ["@jest/test-sequencer",
                                             "25.5.4"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-runner", "25.5.4"],
                                             ["jest-runtime", "25.5.4"]])}]])],
  ["@jest/transform",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__transform__25.5.1__9b38e941/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@jest/transform", "25.5.1"],
                                             ["@jest/types", "25.5.0"],
                                             ["babel-plugin-istanbul",
                                             "6.1.1"],
                                             ["chalk", "3.0.0"],
                                             ["convert-source-map", "1.8.0"],
                                             ["fast-json-stable-stringify",
                                             "2.1.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-regex-util", "25.2.6"],
                                             ["jest-util", "25.5.0"],
                                             ["micromatch", "4.0.5"],
                                             ["pirates", "4.0.5"],
                                             ["realpath-native", "2.0.0"],
                                             ["slash", "3.0.0"],
                                             ["source-map", "0.6.1"],
                                             ["write-file-atomic", "3.0.3"]])}]])],
  ["@jest/types",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__s__types__25.5.0__80b50804/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["@types/istanbul-lib-coverage",
                                             "2.0.4"],
                                             ["@types/istanbul-reports",
                                             "1.1.2"],
                                             ["@types/yargs", "15.0.14"],
                                             ["chalk", "3.0.0"]])}]])],
  ["@jridgewell/gen-mapping",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__gen_mapping__0.1.1__052bb8b6/",
             packageDependencies: new Map([["@jridgewell/gen-mapping",
                                           "0.1.1"],
                                             ["@jridgewell/set-array",
                                             "1.1.2"],
                                             ["@jridgewell/sourcemap-codec",
                                             "1.4.14"]])}],
             ["0.3.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__gen_mapping__0.3.2__b06bbaa2/",
               packageDependencies: new Map([["@jridgewell/gen-mapping",
                                             "0.3.2"],
                                               ["@jridgewell/set-array",
                                               "1.1.2"],
                                               ["@jridgewell/sourcemap-codec",
                                               "1.4.14"],
                                               ["@jridgewell/trace-mapping",
                                               "0.3.14"]])}]])],
  ["@jridgewell/resolve-uri",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__resolve_uri__3.1.0__4aee1788/",
             packageDependencies: new Map([["@jridgewell/resolve-uri",
                                           "3.1.0"]])}]])],
  ["@jridgewell/set-array",
  new Map([["1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__set_array__1.1.2__b04e8e3c/",
             packageDependencies: new Map([["@jridgewell/set-array", "1.1.2"]])}]])],
  ["@jridgewell/sourcemap-codec",
  new Map([["1.4.14",
           {
             packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__sourcemap_codec__1.4.14__762eae32/",
             packageDependencies: new Map([["@jridgewell/sourcemap-codec",
                                           "1.4.14"]])}]])],
  ["@jridgewell/trace-mapping",
  new Map([["0.3.14",
           {
             packageLocation: "/home/lucas/.esy/source/i/jridgewell__s__trace_mapping__0.3.14__604e3439/",
             packageDependencies: new Map([["@jridgewell/resolve-uri",
                                           "3.1.0"],
                                             ["@jridgewell/sourcemap-codec",
                                             "1.4.14"],
                                             ["@jridgewell/trace-mapping",
                                             "0.3.14"]])}]])],
  ["@opam/base-bigarray",
  new Map([["opam:base",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__base_bigarray__opam__c__base__37a71828/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-bigarray",
                                             "opam:base"]])}]])],
  ["@opam/base-bytes",
  new Map([["opam:base",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__base_bytes__opam__c__base__48b6019a/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-bytes",
                                             "opam:base"],
                                             ["@opam/ocamlfind",
                                             "opam:1.9.5"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/base-threads",
  new Map([["opam:base",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__base_threads__opam__c__base__f282958b/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-threads",
                                             "opam:base"]])}]])],
  ["@opam/base-unix",
  new Map([["opam:base",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__base_unix__opam__c__base__93427a57/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-unix", "opam:base"]])}]])],
  ["@opam/chrome-trace",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__chrome_trace__opam__c__3.4.0__5efc5e35/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/chrome-trace",
                                             "opam:3.4.0"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/cppo",
  new Map([["opam:1.6.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__cppo__opam__c__1.6.9__327e8fcf/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-unix", "opam:base"],
                                             ["@opam/cppo", "opam:1.6.9"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/csexp",
  new Map([["opam:1.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__csexp__opam__c__1.5.1__a5d42d7e/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/csexp", "opam:1.5.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/dune",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__dune__opam__c__3.4.0__0aebd8ff/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-threads",
                                             "opam:base"],
                                             ["@opam/base-unix", "opam:base"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/dune-build-info",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__dune_build_info__opam__c__3.4.0__2d68ffbc/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dune-build-info",
                                             "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/dune-rpc",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__dune_rpc__opam__c__3.4.0__9eec4682/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/csexp", "opam:1.5.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dune-rpc", "opam:3.4.0"],
                                             ["@opam/dyn", "opam:3.4.0"],
                                             ["@opam/ordering", "opam:3.4.0"],
                                             ["@opam/pp", "opam:1.1.2"],
                                             ["@opam/stdune", "opam:3.4.0"],
                                             ["@opam/xdg", "opam:3.4.0"]])}]])],
  ["@opam/dyn",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__dyn__opam__c__3.4.0__06b6e146/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dyn", "opam:3.4.0"],
                                             ["@opam/ordering", "opam:3.4.0"],
                                             ["@opam/pp", "opam:1.1.2"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/fiber",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__fiber__opam__c__3.4.0__d855e508/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dyn", "opam:3.4.0"],
                                             ["@opam/fiber", "opam:3.4.0"],
                                             ["@opam/stdune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ocaml-lsp-server",
  new Map([["opam:1.12.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ocaml_lsp_server__opam__c__1.12.4__00efc625/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/chrome-trace",
                                             "opam:3.4.0"],
                                             ["@opam/csexp", "opam:1.5.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dune-build-info",
                                             "opam:3.4.0"],
                                             ["@opam/dune-rpc", "opam:3.4.0"],
                                             ["@opam/dyn", "opam:3.4.0"],
                                             ["@opam/fiber", "opam:3.4.0"],
                                             ["@opam/ocaml-lsp-server",
                                             "opam:1.12.4"],
                                             ["@opam/ocamlformat-rpc-lib",
                                             "opam:0.24.1"],
                                             ["@opam/octavius", "opam:1.2.2"],
                                             ["@opam/omd", "opam:1.3.2"],
                                             ["@opam/ordering", "opam:3.4.0"],
                                             ["@opam/pp", "opam:1.1.2"],
                                             ["@opam/ppx_yojson_conv_lib",
                                             "opam:v0.15.0"],
                                             ["@opam/re", "opam:1.10.4"],
                                             ["@opam/spawn", "opam:v0.15.1"],
                                             ["@opam/stdune", "opam:3.4.0"],
                                             ["@opam/uutf", "opam:1.0.3"],
                                             ["@opam/xdg", "opam:3.4.0"],
                                             ["@opam/yojson", "opam:2.0.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ocamlbuild",
  new Map([["opam:0.14.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ocamlbuild__opam__c__0.14.1__3fd19d31/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/ocamlbuild",
                                             "opam:0.14.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ocamlfind",
  new Map([["opam:1.9.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ocamlfind__opam__c__1.9.5__da1d264f/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/ocamlfind",
                                             "opam:1.9.5"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ocamlformat-rpc-lib",
  new Map([["opam:0.24.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ocamlformat_rpc_lib__opam__c__0.24.1__6279b4e1/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/csexp", "opam:1.5.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/ocamlformat-rpc-lib",
                                             "opam:0.24.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/octavius",
  new Map([["opam:1.2.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__octavius__opam__c__1.2.2__96807fc5/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/octavius", "opam:1.2.2"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/omd",
  new Map([["opam:1.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__omd__opam__c__1.3.2__08ff160d/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-bigarray",
                                             "opam:base"],
                                             ["@opam/base-bytes",
                                             "opam:base"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/omd", "opam:1.3.2"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ordering",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ordering__opam__c__3.4.0__e89b2648/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/ordering", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/pp",
  new Map([["opam:1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__pp__opam__c__1.1.2__ebad31ff/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/pp", "opam:1.1.2"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/ppx_yojson_conv_lib",
  new Map([["opam:v0.15.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__ppx__yojson__conv__lib__opam__c__v0.15.0__fba50f2c/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/ppx_yojson_conv_lib",
                                             "opam:v0.15.0"],
                                             ["@opam/yojson", "opam:2.0.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/re",
  new Map([["opam:1.10.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__re__opam__c__1.10.4__39debd71/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/re", "opam:1.10.4"],
                                             ["@opam/seq", "opam:base"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/seq",
  new Map([["opam:base",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__seq__opam__c__base__a0c677b1/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/seq", "opam:base"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/spawn",
  new Map([["opam:v0.15.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__spawn__opam__c__v0.15.1__cdb37477/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/spawn", "opam:v0.15.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/stdune",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__stdune__opam__c__3.4.0__30f456ed/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/base-unix", "opam:base"],
                                             ["@opam/csexp", "opam:1.5.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/dyn", "opam:3.4.0"],
                                             ["@opam/ordering", "opam:3.4.0"],
                                             ["@opam/pp", "opam:1.1.2"],
                                             ["@opam/stdune", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/topkg",
  new Map([["opam:1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__topkg__opam__c__1.0.5__82377b68/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/ocamlbuild",
                                             "opam:0.14.1"],
                                             ["@opam/ocamlfind",
                                             "opam:1.9.5"],
                                             ["@opam/topkg", "opam:1.0.5"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/uutf",
  new Map([["opam:1.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__uutf__opam__c__1.0.3__8c042452/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/ocamlbuild",
                                             "opam:0.14.1"],
                                             ["@opam/ocamlfind",
                                             "opam:1.9.5"],
                                             ["@opam/topkg", "opam:1.0.5"],
                                             ["@opam/uutf", "opam:1.0.3"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/xdg",
  new Map([["opam:3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__xdg__opam__c__3.4.0__fd4457bf/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/xdg", "opam:3.4.0"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@opam/yojson",
  new Map([["opam:2.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/opam__s__yojson__opam__c__2.0.1__bb3d2a50/",
             packageDependencies: new Map([["@esy-ocaml/substs", "0.0.1"],
                                             ["@opam/cppo", "opam:1.6.9"],
                                             ["@opam/dune", "opam:3.4.0"],
                                             ["@opam/seq", "opam:base"],
                                             ["@opam/yojson", "opam:2.0.1"],
                                             ["ocaml", "4.14.0"]])}]])],
  ["@sinonjs/commons",
  new Map([["1.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/sinonjs__s__commons__1.8.3__242fff93/",
             packageDependencies: new Map([["@sinonjs/commons", "1.8.3"],
                                             ["type-detect", "4.0.8"]])}]])],
  ["@types/babel__core",
  new Map([["7.1.19",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__babel__core__7.1.19__64ca2dfa/",
             packageDependencies: new Map([["@babel/parser", "7.18.9"],
                                             ["@babel/types", "7.18.9"],
                                             ["@types/babel__core", "7.1.19"],
                                             ["@types/babel__generator",
                                             "7.6.4"],
                                             ["@types/babel__template",
                                             "7.4.1"],
                                             ["@types/babel__traverse",
                                             "7.17.1"]])}]])],
  ["@types/babel__generator",
  new Map([["7.6.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__babel__generator__7.6.4__ee169bf1/",
             packageDependencies: new Map([["@babel/types", "7.18.9"],
                                             ["@types/babel__generator",
                                             "7.6.4"]])}]])],
  ["@types/babel__template",
  new Map([["7.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__babel__template__7.4.1__f70ca473/",
             packageDependencies: new Map([["@babel/parser", "7.18.9"],
                                             ["@babel/types", "7.18.9"],
                                             ["@types/babel__template",
                                             "7.4.1"]])}]])],
  ["@types/babel__traverse",
  new Map([["7.17.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__babel__traverse__7.17.1__1477451b/",
             packageDependencies: new Map([["@babel/types", "7.18.9"],
                                             ["@types/babel__traverse",
                                             "7.17.1"]])}]])],
  ["@types/graceful-fs",
  new Map([["4.1.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__graceful_fs__4.1.5__686e200c/",
             packageDependencies: new Map([["@types/graceful-fs", "4.1.5"],
                                             ["@types/node", "18.6.1"]])}]])],
  ["@types/istanbul-lib-coverage",
  new Map([["2.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__istanbul_lib_coverage__2.0.4__e440b8f9/",
             packageDependencies: new Map([["@types/istanbul-lib-coverage",
                                           "2.0.4"]])}]])],
  ["@types/istanbul-lib-report",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__istanbul_lib_report__3.0.0__8520c681/",
             packageDependencies: new Map([["@types/istanbul-lib-coverage",
                                           "2.0.4"],
                                             ["@types/istanbul-lib-report",
                                             "3.0.0"]])}]])],
  ["@types/istanbul-reports",
  new Map([["1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__istanbul_reports__1.1.2__d5fe4e5d/",
             packageDependencies: new Map([["@types/istanbul-lib-coverage",
                                           "2.0.4"],
                                             ["@types/istanbul-lib-report",
                                             "3.0.0"],
                                             ["@types/istanbul-reports",
                                             "1.1.2"]])}]])],
  ["@types/node",
  new Map([["18.6.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__node__18.6.1__4097dba9/",
             packageDependencies: new Map([["@types/node", "18.6.1"]])}]])],
  ["@types/normalize-package-data",
  new Map([["2.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__normalize_package_data__2.4.1__f7d47d0a/",
             packageDependencies: new Map([["@types/normalize-package-data",
                                           "2.4.1"]])}]])],
  ["@types/prettier",
  new Map([["1.19.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__prettier__1.19.1__c5161cf8/",
             packageDependencies: new Map([["@types/prettier", "1.19.1"]])}]])],
  ["@types/stack-utils",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__stack_utils__1.0.1__d54caf55/",
             packageDependencies: new Map([["@types/stack-utils", "1.0.1"]])}]])],
  ["@types/yargs",
  new Map([["15.0.14",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__yargs__15.0.14__b3c72b18/",
             packageDependencies: new Map([["@types/yargs", "15.0.14"],
                                             ["@types/yargs-parser",
                                             "21.0.0"]])}]])],
  ["@types/yargs-parser",
  new Map([["21.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/types__s__yargs_parser__21.0.0__89996650/",
             packageDependencies: new Map([["@types/yargs-parser", "21.0.0"]])}]])],
  ["abab",
  new Map([["2.0.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/abab__2.0.6__478baada/",
             packageDependencies: new Map([["abab", "2.0.6"]])}]])],
  ["acorn",
  new Map([["6.4.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/acorn__6.4.2__3a5cdf52/",
             packageDependencies: new Map([["acorn", "6.4.2"]])}],
             ["7.4.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/acorn__7.4.1__3f870b81/",
               packageDependencies: new Map([["acorn", "7.4.1"]])}]])],
  ["acorn-globals",
  new Map([["4.3.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/acorn_globals__4.3.4__1fa6ef33/",
             packageDependencies: new Map([["acorn", "6.4.2"],
                                             ["acorn-globals", "4.3.4"],
                                             ["acorn-walk", "6.2.0"]])}]])],
  ["acorn-walk",
  new Map([["6.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/acorn_walk__6.2.0__ccf054da/",
             packageDependencies: new Map([["acorn-walk", "6.2.0"]])}]])],
  ["ajv",
  new Map([["6.12.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/ajv__6.12.6__c3a69fc4/",
             packageDependencies: new Map([["ajv", "6.12.6"],
                                             ["fast-deep-equal", "3.1.3"],
                                             ["fast-json-stable-stringify",
                                             "2.1.0"],
                                             ["json-schema-traverse",
                                             "0.4.1"],
                                             ["uri-js", "4.4.1"]])}]])],
  ["ansi-escapes",
  new Map([["4.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/ansi_escapes__4.3.2__4cee8c98/",
             packageDependencies: new Map([["ansi-escapes", "4.3.2"],
                                             ["type-fest", "0.21.3"]])}]])],
  ["ansi-regex",
  new Map([["4.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/ansi_regex__4.1.1__69701333/",
             packageDependencies: new Map([["ansi-regex", "4.1.1"]])}],
             ["5.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/ansi_regex__5.0.1__dfdb7bfb/",
               packageDependencies: new Map([["ansi-regex", "5.0.1"]])}]])],
  ["ansi-styles",
  new Map([["3.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/ansi_styles__3.2.1__3e3790a5/",
             packageDependencies: new Map([["ansi-styles", "3.2.1"],
                                             ["color-convert", "1.9.3"]])}],
             ["4.3.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/ansi_styles__4.3.0__ee058a1d/",
               packageDependencies: new Map([["ansi-styles", "4.3.0"],
                                               ["color-convert", "2.0.1"]])}]])],
  ["anymatch",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/anymatch__2.0.0__53ff378a/",
             packageDependencies: new Map([["anymatch", "2.0.0"],
                                             ["micromatch", "3.1.10"],
                                             ["normalize-path", "2.1.1"]])}],
             ["3.1.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/anymatch__3.1.2__e27270e2/",
               packageDependencies: new Map([["anymatch", "3.1.2"],
                                               ["normalize-path", "3.0.0"],
                                               ["picomatch", "2.3.1"]])}]])],
  ["argparse",
  new Map([["1.0.10",
           {
             packageLocation: "/home/lucas/.esy/source/i/argparse__1.0.10__726c0611/",
             packageDependencies: new Map([["argparse", "1.0.10"],
                                             ["sprintf-js", "1.0.3"]])}]])],
  ["arr-diff",
  new Map([["4.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/arr_diff__4.0.0__5a7bbcc5/",
             packageDependencies: new Map([["arr-diff", "4.0.0"]])}]])],
  ["arr-flatten",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/arr_flatten__1.1.0__15a968d1/",
             packageDependencies: new Map([["arr-flatten", "1.1.0"]])}]])],
  ["arr-union",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/arr_union__3.1.0__58f07489/",
             packageDependencies: new Map([["arr-union", "3.1.0"]])}]])],
  ["array-equal",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/array_equal__1.0.0__aced000d/",
             packageDependencies: new Map([["array-equal", "1.0.0"]])}]])],
  ["array-unique",
  new Map([["0.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/array_unique__0.3.2__ace7cbf4/",
             packageDependencies: new Map([["array-unique", "0.3.2"]])}]])],
  ["asn1",
  new Map([["0.2.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/asn1__0.2.6__5989908f/",
             packageDependencies: new Map([["asn1", "0.2.6"],
                                             ["safer-buffer", "2.1.2"]])}]])],
  ["assert-plus",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/assert_plus__1.0.0__4ffc3b81/",
             packageDependencies: new Map([["assert-plus", "1.0.0"]])}]])],
  ["assign-symbols",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/assign_symbols__1.0.0__60f3deb0/",
             packageDependencies: new Map([["assign-symbols", "1.0.0"]])}]])],
  ["astral-regex",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/astral_regex__1.0.0__412e4694/",
             packageDependencies: new Map([["astral-regex", "1.0.0"]])}]])],
  ["asynckit",
  new Map([["0.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/asynckit__0.4.0__3d17443a/",
             packageDependencies: new Map([["asynckit", "0.4.0"]])}]])],
  ["atob",
  new Map([["2.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/atob__2.1.2__5aa0dbd4/",
             packageDependencies: new Map([["atob", "2.1.2"]])}]])],
  ["aws-sign2",
  new Map([["0.7.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/aws_sign2__0.7.0__91c5ef1e/",
             packageDependencies: new Map([["aws-sign2", "0.7.0"]])}]])],
  ["aws4",
  new Map([["1.11.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/aws4__1.11.0__d73d2209/",
             packageDependencies: new Map([["aws4", "1.11.0"]])}]])],
  ["babel-jest",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel_jest__25.5.1__2e7f18df/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@jest/transform", "25.5.1"],
                                             ["@jest/types", "25.5.0"],
                                             ["@types/babel__core", "7.1.19"],
                                             ["babel-jest", "25.5.1"],
                                             ["babel-plugin-istanbul",
                                             "6.1.1"],
                                             ["babel-preset-jest", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["slash", "3.0.0"]])}]])],
  ["babel-plugin-istanbul",
  new Map([["6.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel_plugin_istanbul__6.1.1__433dbfdd/",
             packageDependencies: new Map([["@babel/helper-plugin-utils",
                                           "7.18.9"],
                                             ["@istanbuljs/load-nyc-config",
                                             "1.1.0"],
                                             ["@istanbuljs/schema", "0.1.3"],
                                             ["babel-plugin-istanbul",
                                             "6.1.1"],
                                             ["istanbul-lib-instrument",
                                             "5.2.0"],
                                             ["test-exclude", "6.0.0"]])}]])],
  ["babel-plugin-jest-hoist",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel_plugin_jest_hoist__25.5.0__645fddfc/",
             packageDependencies: new Map([["@babel/template", "7.18.6"],
                                             ["@babel/types", "7.18.9"],
                                             ["@types/babel__traverse",
                                             "7.17.1"],
                                             ["babel-plugin-jest-hoist",
                                             "25.5.0"]])}]])],
  ["babel-preset-current-node-syntax",
  new Map([["0.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel_preset_current_node_syntax__0.1.4__4187cb72/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@babel/plugin-syntax-async-generators",
                                             "7.8.4"],
                                             ["@babel/plugin-syntax-bigint",
                                             "7.8.3"],
                                             ["@babel/plugin-syntax-class-properties",
                                             "7.12.13"],
                                             ["@babel/plugin-syntax-import-meta",
                                             "7.10.4"],
                                             ["@babel/plugin-syntax-json-strings",
                                             "7.8.3"],
                                             ["@babel/plugin-syntax-logical-assignment-operators",
                                             "7.10.4"],
                                             ["@babel/plugin-syntax-nullish-coalescing-operator",
                                             "7.8.3"],
                                             ["@babel/plugin-syntax-numeric-separator",
                                             "7.10.4"],
                                             ["@babel/plugin-syntax-object-rest-spread",
                                             "7.8.3"],
                                             ["@babel/plugin-syntax-optional-catch-binding",
                                             "7.8.3"],
                                             ["@babel/plugin-syntax-optional-chaining",
                                             "7.8.3"],
                                             ["babel-preset-current-node-syntax",
                                             "0.1.4"]])}]])],
  ["babel-preset-jest",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/babel_preset_jest__25.5.0__f96365c3/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["babel-plugin-jest-hoist",
                                             "25.5.0"],
                                             ["babel-preset-current-node-syntax",
                                             "0.1.4"],
                                             ["babel-preset-jest", "25.5.0"]])}]])],
  ["balanced-match",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/balanced_match__1.0.2__42d32da1/",
             packageDependencies: new Map([["balanced-match", "1.0.2"]])}]])],
  ["base",
  new Map([["0.11.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/base__0.11.2__30052a78/",
             packageDependencies: new Map([["base", "0.11.2"],
                                             ["cache-base", "1.0.1"],
                                             ["class-utils", "0.3.6"],
                                             ["component-emitter", "1.3.0"],
                                             ["define-property", "1.0.0"],
                                             ["isobject", "3.0.1"],
                                             ["mixin-deep", "1.3.2"],
                                             ["pascalcase", "0.1.1"]])}]])],
  ["bcrypt-pbkdf",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/bcrypt_pbkdf__1.0.2__7d7ff311/",
             packageDependencies: new Map([["bcrypt-pbkdf", "1.0.2"],
                                             ["tweetnacl", "0.14.5"]])}]])],
  ["brace-expansion",
  new Map([["1.1.11",
           {
             packageLocation: "/home/lucas/.esy/source/i/brace_expansion__1.1.11__c2e362d2/",
             packageDependencies: new Map([["balanced-match", "1.0.2"],
                                             ["brace-expansion", "1.1.11"],
                                             ["concat-map", "0.0.1"]])}]])],
  ["braces",
  new Map([["2.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/braces__2.3.2__8146c42d/",
             packageDependencies: new Map([["arr-flatten", "1.1.0"],
                                             ["array-unique", "0.3.2"],
                                             ["braces", "2.3.2"],
                                             ["extend-shallow", "2.0.1"],
                                             ["fill-range", "4.0.0"],
                                             ["isobject", "3.0.1"],
                                             ["repeat-element", "1.1.4"],
                                             ["snapdragon", "0.8.2"],
                                             ["snapdragon-node", "2.1.1"],
                                             ["split-string", "3.1.0"],
                                             ["to-regex", "3.0.2"]])}],
             ["3.0.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/braces__3.0.2__5aa7ab81/",
               packageDependencies: new Map([["braces", "3.0.2"],
                                               ["fill-range", "7.0.1"]])}]])],
  ["browser-process-hrtime",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/browser_process_hrtime__1.0.0__df1391ea/",
             packageDependencies: new Map([["browser-process-hrtime",
                                           "1.0.0"]])}]])],
  ["browser-resolve",
  new Map([["1.11.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/browser_resolve__1.11.3__7311d40c/",
             packageDependencies: new Map([["browser-resolve", "1.11.3"],
                                             ["resolve", "1.1.7"]])}]])],
  ["browserslist",
  new Map([["4.21.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/browserslist__4.21.2__5e9896b8/",
             packageDependencies: new Map([["browserslist", "4.21.2"],
                                             ["caniuse-lite", "1.0.30001370"],
                                             ["electron-to-chromium",
                                             "1.4.199"],
                                             ["node-releases", "2.0.6"],
                                             ["update-browserslist-db",
                                             "1.0.5"]])}]])],
  ["bs-platform",
  new Map([["7.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/bs_platform__7.3.2__66711f77/",
             packageDependencies: new Map([["bs-platform", "7.3.2"]])}]])],
  ["bser",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/bser__2.1.1__deaf634e/",
             packageDependencies: new Map([["bser", "2.1.1"],
                                             ["node-int64", "0.4.0"]])}]])],
  ["buffer-from",
  new Map([["1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/buffer_from__1.1.2__f23dfc46/",
             packageDependencies: new Map([["buffer-from", "1.1.2"]])}]])],
  ["cache-base",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/cache_base__1.0.1__ab79e2ff/",
             packageDependencies: new Map([["cache-base", "1.0.1"],
                                             ["collection-visit", "1.0.0"],
                                             ["component-emitter", "1.3.0"],
                                             ["get-value", "2.0.6"],
                                             ["has-value", "1.0.0"],
                                             ["isobject", "3.0.1"],
                                             ["set-value", "2.0.1"],
                                             ["to-object-path", "0.3.0"],
                                             ["union-value", "1.0.1"],
                                             ["unset-value", "1.0.0"]])}]])],
  ["callsites",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/callsites__3.1.0__236409b3/",
             packageDependencies: new Map([["callsites", "3.1.0"]])}]])],
  ["camelcase",
  new Map([["5.3.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/camelcase__5.3.1__f083c5b6/",
             packageDependencies: new Map([["camelcase", "5.3.1"]])}]])],
  ["caniuse-lite",
  new Map([["1.0.30001370",
           {
             packageLocation: "/home/lucas/.esy/source/i/caniuse_lite__1.0.30001370__8e8e4cf1/",
             packageDependencies: new Map([["caniuse-lite", "1.0.30001370"]])}]])],
  ["capture-exit",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/capture_exit__2.0.0__5edb51aa/",
             packageDependencies: new Map([["capture-exit", "2.0.0"],
                                             ["rsvp", "4.8.5"]])}]])],
  ["caseless",
  new Map([["0.12.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/caseless__0.12.0__2e70ac76/",
             packageDependencies: new Map([["caseless", "0.12.0"]])}]])],
  ["chalk",
  new Map([["2.4.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/chalk__2.4.2__cdd4307b/",
             packageDependencies: new Map([["ansi-styles", "3.2.1"],
                                             ["chalk", "2.4.2"],
                                             ["escape-string-regexp",
                                             "1.0.5"],
                                             ["supports-color", "5.5.0"]])}],
             ["3.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/chalk__3.0.0__2f79934a/",
               packageDependencies: new Map([["ansi-styles", "4.3.0"],
                                               ["chalk", "3.0.0"],
                                               ["supports-color", "7.2.0"]])}]])],
  ["ci-info",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/ci_info__2.0.0__6f1dc8f1/",
             packageDependencies: new Map([["ci-info", "2.0.0"]])}]])],
  ["class-utils",
  new Map([["0.3.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/class_utils__0.3.6__3ab22a3d/",
             packageDependencies: new Map([["arr-union", "3.1.0"],
                                             ["class-utils", "0.3.6"],
                                             ["define-property", "0.2.5"],
                                             ["isobject", "3.0.1"],
                                             ["static-extend", "0.1.2"]])}]])],
  ["cliui",
  new Map([["6.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/cliui__6.0.0__3f74d7a6/",
             packageDependencies: new Map([["cliui", "6.0.0"],
                                             ["string-width", "4.2.3"],
                                             ["strip-ansi", "6.0.1"],
                                             ["wrap-ansi", "6.2.0"]])}]])],
  ["co",
  new Map([["4.6.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/co__4.6.0__0a448387/",
             packageDependencies: new Map([["co", "4.6.0"]])}]])],
  ["collect-v8-coverage",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/collect_v8_coverage__1.0.1__5936690b/",
             packageDependencies: new Map([["collect-v8-coverage", "1.0.1"]])}]])],
  ["collection-visit",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/collection_visit__1.0.0__5ba603a9/",
             packageDependencies: new Map([["collection-visit", "1.0.0"],
                                             ["map-visit", "1.0.0"],
                                             ["object-visit", "1.0.1"]])}]])],
  ["color-convert",
  new Map([["1.9.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/color_convert__1.9.3__a7e8c654/",
             packageDependencies: new Map([["color-convert", "1.9.3"],
                                             ["color-name", "1.1.3"]])}],
             ["2.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/color_convert__2.0.1__48e09f09/",
               packageDependencies: new Map([["color-convert", "2.0.1"],
                                               ["color-name", "1.1.4"]])}]])],
  ["color-name",
  new Map([["1.1.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/color_name__1.1.3__2497ef27/",
             packageDependencies: new Map([["color-name", "1.1.3"]])}],
             ["1.1.4",
             {
               packageLocation: "/home/lucas/.esy/source/i/color_name__1.1.4__07bb272f/",
               packageDependencies: new Map([["color-name", "1.1.4"]])}]])],
  ["combined-stream",
  new Map([["1.0.8",
           {
             packageLocation: "/home/lucas/.esy/source/i/combined_stream__1.0.8__0f16095c/",
             packageDependencies: new Map([["combined-stream", "1.0.8"],
                                             ["delayed-stream", "1.0.0"]])}]])],
  ["component-emitter",
  new Map([["1.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/component_emitter__1.3.0__ec2c5ccf/",
             packageDependencies: new Map([["component-emitter", "1.3.0"]])}]])],
  ["concat-map",
  new Map([["0.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/concat_map__0.0.1__c7999216/",
             packageDependencies: new Map([["concat-map", "0.0.1"]])}]])],
  ["convert-source-map",
  new Map([["1.8.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/convert_source_map__1.8.0__dd4e5f3c/",
             packageDependencies: new Map([["convert-source-map", "1.8.0"],
                                             ["safe-buffer", "5.1.2"]])}]])],
  ["copy-descriptor",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/copy_descriptor__0.1.1__b4878afe/",
             packageDependencies: new Map([["copy-descriptor", "0.1.1"]])}]])],
  ["core-util-is",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/core_util_is__1.0.2__d0677167/",
             packageDependencies: new Map([["core-util-is", "1.0.2"]])}]])],
  ["cross-spawn",
  new Map([["6.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/cross_spawn__6.0.5__396ecb10/",
             packageDependencies: new Map([["cross-spawn", "6.0.5"],
                                             ["nice-try", "1.0.5"],
                                             ["path-key", "2.0.1"],
                                             ["semver", "5.7.1"],
                                             ["shebang-command", "1.2.0"],
                                             ["which", "1.3.1"]])}],
             ["7.0.3",
             {
               packageLocation: "/home/lucas/.esy/source/i/cross_spawn__7.0.3__7ae9e5df/",
               packageDependencies: new Map([["cross-spawn", "7.0.3"],
                                               ["path-key", "3.1.1"],
                                               ["shebang-command", "2.0.0"],
                                               ["which", "2.0.2"]])}]])],
  ["cssom",
  new Map([["0.3.8",
           {
             packageLocation: "/home/lucas/.esy/source/i/cssom__0.3.8__83849e6e/",
             packageDependencies: new Map([["cssom", "0.3.8"]])}],
             ["0.4.4",
             {
               packageLocation: "/home/lucas/.esy/source/i/cssom__0.4.4__11b8fbb5/",
               packageDependencies: new Map([["cssom", "0.4.4"]])}]])],
  ["cssstyle",
  new Map([["2.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/cssstyle__2.3.0__49fa5986/",
             packageDependencies: new Map([["cssom", "0.3.8"],
                                             ["cssstyle", "2.3.0"]])}]])],
  ["dashdash",
  new Map([["1.14.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/dashdash__1.14.1__08096b75/",
             packageDependencies: new Map([["assert-plus", "1.0.0"],
                                             ["dashdash", "1.14.1"]])}]])],
  ["data-urls",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/data_urls__1.1.0__7c86765b/",
             packageDependencies: new Map([["abab", "2.0.6"],
                                             ["data-urls", "1.1.0"],
                                             ["whatwg-mimetype", "2.3.0"],
                                             ["whatwg-url", "7.1.0"]])}]])],
  ["debug",
  new Map([["2.6.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/debug__2.6.9__8eaf8f1e/",
             packageDependencies: new Map([["debug", "2.6.9"],
                                             ["ms", "2.0.0"]])}],
             ["4.3.4",
             {
               packageLocation: "/home/lucas/.esy/source/i/debug__4.3.4__84af5971/",
               packageDependencies: new Map([["debug", "4.3.4"],
                                               ["ms", "2.1.2"]])}]])],
  ["decamelize",
  new Map([["1.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/decamelize__1.2.0__8db54854/",
             packageDependencies: new Map([["decamelize", "1.2.0"]])}]])],
  ["decode-uri-component",
  new Map([["0.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/decode_uri_component__0.2.0__85d618dc/",
             packageDependencies: new Map([["decode-uri-component", "0.2.0"]])}]])],
  ["deep-is",
  new Map([["0.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/deep_is__0.1.4__23719354/",
             packageDependencies: new Map([["deep-is", "0.1.4"]])}]])],
  ["deepmerge",
  new Map([["4.2.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/deepmerge__4.2.2__0795879d/",
             packageDependencies: new Map([["deepmerge", "4.2.2"]])}]])],
  ["define-property",
  new Map([["0.2.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/define_property__0.2.5__35bf1352/",
             packageDependencies: new Map([["define-property", "0.2.5"],
                                             ["is-descriptor", "0.1.6"]])}],
             ["1.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/define_property__1.0.0__f7276e5e/",
               packageDependencies: new Map([["define-property", "1.0.0"],
                                               ["is-descriptor", "1.0.2"]])}],
             ["2.0.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/define_property__2.0.2__aa71f45e/",
               packageDependencies: new Map([["define-property", "2.0.2"],
                                               ["is-descriptor", "1.0.2"],
                                               ["isobject", "3.0.1"]])}]])],
  ["delayed-stream",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/delayed_stream__1.0.0__47205835/",
             packageDependencies: new Map([["delayed-stream", "1.0.0"]])}]])],
  ["detect-newline",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/detect_newline__3.1.0__9fad862f/",
             packageDependencies: new Map([["detect-newline", "3.1.0"]])}]])],
  ["diff-sequences",
  new Map([["25.2.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/diff_sequences__25.2.6__80c163bc/",
             packageDependencies: new Map([["diff-sequences", "25.2.6"]])}]])],
  ["domexception",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/domexception__1.0.1__a389fce3/",
             packageDependencies: new Map([["domexception", "1.0.1"],
                                             ["webidl-conversions", "4.0.2"]])}]])],
  ["ecc-jsbn",
  new Map([["0.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/ecc_jsbn__0.1.2__84f8de3f/",
             packageDependencies: new Map([["ecc-jsbn", "0.1.2"],
                                             ["jsbn", "0.1.1"],
                                             ["safer-buffer", "2.1.2"]])}]])],
  ["electron-to-chromium",
  new Map([["1.4.199",
           {
             packageLocation: "/home/lucas/.esy/source/i/electron_to_chromium__1.4.199__33b3de30/",
             packageDependencies: new Map([["electron-to-chromium",
                                           "1.4.199"]])}]])],
  ["emoji-regex",
  new Map([["8.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/emoji_regex__8.0.0__8e099b89/",
             packageDependencies: new Map([["emoji-regex", "8.0.0"]])}]])],
  ["end-of-stream",
  new Map([["1.4.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/end_of_stream__1.4.4__29536c64/",
             packageDependencies: new Map([["end-of-stream", "1.4.4"],
                                             ["once", "1.4.0"]])}]])],
  ["error-ex",
  new Map([["1.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/error_ex__1.3.2__851c0bc5/",
             packageDependencies: new Map([["error-ex", "1.3.2"],
                                             ["is-arrayish", "0.2.1"]])}]])],
  ["escalade",
  new Map([["3.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/escalade__3.1.1__be4c030d/",
             packageDependencies: new Map([["escalade", "3.1.1"]])}]])],
  ["escape-string-regexp",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/escape_string_regexp__1.0.5__08b8b625/",
             packageDependencies: new Map([["escape-string-regexp", "1.0.5"]])}],
             ["2.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/escape_string_regexp__2.0.0__19dcf210/",
               packageDependencies: new Map([["escape-string-regexp",
                                             "2.0.0"]])}]])],
  ["escodegen",
  new Map([["1.14.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/escodegen__1.14.3__a618f361/",
             packageDependencies: new Map([["escodegen", "1.14.3"],
                                             ["esprima", "4.0.1"],
                                             ["estraverse", "4.3.0"],
                                             ["esutils", "2.0.3"],
                                             ["optionator", "0.8.3"],
                                             ["source-map", "0.6.1"]])}]])],
  ["esprima",
  new Map([["4.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/esprima__4.0.1__8917feca/",
             packageDependencies: new Map([["esprima", "4.0.1"]])}]])],
  ["estraverse",
  new Map([["4.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/estraverse__4.3.0__539360ea/",
             packageDependencies: new Map([["estraverse", "4.3.0"]])}]])],
  ["esutils",
  new Map([["2.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/esutils__2.0.3__c72e14fe/",
             packageDependencies: new Map([["esutils", "2.0.3"]])}]])],
  ["exec-sh",
  new Map([["0.3.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/exec_sh__0.3.6__e8c7ca4f/",
             packageDependencies: new Map([["exec-sh", "0.3.6"]])}]])],
  ["execa",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/execa__1.0.0__7c978f7c/",
             packageDependencies: new Map([["cross-spawn", "6.0.5"],
                                             ["execa", "1.0.0"],
                                             ["get-stream", "4.1.0"],
                                             ["is-stream", "1.1.0"],
                                             ["npm-run-path", "2.0.2"],
                                             ["p-finally", "1.0.0"],
                                             ["signal-exit", "3.0.7"],
                                             ["strip-eof", "1.0.0"]])}],
             ["3.4.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/execa__3.4.0__21cd4f89/",
               packageDependencies: new Map([["cross-spawn", "7.0.3"],
                                               ["execa", "3.4.0"],
                                               ["get-stream", "5.2.0"],
                                               ["human-signals", "1.1.1"],
                                               ["is-stream", "2.0.1"],
                                               ["merge-stream", "2.0.0"],
                                               ["npm-run-path", "4.0.1"],
                                               ["onetime", "5.1.2"],
                                               ["p-finally", "2.0.1"],
                                               ["signal-exit", "3.0.7"],
                                               ["strip-final-newline",
                                               "2.0.0"]])}]])],
  ["exit",
  new Map([["0.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/exit__0.1.2__010369c1/",
             packageDependencies: new Map([["exit", "0.1.2"]])}]])],
  ["expand-brackets",
  new Map([["2.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/expand_brackets__2.1.4__15f41e0c/",
             packageDependencies: new Map([["debug", "2.6.9"],
                                             ["define-property", "0.2.5"],
                                             ["expand-brackets", "2.1.4"],
                                             ["extend-shallow", "2.0.1"],
                                             ["posix-character-classes",
                                             "0.1.1"],
                                             ["regex-not", "1.0.2"],
                                             ["snapdragon", "0.8.2"],
                                             ["to-regex", "3.0.2"]])}]])],
  ["expect",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/expect__25.5.0__50eb01f1/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["ansi-styles", "4.3.0"],
                                             ["expect", "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-matcher-utils", "25.5.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-regex-util", "25.2.6"]])}]])],
  ["extend",
  new Map([["3.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/extend__3.0.2__a5974d80/",
             packageDependencies: new Map([["extend", "3.0.2"]])}]])],
  ["extend-shallow",
  new Map([["2.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/extend_shallow__2.0.1__65c3deaf/",
             packageDependencies: new Map([["extend-shallow", "2.0.1"],
                                             ["is-extendable", "0.1.1"]])}],
             ["3.0.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/extend_shallow__3.0.2__8e38f124/",
               packageDependencies: new Map([["assign-symbols", "1.0.0"],
                                               ["extend-shallow", "3.0.2"],
                                               ["is-extendable", "1.0.1"]])}]])],
  ["extglob",
  new Map([["2.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/extglob__2.0.4__ff5831fb/",
             packageDependencies: new Map([["array-unique", "0.3.2"],
                                             ["define-property", "1.0.0"],
                                             ["expand-brackets", "2.1.4"],
                                             ["extend-shallow", "2.0.1"],
                                             ["extglob", "2.0.4"],
                                             ["fragment-cache", "0.2.1"],
                                             ["regex-not", "1.0.2"],
                                             ["snapdragon", "0.8.2"],
                                             ["to-regex", "3.0.2"]])}]])],
  ["extsprintf",
  new Map([["1.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/extsprintf__1.3.0__8f6b6b90/",
             packageDependencies: new Map([["extsprintf", "1.3.0"]])}]])],
  ["fast-deep-equal",
  new Map([["3.1.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/fast_deep_equal__3.1.3__973bc016/",
             packageDependencies: new Map([["fast-deep-equal", "3.1.3"]])}]])],
  ["fast-json-stable-stringify",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/fast_json_stable_stringify__2.1.0__e7b65021/",
             packageDependencies: new Map([["fast-json-stable-stringify",
                                           "2.1.0"]])}]])],
  ["fast-levenshtein",
  new Map([["2.0.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/fast_levenshtein__2.0.6__cb61e03a/",
             packageDependencies: new Map([["fast-levenshtein", "2.0.6"]])}]])],
  ["fb-watchman",
  new Map([["2.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/fb_watchman__2.0.1__19f3df50/",
             packageDependencies: new Map([["bser", "2.1.1"],
                                             ["fb-watchman", "2.0.1"]])}]])],
  ["fill-range",
  new Map([["4.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/fill_range__4.0.0__d5dfefd7/",
             packageDependencies: new Map([["extend-shallow", "2.0.1"],
                                             ["fill-range", "4.0.0"],
                                             ["is-number", "3.0.0"],
                                             ["repeat-string", "1.6.1"],
                                             ["to-regex-range", "2.1.1"]])}],
             ["7.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/fill_range__7.0.1__2354263a/",
               packageDependencies: new Map([["fill-range", "7.0.1"],
                                               ["to-regex-range", "5.0.1"]])}]])],
  ["find-up",
  new Map([["4.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/find_up__4.1.0__55a9970e/",
             packageDependencies: new Map([["find-up", "4.1.0"],
                                             ["locate-path", "5.0.0"],
                                             ["path-exists", "4.0.0"]])}]])],
  ["for-in",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/for_in__1.0.2__8016c44d/",
             packageDependencies: new Map([["for-in", "1.0.2"]])}]])],
  ["forever-agent",
  new Map([["0.6.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/forever_agent__0.6.1__7c765f4a/",
             packageDependencies: new Map([["forever-agent", "0.6.1"]])}]])],
  ["form-data",
  new Map([["2.3.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/form_data__2.3.3__2dba9575/",
             packageDependencies: new Map([["asynckit", "0.4.0"],
                                             ["combined-stream", "1.0.8"],
                                             ["form-data", "2.3.3"],
                                             ["mime-types", "2.1.35"]])}]])],
  ["fragment-cache",
  new Map([["0.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/fragment_cache__0.2.1__6a18be86/",
             packageDependencies: new Map([["fragment-cache", "0.2.1"],
                                             ["map-cache", "0.2.2"]])}]])],
  ["fs.realpath",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/fs.realpath__1.0.0__094c11ca/",
             packageDependencies: new Map([["fs.realpath", "1.0.0"]])}]])],
  ["fsevents",
  new Map([["2.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/fsevents__2.3.2__d3d926a0/",
             packageDependencies: new Map([["fsevents", "2.3.2"]])}]])],
  ["function-bind",
  new Map([["1.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/function_bind__1.1.1__98f8a427/",
             packageDependencies: new Map([["function-bind", "1.1.1"]])}]])],
  ["gensync",
  new Map([["1.0.0-beta.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/gensync__1.0.0_beta.2__a958cc59/",
             packageDependencies: new Map([["gensync", "1.0.0-beta.2"]])}]])],
  ["get-caller-file",
  new Map([["2.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/get_caller_file__2.0.5__ef007ca2/",
             packageDependencies: new Map([["get-caller-file", "2.0.5"]])}]])],
  ["get-package-type",
  new Map([["0.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/get_package_type__0.1.0__14fcea3f/",
             packageDependencies: new Map([["get-package-type", "0.1.0"]])}]])],
  ["get-stream",
  new Map([["4.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/get_stream__4.1.0__c6459916/",
             packageDependencies: new Map([["get-stream", "4.1.0"],
                                             ["pump", "3.0.0"]])}],
             ["5.2.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/get_stream__5.2.0__f4f8c920/",
               packageDependencies: new Map([["get-stream", "5.2.0"],
                                               ["pump", "3.0.0"]])}]])],
  ["get-value",
  new Map([["2.0.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/get_value__2.0.6__147b5c9f/",
             packageDependencies: new Map([["get-value", "2.0.6"]])}]])],
  ["getpass",
  new Map([["0.1.7",
           {
             packageLocation: "/home/lucas/.esy/source/i/getpass__0.1.7__8500eb7d/",
             packageDependencies: new Map([["assert-plus", "1.0.0"],
                                             ["getpass", "0.1.7"]])}]])],
  ["glob",
  new Map([["7.2.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/glob__7.2.3__264cf811/",
             packageDependencies: new Map([["fs.realpath", "1.0.0"],
                                             ["glob", "7.2.3"],
                                             ["inflight", "1.0.6"],
                                             ["inherits", "2.0.4"],
                                             ["minimatch", "3.1.2"],
                                             ["once", "1.4.0"],
                                             ["path-is-absolute", "1.0.1"]])}]])],
  ["globals",
  new Map([["11.12.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/globals__11.12.0__75db2ee0/",
             packageDependencies: new Map([["globals", "11.12.0"]])}]])],
  ["graceful-fs",
  new Map([["4.2.10",
           {
             packageLocation: "/home/lucas/.esy/source/i/graceful_fs__4.2.10__ecba3630/",
             packageDependencies: new Map([["graceful-fs", "4.2.10"]])}]])],
  ["growly",
  new Map([["1.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/growly__1.3.0__ed748794/",
             packageDependencies: new Map([["growly", "1.3.0"]])}]])],
  ["har-schema",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/har_schema__2.0.0__c54b2db6/",
             packageDependencies: new Map([["har-schema", "2.0.0"]])}]])],
  ["har-validator",
  new Map([["5.1.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/har_validator__5.1.5__238d9a3e/",
             packageDependencies: new Map([["ajv", "6.12.6"],
                                             ["har-schema", "2.0.0"],
                                             ["har-validator", "5.1.5"]])}]])],
  ["has",
  new Map([["1.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/has__1.0.3__79b9f05d/",
             packageDependencies: new Map([["function-bind", "1.1.1"],
                                             ["has", "1.0.3"]])}]])],
  ["has-flag",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/has_flag__3.0.0__058d2bde/",
             packageDependencies: new Map([["has-flag", "3.0.0"]])}],
             ["4.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/has_flag__4.0.0__2b4e2759/",
               packageDependencies: new Map([["has-flag", "4.0.0"]])}]])],
  ["has-value",
  new Map([["0.3.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/has_value__0.3.1__802ffa1f/",
             packageDependencies: new Map([["get-value", "2.0.6"],
                                             ["has-value", "0.3.1"],
                                             ["has-values", "0.1.4"],
                                             ["isobject", "2.1.0"]])}],
             ["1.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/has_value__1.0.0__6bf1e647/",
               packageDependencies: new Map([["get-value", "2.0.6"],
                                               ["has-value", "1.0.0"],
                                               ["has-values", "1.0.0"],
                                               ["isobject", "3.0.1"]])}]])],
  ["has-values",
  new Map([["0.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/has_values__0.1.4__95f0f007/",
             packageDependencies: new Map([["has-values", "0.1.4"]])}],
             ["1.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/has_values__1.0.0__f4b60ee2/",
               packageDependencies: new Map([["has-values", "1.0.0"],
                                               ["is-number", "3.0.0"],
                                               ["kind-of", "4.0.0"]])}]])],
  ["hosted-git-info",
  new Map([["2.8.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/hosted_git_info__2.8.9__e2574dbd/",
             packageDependencies: new Map([["hosted-git-info", "2.8.9"]])}]])],
  ["html-encoding-sniffer",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/html_encoding_sniffer__1.0.2__ebb857a9/",
             packageDependencies: new Map([["html-encoding-sniffer", "1.0.2"],
                                             ["whatwg-encoding", "1.0.5"]])}]])],
  ["html-escaper",
  new Map([["2.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/html_escaper__2.0.2__d913b1da/",
             packageDependencies: new Map([["html-escaper", "2.0.2"]])}]])],
  ["http-signature",
  new Map([["1.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/http_signature__1.2.0__0bbb41dd/",
             packageDependencies: new Map([["assert-plus", "1.0.0"],
                                             ["http-signature", "1.2.0"],
                                             ["jsprim", "1.4.2"],
                                             ["sshpk", "1.17.0"]])}]])],
  ["human-signals",
  new Map([["1.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/human_signals__1.1.1__93038e72/",
             packageDependencies: new Map([["human-signals", "1.1.1"]])}]])],
  ["iconv-lite",
  new Map([["0.4.24",
           {
             packageLocation: "/home/lucas/.esy/source/i/iconv_lite__0.4.24__0f6d0a3e/",
             packageDependencies: new Map([["iconv-lite", "0.4.24"],
                                             ["safer-buffer", "2.1.2"]])}]])],
  ["import-local",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/import_local__3.1.0__0ddbb8c4/",
             packageDependencies: new Map([["import-local", "3.1.0"],
                                             ["pkg-dir", "4.2.0"],
                                             ["resolve-cwd", "3.0.0"]])}]])],
  ["imurmurhash",
  new Map([["0.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/imurmurhash__0.1.4__1fc42006/",
             packageDependencies: new Map([["imurmurhash", "0.1.4"]])}]])],
  ["inflight",
  new Map([["1.0.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/inflight__1.0.6__5ef09bf2/",
             packageDependencies: new Map([["inflight", "1.0.6"],
                                             ["once", "1.4.0"],
                                             ["wrappy", "1.0.2"]])}]])],
  ["inherits",
  new Map([["2.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/inherits__2.0.4__5ce658b5/",
             packageDependencies: new Map([["inherits", "2.0.4"]])}]])],
  ["ip-regex",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/ip_regex__2.1.0__5e630305/",
             packageDependencies: new Map([["ip-regex", "2.1.0"]])}]])],
  ["is-accessor-descriptor",
  new Map([["0.1.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_accessor_descriptor__0.1.6__892d8573/",
             packageDependencies: new Map([["is-accessor-descriptor",
                                           "0.1.6"],
                                             ["kind-of", "3.2.2"]])}],
             ["1.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_accessor_descriptor__1.0.0__108888c1/",
               packageDependencies: new Map([["is-accessor-descriptor",
                                             "1.0.0"],
                                               ["kind-of", "6.0.3"]])}]])],
  ["is-arrayish",
  new Map([["0.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_arrayish__0.2.1__3d2a59cd/",
             packageDependencies: new Map([["is-arrayish", "0.2.1"]])}]])],
  ["is-buffer",
  new Map([["1.1.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_buffer__1.1.6__f9508fd1/",
             packageDependencies: new Map([["is-buffer", "1.1.6"]])}]])],
  ["is-ci",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_ci__2.0.0__43195c84/",
             packageDependencies: new Map([["ci-info", "2.0.0"],
                                             ["is-ci", "2.0.0"]])}]])],
  ["is-core-module",
  new Map([["2.9.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_core_module__2.9.0__40a77dac/",
             packageDependencies: new Map([["has", "1.0.3"],
                                             ["is-core-module", "2.9.0"]])}]])],
  ["is-data-descriptor",
  new Map([["0.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_data_descriptor__0.1.4__79d141c0/",
             packageDependencies: new Map([["is-data-descriptor", "0.1.4"],
                                             ["kind-of", "3.2.2"]])}],
             ["1.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_data_descriptor__1.0.0__45e804c7/",
               packageDependencies: new Map([["is-data-descriptor", "1.0.0"],
                                               ["kind-of", "6.0.3"]])}]])],
  ["is-descriptor",
  new Map([["0.1.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_descriptor__0.1.6__e33f1b8b/",
             packageDependencies: new Map([["is-accessor-descriptor",
                                           "0.1.6"],
                                             ["is-data-descriptor", "0.1.4"],
                                             ["is-descriptor", "0.1.6"],
                                             ["kind-of", "5.1.0"]])}],
             ["1.0.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_descriptor__1.0.2__9886fab7/",
               packageDependencies: new Map([["is-accessor-descriptor",
                                             "1.0.0"],
                                               ["is-data-descriptor",
                                               "1.0.0"],
                                               ["is-descriptor", "1.0.2"],
                                               ["kind-of", "6.0.3"]])}]])],
  ["is-docker",
  new Map([["2.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_docker__2.2.1__40fcf4f6/",
             packageDependencies: new Map([["is-docker", "2.2.1"]])}]])],
  ["is-extendable",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_extendable__0.1.1__660e53d4/",
             packageDependencies: new Map([["is-extendable", "0.1.1"]])}],
             ["1.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_extendable__1.0.1__42926f00/",
               packageDependencies: new Map([["is-extendable", "1.0.1"],
                                               ["is-plain-object", "2.0.4"]])}]])],
  ["is-fullwidth-code-point",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_fullwidth_code_point__3.0.0__27c011ce/",
             packageDependencies: new Map([["is-fullwidth-code-point",
                                           "3.0.0"]])}]])],
  ["is-generator-fn",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_generator_fn__2.1.0__4a4bcda8/",
             packageDependencies: new Map([["is-generator-fn", "2.1.0"]])}]])],
  ["is-number",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_number__3.0.0__46772964/",
             packageDependencies: new Map([["is-number", "3.0.0"],
                                             ["kind-of", "3.2.2"]])}],
             ["7.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_number__7.0.0__e3bfa7e2/",
               packageDependencies: new Map([["is-number", "7.0.0"]])}]])],
  ["is-plain-object",
  new Map([["2.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_plain_object__2.0.4__50413263/",
             packageDependencies: new Map([["is-plain-object", "2.0.4"],
                                             ["isobject", "3.0.1"]])}]])],
  ["is-stream",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_stream__1.1.0__808b4cab/",
             packageDependencies: new Map([["is-stream", "1.1.0"]])}],
             ["2.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/is_stream__2.0.1__43cbc376/",
               packageDependencies: new Map([["is-stream", "2.0.1"]])}]])],
  ["is-typedarray",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_typedarray__1.0.0__d13c5d5e/",
             packageDependencies: new Map([["is-typedarray", "1.0.0"]])}]])],
  ["is-windows",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_windows__1.0.2__e09f5a28/",
             packageDependencies: new Map([["is-windows", "1.0.2"]])}]])],
  ["is-wsl",
  new Map([["2.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/is_wsl__2.2.0__830151f6/",
             packageDependencies: new Map([["is-docker", "2.2.1"],
                                             ["is-wsl", "2.2.0"]])}]])],
  ["isarray",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/isarray__1.0.0__6cecb641/",
             packageDependencies: new Map([["isarray", "1.0.0"]])}]])],
  ["isexe",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/isexe__2.0.0__01c1de49/",
             packageDependencies: new Map([["isexe", "2.0.0"]])}]])],
  ["isobject",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/isobject__2.1.0__b1b028ee/",
             packageDependencies: new Map([["isarray", "1.0.0"],
                                             ["isobject", "2.1.0"]])}],
             ["3.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/isobject__3.0.1__892637c7/",
               packageDependencies: new Map([["isobject", "3.0.1"]])}]])],
  ["isstream",
  new Map([["0.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/isstream__0.1.2__02284f89/",
             packageDependencies: new Map([["isstream", "0.1.2"]])}]])],
  ["istanbul-lib-coverage",
  new Map([["3.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbul_lib_coverage__3.2.0__730722e1/",
             packageDependencies: new Map([["istanbul-lib-coverage", "3.2.0"]])}]])],
  ["istanbul-lib-instrument",
  new Map([["4.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbul_lib_instrument__4.0.3__5f3f39dc/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@istanbuljs/schema", "0.1.3"],
                                             ["istanbul-lib-coverage",
                                             "3.2.0"],
                                             ["istanbul-lib-instrument",
                                             "4.0.3"],
                                             ["semver", "6.3.0"]])}],
             ["5.2.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/istanbul_lib_instrument__5.2.0__ef82bf13/",
               packageDependencies: new Map([["@babel/core", "7.18.9"],
                                               ["@babel/parser", "7.18.9"],
                                               ["@istanbuljs/schema",
                                               "0.1.3"],
                                               ["istanbul-lib-coverage",
                                               "3.2.0"],
                                               ["istanbul-lib-instrument",
                                               "5.2.0"],
                                               ["semver", "6.3.0"]])}]])],
  ["istanbul-lib-report",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbul_lib_report__3.0.0__c279c2b4/",
             packageDependencies: new Map([["istanbul-lib-coverage", "3.2.0"],
                                             ["istanbul-lib-report", "3.0.0"],
                                             ["make-dir", "3.1.0"],
                                             ["supports-color", "7.2.0"]])}]])],
  ["istanbul-lib-source-maps",
  new Map([["4.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbul_lib_source_maps__4.0.1__b3870472/",
             packageDependencies: new Map([["debug", "4.3.4"],
                                             ["istanbul-lib-coverage",
                                             "3.2.0"],
                                             ["istanbul-lib-source-maps",
                                             "4.0.1"],
                                             ["source-map", "0.6.1"]])}]])],
  ["istanbul-reports",
  new Map([["3.1.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/istanbul_reports__3.1.5__996a9b9f/",
             packageDependencies: new Map([["html-escaper", "2.0.2"],
                                             ["istanbul-lib-report", "3.0.0"],
                                             ["istanbul-reports", "3.1.5"]])}]])],
  ["jest",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest__25.5.4__f88a4673/",
             packageDependencies: new Map([["@jest/core", "25.5.4"],
                                             ["import-local", "3.1.0"],
                                             ["jest", "25.5.4"],
                                             ["jest-cli", "25.5.4"]])}]])],
  ["jest-changed-files",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_changed_files__25.5.0__8f3cdcb3/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["execa", "3.4.0"],
                                             ["jest-changed-files", "25.5.0"],
                                             ["throat", "5.0.0"]])}]])],
  ["jest-cli",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_cli__25.5.4__4c6d5f73/",
             packageDependencies: new Map([["@jest/core", "25.5.4"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["exit", "0.1.2"],
                                             ["graceful-fs", "4.2.10"],
                                             ["import-local", "3.1.0"],
                                             ["is-ci", "2.0.0"],
                                             ["jest-cli", "25.5.4"],
                                             ["jest-config", "25.5.4"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-validate", "25.5.0"],
                                             ["prompts", "2.4.2"],
                                             ["realpath-native", "2.0.0"],
                                             ["yargs", "15.4.1"]])}]])],
  ["jest-config",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_config__25.5.4__23f76f29/",
             packageDependencies: new Map([["@babel/core", "7.18.9"],
                                             ["@jest/test-sequencer",
                                             "25.5.4"],
                                             ["@jest/types", "25.5.0"],
                                             ["babel-jest", "25.5.1"],
                                             ["chalk", "3.0.0"],
                                             ["deepmerge", "4.2.2"],
                                             ["glob", "7.2.3"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-config", "25.5.4"],
                                             ["jest-environment-jsdom",
                                             "25.5.0"],
                                             ["jest-environment-node",
                                             "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-jasmine2", "25.5.4"],
                                             ["jest-regex-util", "25.2.6"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-validate", "25.5.0"],
                                             ["micromatch", "4.0.5"],
                                             ["pretty-format", "25.5.0"],
                                             ["realpath-native", "2.0.0"]])}]])],
  ["jest-diff",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_diff__25.5.0__a23fc449/",
             packageDependencies: new Map([["chalk", "3.0.0"],
                                             ["diff-sequences", "25.2.6"],
                                             ["jest-diff", "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["pretty-format", "25.5.0"]])}]])],
  ["jest-docblock",
  new Map([["25.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_docblock__25.3.0__1032b60e/",
             packageDependencies: new Map([["detect-newline", "3.1.0"],
                                             ["jest-docblock", "25.3.0"]])}]])],
  ["jest-each",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_each__25.5.0__710835ef/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["jest-each", "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-util", "25.5.0"],
                                             ["pretty-format", "25.5.0"]])}]])],
  ["jest-environment-jsdom",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_environment_jsdom__25.5.0__da6dcf33/",
             packageDependencies: new Map([["@jest/environment", "25.5.0"],
                                             ["@jest/fake-timers", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["jest-environment-jsdom",
                                             "25.5.0"],
                                             ["jest-mock", "25.5.0"],
                                             ["jest-util", "25.5.0"],
                                             ["jsdom", "15.2.1"]])}]])],
  ["jest-environment-node",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_environment_node__25.5.0__4d532134/",
             packageDependencies: new Map([["@jest/environment", "25.5.0"],
                                             ["@jest/fake-timers", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["jest-environment-node",
                                             "25.5.0"],
                                             ["jest-mock", "25.5.0"],
                                             ["jest-util", "25.5.0"],
                                             ["semver", "6.3.0"]])}]])],
  ["jest-get-type",
  new Map([["25.2.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_get_type__25.2.6__7309a8df/",
             packageDependencies: new Map([["jest-get-type", "25.2.6"]])}]])],
  ["jest-haste-map",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_haste_map__25.5.1__9e459bc0/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["@types/graceful-fs", "4.1.5"],
                                             ["anymatch", "3.1.2"],
                                             ["fb-watchman", "2.0.1"],
                                             ["fsevents", "2.3.2"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-serializer", "25.5.0"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-worker", "25.5.0"],
                                             ["micromatch", "4.0.5"],
                                             ["sane", "4.1.0"],
                                             ["walker", "1.0.8"],
                                             ["which", "2.0.2"]])}]])],
  ["jest-jasmine2",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_jasmine2__25.5.4__0ecb33f6/",
             packageDependencies: new Map([["@babel/traverse", "7.18.9"],
                                             ["@jest/environment", "25.5.0"],
                                             ["@jest/source-map", "25.5.0"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["co", "4.6.0"],
                                             ["expect", "25.5.0"],
                                             ["is-generator-fn", "2.1.0"],
                                             ["jest-each", "25.5.0"],
                                             ["jest-jasmine2", "25.5.4"],
                                             ["jest-matcher-utils", "25.5.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-runtime", "25.5.4"],
                                             ["jest-snapshot", "25.5.1"],
                                             ["jest-util", "25.5.0"],
                                             ["pretty-format", "25.5.0"],
                                             ["throat", "5.0.0"]])}]])],
  ["jest-leak-detector",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_leak_detector__25.5.0__c498905b/",
             packageDependencies: new Map([["jest-get-type", "25.2.6"],
                                             ["jest-leak-detector", "25.5.0"],
                                             ["pretty-format", "25.5.0"]])}]])],
  ["jest-matcher-utils",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_matcher_utils__25.5.0__dfa7a5f1/",
             packageDependencies: new Map([["chalk", "3.0.0"],
                                             ["jest-diff", "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-matcher-utils", "25.5.0"],
                                             ["pretty-format", "25.5.0"]])}]])],
  ["jest-message-util",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_message_util__25.5.0__3ace6e50/",
             packageDependencies: new Map([["@babel/code-frame", "7.18.6"],
                                             ["@jest/types", "25.5.0"],
                                             ["@types/stack-utils", "1.0.1"],
                                             ["chalk", "3.0.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-message-util", "25.5.0"],
                                             ["micromatch", "4.0.5"],
                                             ["slash", "3.0.0"],
                                             ["stack-utils", "1.0.5"]])}]])],
  ["jest-mock",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_mock__25.5.0__fc088aa8/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["jest-mock", "25.5.0"]])}]])],
  ["jest-pnp-resolver",
  new Map([["1.2.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_pnp_resolver__1.2.2__9da0c952/",
             packageDependencies: new Map([["jest-pnp-resolver", "1.2.2"],
                                             ["jest-resolve", "25.5.1"]])}]])],
  ["jest-regex-util",
  new Map([["25.2.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_regex_util__25.2.6__e1432830/",
             packageDependencies: new Map([["jest-regex-util", "25.2.6"]])}]])],
  ["jest-resolve",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_resolve__25.5.1__b1f1ee16/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["browser-resolve", "1.11.3"],
                                             ["chalk", "3.0.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-pnp-resolver", "1.2.2"],
                                             ["jest-resolve", "25.5.1"],
                                             ["read-pkg-up", "7.0.1"],
                                             ["realpath-native", "2.0.0"],
                                             ["resolve", "1.22.1"],
                                             ["slash", "3.0.0"]])}]])],
  ["jest-resolve-dependencies",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_resolve_dependencies__25.5.4__8a179ff1/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["jest-regex-util", "25.2.6"],
                                             ["jest-resolve-dependencies",
                                             "25.5.4"],
                                             ["jest-snapshot", "25.5.1"]])}]])],
  ["jest-runner",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_runner__25.5.4__9d256378/",
             packageDependencies: new Map([["@jest/console", "25.5.0"],
                                             ["@jest/environment", "25.5.0"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["exit", "0.1.2"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-config", "25.5.4"],
                                             ["jest-docblock", "25.3.0"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-jasmine2", "25.5.4"],
                                             ["jest-leak-detector", "25.5.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-runner", "25.5.4"],
                                             ["jest-runtime", "25.5.4"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-worker", "25.5.0"],
                                             ["source-map-support", "0.5.21"],
                                             ["throat", "5.0.0"]])}]])],
  ["jest-runtime",
  new Map([["25.5.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_runtime__25.5.4__7f5c1bbc/",
             packageDependencies: new Map([["@jest/console", "25.5.0"],
                                             ["@jest/environment", "25.5.0"],
                                             ["@jest/globals", "25.5.2"],
                                             ["@jest/source-map", "25.5.0"],
                                             ["@jest/test-result", "25.5.0"],
                                             ["@jest/transform", "25.5.1"],
                                             ["@jest/types", "25.5.0"],
                                             ["@types/yargs", "15.0.14"],
                                             ["chalk", "3.0.0"],
                                             ["collect-v8-coverage", "1.0.1"],
                                             ["exit", "0.1.2"],
                                             ["glob", "7.2.3"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-config", "25.5.4"],
                                             ["jest-haste-map", "25.5.1"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-mock", "25.5.0"],
                                             ["jest-regex-util", "25.2.6"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-runtime", "25.5.4"],
                                             ["jest-snapshot", "25.5.1"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-validate", "25.5.0"],
                                             ["realpath-native", "2.0.0"],
                                             ["slash", "3.0.0"],
                                             ["strip-bom", "4.0.0"],
                                             ["yargs", "15.4.1"]])}]])],
  ["jest-serializer",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_serializer__25.5.0__b4268109/",
             packageDependencies: new Map([["graceful-fs", "4.2.10"],
                                             ["jest-serializer", "25.5.0"]])}]])],
  ["jest-snapshot",
  new Map([["25.5.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_snapshot__25.5.1__164b30a4/",
             packageDependencies: new Map([["@babel/types", "7.18.9"],
                                             ["@jest/types", "25.5.0"],
                                             ["@types/prettier", "1.19.1"],
                                             ["chalk", "3.0.0"],
                                             ["expect", "25.5.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["jest-diff", "25.5.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-matcher-utils", "25.5.0"],
                                             ["jest-message-util", "25.5.0"],
                                             ["jest-resolve", "25.5.1"],
                                             ["jest-snapshot", "25.5.1"],
                                             ["make-dir", "3.1.0"],
                                             ["natural-compare", "1.4.0"],
                                             ["pretty-format", "25.5.0"],
                                             ["semver", "6.3.0"]])}]])],
  ["jest-util",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_util__25.5.0__237a9ff2/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["chalk", "3.0.0"],
                                             ["graceful-fs", "4.2.10"],
                                             ["is-ci", "2.0.0"],
                                             ["jest-util", "25.5.0"],
                                             ["make-dir", "3.1.0"]])}]])],
  ["jest-validate",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_validate__25.5.0__a68d7d80/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["camelcase", "5.3.1"],
                                             ["chalk", "3.0.0"],
                                             ["jest-get-type", "25.2.6"],
                                             ["jest-validate", "25.5.0"],
                                             ["leven", "3.1.0"],
                                             ["pretty-format", "25.5.0"]])}]])],
  ["jest-watcher",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_watcher__25.5.0__b24debae/",
             packageDependencies: new Map([["@jest/test-result", "25.5.0"],
                                             ["@jest/types", "25.5.0"],
                                             ["ansi-escapes", "4.3.2"],
                                             ["chalk", "3.0.0"],
                                             ["jest-util", "25.5.0"],
                                             ["jest-watcher", "25.5.0"],
                                             ["string-length", "3.1.0"]])}]])],
  ["jest-worker",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/jest_worker__25.5.0__b797d053/",
             packageDependencies: new Map([["jest-worker", "25.5.0"],
                                             ["merge-stream", "2.0.0"],
                                             ["supports-color", "7.2.0"]])}]])],
  ["js-tokens",
  new Map([["4.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/js_tokens__4.0.0__13c348c2/",
             packageDependencies: new Map([["js-tokens", "4.0.0"]])}]])],
  ["js-yaml",
  new Map([["3.14.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/js_yaml__3.14.1__f8f82111/",
             packageDependencies: new Map([["argparse", "1.0.10"],
                                             ["esprima", "4.0.1"],
                                             ["js-yaml", "3.14.1"]])}]])],
  ["jsbn",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jsbn__0.1.1__75bf0e62/",
             packageDependencies: new Map([["jsbn", "0.1.1"]])}]])],
  ["jsdom",
  new Map([["15.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/jsdom__15.2.1__015ddda7/",
             packageDependencies: new Map([["abab", "2.0.6"],
                                             ["acorn", "7.4.1"],
                                             ["acorn-globals", "4.3.4"],
                                             ["array-equal", "1.0.0"],
                                             ["cssom", "0.4.4"],
                                             ["cssstyle", "2.3.0"],
                                             ["data-urls", "1.1.0"],
                                             ["domexception", "1.0.1"],
                                             ["escodegen", "1.14.3"],
                                             ["html-encoding-sniffer",
                                             "1.0.2"],
                                             ["jsdom", "15.2.1"],
                                             ["nwsapi", "2.2.1"],
                                             ["parse5", "5.1.0"],
                                             ["pn", "1.1.0"],
                                             ["request", "2.88.2"],
                                             ["request-promise-native",
                                             "1.0.9"],
                                             ["saxes", "3.1.11"],
                                             ["symbol-tree", "3.2.4"],
                                             ["tough-cookie", "3.0.1"],
                                             ["w3c-hr-time", "1.0.2"],
                                             ["w3c-xmlserializer", "1.1.2"],
                                             ["webidl-conversions", "4.0.2"],
                                             ["whatwg-encoding", "1.0.5"],
                                             ["whatwg-mimetype", "2.3.0"],
                                             ["whatwg-url", "7.1.0"],
                                             ["ws", "7.5.9"],
                                             ["xml-name-validator", "3.0.0"]])}]])],
  ["jsesc",
  new Map([["2.5.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/jsesc__2.5.2__9fa3d6ed/",
             packageDependencies: new Map([["jsesc", "2.5.2"]])}]])],
  ["json-parse-even-better-errors",
  new Map([["2.3.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/json_parse_even_better_errors__2.3.1__d4098c05/",
             packageDependencies: new Map([["json-parse-even-better-errors",
                                           "2.3.1"]])}]])],
  ["json-schema",
  new Map([["0.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/json_schema__0.4.0__4ddec21c/",
             packageDependencies: new Map([["json-schema", "0.4.0"]])}]])],
  ["json-schema-traverse",
  new Map([["0.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/json_schema_traverse__0.4.1__43d23351/",
             packageDependencies: new Map([["json-schema-traverse", "0.4.1"]])}]])],
  ["json-stringify-safe",
  new Map([["5.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/json_stringify_safe__5.0.1__819e720d/",
             packageDependencies: new Map([["json-stringify-safe", "5.0.1"]])}]])],
  ["json5",
  new Map([["2.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/json5__2.2.1__0ceb051f/",
             packageDependencies: new Map([["json5", "2.2.1"]])}]])],
  ["jsprim",
  new Map([["1.4.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/jsprim__1.4.2__1824d879/",
             packageDependencies: new Map([["assert-plus", "1.0.0"],
                                             ["extsprintf", "1.3.0"],
                                             ["json-schema", "0.4.0"],
                                             ["jsprim", "1.4.2"],
                                             ["verror", "1.10.0"]])}]])],
  ["kind-of",
  new Map([["3.2.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/kind_of__3.2.2__d01f6796/",
             packageDependencies: new Map([["is-buffer", "1.1.6"],
                                             ["kind-of", "3.2.2"]])}],
             ["4.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/kind_of__4.0.0__db2bf5e3/",
               packageDependencies: new Map([["is-buffer", "1.1.6"],
                                               ["kind-of", "4.0.0"]])}],
             ["5.1.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/kind_of__5.1.0__d39d9bfc/",
               packageDependencies: new Map([["kind-of", "5.1.0"]])}],
             ["6.0.3",
             {
               packageLocation: "/home/lucas/.esy/source/i/kind_of__6.0.3__5e3ab80e/",
               packageDependencies: new Map([["kind-of", "6.0.3"]])}]])],
  ["kleur",
  new Map([["3.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/kleur__3.0.3__890177c4/",
             packageDependencies: new Map([["kleur", "3.0.3"]])}]])],
  ["leven",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/leven__3.1.0__5c43f7fb/",
             packageDependencies: new Map([["leven", "3.1.0"]])}]])],
  ["levn",
  new Map([["0.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/levn__0.3.0__3090a2e9/",
             packageDependencies: new Map([["levn", "0.3.0"],
                                             ["prelude-ls", "1.1.2"],
                                             ["type-check", "0.3.2"]])}]])],
  ["lines-and-columns",
  new Map([["1.2.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/lines_and_columns__1.2.4__998b7164/",
             packageDependencies: new Map([["lines-and-columns", "1.2.4"]])}]])],
  ["locate-path",
  new Map([["5.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/locate_path__5.0.0__d946b836/",
             packageDependencies: new Map([["locate-path", "5.0.0"],
                                             ["p-locate", "4.1.0"]])}]])],
  ["lodash",
  new Map([["4.17.21",
           {
             packageLocation: "/home/lucas/.esy/source/i/lodash__4.17.21__82c45c9d/",
             packageDependencies: new Map([["lodash", "4.17.21"]])}]])],
  ["lodash.sortby",
  new Map([["4.7.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/lodash.sortby__4.7.0__d90c4b3f/",
             packageDependencies: new Map([["lodash.sortby", "4.7.0"]])}]])],
  ["lolex",
  new Map([["5.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/lolex__5.1.2__bf2e555c/",
             packageDependencies: new Map([["@sinonjs/commons", "1.8.3"],
                                             ["lolex", "5.1.2"]])}]])],
  ["make-dir",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/make_dir__3.1.0__5a7cab19/",
             packageDependencies: new Map([["make-dir", "3.1.0"],
                                             ["semver", "6.3.0"]])}]])],
  ["makeerror",
  new Map([["1.0.12",
           {
             packageLocation: "/home/lucas/.esy/source/i/makeerror__1.0.12__7c491618/",
             packageDependencies: new Map([["makeerror", "1.0.12"],
                                             ["tmpl", "1.0.5"]])}]])],
  ["map-cache",
  new Map([["0.2.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/map_cache__0.2.2__ae144545/",
             packageDependencies: new Map([["map-cache", "0.2.2"]])}]])],
  ["map-visit",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/map_visit__1.0.0__b55d6613/",
             packageDependencies: new Map([["map-visit", "1.0.0"],
                                             ["object-visit", "1.0.1"]])}]])],
  ["merge-stream",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/merge_stream__2.0.0__c7946737/",
             packageDependencies: new Map([["merge-stream", "2.0.0"]])}]])],
  ["micromatch",
  new Map([["3.1.10",
           {
             packageLocation: "/home/lucas/.esy/source/i/micromatch__3.1.10__4fdec659/",
             packageDependencies: new Map([["arr-diff", "4.0.0"],
                                             ["array-unique", "0.3.2"],
                                             ["braces", "2.3.2"],
                                             ["define-property", "2.0.2"],
                                             ["extend-shallow", "3.0.2"],
                                             ["extglob", "2.0.4"],
                                             ["fragment-cache", "0.2.1"],
                                             ["kind-of", "6.0.3"],
                                             ["micromatch", "3.1.10"],
                                             ["nanomatch", "1.2.13"],
                                             ["object.pick", "1.3.0"],
                                             ["regex-not", "1.0.2"],
                                             ["snapdragon", "0.8.2"],
                                             ["to-regex", "3.0.2"]])}],
             ["4.0.5",
             {
               packageLocation: "/home/lucas/.esy/source/i/micromatch__4.0.5__5683a228/",
               packageDependencies: new Map([["braces", "3.0.2"],
                                               ["micromatch", "4.0.5"],
                                               ["picomatch", "2.3.1"]])}]])],
  ["mime-db",
  new Map([["1.52.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/mime_db__1.52.0__95b55558/",
             packageDependencies: new Map([["mime-db", "1.52.0"]])}]])],
  ["mime-types",
  new Map([["2.1.35",
           {
             packageLocation: "/home/lucas/.esy/source/i/mime_types__2.1.35__ba4679a9/",
             packageDependencies: new Map([["mime-db", "1.52.0"],
                                             ["mime-types", "2.1.35"]])}]])],
  ["mimic-fn",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/mimic_fn__2.1.0__f76a6bb1/",
             packageDependencies: new Map([["mimic-fn", "2.1.0"]])}]])],
  ["minimatch",
  new Map([["3.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/minimatch__3.1.2__4b853d7d/",
             packageDependencies: new Map([["brace-expansion", "1.1.11"],
                                             ["minimatch", "3.1.2"]])}]])],
  ["minimist",
  new Map([["1.2.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/minimist__1.2.6__0c34a6c6/",
             packageDependencies: new Map([["minimist", "1.2.6"]])}]])],
  ["mixin-deep",
  new Map([["1.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/mixin_deep__1.3.2__57627b76/",
             packageDependencies: new Map([["for-in", "1.0.2"],
                                             ["is-extendable", "1.0.1"],
                                             ["mixin-deep", "1.3.2"]])}]])],
  ["ms",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/ms__2.0.0__d842b4cd/",
             packageDependencies: new Map([["ms", "2.0.0"]])}],
             ["2.1.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/ms__2.1.2__44bf868b/",
               packageDependencies: new Map([["ms", "2.1.2"]])}]])],
  ["nanomatch",
  new Map([["1.2.13",
           {
             packageLocation: "/home/lucas/.esy/source/i/nanomatch__1.2.13__2a566370/",
             packageDependencies: new Map([["arr-diff", "4.0.0"],
                                             ["array-unique", "0.3.2"],
                                             ["define-property", "2.0.2"],
                                             ["extend-shallow", "3.0.2"],
                                             ["fragment-cache", "0.2.1"],
                                             ["is-windows", "1.0.2"],
                                             ["kind-of", "6.0.3"],
                                             ["nanomatch", "1.2.13"],
                                             ["object.pick", "1.3.0"],
                                             ["regex-not", "1.0.2"],
                                             ["snapdragon", "0.8.2"],
                                             ["to-regex", "3.0.2"]])}]])],
  ["natural-compare",
  new Map([["1.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/natural_compare__1.4.0__03025537/",
             packageDependencies: new Map([["natural-compare", "1.4.0"]])}]])],
  ["nice-try",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/nice_try__1.0.5__f4f1d459/",
             packageDependencies: new Map([["nice-try", "1.0.5"]])}]])],
  ["node-int64",
  new Map([["0.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/node_int64__0.4.0__c4a509ca/",
             packageDependencies: new Map([["node-int64", "0.4.0"]])}]])],
  ["node-notifier",
  new Map([["6.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/node_notifier__6.0.0__f3e114d5/",
             packageDependencies: new Map([["growly", "1.3.0"],
                                             ["is-wsl", "2.2.0"],
                                             ["node-notifier", "6.0.0"],
                                             ["semver", "6.3.0"],
                                             ["shellwords", "0.1.1"],
                                             ["which", "1.3.1"]])}]])],
  ["node-releases",
  new Map([["2.0.6",
           {
             packageLocation: "/home/lucas/.esy/source/i/node_releases__2.0.6__9025acfe/",
             packageDependencies: new Map([["node-releases", "2.0.6"]])}]])],
  ["normalize-package-data",
  new Map([["2.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/normalize_package_data__2.5.0__ad8eb7b6/",
             packageDependencies: new Map([["hosted-git-info", "2.8.9"],
                                             ["normalize-package-data",
                                             "2.5.0"],
                                             ["resolve", "1.22.1"],
                                             ["semver", "5.7.1"],
                                             ["validate-npm-package-license",
                                             "3.0.4"]])}]])],
  ["normalize-path",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/normalize_path__2.1.1__baf85fb0/",
             packageDependencies: new Map([["normalize-path", "2.1.1"],
                                             ["remove-trailing-separator",
                                             "1.1.0"]])}],
             ["3.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/normalize_path__3.0.0__91fa1ad9/",
               packageDependencies: new Map([["normalize-path", "3.0.0"]])}]])],
  ["npm-run-path",
  new Map([["2.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/npm_run_path__2.0.2__12ea0e5b/",
             packageDependencies: new Map([["npm-run-path", "2.0.2"],
                                             ["path-key", "2.0.1"]])}],
             ["4.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/npm_run_path__4.0.1__4d614634/",
               packageDependencies: new Map([["npm-run-path", "4.0.1"],
                                               ["path-key", "3.1.1"]])}]])],
  ["nwsapi",
  new Map([["2.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/nwsapi__2.2.1__56c8fbf9/",
             packageDependencies: new Map([["nwsapi", "2.2.1"]])}]])],
  ["oauth-sign",
  new Map([["0.9.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/oauth_sign__0.9.0__396e6f49/",
             packageDependencies: new Map([["oauth-sign", "0.9.0"]])}]])],
  ["object-copy",
  new Map([["0.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/object_copy__0.1.0__b1fa7896/",
             packageDependencies: new Map([["copy-descriptor", "0.1.1"],
                                             ["define-property", "0.2.5"],
                                             ["kind-of", "3.2.2"],
                                             ["object-copy", "0.1.0"]])}]])],
  ["object-visit",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/object_visit__1.0.1__c60c875c/",
             packageDependencies: new Map([["isobject", "3.0.1"],
                                             ["object-visit", "1.0.1"]])}]])],
  ["object.pick",
  new Map([["1.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/object.pick__1.3.0__723792f2/",
             packageDependencies: new Map([["isobject", "3.0.1"],
                                             ["object.pick", "1.3.0"]])}]])],
  ["ocaml",
  new Map([["4.14.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/ocaml__4.14.0__5c587ac3/",
             packageDependencies: new Map([["ocaml", "4.14.0"]])}]])],
  ["once",
  new Map([["1.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/once__1.4.0__8285ddde/",
             packageDependencies: new Map([["once", "1.4.0"],
                                             ["wrappy", "1.0.2"]])}]])],
  ["onetime",
  new Map([["5.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/onetime__5.1.2__54dbb231/",
             packageDependencies: new Map([["mimic-fn", "2.1.0"],
                                             ["onetime", "5.1.2"]])}]])],
  ["optionator",
  new Map([["0.8.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/optionator__0.8.3__4945d345/",
             packageDependencies: new Map([["deep-is", "0.1.4"],
                                             ["fast-levenshtein", "2.0.6"],
                                             ["levn", "0.3.0"],
                                             ["optionator", "0.8.3"],
                                             ["prelude-ls", "1.1.2"],
                                             ["type-check", "0.3.2"],
                                             ["word-wrap", "1.2.3"]])}]])],
  ["p-each-series",
  new Map([["2.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/p_each_series__2.2.0__77c6f0c7/",
             packageDependencies: new Map([["p-each-series", "2.2.0"]])}]])],
  ["p-finally",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/p_finally__1.0.0__90840028/",
             packageDependencies: new Map([["p-finally", "1.0.0"]])}],
             ["2.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/p_finally__2.0.1__c91fa114/",
               packageDependencies: new Map([["p-finally", "2.0.1"]])}]])],
  ["p-limit",
  new Map([["2.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/p_limit__2.3.0__cfa3bb23/",
             packageDependencies: new Map([["p-limit", "2.3.0"],
                                             ["p-try", "2.2.0"]])}]])],
  ["p-locate",
  new Map([["4.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/p_locate__4.1.0__359d132a/",
             packageDependencies: new Map([["p-limit", "2.3.0"],
                                             ["p-locate", "4.1.0"]])}]])],
  ["p-try",
  new Map([["2.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/p_try__2.2.0__7ec98f05/",
             packageDependencies: new Map([["p-try", "2.2.0"]])}]])],
  ["parse-json",
  new Map([["5.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/parse_json__5.2.0__cc8a29ed/",
             packageDependencies: new Map([["@babel/code-frame", "7.18.6"],
                                             ["error-ex", "1.3.2"],
                                             ["json-parse-even-better-errors",
                                             "2.3.1"],
                                             ["lines-and-columns", "1.2.4"],
                                             ["parse-json", "5.2.0"]])}]])],
  ["parse5",
  new Map([["5.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/parse5__5.1.0__c5499f5a/",
             packageDependencies: new Map([["parse5", "5.1.0"]])}]])],
  ["pascalcase",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/pascalcase__0.1.1__dbba0370/",
             packageDependencies: new Map([["pascalcase", "0.1.1"]])}]])],
  ["path-exists",
  new Map([["4.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/path_exists__4.0.0__f0834a86/",
             packageDependencies: new Map([["path-exists", "4.0.0"]])}]])],
  ["path-is-absolute",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/path_is_absolute__1.0.1__b16551ae/",
             packageDependencies: new Map([["path-is-absolute", "1.0.1"]])}]])],
  ["path-key",
  new Map([["2.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/path_key__2.0.1__b1422758/",
             packageDependencies: new Map([["path-key", "2.0.1"]])}],
             ["3.1.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/path_key__3.1.1__af067986/",
               packageDependencies: new Map([["path-key", "3.1.1"]])}]])],
  ["path-parse",
  new Map([["1.0.7",
           {
             packageLocation: "/home/lucas/.esy/source/i/path_parse__1.0.7__7a3b308e/",
             packageDependencies: new Map([["path-parse", "1.0.7"]])}]])],
  ["performance-now",
  new Map([["2.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/performance_now__2.1.0__828664f5/",
             packageDependencies: new Map([["performance-now", "2.1.0"]])}]])],
  ["picocolors",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/picocolors__1.0.0__e5c56b04/",
             packageDependencies: new Map([["picocolors", "1.0.0"]])}]])],
  ["picomatch",
  new Map([["2.3.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/picomatch__2.3.1__4699f5fc/",
             packageDependencies: new Map([["picomatch", "2.3.1"]])}]])],
  ["pirates",
  new Map([["4.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/pirates__4.0.5__22d4ffe4/",
             packageDependencies: new Map([["pirates", "4.0.5"]])}]])],
  ["pkg-dir",
  new Map([["4.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/pkg_dir__4.2.0__4d291c31/",
             packageDependencies: new Map([["find-up", "4.1.0"],
                                             ["pkg-dir", "4.2.0"]])}]])],
  ["pn",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/pn__1.1.0__178d1a64/",
             packageDependencies: new Map([["pn", "1.1.0"]])}]])],
  ["posix-character-classes",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/posix_character_classes__0.1.1__c9261503/",
             packageDependencies: new Map([["posix-character-classes",
                                           "0.1.1"]])}]])],
  ["prelude-ls",
  new Map([["1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/prelude_ls__1.1.2__179c4c45/",
             packageDependencies: new Map([["prelude-ls", "1.1.2"]])}]])],
  ["pretty-format",
  new Map([["25.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/pretty_format__25.5.0__91763724/",
             packageDependencies: new Map([["@jest/types", "25.5.0"],
                                             ["ansi-regex", "5.0.1"],
                                             ["ansi-styles", "4.3.0"],
                                             ["pretty-format", "25.5.0"],
                                             ["react-is", "16.13.1"]])}]])],
  ["prompts",
  new Map([["2.4.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/prompts__2.4.2__79180228/",
             packageDependencies: new Map([["kleur", "3.0.3"],
                                             ["prompts", "2.4.2"],
                                             ["sisteransi", "1.0.5"]])}]])],
  ["psl",
  new Map([["1.9.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/psl__1.9.0__f289acac/",
             packageDependencies: new Map([["psl", "1.9.0"]])}]])],
  ["pump",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/pump__3.0.0__650a87ec/",
             packageDependencies: new Map([["end-of-stream", "1.4.4"],
                                             ["once", "1.4.0"],
                                             ["pump", "3.0.0"]])}]])],
  ["punycode",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/punycode__2.1.1__9d5f3bb8/",
             packageDependencies: new Map([["punycode", "2.1.1"]])}]])],
  ["qs",
  new Map([["6.5.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/qs__6.5.3__3ed598c0/",
             packageDependencies: new Map([["qs", "6.5.3"]])}]])],
  ["react-is",
  new Map([["16.13.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/react_is__16.13.1__8a41bdd9/",
             packageDependencies: new Map([["react-is", "16.13.1"]])}]])],
  ["read-pkg",
  new Map([["5.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/read_pkg__5.2.0__f85f0d90/",
             packageDependencies: new Map([["@types/normalize-package-data",
                                           "2.4.1"],
                                             ["normalize-package-data",
                                             "2.5.0"],
                                             ["parse-json", "5.2.0"],
                                             ["read-pkg", "5.2.0"],
                                             ["type-fest", "0.6.0"]])}]])],
  ["read-pkg-up",
  new Map([["7.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/read_pkg_up__7.0.1__e36e2610/",
             packageDependencies: new Map([["find-up", "4.1.0"],
                                             ["read-pkg", "5.2.0"],
                                             ["read-pkg-up", "7.0.1"],
                                             ["type-fest", "0.8.1"]])}]])],
  ["realpath-native",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/realpath_native__2.0.0__b48905d6/",
             packageDependencies: new Map([["realpath-native", "2.0.0"]])}]])],
  ["regex-not",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/regex_not__1.0.2__9a76c75b/",
             packageDependencies: new Map([["extend-shallow", "3.0.2"],
                                             ["regex-not", "1.0.2"],
                                             ["safe-regex", "1.1.0"]])}]])],
  ["remove-trailing-separator",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/remove_trailing_separator__1.1.0__5afd3399/",
             packageDependencies: new Map([["remove-trailing-separator",
                                           "1.1.0"]])}]])],
  ["repeat-element",
  new Map([["1.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/repeat_element__1.1.4__cce94694/",
             packageDependencies: new Map([["repeat-element", "1.1.4"]])}]])],
  ["repeat-string",
  new Map([["1.6.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/repeat_string__1.6.1__f30c8ba7/",
             packageDependencies: new Map([["repeat-string", "1.6.1"]])}]])],
  ["request",
  new Map([["2.88.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/request__2.88.2__5c8b4637/",
             packageDependencies: new Map([["aws-sign2", "0.7.0"],
                                             ["aws4", "1.11.0"],
                                             ["caseless", "0.12.0"],
                                             ["combined-stream", "1.0.8"],
                                             ["extend", "3.0.2"],
                                             ["forever-agent", "0.6.1"],
                                             ["form-data", "2.3.3"],
                                             ["har-validator", "5.1.5"],
                                             ["http-signature", "1.2.0"],
                                             ["is-typedarray", "1.0.0"],
                                             ["isstream", "0.1.2"],
                                             ["json-stringify-safe", "5.0.1"],
                                             ["mime-types", "2.1.35"],
                                             ["oauth-sign", "0.9.0"],
                                             ["performance-now", "2.1.0"],
                                             ["qs", "6.5.3"],
                                             ["request", "2.88.2"],
                                             ["safe-buffer", "5.1.2"],
                                             ["tough-cookie", "2.5.0"],
                                             ["tunnel-agent", "0.6.0"],
                                             ["uuid", "3.4.0"]])}]])],
  ["request-promise-core",
  new Map([["1.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/request_promise_core__1.1.4__f9887999/",
             packageDependencies: new Map([["lodash", "4.17.21"],
                                             ["request", "2.88.2"],
                                             ["request-promise-core",
                                             "1.1.4"]])}]])],
  ["request-promise-native",
  new Map([["1.0.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/request_promise_native__1.0.9__2907f506/",
             packageDependencies: new Map([["request", "2.88.2"],
                                             ["request-promise-core",
                                             "1.1.4"],
                                             ["request-promise-native",
                                             "1.0.9"],
                                             ["stealthy-require", "1.1.1"],
                                             ["tough-cookie", "2.5.0"]])}]])],
  ["require-directory",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/require_directory__2.1.1__263c7201/",
             packageDependencies: new Map([["require-directory", "2.1.1"]])}]])],
  ["require-main-filename",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/require_main_filename__2.0.0__86f489be/",
             packageDependencies: new Map([["require-main-filename", "2.0.0"]])}]])],
  ["resolve",
  new Map([["1.1.7",
           {
             packageLocation: "/home/lucas/.esy/source/i/resolve__1.1.7__eeb5dfb4/",
             packageDependencies: new Map([["resolve", "1.1.7"]])}],
             ["1.22.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/resolve__1.22.1__2c82103e/",
               packageDependencies: new Map([["is-core-module", "2.9.0"],
                                               ["path-parse", "1.0.7"],
                                               ["resolve", "1.22.1"],
                                               ["supports-preserve-symlinks-flag",
                                               "1.0.0"]])}]])],
  ["resolve-cwd",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/resolve_cwd__3.0.0__41f3f704/",
             packageDependencies: new Map([["resolve-cwd", "3.0.0"],
                                             ["resolve-from", "5.0.0"]])}]])],
  ["resolve-from",
  new Map([["5.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/resolve_from__5.0.0__10bee194/",
             packageDependencies: new Map([["resolve-from", "5.0.0"]])}]])],
  ["resolve-url",
  new Map([["0.2.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/resolve_url__0.2.1__a6983901/",
             packageDependencies: new Map([["resolve-url", "0.2.1"]])}]])],
  ["ret",
  new Map([["0.1.15",
           {
             packageLocation: "/home/lucas/.esy/source/i/ret__0.1.15__017183c7/",
             packageDependencies: new Map([["ret", "0.1.15"]])}]])],
  ["rimraf",
  new Map([["3.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/rimraf__3.0.2__283ad518/",
             packageDependencies: new Map([["glob", "7.2.3"],
                                             ["rimraf", "3.0.2"]])}]])],
  ["rsvp",
  new Map([["4.8.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/rsvp__4.8.5__08beeafc/",
             packageDependencies: new Map([["rsvp", "4.8.5"]])}]])],
  ["safe-buffer",
  new Map([["5.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/safe_buffer__5.1.2__e975ebd3/",
             packageDependencies: new Map([["safe-buffer", "5.1.2"]])}]])],
  ["safe-regex",
  new Map([["1.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/safe_regex__1.1.0__ffc1efdf/",
             packageDependencies: new Map([["ret", "0.1.15"],
                                             ["safe-regex", "1.1.0"]])}]])],
  ["safer-buffer",
  new Map([["2.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/safer_buffer__2.1.2__204e3826/",
             packageDependencies: new Map([["safer-buffer", "2.1.2"]])}]])],
  ["sane",
  new Map([["4.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/sane__4.1.0__5b5e141d/",
             packageDependencies: new Map([["@cnakazawa/watch", "1.0.4"],
                                             ["anymatch", "2.0.0"],
                                             ["capture-exit", "2.0.0"],
                                             ["exec-sh", "0.3.6"],
                                             ["execa", "1.0.0"],
                                             ["fb-watchman", "2.0.1"],
                                             ["micromatch", "3.1.10"],
                                             ["minimist", "1.2.6"],
                                             ["sane", "4.1.0"],
                                             ["walker", "1.0.8"]])}]])],
  ["saxes",
  new Map([["3.1.11",
           {
             packageLocation: "/home/lucas/.esy/source/i/saxes__3.1.11__44bd18c5/",
             packageDependencies: new Map([["saxes", "3.1.11"],
                                             ["xmlchars", "2.2.0"]])}]])],
  ["semver",
  new Map([["5.7.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/semver__5.7.1__e3fff838/",
             packageDependencies: new Map([["semver", "5.7.1"]])}],
             ["6.3.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/semver__6.3.0__fb45cafd/",
               packageDependencies: new Map([["semver", "6.3.0"]])}]])],
  ["set-blocking",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/set_blocking__2.0.0__5d79dd8a/",
             packageDependencies: new Map([["set-blocking", "2.0.0"]])}]])],
  ["set-value",
  new Map([["2.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/set_value__2.0.1__a2adfdf9/",
             packageDependencies: new Map([["extend-shallow", "2.0.1"],
                                             ["is-extendable", "0.1.1"],
                                             ["is-plain-object", "2.0.4"],
                                             ["set-value", "2.0.1"],
                                             ["split-string", "3.1.0"]])}]])],
  ["shebang-command",
  new Map([["1.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/shebang_command__1.2.0__d7a62977/",
             packageDependencies: new Map([["shebang-command", "1.2.0"],
                                             ["shebang-regex", "1.0.0"]])}],
             ["2.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/shebang_command__2.0.0__0462f5ca/",
               packageDependencies: new Map([["shebang-command", "2.0.0"],
                                               ["shebang-regex", "3.0.0"]])}]])],
  ["shebang-regex",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/shebang_regex__1.0.0__61c22a6d/",
             packageDependencies: new Map([["shebang-regex", "1.0.0"]])}],
             ["3.0.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/shebang_regex__3.0.0__ce18071a/",
               packageDependencies: new Map([["shebang-regex", "3.0.0"]])}]])],
  ["shellwords",
  new Map([["0.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/shellwords__0.1.1__d12c3a69/",
             packageDependencies: new Map([["shellwords", "0.1.1"]])}]])],
  ["signal-exit",
  new Map([["3.0.7",
           {
             packageLocation: "/home/lucas/.esy/source/i/signal_exit__3.0.7__2427f0d9/",
             packageDependencies: new Map([["signal-exit", "3.0.7"]])}]])],
  ["sisteransi",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/sisteransi__1.0.5__bc6ed82b/",
             packageDependencies: new Map([["sisteransi", "1.0.5"]])}]])],
  ["slash",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/slash__3.0.0__065936e9/",
             packageDependencies: new Map([["slash", "3.0.0"]])}]])],
  ["snapdragon",
  new Map([["0.8.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/snapdragon__0.8.2__3333ae58/",
             packageDependencies: new Map([["base", "0.11.2"],
                                             ["debug", "2.6.9"],
                                             ["define-property", "0.2.5"],
                                             ["extend-shallow", "2.0.1"],
                                             ["map-cache", "0.2.2"],
                                             ["snapdragon", "0.8.2"],
                                             ["source-map", "0.5.7"],
                                             ["source-map-resolve", "0.5.3"],
                                             ["use", "3.1.1"]])}]])],
  ["snapdragon-node",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/snapdragon_node__2.1.1__389d2cbf/",
             packageDependencies: new Map([["define-property", "1.0.0"],
                                             ["isobject", "3.0.1"],
                                             ["snapdragon-node", "2.1.1"],
                                             ["snapdragon-util", "3.0.1"]])}]])],
  ["snapdragon-util",
  new Map([["3.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/snapdragon_util__3.0.1__09e35752/",
             packageDependencies: new Map([["kind-of", "3.2.2"],
                                             ["snapdragon-util", "3.0.1"]])}]])],
  ["source-map",
  new Map([["0.5.7",
           {
             packageLocation: "/home/lucas/.esy/source/i/source_map__0.5.7__f39e7237/",
             packageDependencies: new Map([["source-map", "0.5.7"]])}],
             ["0.6.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/source_map__0.6.1__20131c2b/",
               packageDependencies: new Map([["source-map", "0.6.1"]])}],
             ["0.7.4",
             {
               packageLocation: "/home/lucas/.esy/source/i/source_map__0.7.4__5e03c8d2/",
               packageDependencies: new Map([["source-map", "0.7.4"]])}]])],
  ["source-map-resolve",
  new Map([["0.5.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/source_map_resolve__0.5.3__8aba3b88/",
             packageDependencies: new Map([["atob", "2.1.2"],
                                             ["decode-uri-component",
                                             "0.2.0"],
                                             ["resolve-url", "0.2.1"],
                                             ["source-map-resolve", "0.5.3"],
                                             ["source-map-url", "0.4.1"],
                                             ["urix", "0.1.0"]])}]])],
  ["source-map-support",
  new Map([["0.5.21",
           {
             packageLocation: "/home/lucas/.esy/source/i/source_map_support__0.5.21__c4490966/",
             packageDependencies: new Map([["buffer-from", "1.1.2"],
                                             ["source-map", "0.6.1"],
                                             ["source-map-support", "0.5.21"]])}]])],
  ["source-map-url",
  new Map([["0.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/source_map_url__0.4.1__b3241d85/",
             packageDependencies: new Map([["source-map-url", "0.4.1"]])}]])],
  ["spdx-correct",
  new Map([["3.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/spdx_correct__3.1.1__3e0d6226/",
             packageDependencies: new Map([["spdx-correct", "3.1.1"],
                                             ["spdx-expression-parse",
                                             "3.0.1"],
                                             ["spdx-license-ids", "3.0.11"]])}]])],
  ["spdx-exceptions",
  new Map([["2.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/spdx_exceptions__2.3.0__66adeda0/",
             packageDependencies: new Map([["spdx-exceptions", "2.3.0"]])}]])],
  ["spdx-expression-parse",
  new Map([["3.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/spdx_expression_parse__3.0.1__2313802f/",
             packageDependencies: new Map([["spdx-exceptions", "2.3.0"],
                                             ["spdx-expression-parse",
                                             "3.0.1"],
                                             ["spdx-license-ids", "3.0.11"]])}]])],
  ["spdx-license-ids",
  new Map([["3.0.11",
           {
             packageLocation: "/home/lucas/.esy/source/i/spdx_license_ids__3.0.11__31783c01/",
             packageDependencies: new Map([["spdx-license-ids", "3.0.11"]])}]])],
  ["split-string",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/split_string__3.1.0__ba22f226/",
             packageDependencies: new Map([["extend-shallow", "3.0.2"],
                                             ["split-string", "3.1.0"]])}]])],
  ["sprintf-js",
  new Map([["1.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/sprintf_js__1.0.3__d658c825/",
             packageDependencies: new Map([["sprintf-js", "1.0.3"]])}]])],
  ["sshpk",
  new Map([["1.17.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/sshpk__1.17.0__82fea7e5/",
             packageDependencies: new Map([["asn1", "0.2.6"],
                                             ["assert-plus", "1.0.0"],
                                             ["bcrypt-pbkdf", "1.0.2"],
                                             ["dashdash", "1.14.1"],
                                             ["ecc-jsbn", "0.1.2"],
                                             ["getpass", "0.1.7"],
                                             ["jsbn", "0.1.1"],
                                             ["safer-buffer", "2.1.2"],
                                             ["sshpk", "1.17.0"],
                                             ["tweetnacl", "0.14.5"]])}]])],
  ["stack-utils",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/stack_utils__1.0.5__bf307028/",
             packageDependencies: new Map([["escape-string-regexp", "2.0.0"],
                                             ["stack-utils", "1.0.5"]])}]])],
  ["static-extend",
  new Map([["0.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/static_extend__0.1.2__eef8a796/",
             packageDependencies: new Map([["define-property", "0.2.5"],
                                             ["object-copy", "0.1.0"],
                                             ["static-extend", "0.1.2"]])}]])],
  ["stealthy-require",
  new Map([["1.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/stealthy_require__1.1.1__5f88108a/",
             packageDependencies: new Map([["stealthy-require", "1.1.1"]])}]])],
  ["string-length",
  new Map([["3.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/string_length__3.1.0__d5430449/",
             packageDependencies: new Map([["astral-regex", "1.0.0"],
                                             ["string-length", "3.1.0"],
                                             ["strip-ansi", "5.2.0"]])}]])],
  ["string-width",
  new Map([["4.2.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/string_width__4.2.3__6c76da73/",
             packageDependencies: new Map([["emoji-regex", "8.0.0"],
                                             ["is-fullwidth-code-point",
                                             "3.0.0"],
                                             ["string-width", "4.2.3"],
                                             ["strip-ansi", "6.0.1"]])}]])],
  ["strip-ansi",
  new Map([["5.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/strip_ansi__5.2.0__36e628b8/",
             packageDependencies: new Map([["ansi-regex", "4.1.1"],
                                             ["strip-ansi", "5.2.0"]])}],
             ["6.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/strip_ansi__6.0.1__19d38e39/",
               packageDependencies: new Map([["ansi-regex", "5.0.1"],
                                               ["strip-ansi", "6.0.1"]])}]])],
  ["strip-bom",
  new Map([["4.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/strip_bom__4.0.0__61067802/",
             packageDependencies: new Map([["strip-bom", "4.0.0"]])}]])],
  ["strip-eof",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/strip_eof__1.0.0__040453c2/",
             packageDependencies: new Map([["strip-eof", "1.0.0"]])}]])],
  ["strip-final-newline",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/strip_final_newline__2.0.0__ee42b96b/",
             packageDependencies: new Map([["strip-final-newline", "2.0.0"]])}]])],
  ["supports-color",
  new Map([["5.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/supports_color__5.5.0__0bed0829/",
             packageDependencies: new Map([["has-flag", "3.0.0"],
                                             ["supports-color", "5.5.0"]])}],
             ["7.2.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/supports_color__7.2.0__314a291a/",
               packageDependencies: new Map([["has-flag", "4.0.0"],
                                               ["supports-color", "7.2.0"]])}]])],
  ["supports-hyperlinks",
  new Map([["2.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/supports_hyperlinks__2.2.0__757c6a25/",
             packageDependencies: new Map([["has-flag", "4.0.0"],
                                             ["supports-color", "7.2.0"],
                                             ["supports-hyperlinks", "2.2.0"]])}]])],
  ["supports-preserve-symlinks-flag",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/supports_preserve_symlinks_flag__1.0.0__1e117067/",
             packageDependencies: new Map([["supports-preserve-symlinks-flag",
                                           "1.0.0"]])}]])],
  ["symbol-tree",
  new Map([["3.2.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/symbol_tree__3.2.4__9afcccea/",
             packageDependencies: new Map([["symbol-tree", "3.2.4"]])}]])],
  ["terminal-link",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/terminal_link__2.1.1__21db132b/",
             packageDependencies: new Map([["ansi-escapes", "4.3.2"],
                                             ["supports-hyperlinks", "2.2.0"],
                                             ["terminal-link", "2.1.1"]])}]])],
  ["test-exclude",
  new Map([["6.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/test_exclude__6.0.0__442dffc5/",
             packageDependencies: new Map([["@istanbuljs/schema", "0.1.3"],
                                             ["glob", "7.2.3"],
                                             ["minimatch", "3.1.2"],
                                             ["test-exclude", "6.0.0"]])}]])],
  ["throat",
  new Map([["5.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/throat__5.0.0__58d99cb8/",
             packageDependencies: new Map([["throat", "5.0.0"]])}]])],
  ["tmpl",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/tmpl__1.0.5__a076db55/",
             packageDependencies: new Map([["tmpl", "1.0.5"]])}]])],
  ["to-fast-properties",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/to_fast_properties__2.0.0__0ba318c5/",
             packageDependencies: new Map([["to-fast-properties", "2.0.0"]])}]])],
  ["to-object-path",
  new Map([["0.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/to_object_path__0.3.0__4e1644c7/",
             packageDependencies: new Map([["kind-of", "3.2.2"],
                                             ["to-object-path", "0.3.0"]])}]])],
  ["to-regex",
  new Map([["3.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/to_regex__3.0.2__1682d906/",
             packageDependencies: new Map([["define-property", "2.0.2"],
                                             ["extend-shallow", "3.0.2"],
                                             ["regex-not", "1.0.2"],
                                             ["safe-regex", "1.1.0"],
                                             ["to-regex", "3.0.2"]])}]])],
  ["to-regex-range",
  new Map([["2.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/to_regex_range__2.1.1__ff8c30ef/",
             packageDependencies: new Map([["is-number", "3.0.0"],
                                             ["repeat-string", "1.6.1"],
                                             ["to-regex-range", "2.1.1"]])}],
             ["5.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/to_regex_range__5.0.1__ddb0b8b0/",
               packageDependencies: new Map([["is-number", "7.0.0"],
                                               ["to-regex-range", "5.0.1"]])}]])],
  ["tough-cookie",
  new Map([["2.5.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/tough_cookie__2.5.0__9fe36df0/",
             packageDependencies: new Map([["psl", "1.9.0"],
                                             ["punycode", "2.1.1"],
                                             ["tough-cookie", "2.5.0"]])}],
             ["3.0.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/tough_cookie__3.0.1__7cd5263f/",
               packageDependencies: new Map([["ip-regex", "2.1.0"],
                                               ["psl", "1.9.0"],
                                               ["punycode", "2.1.1"],
                                               ["tough-cookie", "3.0.1"]])}]])],
  ["tr46",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/tr46__1.0.1__58ccfe17/",
             packageDependencies: new Map([["punycode", "2.1.1"],
                                             ["tr46", "1.0.1"]])}]])],
  ["tunnel-agent",
  new Map([["0.6.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/tunnel_agent__0.6.0__00a51b75/",
             packageDependencies: new Map([["safe-buffer", "5.1.2"],
                                             ["tunnel-agent", "0.6.0"]])}]])],
  ["tweetnacl",
  new Map([["0.14.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/tweetnacl__0.14.5__03459ff4/",
             packageDependencies: new Map([["tweetnacl", "0.14.5"]])}]])],
  ["type-check",
  new Map([["0.3.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/type_check__0.3.2__046c4482/",
             packageDependencies: new Map([["prelude-ls", "1.1.2"],
                                             ["type-check", "0.3.2"]])}]])],
  ["type-detect",
  new Map([["4.0.8",
           {
             packageLocation: "/home/lucas/.esy/source/i/type_detect__4.0.8__2510b9fe/",
             packageDependencies: new Map([["type-detect", "4.0.8"]])}]])],
  ["type-fest",
  new Map([["0.21.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/type_fest__0.21.3__eb21aeec/",
             packageDependencies: new Map([["type-fest", "0.21.3"]])}],
             ["0.6.0",
             {
               packageLocation: "/home/lucas/.esy/source/i/type_fest__0.6.0__5e105463/",
               packageDependencies: new Map([["type-fest", "0.6.0"]])}],
             ["0.8.1",
             {
               packageLocation: "/home/lucas/.esy/source/i/type_fest__0.8.1__fabbb69d/",
               packageDependencies: new Map([["type-fest", "0.8.1"]])}]])],
  ["typedarray-to-buffer",
  new Map([["3.1.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/typedarray_to_buffer__3.1.5__cc08292c/",
             packageDependencies: new Map([["is-typedarray", "1.0.0"],
                                             ["typedarray-to-buffer",
                                             "3.1.5"]])}]])],
  ["union-value",
  new Map([["1.0.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/union_value__1.0.1__b1f6001d/",
             packageDependencies: new Map([["arr-union", "3.1.0"],
                                             ["get-value", "2.0.6"],
                                             ["is-extendable", "0.1.1"],
                                             ["set-value", "2.0.1"],
                                             ["union-value", "1.0.1"]])}]])],
  ["unset-value",
  new Map([["1.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/unset_value__1.0.0__54969e15/",
             packageDependencies: new Map([["has-value", "0.3.1"],
                                             ["isobject", "3.0.1"],
                                             ["unset-value", "1.0.0"]])}]])],
  ["update-browserslist-db",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/update_browserslist_db__1.0.5__7ae71fb4/",
             packageDependencies: new Map([["browserslist", "4.21.2"],
                                             ["escalade", "3.1.1"],
                                             ["picocolors", "1.0.0"],
                                             ["update-browserslist-db",
                                             "1.0.5"]])}]])],
  ["uri-js",
  new Map([["4.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/uri_js__4.4.1__7918c241/",
             packageDependencies: new Map([["punycode", "2.1.1"],
                                             ["uri-js", "4.4.1"]])}]])],
  ["urix",
  new Map([["0.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/urix__0.1.0__578d889a/",
             packageDependencies: new Map([["urix", "0.1.0"]])}]])],
  ["use",
  new Map([["3.1.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/use__3.1.1__6c794d09/",
             packageDependencies: new Map([["use", "3.1.1"]])}]])],
  ["uuid",
  new Map([["3.4.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/uuid__3.4.0__aded8d7a/",
             packageDependencies: new Map([["uuid", "3.4.0"]])}]])],
  ["v8-to-istanbul",
  new Map([["4.1.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/v8_to_istanbul__4.1.4__ce221a39/",
             packageDependencies: new Map([["@types/istanbul-lib-coverage",
                                           "2.0.4"],
                                             ["convert-source-map", "1.8.0"],
                                             ["source-map", "0.7.4"],
                                             ["v8-to-istanbul", "4.1.4"]])}]])],
  ["validate-npm-package-license",
  new Map([["3.0.4",
           {
             packageLocation: "/home/lucas/.esy/source/i/validate_npm_package_license__3.0.4__9b2ae112/",
             packageDependencies: new Map([["spdx-correct", "3.1.1"],
                                             ["spdx-expression-parse",
                                             "3.0.1"],
                                             ["validate-npm-package-license",
                                             "3.0.4"]])}]])],
  ["verror",
  new Map([["1.10.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/verror__1.10.0__a7bd6ab7/",
             packageDependencies: new Map([["assert-plus", "1.0.0"],
                                             ["core-util-is", "1.0.2"],
                                             ["extsprintf", "1.3.0"],
                                             ["verror", "1.10.0"]])}]])],
  ["w3c-hr-time",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/w3c_hr_time__1.0.2__54e7a2ae/",
             packageDependencies: new Map([["browser-process-hrtime",
                                           "1.0.0"],
                                             ["w3c-hr-time", "1.0.2"]])}]])],
  ["w3c-xmlserializer",
  new Map([["1.1.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/w3c_xmlserializer__1.1.2__8775e91e/",
             packageDependencies: new Map([["domexception", "1.0.1"],
                                             ["w3c-xmlserializer", "1.1.2"],
                                             ["webidl-conversions", "4.0.2"],
                                             ["xml-name-validator", "3.0.0"]])}]])],
  ["walker",
  new Map([["1.0.8",
           {
             packageLocation: "/home/lucas/.esy/source/i/walker__1.0.8__74b5814d/",
             packageDependencies: new Map([["makeerror", "1.0.12"],
                                             ["walker", "1.0.8"]])}]])],
  ["webidl-conversions",
  new Map([["4.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/webidl_conversions__4.0.2__e29d3cf0/",
             packageDependencies: new Map([["webidl-conversions", "4.0.2"]])}]])],
  ["whatwg-encoding",
  new Map([["1.0.5",
           {
             packageLocation: "/home/lucas/.esy/source/i/whatwg_encoding__1.0.5__35eb34ef/",
             packageDependencies: new Map([["iconv-lite", "0.4.24"],
                                             ["whatwg-encoding", "1.0.5"]])}]])],
  ["whatwg-mimetype",
  new Map([["2.3.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/whatwg_mimetype__2.3.0__d8e82697/",
             packageDependencies: new Map([["whatwg-mimetype", "2.3.0"]])}]])],
  ["whatwg-url",
  new Map([["7.1.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/whatwg_url__7.1.0__8881dc95/",
             packageDependencies: new Map([["lodash.sortby", "4.7.0"],
                                             ["tr46", "1.0.1"],
                                             ["webidl-conversions", "4.0.2"],
                                             ["whatwg-url", "7.1.0"]])}]])],
  ["which",
  new Map([["1.3.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/which__1.3.1__6a4208c5/",
             packageDependencies: new Map([["isexe", "2.0.0"],
                                             ["which", "1.3.1"]])}],
             ["2.0.2",
             {
               packageLocation: "/home/lucas/.esy/source/i/which__2.0.2__12e88ff3/",
               packageDependencies: new Map([["isexe", "2.0.0"],
                                               ["which", "2.0.2"]])}]])],
  ["which-module",
  new Map([["2.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/which_module__2.0.0__dbf9460d/",
             packageDependencies: new Map([["which-module", "2.0.0"]])}]])],
  ["word-wrap",
  new Map([["1.2.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/word_wrap__1.2.3__b3ea4240/",
             packageDependencies: new Map([["word-wrap", "1.2.3"]])}]])],
  ["wrap-ansi",
  new Map([["6.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/wrap_ansi__6.2.0__630fcb39/",
             packageDependencies: new Map([["ansi-styles", "4.3.0"],
                                             ["string-width", "4.2.3"],
                                             ["strip-ansi", "6.0.1"],
                                             ["wrap-ansi", "6.2.0"]])}]])],
  ["wrappy",
  new Map([["1.0.2",
           {
             packageLocation: "/home/lucas/.esy/source/i/wrappy__1.0.2__5299ea53/",
             packageDependencies: new Map([["wrappy", "1.0.2"]])}]])],
  ["write-file-atomic",
  new Map([["3.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/write_file_atomic__3.0.3__6a20bc64/",
             packageDependencies: new Map([["imurmurhash", "0.1.4"],
                                             ["is-typedarray", "1.0.0"],
                                             ["signal-exit", "3.0.7"],
                                             ["typedarray-to-buffer",
                                             "3.1.5"],
                                             ["write-file-atomic", "3.0.3"]])}]])],
  ["ws",
  new Map([["7.5.9",
           {
             packageLocation: "/home/lucas/.esy/source/i/ws__7.5.9__bf7d0a03/",
             packageDependencies: new Map([["ws", "7.5.9"]])}]])],
  ["xml-name-validator",
  new Map([["3.0.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/xml_name_validator__3.0.0__808c4a12/",
             packageDependencies: new Map([["xml-name-validator", "3.0.0"]])}]])],
  ["xmlchars",
  new Map([["2.2.0",
           {
             packageLocation: "/home/lucas/.esy/source/i/xmlchars__2.2.0__15519a46/",
             packageDependencies: new Map([["xmlchars", "2.2.0"]])}]])],
  ["y18n",
  new Map([["4.0.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/y18n__4.0.3__4dbf3ad1/",
             packageDependencies: new Map([["y18n", "4.0.3"]])}]])],
  ["yargs",
  new Map([["15.4.1",
           {
             packageLocation: "/home/lucas/.esy/source/i/yargs__15.4.1__02577956/",
             packageDependencies: new Map([["cliui", "6.0.0"],
                                             ["decamelize", "1.2.0"],
                                             ["find-up", "4.1.0"],
                                             ["get-caller-file", "2.0.5"],
                                             ["require-directory", "2.1.1"],
                                             ["require-main-filename",
                                             "2.0.0"],
                                             ["set-blocking", "2.0.0"],
                                             ["string-width", "4.2.3"],
                                             ["which-module", "2.0.0"],
                                             ["y18n", "4.0.3"],
                                             ["yargs", "15.4.1"],
                                             ["yargs-parser", "18.1.3"]])}]])],
  ["yargs-parser",
  new Map([["18.1.3",
           {
             packageLocation: "/home/lucas/.esy/source/i/yargs_parser__18.1.3__7d2b106e/",
             packageDependencies: new Map([["camelcase", "5.3.1"],
                                             ["decamelize", "1.2.0"],
                                             ["yargs-parser", "18.1.3"]])}]])],
  [null,
  new Map([[null,
           {
             packageLocation: "/home/lucas/dev/exercism/reasonml/rna-transcription/",
             packageDependencies: new Map([["@glennsl/bs-jest", "0.5.1"],
                                             ["@opam/ocaml-lsp-server",
                                             "opam:1.12.4"],
                                             ["bs-platform", "7.3.2"]])}]])]]);

let topLevelLocatorPath = "../../";
let locatorsByLocations = new Map([
["../../", topLevelLocator],
  ["../../../../../../.esy/source/i/abab__2.0.6__478baada/",
  {
    name: "abab",
    reference: "2.0.6"}],
  ["../../../../../../.esy/source/i/acorn__6.4.2__3a5cdf52/",
  {
    name: "acorn",
    reference: "6.4.2"}],
  ["../../../../../../.esy/source/i/acorn__7.4.1__3f870b81/",
  {
    name: "acorn",
    reference: "7.4.1"}],
  ["../../../../../../.esy/source/i/acorn_globals__4.3.4__1fa6ef33/",
  {
    name: "acorn-globals",
    reference: "4.3.4"}],
  ["../../../../../../.esy/source/i/acorn_walk__6.2.0__ccf054da/",
  {
    name: "acorn-walk",
    reference: "6.2.0"}],
  ["../../../../../../.esy/source/i/ajv__6.12.6__c3a69fc4/",
  {
    name: "ajv",
    reference: "6.12.6"}],
  ["../../../../../../.esy/source/i/ampproject__s__remapping__2.2.0__f81d8b75/",
  {
    name: "@ampproject/remapping",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/ansi_escapes__4.3.2__4cee8c98/",
  {
    name: "ansi-escapes",
    reference: "4.3.2"}],
  ["../../../../../../.esy/source/i/ansi_regex__4.1.1__69701333/",
  {
    name: "ansi-regex",
    reference: "4.1.1"}],
  ["../../../../../../.esy/source/i/ansi_regex__5.0.1__dfdb7bfb/",
  {
    name: "ansi-regex",
    reference: "5.0.1"}],
  ["../../../../../../.esy/source/i/ansi_styles__3.2.1__3e3790a5/",
  {
    name: "ansi-styles",
    reference: "3.2.1"}],
  ["../../../../../../.esy/source/i/ansi_styles__4.3.0__ee058a1d/",
  {
    name: "ansi-styles",
    reference: "4.3.0"}],
  ["../../../../../../.esy/source/i/anymatch__2.0.0__53ff378a/",
  {
    name: "anymatch",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/anymatch__3.1.2__e27270e2/",
  {
    name: "anymatch",
    reference: "3.1.2"}],
  ["../../../../../../.esy/source/i/argparse__1.0.10__726c0611/",
  {
    name: "argparse",
    reference: "1.0.10"}],
  ["../../../../../../.esy/source/i/arr_diff__4.0.0__5a7bbcc5/",
  {
    name: "arr-diff",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/arr_flatten__1.1.0__15a968d1/",
  {
    name: "arr-flatten",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/arr_union__3.1.0__58f07489/",
  {
    name: "arr-union",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/array_equal__1.0.0__aced000d/",
  {
    name: "array-equal",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/array_unique__0.3.2__ace7cbf4/",
  {
    name: "array-unique",
    reference: "0.3.2"}],
  ["../../../../../../.esy/source/i/asn1__0.2.6__5989908f/",
  {
    name: "asn1",
    reference: "0.2.6"}],
  ["../../../../../../.esy/source/i/assert_plus__1.0.0__4ffc3b81/",
  {
    name: "assert-plus",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/assign_symbols__1.0.0__60f3deb0/",
  {
    name: "assign-symbols",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/astral_regex__1.0.0__412e4694/",
  {
    name: "astral-regex",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/asynckit__0.4.0__3d17443a/",
  {
    name: "asynckit",
    reference: "0.4.0"}],
  ["../../../../../../.esy/source/i/atob__2.1.2__5aa0dbd4/",
  {
    name: "atob",
    reference: "2.1.2"}],
  ["../../../../../../.esy/source/i/aws4__1.11.0__d73d2209/",
  {
    name: "aws4",
    reference: "1.11.0"}],
  ["../../../../../../.esy/source/i/aws_sign2__0.7.0__91c5ef1e/",
  {
    name: "aws-sign2",
    reference: "0.7.0"}],
  ["../../../../../../.esy/source/i/babel__s__code_frame__7.18.6__15c24586/",
  {
    name: "@babel/code-frame",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__compat_data__7.18.8__7b58b877/",
  {
    name: "@babel/compat-data",
    reference: "7.18.8"}],
  ["../../../../../../.esy/source/i/babel__s__core__7.18.9__0c8a6787/",
  {
    name: "@babel/core",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__generator__7.18.9__fb432c17/",
  {
    name: "@babel/generator",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_compilation_targets__7.18.9__814722fb/",
  {
    name: "@babel/helper-compilation-targets",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_environment_visitor__7.18.9__9e5b7c18/",
  {
    name: "@babel/helper-environment-visitor",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_function_name__7.18.9__4550610a/",
  {
    name: "@babel/helper-function-name",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_hoist_variables__7.18.6__e4954502/",
  {
    name: "@babel/helper-hoist-variables",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helper_module_imports__7.18.6__9ba15c30/",
  {
    name: "@babel/helper-module-imports",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helper_module_transforms__7.18.9__0411f3bf/",
  {
    name: "@babel/helper-module-transforms",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_plugin_utils__7.18.9__c84cb08d/",
  {
    name: "@babel/helper-plugin-utils",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__helper_simple_access__7.18.6__e95f8d00/",
  {
    name: "@babel/helper-simple-access",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helper_split_export_declaration__7.18.6__419b17ea/",
  {
    name: "@babel/helper-split-export-declaration",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helper_validator_identifier__7.18.6__f5b0b43e/",
  {
    name: "@babel/helper-validator-identifier",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helper_validator_option__7.18.6__a2479f6c/",
  {
    name: "@babel/helper-validator-option",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__helpers__7.18.9__c461fc4f/",
  {
    name: "@babel/helpers",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__highlight__7.18.6__22428d3f/",
  {
    name: "@babel/highlight",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__parser__7.18.9__b95de411/",
  {
    name: "@babel/parser",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_async_generators__7.8.4__e8a36b86/",
  {
    name: "@babel/plugin-syntax-async-generators",
    reference: "7.8.4"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_bigint__7.8.3__2b73dbf5/",
  {
    name: "@babel/plugin-syntax-bigint",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_class_properties__7.12.13__aced802e/",
  {
    name: "@babel/plugin-syntax-class-properties",
    reference: "7.12.13"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_import_meta__7.10.4__659b066d/",
  {
    name: "@babel/plugin-syntax-import-meta",
    reference: "7.10.4"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_json_strings__7.8.3__caabb7e8/",
  {
    name: "@babel/plugin-syntax-json-strings",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_logical_assignment_operators__7.10.4__8cdb093f/",
  {
    name: "@babel/plugin-syntax-logical-assignment-operators",
    reference: "7.10.4"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_nullish_coalescing_operator__7.8.3__e55fc3df/",
  {
    name: "@babel/plugin-syntax-nullish-coalescing-operator",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_numeric_separator__7.10.4__b2d0bb12/",
  {
    name: "@babel/plugin-syntax-numeric-separator",
    reference: "7.10.4"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_object_rest_spread__7.8.3__2693ed1f/",
  {
    name: "@babel/plugin-syntax-object-rest-spread",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_optional_catch_binding__7.8.3__9c1a5a0e/",
  {
    name: "@babel/plugin-syntax-optional-catch-binding",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__plugin_syntax_optional_chaining__7.8.3__9e671e05/",
  {
    name: "@babel/plugin-syntax-optional-chaining",
    reference: "7.8.3"}],
  ["../../../../../../.esy/source/i/babel__s__template__7.18.6__72cd41cb/",
  {
    name: "@babel/template",
    reference: "7.18.6"}],
  ["../../../../../../.esy/source/i/babel__s__traverse__7.18.9__9b9cacd7/",
  {
    name: "@babel/traverse",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel__s__types__7.18.9__7427cd40/",
  {
    name: "@babel/types",
    reference: "7.18.9"}],
  ["../../../../../../.esy/source/i/babel_jest__25.5.1__2e7f18df/",
  {
    name: "babel-jest",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/babel_plugin_istanbul__6.1.1__433dbfdd/",
  {
    name: "babel-plugin-istanbul",
    reference: "6.1.1"}],
  ["../../../../../../.esy/source/i/babel_plugin_jest_hoist__25.5.0__645fddfc/",
  {
    name: "babel-plugin-jest-hoist",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/babel_preset_current_node_syntax__0.1.4__4187cb72/",
  {
    name: "babel-preset-current-node-syntax",
    reference: "0.1.4"}],
  ["../../../../../../.esy/source/i/babel_preset_jest__25.5.0__f96365c3/",
  {
    name: "babel-preset-jest",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/balanced_match__1.0.2__42d32da1/",
  {
    name: "balanced-match",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/base__0.11.2__30052a78/",
  {
    name: "base",
    reference: "0.11.2"}],
  ["../../../../../../.esy/source/i/bcoe__s__v8_coverage__0.2.3__09e145cc/",
  {
    name: "@bcoe/v8-coverage",
    reference: "0.2.3"}],
  ["../../../../../../.esy/source/i/bcrypt_pbkdf__1.0.2__7d7ff311/",
  {
    name: "bcrypt-pbkdf",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/brace_expansion__1.1.11__c2e362d2/",
  {
    name: "brace-expansion",
    reference: "1.1.11"}],
  ["../../../../../../.esy/source/i/braces__2.3.2__8146c42d/",
  {
    name: "braces",
    reference: "2.3.2"}],
  ["../../../../../../.esy/source/i/braces__3.0.2__5aa7ab81/",
  {
    name: "braces",
    reference: "3.0.2"}],
  ["../../../../../../.esy/source/i/browser_process_hrtime__1.0.0__df1391ea/",
  {
    name: "browser-process-hrtime",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/browser_resolve__1.11.3__7311d40c/",
  {
    name: "browser-resolve",
    reference: "1.11.3"}],
  ["../../../../../../.esy/source/i/browserslist__4.21.2__5e9896b8/",
  {
    name: "browserslist",
    reference: "4.21.2"}],
  ["../../../../../../.esy/source/i/bs_platform__7.3.2__66711f77/",
  {
    name: "bs-platform",
    reference: "7.3.2"}],
  ["../../../../../../.esy/source/i/bser__2.1.1__deaf634e/",
  {
    name: "bser",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/buffer_from__1.1.2__f23dfc46/",
  {
    name: "buffer-from",
    reference: "1.1.2"}],
  ["../../../../../../.esy/source/i/cache_base__1.0.1__ab79e2ff/",
  {
    name: "cache-base",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/callsites__3.1.0__236409b3/",
  {
    name: "callsites",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/camelcase__5.3.1__f083c5b6/",
  {
    name: "camelcase",
    reference: "5.3.1"}],
  ["../../../../../../.esy/source/i/caniuse_lite__1.0.30001370__8e8e4cf1/",
  {
    name: "caniuse-lite",
    reference: "1.0.30001370"}],
  ["../../../../../../.esy/source/i/capture_exit__2.0.0__5edb51aa/",
  {
    name: "capture-exit",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/caseless__0.12.0__2e70ac76/",
  {
    name: "caseless",
    reference: "0.12.0"}],
  ["../../../../../../.esy/source/i/chalk__2.4.2__cdd4307b/",
  {
    name: "chalk",
    reference: "2.4.2"}],
  ["../../../../../../.esy/source/i/chalk__3.0.0__2f79934a/",
  {
    name: "chalk",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/ci_info__2.0.0__6f1dc8f1/",
  {
    name: "ci-info",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/class_utils__0.3.6__3ab22a3d/",
  {
    name: "class-utils",
    reference: "0.3.6"}],
  ["../../../../../../.esy/source/i/cliui__6.0.0__3f74d7a6/",
  {
    name: "cliui",
    reference: "6.0.0"}],
  ["../../../../../../.esy/source/i/cnakazawa__s__watch__1.0.4__7661a2dc/",
  {
    name: "@cnakazawa/watch",
    reference: "1.0.4"}],
  ["../../../../../../.esy/source/i/co__4.6.0__0a448387/",
  {
    name: "co",
    reference: "4.6.0"}],
  ["../../../../../../.esy/source/i/collect_v8_coverage__1.0.1__5936690b/",
  {
    name: "collect-v8-coverage",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/collection_visit__1.0.0__5ba603a9/",
  {
    name: "collection-visit",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/color_convert__1.9.3__a7e8c654/",
  {
    name: "color-convert",
    reference: "1.9.3"}],
  ["../../../../../../.esy/source/i/color_convert__2.0.1__48e09f09/",
  {
    name: "color-convert",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/color_name__1.1.3__2497ef27/",
  {
    name: "color-name",
    reference: "1.1.3"}],
  ["../../../../../../.esy/source/i/color_name__1.1.4__07bb272f/",
  {
    name: "color-name",
    reference: "1.1.4"}],
  ["../../../../../../.esy/source/i/combined_stream__1.0.8__0f16095c/",
  {
    name: "combined-stream",
    reference: "1.0.8"}],
  ["../../../../../../.esy/source/i/component_emitter__1.3.0__ec2c5ccf/",
  {
    name: "component-emitter",
    reference: "1.3.0"}],
  ["../../../../../../.esy/source/i/concat_map__0.0.1__c7999216/",
  {
    name: "concat-map",
    reference: "0.0.1"}],
  ["../../../../../../.esy/source/i/convert_source_map__1.8.0__dd4e5f3c/",
  {
    name: "convert-source-map",
    reference: "1.8.0"}],
  ["../../../../../../.esy/source/i/copy_descriptor__0.1.1__b4878afe/",
  {
    name: "copy-descriptor",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/core_util_is__1.0.2__d0677167/",
  {
    name: "core-util-is",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/cross_spawn__6.0.5__396ecb10/",
  {
    name: "cross-spawn",
    reference: "6.0.5"}],
  ["../../../../../../.esy/source/i/cross_spawn__7.0.3__7ae9e5df/",
  {
    name: "cross-spawn",
    reference: "7.0.3"}],
  ["../../../../../../.esy/source/i/cssom__0.3.8__83849e6e/",
  {
    name: "cssom",
    reference: "0.3.8"}],
  ["../../../../../../.esy/source/i/cssom__0.4.4__11b8fbb5/",
  {
    name: "cssom",
    reference: "0.4.4"}],
  ["../../../../../../.esy/source/i/cssstyle__2.3.0__49fa5986/",
  {
    name: "cssstyle",
    reference: "2.3.0"}],
  ["../../../../../../.esy/source/i/dashdash__1.14.1__08096b75/",
  {
    name: "dashdash",
    reference: "1.14.1"}],
  ["../../../../../../.esy/source/i/data_urls__1.1.0__7c86765b/",
  {
    name: "data-urls",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/debug__2.6.9__8eaf8f1e/",
  {
    name: "debug",
    reference: "2.6.9"}],
  ["../../../../../../.esy/source/i/debug__4.3.4__84af5971/",
  {
    name: "debug",
    reference: "4.3.4"}],
  ["../../../../../../.esy/source/i/decamelize__1.2.0__8db54854/",
  {
    name: "decamelize",
    reference: "1.2.0"}],
  ["../../../../../../.esy/source/i/decode_uri_component__0.2.0__85d618dc/",
  {
    name: "decode-uri-component",
    reference: "0.2.0"}],
  ["../../../../../../.esy/source/i/deep_is__0.1.4__23719354/",
  {
    name: "deep-is",
    reference: "0.1.4"}],
  ["../../../../../../.esy/source/i/deepmerge__4.2.2__0795879d/",
  {
    name: "deepmerge",
    reference: "4.2.2"}],
  ["../../../../../../.esy/source/i/define_property__0.2.5__35bf1352/",
  {
    name: "define-property",
    reference: "0.2.5"}],
  ["../../../../../../.esy/source/i/define_property__1.0.0__f7276e5e/",
  {
    name: "define-property",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/define_property__2.0.2__aa71f45e/",
  {
    name: "define-property",
    reference: "2.0.2"}],
  ["../../../../../../.esy/source/i/delayed_stream__1.0.0__47205835/",
  {
    name: "delayed-stream",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/detect_newline__3.1.0__9fad862f/",
  {
    name: "detect-newline",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/diff_sequences__25.2.6__80c163bc/",
  {
    name: "diff-sequences",
    reference: "25.2.6"}],
  ["../../../../../../.esy/source/i/domexception__1.0.1__a389fce3/",
  {
    name: "domexception",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/ecc_jsbn__0.1.2__84f8de3f/",
  {
    name: "ecc-jsbn",
    reference: "0.1.2"}],
  ["../../../../../../.esy/source/i/electron_to_chromium__1.4.199__33b3de30/",
  {
    name: "electron-to-chromium",
    reference: "1.4.199"}],
  ["../../../../../../.esy/source/i/emoji_regex__8.0.0__8e099b89/",
  {
    name: "emoji-regex",
    reference: "8.0.0"}],
  ["../../../../../../.esy/source/i/end_of_stream__1.4.4__29536c64/",
  {
    name: "end-of-stream",
    reference: "1.4.4"}],
  ["../../../../../../.esy/source/i/error_ex__1.3.2__851c0bc5/",
  {
    name: "error-ex",
    reference: "1.3.2"}],
  ["../../../../../../.esy/source/i/escalade__3.1.1__be4c030d/",
  {
    name: "escalade",
    reference: "3.1.1"}],
  ["../../../../../../.esy/source/i/escape_string_regexp__1.0.5__08b8b625/",
  {
    name: "escape-string-regexp",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/escape_string_regexp__2.0.0__19dcf210/",
  {
    name: "escape-string-regexp",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/escodegen__1.14.3__a618f361/",
  {
    name: "escodegen",
    reference: "1.14.3"}],
  ["../../../../../../.esy/source/i/esprima__4.0.1__8917feca/",
  {
    name: "esprima",
    reference: "4.0.1"}],
  ["../../../../../../.esy/source/i/estraverse__4.3.0__539360ea/",
  {
    name: "estraverse",
    reference: "4.3.0"}],
  ["../../../../../../.esy/source/i/esutils__2.0.3__c72e14fe/",
  {
    name: "esutils",
    reference: "2.0.3"}],
  ["../../../../../../.esy/source/i/esy_ocaml__s__substs__0.0.1__19de1ee1/",
  {
    name: "@esy-ocaml/substs",
    reference: "0.0.1"}],
  ["../../../../../../.esy/source/i/exec_sh__0.3.6__e8c7ca4f/",
  {
    name: "exec-sh",
    reference: "0.3.6"}],
  ["../../../../../../.esy/source/i/execa__1.0.0__7c978f7c/",
  {
    name: "execa",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/execa__3.4.0__21cd4f89/",
  {
    name: "execa",
    reference: "3.4.0"}],
  ["../../../../../../.esy/source/i/exit__0.1.2__010369c1/",
  {
    name: "exit",
    reference: "0.1.2"}],
  ["../../../../../../.esy/source/i/expand_brackets__2.1.4__15f41e0c/",
  {
    name: "expand-brackets",
    reference: "2.1.4"}],
  ["../../../../../../.esy/source/i/expect__25.5.0__50eb01f1/",
  {
    name: "expect",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/extend__3.0.2__a5974d80/",
  {
    name: "extend",
    reference: "3.0.2"}],
  ["../../../../../../.esy/source/i/extend_shallow__2.0.1__65c3deaf/",
  {
    name: "extend-shallow",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/extend_shallow__3.0.2__8e38f124/",
  {
    name: "extend-shallow",
    reference: "3.0.2"}],
  ["../../../../../../.esy/source/i/extglob__2.0.4__ff5831fb/",
  {
    name: "extglob",
    reference: "2.0.4"}],
  ["../../../../../../.esy/source/i/extsprintf__1.3.0__8f6b6b90/",
  {
    name: "extsprintf",
    reference: "1.3.0"}],
  ["../../../../../../.esy/source/i/fast_deep_equal__3.1.3__973bc016/",
  {
    name: "fast-deep-equal",
    reference: "3.1.3"}],
  ["../../../../../../.esy/source/i/fast_json_stable_stringify__2.1.0__e7b65021/",
  {
    name: "fast-json-stable-stringify",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/fast_levenshtein__2.0.6__cb61e03a/",
  {
    name: "fast-levenshtein",
    reference: "2.0.6"}],
  ["../../../../../../.esy/source/i/fb_watchman__2.0.1__19f3df50/",
  {
    name: "fb-watchman",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/fill_range__4.0.0__d5dfefd7/",
  {
    name: "fill-range",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/fill_range__7.0.1__2354263a/",
  {
    name: "fill-range",
    reference: "7.0.1"}],
  ["../../../../../../.esy/source/i/find_up__4.1.0__55a9970e/",
  {
    name: "find-up",
    reference: "4.1.0"}],
  ["../../../../../../.esy/source/i/for_in__1.0.2__8016c44d/",
  {
    name: "for-in",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/forever_agent__0.6.1__7c765f4a/",
  {
    name: "forever-agent",
    reference: "0.6.1"}],
  ["../../../../../../.esy/source/i/form_data__2.3.3__2dba9575/",
  {
    name: "form-data",
    reference: "2.3.3"}],
  ["../../../../../../.esy/source/i/fragment_cache__0.2.1__6a18be86/",
  {
    name: "fragment-cache",
    reference: "0.2.1"}],
  ["../../../../../../.esy/source/i/fs.realpath__1.0.0__094c11ca/",
  {
    name: "fs.realpath",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/fsevents__2.3.2__d3d926a0/",
  {
    name: "fsevents",
    reference: "2.3.2"}],
  ["../../../../../../.esy/source/i/function_bind__1.1.1__98f8a427/",
  {
    name: "function-bind",
    reference: "1.1.1"}],
  ["../../../../../../.esy/source/i/gensync__1.0.0_beta.2__a958cc59/",
  {
    name: "gensync",
    reference: "1.0.0-beta.2"}],
  ["../../../../../../.esy/source/i/get_caller_file__2.0.5__ef007ca2/",
  {
    name: "get-caller-file",
    reference: "2.0.5"}],
  ["../../../../../../.esy/source/i/get_package_type__0.1.0__14fcea3f/",
  {
    name: "get-package-type",
    reference: "0.1.0"}],
  ["../../../../../../.esy/source/i/get_stream__4.1.0__c6459916/",
  {
    name: "get-stream",
    reference: "4.1.0"}],
  ["../../../../../../.esy/source/i/get_stream__5.2.0__f4f8c920/",
  {
    name: "get-stream",
    reference: "5.2.0"}],
  ["../../../../../../.esy/source/i/get_value__2.0.6__147b5c9f/",
  {
    name: "get-value",
    reference: "2.0.6"}],
  ["../../../../../../.esy/source/i/getpass__0.1.7__8500eb7d/",
  {
    name: "getpass",
    reference: "0.1.7"}],
  ["../../../../../../.esy/source/i/glennsl__s__bs_jest__0.5.1__2046b7a1/",
  {
    name: "@glennsl/bs-jest",
    reference: "0.5.1"}],
  ["../../../../../../.esy/source/i/glob__7.2.3__264cf811/",
  {
    name: "glob",
    reference: "7.2.3"}],
  ["../../../../../../.esy/source/i/globals__11.12.0__75db2ee0/",
  {
    name: "globals",
    reference: "11.12.0"}],
  ["../../../../../../.esy/source/i/graceful_fs__4.2.10__ecba3630/",
  {
    name: "graceful-fs",
    reference: "4.2.10"}],
  ["../../../../../../.esy/source/i/growly__1.3.0__ed748794/",
  {
    name: "growly",
    reference: "1.3.0"}],
  ["../../../../../../.esy/source/i/har_schema__2.0.0__c54b2db6/",
  {
    name: "har-schema",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/har_validator__5.1.5__238d9a3e/",
  {
    name: "har-validator",
    reference: "5.1.5"}],
  ["../../../../../../.esy/source/i/has__1.0.3__79b9f05d/",
  {
    name: "has",
    reference: "1.0.3"}],
  ["../../../../../../.esy/source/i/has_flag__3.0.0__058d2bde/",
  {
    name: "has-flag",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/has_flag__4.0.0__2b4e2759/",
  {
    name: "has-flag",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/has_value__0.3.1__802ffa1f/",
  {
    name: "has-value",
    reference: "0.3.1"}],
  ["../../../../../../.esy/source/i/has_value__1.0.0__6bf1e647/",
  {
    name: "has-value",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/has_values__0.1.4__95f0f007/",
  {
    name: "has-values",
    reference: "0.1.4"}],
  ["../../../../../../.esy/source/i/has_values__1.0.0__f4b60ee2/",
  {
    name: "has-values",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/hosted_git_info__2.8.9__e2574dbd/",
  {
    name: "hosted-git-info",
    reference: "2.8.9"}],
  ["../../../../../../.esy/source/i/html_encoding_sniffer__1.0.2__ebb857a9/",
  {
    name: "html-encoding-sniffer",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/html_escaper__2.0.2__d913b1da/",
  {
    name: "html-escaper",
    reference: "2.0.2"}],
  ["../../../../../../.esy/source/i/http_signature__1.2.0__0bbb41dd/",
  {
    name: "http-signature",
    reference: "1.2.0"}],
  ["../../../../../../.esy/source/i/human_signals__1.1.1__93038e72/",
  {
    name: "human-signals",
    reference: "1.1.1"}],
  ["../../../../../../.esy/source/i/iconv_lite__0.4.24__0f6d0a3e/",
  {
    name: "iconv-lite",
    reference: "0.4.24"}],
  ["../../../../../../.esy/source/i/import_local__3.1.0__0ddbb8c4/",
  {
    name: "import-local",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/imurmurhash__0.1.4__1fc42006/",
  {
    name: "imurmurhash",
    reference: "0.1.4"}],
  ["../../../../../../.esy/source/i/inflight__1.0.6__5ef09bf2/",
  {
    name: "inflight",
    reference: "1.0.6"}],
  ["../../../../../../.esy/source/i/inherits__2.0.4__5ce658b5/",
  {
    name: "inherits",
    reference: "2.0.4"}],
  ["../../../../../../.esy/source/i/ip_regex__2.1.0__5e630305/",
  {
    name: "ip-regex",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/is_accessor_descriptor__0.1.6__892d8573/",
  {
    name: "is-accessor-descriptor",
    reference: "0.1.6"}],
  ["../../../../../../.esy/source/i/is_accessor_descriptor__1.0.0__108888c1/",
  {
    name: "is-accessor-descriptor",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/is_arrayish__0.2.1__3d2a59cd/",
  {
    name: "is-arrayish",
    reference: "0.2.1"}],
  ["../../../../../../.esy/source/i/is_buffer__1.1.6__f9508fd1/",
  {
    name: "is-buffer",
    reference: "1.1.6"}],
  ["../../../../../../.esy/source/i/is_ci__2.0.0__43195c84/",
  {
    name: "is-ci",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/is_core_module__2.9.0__40a77dac/",
  {
    name: "is-core-module",
    reference: "2.9.0"}],
  ["../../../../../../.esy/source/i/is_data_descriptor__0.1.4__79d141c0/",
  {
    name: "is-data-descriptor",
    reference: "0.1.4"}],
  ["../../../../../../.esy/source/i/is_data_descriptor__1.0.0__45e804c7/",
  {
    name: "is-data-descriptor",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/is_descriptor__0.1.6__e33f1b8b/",
  {
    name: "is-descriptor",
    reference: "0.1.6"}],
  ["../../../../../../.esy/source/i/is_descriptor__1.0.2__9886fab7/",
  {
    name: "is-descriptor",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/is_docker__2.2.1__40fcf4f6/",
  {
    name: "is-docker",
    reference: "2.2.1"}],
  ["../../../../../../.esy/source/i/is_extendable__0.1.1__660e53d4/",
  {
    name: "is-extendable",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/is_extendable__1.0.1__42926f00/",
  {
    name: "is-extendable",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/is_fullwidth_code_point__3.0.0__27c011ce/",
  {
    name: "is-fullwidth-code-point",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/is_generator_fn__2.1.0__4a4bcda8/",
  {
    name: "is-generator-fn",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/is_number__3.0.0__46772964/",
  {
    name: "is-number",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/is_number__7.0.0__e3bfa7e2/",
  {
    name: "is-number",
    reference: "7.0.0"}],
  ["../../../../../../.esy/source/i/is_plain_object__2.0.4__50413263/",
  {
    name: "is-plain-object",
    reference: "2.0.4"}],
  ["../../../../../../.esy/source/i/is_stream__1.1.0__808b4cab/",
  {
    name: "is-stream",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/is_stream__2.0.1__43cbc376/",
  {
    name: "is-stream",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/is_typedarray__1.0.0__d13c5d5e/",
  {
    name: "is-typedarray",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/is_windows__1.0.2__e09f5a28/",
  {
    name: "is-windows",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/is_wsl__2.2.0__830151f6/",
  {
    name: "is-wsl",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/isarray__1.0.0__6cecb641/",
  {
    name: "isarray",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/isexe__2.0.0__01c1de49/",
  {
    name: "isexe",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/isobject__2.1.0__b1b028ee/",
  {
    name: "isobject",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/isobject__3.0.1__892637c7/",
  {
    name: "isobject",
    reference: "3.0.1"}],
  ["../../../../../../.esy/source/i/isstream__0.1.2__02284f89/",
  {
    name: "isstream",
    reference: "0.1.2"}],
  ["../../../../../../.esy/source/i/istanbul_lib_coverage__3.2.0__730722e1/",
  {
    name: "istanbul-lib-coverage",
    reference: "3.2.0"}],
  ["../../../../../../.esy/source/i/istanbul_lib_instrument__4.0.3__5f3f39dc/",
  {
    name: "istanbul-lib-instrument",
    reference: "4.0.3"}],
  ["../../../../../../.esy/source/i/istanbul_lib_instrument__5.2.0__ef82bf13/",
  {
    name: "istanbul-lib-instrument",
    reference: "5.2.0"}],
  ["../../../../../../.esy/source/i/istanbul_lib_report__3.0.0__c279c2b4/",
  {
    name: "istanbul-lib-report",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/istanbul_lib_source_maps__4.0.1__b3870472/",
  {
    name: "istanbul-lib-source-maps",
    reference: "4.0.1"}],
  ["../../../../../../.esy/source/i/istanbul_reports__3.1.5__996a9b9f/",
  {
    name: "istanbul-reports",
    reference: "3.1.5"}],
  ["../../../../../../.esy/source/i/istanbuljs__s__load_nyc_config__1.1.0__d99934e0/",
  {
    name: "@istanbuljs/load-nyc-config",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/istanbuljs__s__schema__0.1.3__c54ca3b9/",
  {
    name: "@istanbuljs/schema",
    reference: "0.1.3"}],
  ["../../../../../../.esy/source/i/jest__25.5.4__f88a4673/",
  {
    name: "jest",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest__s__console__25.5.0__211aedcf/",
  {
    name: "@jest/console",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest__s__core__25.5.4__6b36bff5/",
  {
    name: "@jest/core",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest__s__environment__25.5.0__bf8c0583/",
  {
    name: "@jest/environment",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest__s__fake_timers__25.5.0__47ab4b84/",
  {
    name: "@jest/fake-timers",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest__s__globals__25.5.2__37315980/",
  {
    name: "@jest/globals",
    reference: "25.5.2"}],
  ["../../../../../../.esy/source/i/jest__s__reporters__25.5.1__0955b45c/",
  {
    name: "@jest/reporters",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/jest__s__source_map__25.5.0__7672fae3/",
  {
    name: "@jest/source-map",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest__s__test_result__25.5.0__6364246c/",
  {
    name: "@jest/test-result",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest__s__test_sequencer__25.5.4__5e6ef657/",
  {
    name: "@jest/test-sequencer",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest__s__transform__25.5.1__9b38e941/",
  {
    name: "@jest/transform",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/jest__s__types__25.5.0__80b50804/",
  {
    name: "@jest/types",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_changed_files__25.5.0__8f3cdcb3/",
  {
    name: "jest-changed-files",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_cli__25.5.4__4c6d5f73/",
  {
    name: "jest-cli",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_config__25.5.4__23f76f29/",
  {
    name: "jest-config",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_diff__25.5.0__a23fc449/",
  {
    name: "jest-diff",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_docblock__25.3.0__1032b60e/",
  {
    name: "jest-docblock",
    reference: "25.3.0"}],
  ["../../../../../../.esy/source/i/jest_each__25.5.0__710835ef/",
  {
    name: "jest-each",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_environment_jsdom__25.5.0__da6dcf33/",
  {
    name: "jest-environment-jsdom",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_environment_node__25.5.0__4d532134/",
  {
    name: "jest-environment-node",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_get_type__25.2.6__7309a8df/",
  {
    name: "jest-get-type",
    reference: "25.2.6"}],
  ["../../../../../../.esy/source/i/jest_haste_map__25.5.1__9e459bc0/",
  {
    name: "jest-haste-map",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/jest_jasmine2__25.5.4__0ecb33f6/",
  {
    name: "jest-jasmine2",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_leak_detector__25.5.0__c498905b/",
  {
    name: "jest-leak-detector",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_matcher_utils__25.5.0__dfa7a5f1/",
  {
    name: "jest-matcher-utils",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_message_util__25.5.0__3ace6e50/",
  {
    name: "jest-message-util",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_mock__25.5.0__fc088aa8/",
  {
    name: "jest-mock",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_pnp_resolver__1.2.2__9da0c952/",
  {
    name: "jest-pnp-resolver",
    reference: "1.2.2"}],
  ["../../../../../../.esy/source/i/jest_regex_util__25.2.6__e1432830/",
  {
    name: "jest-regex-util",
    reference: "25.2.6"}],
  ["../../../../../../.esy/source/i/jest_resolve__25.5.1__b1f1ee16/",
  {
    name: "jest-resolve",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/jest_resolve_dependencies__25.5.4__8a179ff1/",
  {
    name: "jest-resolve-dependencies",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_runner__25.5.4__9d256378/",
  {
    name: "jest-runner",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_runtime__25.5.4__7f5c1bbc/",
  {
    name: "jest-runtime",
    reference: "25.5.4"}],
  ["../../../../../../.esy/source/i/jest_serializer__25.5.0__b4268109/",
  {
    name: "jest-serializer",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_snapshot__25.5.1__164b30a4/",
  {
    name: "jest-snapshot",
    reference: "25.5.1"}],
  ["../../../../../../.esy/source/i/jest_util__25.5.0__237a9ff2/",
  {
    name: "jest-util",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_validate__25.5.0__a68d7d80/",
  {
    name: "jest-validate",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_watcher__25.5.0__b24debae/",
  {
    name: "jest-watcher",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jest_worker__25.5.0__b797d053/",
  {
    name: "jest-worker",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/jridgewell__s__gen_mapping__0.1.1__052bb8b6/",
  {
    name: "@jridgewell/gen-mapping",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/jridgewell__s__gen_mapping__0.3.2__b06bbaa2/",
  {
    name: "@jridgewell/gen-mapping",
    reference: "0.3.2"}],
  ["../../../../../../.esy/source/i/jridgewell__s__resolve_uri__3.1.0__4aee1788/",
  {
    name: "@jridgewell/resolve-uri",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/jridgewell__s__set_array__1.1.2__b04e8e3c/",
  {
    name: "@jridgewell/set-array",
    reference: "1.1.2"}],
  ["../../../../../../.esy/source/i/jridgewell__s__sourcemap_codec__1.4.14__762eae32/",
  {
    name: "@jridgewell/sourcemap-codec",
    reference: "1.4.14"}],
  ["../../../../../../.esy/source/i/jridgewell__s__trace_mapping__0.3.14__604e3439/",
  {
    name: "@jridgewell/trace-mapping",
    reference: "0.3.14"}],
  ["../../../../../../.esy/source/i/js_tokens__4.0.0__13c348c2/",
  {
    name: "js-tokens",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/js_yaml__3.14.1__f8f82111/",
  {
    name: "js-yaml",
    reference: "3.14.1"}],
  ["../../../../../../.esy/source/i/jsbn__0.1.1__75bf0e62/",
  {
    name: "jsbn",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/jsdom__15.2.1__015ddda7/",
  {
    name: "jsdom",
    reference: "15.2.1"}],
  ["../../../../../../.esy/source/i/jsesc__2.5.2__9fa3d6ed/",
  {
    name: "jsesc",
    reference: "2.5.2"}],
  ["../../../../../../.esy/source/i/json5__2.2.1__0ceb051f/",
  {
    name: "json5",
    reference: "2.2.1"}],
  ["../../../../../../.esy/source/i/json_parse_even_better_errors__2.3.1__d4098c05/",
  {
    name: "json-parse-even-better-errors",
    reference: "2.3.1"}],
  ["../../../../../../.esy/source/i/json_schema__0.4.0__4ddec21c/",
  {
    name: "json-schema",
    reference: "0.4.0"}],
  ["../../../../../../.esy/source/i/json_schema_traverse__0.4.1__43d23351/",
  {
    name: "json-schema-traverse",
    reference: "0.4.1"}],
  ["../../../../../../.esy/source/i/json_stringify_safe__5.0.1__819e720d/",
  {
    name: "json-stringify-safe",
    reference: "5.0.1"}],
  ["../../../../../../.esy/source/i/jsprim__1.4.2__1824d879/",
  {
    name: "jsprim",
    reference: "1.4.2"}],
  ["../../../../../../.esy/source/i/kind_of__3.2.2__d01f6796/",
  {
    name: "kind-of",
    reference: "3.2.2"}],
  ["../../../../../../.esy/source/i/kind_of__4.0.0__db2bf5e3/",
  {
    name: "kind-of",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/kind_of__5.1.0__d39d9bfc/",
  {
    name: "kind-of",
    reference: "5.1.0"}],
  ["../../../../../../.esy/source/i/kind_of__6.0.3__5e3ab80e/",
  {
    name: "kind-of",
    reference: "6.0.3"}],
  ["../../../../../../.esy/source/i/kleur__3.0.3__890177c4/",
  {
    name: "kleur",
    reference: "3.0.3"}],
  ["../../../../../../.esy/source/i/leven__3.1.0__5c43f7fb/",
  {
    name: "leven",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/levn__0.3.0__3090a2e9/",
  {
    name: "levn",
    reference: "0.3.0"}],
  ["../../../../../../.esy/source/i/lines_and_columns__1.2.4__998b7164/",
  {
    name: "lines-and-columns",
    reference: "1.2.4"}],
  ["../../../../../../.esy/source/i/locate_path__5.0.0__d946b836/",
  {
    name: "locate-path",
    reference: "5.0.0"}],
  ["../../../../../../.esy/source/i/lodash.sortby__4.7.0__d90c4b3f/",
  {
    name: "lodash.sortby",
    reference: "4.7.0"}],
  ["../../../../../../.esy/source/i/lodash__4.17.21__82c45c9d/",
  {
    name: "lodash",
    reference: "4.17.21"}],
  ["../../../../../../.esy/source/i/lolex__5.1.2__bf2e555c/",
  {
    name: "lolex",
    reference: "5.1.2"}],
  ["../../../../../../.esy/source/i/make_dir__3.1.0__5a7cab19/",
  {
    name: "make-dir",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/makeerror__1.0.12__7c491618/",
  {
    name: "makeerror",
    reference: "1.0.12"}],
  ["../../../../../../.esy/source/i/map_cache__0.2.2__ae144545/",
  {
    name: "map-cache",
    reference: "0.2.2"}],
  ["../../../../../../.esy/source/i/map_visit__1.0.0__b55d6613/",
  {
    name: "map-visit",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/merge_stream__2.0.0__c7946737/",
  {
    name: "merge-stream",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/micromatch__3.1.10__4fdec659/",
  {
    name: "micromatch",
    reference: "3.1.10"}],
  ["../../../../../../.esy/source/i/micromatch__4.0.5__5683a228/",
  {
    name: "micromatch",
    reference: "4.0.5"}],
  ["../../../../../../.esy/source/i/mime_db__1.52.0__95b55558/",
  {
    name: "mime-db",
    reference: "1.52.0"}],
  ["../../../../../../.esy/source/i/mime_types__2.1.35__ba4679a9/",
  {
    name: "mime-types",
    reference: "2.1.35"}],
  ["../../../../../../.esy/source/i/mimic_fn__2.1.0__f76a6bb1/",
  {
    name: "mimic-fn",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/minimatch__3.1.2__4b853d7d/",
  {
    name: "minimatch",
    reference: "3.1.2"}],
  ["../../../../../../.esy/source/i/minimist__1.2.6__0c34a6c6/",
  {
    name: "minimist",
    reference: "1.2.6"}],
  ["../../../../../../.esy/source/i/mixin_deep__1.3.2__57627b76/",
  {
    name: "mixin-deep",
    reference: "1.3.2"}],
  ["../../../../../../.esy/source/i/ms__2.0.0__d842b4cd/",
  {
    name: "ms",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/ms__2.1.2__44bf868b/",
  {
    name: "ms",
    reference: "2.1.2"}],
  ["../../../../../../.esy/source/i/nanomatch__1.2.13__2a566370/",
  {
    name: "nanomatch",
    reference: "1.2.13"}],
  ["../../../../../../.esy/source/i/natural_compare__1.4.0__03025537/",
  {
    name: "natural-compare",
    reference: "1.4.0"}],
  ["../../../../../../.esy/source/i/nice_try__1.0.5__f4f1d459/",
  {
    name: "nice-try",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/node_int64__0.4.0__c4a509ca/",
  {
    name: "node-int64",
    reference: "0.4.0"}],
  ["../../../../../../.esy/source/i/node_notifier__6.0.0__f3e114d5/",
  {
    name: "node-notifier",
    reference: "6.0.0"}],
  ["../../../../../../.esy/source/i/node_releases__2.0.6__9025acfe/",
  {
    name: "node-releases",
    reference: "2.0.6"}],
  ["../../../../../../.esy/source/i/normalize_package_data__2.5.0__ad8eb7b6/",
  {
    name: "normalize-package-data",
    reference: "2.5.0"}],
  ["../../../../../../.esy/source/i/normalize_path__2.1.1__baf85fb0/",
  {
    name: "normalize-path",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/normalize_path__3.0.0__91fa1ad9/",
  {
    name: "normalize-path",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/npm_run_path__2.0.2__12ea0e5b/",
  {
    name: "npm-run-path",
    reference: "2.0.2"}],
  ["../../../../../../.esy/source/i/npm_run_path__4.0.1__4d614634/",
  {
    name: "npm-run-path",
    reference: "4.0.1"}],
  ["../../../../../../.esy/source/i/nwsapi__2.2.1__56c8fbf9/",
  {
    name: "nwsapi",
    reference: "2.2.1"}],
  ["../../../../../../.esy/source/i/oauth_sign__0.9.0__396e6f49/",
  {
    name: "oauth-sign",
    reference: "0.9.0"}],
  ["../../../../../../.esy/source/i/object.pick__1.3.0__723792f2/",
  {
    name: "object.pick",
    reference: "1.3.0"}],
  ["../../../../../../.esy/source/i/object_copy__0.1.0__b1fa7896/",
  {
    name: "object-copy",
    reference: "0.1.0"}],
  ["../../../../../../.esy/source/i/object_visit__1.0.1__c60c875c/",
  {
    name: "object-visit",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/ocaml__4.14.0__5c587ac3/",
  {
    name: "ocaml",
    reference: "4.14.0"}],
  ["../../../../../../.esy/source/i/once__1.4.0__8285ddde/",
  {
    name: "once",
    reference: "1.4.0"}],
  ["../../../../../../.esy/source/i/onetime__5.1.2__54dbb231/",
  {
    name: "onetime",
    reference: "5.1.2"}],
  ["../../../../../../.esy/source/i/opam__s__base_bigarray__opam__c__base__37a71828/",
  {
    name: "@opam/base-bigarray",
    reference: "opam:base"}],
  ["../../../../../../.esy/source/i/opam__s__base_bytes__opam__c__base__48b6019a/",
  {
    name: "@opam/base-bytes",
    reference: "opam:base"}],
  ["../../../../../../.esy/source/i/opam__s__base_threads__opam__c__base__f282958b/",
  {
    name: "@opam/base-threads",
    reference: "opam:base"}],
  ["../../../../../../.esy/source/i/opam__s__base_unix__opam__c__base__93427a57/",
  {
    name: "@opam/base-unix",
    reference: "opam:base"}],
  ["../../../../../../.esy/source/i/opam__s__chrome_trace__opam__c__3.4.0__5efc5e35/",
  {
    name: "@opam/chrome-trace",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__cppo__opam__c__1.6.9__327e8fcf/",
  {
    name: "@opam/cppo",
    reference: "opam:1.6.9"}],
  ["../../../../../../.esy/source/i/opam__s__csexp__opam__c__1.5.1__a5d42d7e/",
  {
    name: "@opam/csexp",
    reference: "opam:1.5.1"}],
  ["../../../../../../.esy/source/i/opam__s__dune__opam__c__3.4.0__0aebd8ff/",
  {
    name: "@opam/dune",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__dune_build_info__opam__c__3.4.0__2d68ffbc/",
  {
    name: "@opam/dune-build-info",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__dune_rpc__opam__c__3.4.0__9eec4682/",
  {
    name: "@opam/dune-rpc",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__dyn__opam__c__3.4.0__06b6e146/",
  {
    name: "@opam/dyn",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__fiber__opam__c__3.4.0__d855e508/",
  {
    name: "@opam/fiber",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__ocaml_lsp_server__opam__c__1.12.4__00efc625/",
  {
    name: "@opam/ocaml-lsp-server",
    reference: "opam:1.12.4"}],
  ["../../../../../../.esy/source/i/opam__s__ocamlbuild__opam__c__0.14.1__3fd19d31/",
  {
    name: "@opam/ocamlbuild",
    reference: "opam:0.14.1"}],
  ["../../../../../../.esy/source/i/opam__s__ocamlfind__opam__c__1.9.5__da1d264f/",
  {
    name: "@opam/ocamlfind",
    reference: "opam:1.9.5"}],
  ["../../../../../../.esy/source/i/opam__s__ocamlformat_rpc_lib__opam__c__0.24.1__6279b4e1/",
  {
    name: "@opam/ocamlformat-rpc-lib",
    reference: "opam:0.24.1"}],
  ["../../../../../../.esy/source/i/opam__s__octavius__opam__c__1.2.2__96807fc5/",
  {
    name: "@opam/octavius",
    reference: "opam:1.2.2"}],
  ["../../../../../../.esy/source/i/opam__s__omd__opam__c__1.3.2__08ff160d/",
  {
    name: "@opam/omd",
    reference: "opam:1.3.2"}],
  ["../../../../../../.esy/source/i/opam__s__ordering__opam__c__3.4.0__e89b2648/",
  {
    name: "@opam/ordering",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__pp__opam__c__1.1.2__ebad31ff/",
  {
    name: "@opam/pp",
    reference: "opam:1.1.2"}],
  ["../../../../../../.esy/source/i/opam__s__ppx__yojson__conv__lib__opam__c__v0.15.0__fba50f2c/",
  {
    name: "@opam/ppx_yojson_conv_lib",
    reference: "opam:v0.15.0"}],
  ["../../../../../../.esy/source/i/opam__s__re__opam__c__1.10.4__39debd71/",
  {
    name: "@opam/re",
    reference: "opam:1.10.4"}],
  ["../../../../../../.esy/source/i/opam__s__seq__opam__c__base__a0c677b1/",
  {
    name: "@opam/seq",
    reference: "opam:base"}],
  ["../../../../../../.esy/source/i/opam__s__spawn__opam__c__v0.15.1__cdb37477/",
  {
    name: "@opam/spawn",
    reference: "opam:v0.15.1"}],
  ["../../../../../../.esy/source/i/opam__s__stdune__opam__c__3.4.0__30f456ed/",
  {
    name: "@opam/stdune",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__topkg__opam__c__1.0.5__82377b68/",
  {
    name: "@opam/topkg",
    reference: "opam:1.0.5"}],
  ["../../../../../../.esy/source/i/opam__s__uutf__opam__c__1.0.3__8c042452/",
  {
    name: "@opam/uutf",
    reference: "opam:1.0.3"}],
  ["../../../../../../.esy/source/i/opam__s__xdg__opam__c__3.4.0__fd4457bf/",
  {
    name: "@opam/xdg",
    reference: "opam:3.4.0"}],
  ["../../../../../../.esy/source/i/opam__s__yojson__opam__c__2.0.1__bb3d2a50/",
  {
    name: "@opam/yojson",
    reference: "opam:2.0.1"}],
  ["../../../../../../.esy/source/i/optionator__0.8.3__4945d345/",
  {
    name: "optionator",
    reference: "0.8.3"}],
  ["../../../../../../.esy/source/i/p_each_series__2.2.0__77c6f0c7/",
  {
    name: "p-each-series",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/p_finally__1.0.0__90840028/",
  {
    name: "p-finally",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/p_finally__2.0.1__c91fa114/",
  {
    name: "p-finally",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/p_limit__2.3.0__cfa3bb23/",
  {
    name: "p-limit",
    reference: "2.3.0"}],
  ["../../../../../../.esy/source/i/p_locate__4.1.0__359d132a/",
  {
    name: "p-locate",
    reference: "4.1.0"}],
  ["../../../../../../.esy/source/i/p_try__2.2.0__7ec98f05/",
  {
    name: "p-try",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/parse5__5.1.0__c5499f5a/",
  {
    name: "parse5",
    reference: "5.1.0"}],
  ["../../../../../../.esy/source/i/parse_json__5.2.0__cc8a29ed/",
  {
    name: "parse-json",
    reference: "5.2.0"}],
  ["../../../../../../.esy/source/i/pascalcase__0.1.1__dbba0370/",
  {
    name: "pascalcase",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/path_exists__4.0.0__f0834a86/",
  {
    name: "path-exists",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/path_is_absolute__1.0.1__b16551ae/",
  {
    name: "path-is-absolute",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/path_key__2.0.1__b1422758/",
  {
    name: "path-key",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/path_key__3.1.1__af067986/",
  {
    name: "path-key",
    reference: "3.1.1"}],
  ["../../../../../../.esy/source/i/path_parse__1.0.7__7a3b308e/",
  {
    name: "path-parse",
    reference: "1.0.7"}],
  ["../../../../../../.esy/source/i/performance_now__2.1.0__828664f5/",
  {
    name: "performance-now",
    reference: "2.1.0"}],
  ["../../../../../../.esy/source/i/picocolors__1.0.0__e5c56b04/",
  {
    name: "picocolors",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/picomatch__2.3.1__4699f5fc/",
  {
    name: "picomatch",
    reference: "2.3.1"}],
  ["../../../../../../.esy/source/i/pirates__4.0.5__22d4ffe4/",
  {
    name: "pirates",
    reference: "4.0.5"}],
  ["../../../../../../.esy/source/i/pkg_dir__4.2.0__4d291c31/",
  {
    name: "pkg-dir",
    reference: "4.2.0"}],
  ["../../../../../../.esy/source/i/pn__1.1.0__178d1a64/",
  {
    name: "pn",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/posix_character_classes__0.1.1__c9261503/",
  {
    name: "posix-character-classes",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/prelude_ls__1.1.2__179c4c45/",
  {
    name: "prelude-ls",
    reference: "1.1.2"}],
  ["../../../../../../.esy/source/i/pretty_format__25.5.0__91763724/",
  {
    name: "pretty-format",
    reference: "25.5.0"}],
  ["../../../../../../.esy/source/i/prompts__2.4.2__79180228/",
  {
    name: "prompts",
    reference: "2.4.2"}],
  ["../../../../../../.esy/source/i/psl__1.9.0__f289acac/",
  {
    name: "psl",
    reference: "1.9.0"}],
  ["../../../../../../.esy/source/i/pump__3.0.0__650a87ec/",
  {
    name: "pump",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/punycode__2.1.1__9d5f3bb8/",
  {
    name: "punycode",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/qs__6.5.3__3ed598c0/",
  {
    name: "qs",
    reference: "6.5.3"}],
  ["../../../../../../.esy/source/i/react_is__16.13.1__8a41bdd9/",
  {
    name: "react-is",
    reference: "16.13.1"}],
  ["../../../../../../.esy/source/i/read_pkg__5.2.0__f85f0d90/",
  {
    name: "read-pkg",
    reference: "5.2.0"}],
  ["../../../../../../.esy/source/i/read_pkg_up__7.0.1__e36e2610/",
  {
    name: "read-pkg-up",
    reference: "7.0.1"}],
  ["../../../../../../.esy/source/i/realpath_native__2.0.0__b48905d6/",
  {
    name: "realpath-native",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/regex_not__1.0.2__9a76c75b/",
  {
    name: "regex-not",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/remove_trailing_separator__1.1.0__5afd3399/",
  {
    name: "remove-trailing-separator",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/repeat_element__1.1.4__cce94694/",
  {
    name: "repeat-element",
    reference: "1.1.4"}],
  ["../../../../../../.esy/source/i/repeat_string__1.6.1__f30c8ba7/",
  {
    name: "repeat-string",
    reference: "1.6.1"}],
  ["../../../../../../.esy/source/i/request__2.88.2__5c8b4637/",
  {
    name: "request",
    reference: "2.88.2"}],
  ["../../../../../../.esy/source/i/request_promise_core__1.1.4__f9887999/",
  {
    name: "request-promise-core",
    reference: "1.1.4"}],
  ["../../../../../../.esy/source/i/request_promise_native__1.0.9__2907f506/",
  {
    name: "request-promise-native",
    reference: "1.0.9"}],
  ["../../../../../../.esy/source/i/require_directory__2.1.1__263c7201/",
  {
    name: "require-directory",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/require_main_filename__2.0.0__86f489be/",
  {
    name: "require-main-filename",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/resolve__1.1.7__eeb5dfb4/",
  {
    name: "resolve",
    reference: "1.1.7"}],
  ["../../../../../../.esy/source/i/resolve__1.22.1__2c82103e/",
  {
    name: "resolve",
    reference: "1.22.1"}],
  ["../../../../../../.esy/source/i/resolve_cwd__3.0.0__41f3f704/",
  {
    name: "resolve-cwd",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/resolve_from__5.0.0__10bee194/",
  {
    name: "resolve-from",
    reference: "5.0.0"}],
  ["../../../../../../.esy/source/i/resolve_url__0.2.1__a6983901/",
  {
    name: "resolve-url",
    reference: "0.2.1"}],
  ["../../../../../../.esy/source/i/ret__0.1.15__017183c7/",
  {
    name: "ret",
    reference: "0.1.15"}],
  ["../../../../../../.esy/source/i/rimraf__3.0.2__283ad518/",
  {
    name: "rimraf",
    reference: "3.0.2"}],
  ["../../../../../../.esy/source/i/rsvp__4.8.5__08beeafc/",
  {
    name: "rsvp",
    reference: "4.8.5"}],
  ["../../../../../../.esy/source/i/safe_buffer__5.1.2__e975ebd3/",
  {
    name: "safe-buffer",
    reference: "5.1.2"}],
  ["../../../../../../.esy/source/i/safe_regex__1.1.0__ffc1efdf/",
  {
    name: "safe-regex",
    reference: "1.1.0"}],
  ["../../../../../../.esy/source/i/safer_buffer__2.1.2__204e3826/",
  {
    name: "safer-buffer",
    reference: "2.1.2"}],
  ["../../../../../../.esy/source/i/sane__4.1.0__5b5e141d/",
  {
    name: "sane",
    reference: "4.1.0"}],
  ["../../../../../../.esy/source/i/saxes__3.1.11__44bd18c5/",
  {
    name: "saxes",
    reference: "3.1.11"}],
  ["../../../../../../.esy/source/i/semver__5.7.1__e3fff838/",
  {
    name: "semver",
    reference: "5.7.1"}],
  ["../../../../../../.esy/source/i/semver__6.3.0__fb45cafd/",
  {
    name: "semver",
    reference: "6.3.0"}],
  ["../../../../../../.esy/source/i/set_blocking__2.0.0__5d79dd8a/",
  {
    name: "set-blocking",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/set_value__2.0.1__a2adfdf9/",
  {
    name: "set-value",
    reference: "2.0.1"}],
  ["../../../../../../.esy/source/i/shebang_command__1.2.0__d7a62977/",
  {
    name: "shebang-command",
    reference: "1.2.0"}],
  ["../../../../../../.esy/source/i/shebang_command__2.0.0__0462f5ca/",
  {
    name: "shebang-command",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/shebang_regex__1.0.0__61c22a6d/",
  {
    name: "shebang-regex",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/shebang_regex__3.0.0__ce18071a/",
  {
    name: "shebang-regex",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/shellwords__0.1.1__d12c3a69/",
  {
    name: "shellwords",
    reference: "0.1.1"}],
  ["../../../../../../.esy/source/i/signal_exit__3.0.7__2427f0d9/",
  {
    name: "signal-exit",
    reference: "3.0.7"}],
  ["../../../../../../.esy/source/i/sinonjs__s__commons__1.8.3__242fff93/",
  {
    name: "@sinonjs/commons",
    reference: "1.8.3"}],
  ["../../../../../../.esy/source/i/sisteransi__1.0.5__bc6ed82b/",
  {
    name: "sisteransi",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/slash__3.0.0__065936e9/",
  {
    name: "slash",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/snapdragon__0.8.2__3333ae58/",
  {
    name: "snapdragon",
    reference: "0.8.2"}],
  ["../../../../../../.esy/source/i/snapdragon_node__2.1.1__389d2cbf/",
  {
    name: "snapdragon-node",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/snapdragon_util__3.0.1__09e35752/",
  {
    name: "snapdragon-util",
    reference: "3.0.1"}],
  ["../../../../../../.esy/source/i/source_map__0.5.7__f39e7237/",
  {
    name: "source-map",
    reference: "0.5.7"}],
  ["../../../../../../.esy/source/i/source_map__0.6.1__20131c2b/",
  {
    name: "source-map",
    reference: "0.6.1"}],
  ["../../../../../../.esy/source/i/source_map__0.7.4__5e03c8d2/",
  {
    name: "source-map",
    reference: "0.7.4"}],
  ["../../../../../../.esy/source/i/source_map_resolve__0.5.3__8aba3b88/",
  {
    name: "source-map-resolve",
    reference: "0.5.3"}],
  ["../../../../../../.esy/source/i/source_map_support__0.5.21__c4490966/",
  {
    name: "source-map-support",
    reference: "0.5.21"}],
  ["../../../../../../.esy/source/i/source_map_url__0.4.1__b3241d85/",
  {
    name: "source-map-url",
    reference: "0.4.1"}],
  ["../../../../../../.esy/source/i/spdx_correct__3.1.1__3e0d6226/",
  {
    name: "spdx-correct",
    reference: "3.1.1"}],
  ["../../../../../../.esy/source/i/spdx_exceptions__2.3.0__66adeda0/",
  {
    name: "spdx-exceptions",
    reference: "2.3.0"}],
  ["../../../../../../.esy/source/i/spdx_expression_parse__3.0.1__2313802f/",
  {
    name: "spdx-expression-parse",
    reference: "3.0.1"}],
  ["../../../../../../.esy/source/i/spdx_license_ids__3.0.11__31783c01/",
  {
    name: "spdx-license-ids",
    reference: "3.0.11"}],
  ["../../../../../../.esy/source/i/split_string__3.1.0__ba22f226/",
  {
    name: "split-string",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/sprintf_js__1.0.3__d658c825/",
  {
    name: "sprintf-js",
    reference: "1.0.3"}],
  ["../../../../../../.esy/source/i/sshpk__1.17.0__82fea7e5/",
  {
    name: "sshpk",
    reference: "1.17.0"}],
  ["../../../../../../.esy/source/i/stack_utils__1.0.5__bf307028/",
  {
    name: "stack-utils",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/static_extend__0.1.2__eef8a796/",
  {
    name: "static-extend",
    reference: "0.1.2"}],
  ["../../../../../../.esy/source/i/stealthy_require__1.1.1__5f88108a/",
  {
    name: "stealthy-require",
    reference: "1.1.1"}],
  ["../../../../../../.esy/source/i/string_length__3.1.0__d5430449/",
  {
    name: "string-length",
    reference: "3.1.0"}],
  ["../../../../../../.esy/source/i/string_width__4.2.3__6c76da73/",
  {
    name: "string-width",
    reference: "4.2.3"}],
  ["../../../../../../.esy/source/i/strip_ansi__5.2.0__36e628b8/",
  {
    name: "strip-ansi",
    reference: "5.2.0"}],
  ["../../../../../../.esy/source/i/strip_ansi__6.0.1__19d38e39/",
  {
    name: "strip-ansi",
    reference: "6.0.1"}],
  ["../../../../../../.esy/source/i/strip_bom__4.0.0__61067802/",
  {
    name: "strip-bom",
    reference: "4.0.0"}],
  ["../../../../../../.esy/source/i/strip_eof__1.0.0__040453c2/",
  {
    name: "strip-eof",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/strip_final_newline__2.0.0__ee42b96b/",
  {
    name: "strip-final-newline",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/supports_color__5.5.0__0bed0829/",
  {
    name: "supports-color",
    reference: "5.5.0"}],
  ["../../../../../../.esy/source/i/supports_color__7.2.0__314a291a/",
  {
    name: "supports-color",
    reference: "7.2.0"}],
  ["../../../../../../.esy/source/i/supports_hyperlinks__2.2.0__757c6a25/",
  {
    name: "supports-hyperlinks",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/supports_preserve_symlinks_flag__1.0.0__1e117067/",
  {
    name: "supports-preserve-symlinks-flag",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/symbol_tree__3.2.4__9afcccea/",
  {
    name: "symbol-tree",
    reference: "3.2.4"}],
  ["../../../../../../.esy/source/i/terminal_link__2.1.1__21db132b/",
  {
    name: "terminal-link",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/test_exclude__6.0.0__442dffc5/",
  {
    name: "test-exclude",
    reference: "6.0.0"}],
  ["../../../../../../.esy/source/i/throat__5.0.0__58d99cb8/",
  {
    name: "throat",
    reference: "5.0.0"}],
  ["../../../../../../.esy/source/i/tmpl__1.0.5__a076db55/",
  {
    name: "tmpl",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/to_fast_properties__2.0.0__0ba318c5/",
  {
    name: "to-fast-properties",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/to_object_path__0.3.0__4e1644c7/",
  {
    name: "to-object-path",
    reference: "0.3.0"}],
  ["../../../../../../.esy/source/i/to_regex__3.0.2__1682d906/",
  {
    name: "to-regex",
    reference: "3.0.2"}],
  ["../../../../../../.esy/source/i/to_regex_range__2.1.1__ff8c30ef/",
  {
    name: "to-regex-range",
    reference: "2.1.1"}],
  ["../../../../../../.esy/source/i/to_regex_range__5.0.1__ddb0b8b0/",
  {
    name: "to-regex-range",
    reference: "5.0.1"}],
  ["../../../../../../.esy/source/i/tough_cookie__2.5.0__9fe36df0/",
  {
    name: "tough-cookie",
    reference: "2.5.0"}],
  ["../../../../../../.esy/source/i/tough_cookie__3.0.1__7cd5263f/",
  {
    name: "tough-cookie",
    reference: "3.0.1"}],
  ["../../../../../../.esy/source/i/tr46__1.0.1__58ccfe17/",
  {
    name: "tr46",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/tunnel_agent__0.6.0__00a51b75/",
  {
    name: "tunnel-agent",
    reference: "0.6.0"}],
  ["../../../../../../.esy/source/i/tweetnacl__0.14.5__03459ff4/",
  {
    name: "tweetnacl",
    reference: "0.14.5"}],
  ["../../../../../../.esy/source/i/type_check__0.3.2__046c4482/",
  {
    name: "type-check",
    reference: "0.3.2"}],
  ["../../../../../../.esy/source/i/type_detect__4.0.8__2510b9fe/",
  {
    name: "type-detect",
    reference: "4.0.8"}],
  ["../../../../../../.esy/source/i/type_fest__0.21.3__eb21aeec/",
  {
    name: "type-fest",
    reference: "0.21.3"}],
  ["../../../../../../.esy/source/i/type_fest__0.6.0__5e105463/",
  {
    name: "type-fest",
    reference: "0.6.0"}],
  ["../../../../../../.esy/source/i/type_fest__0.8.1__fabbb69d/",
  {
    name: "type-fest",
    reference: "0.8.1"}],
  ["../../../../../../.esy/source/i/typedarray_to_buffer__3.1.5__cc08292c/",
  {
    name: "typedarray-to-buffer",
    reference: "3.1.5"}],
  ["../../../../../../.esy/source/i/types__s__babel__core__7.1.19__64ca2dfa/",
  {
    name: "@types/babel__core",
    reference: "7.1.19"}],
  ["../../../../../../.esy/source/i/types__s__babel__generator__7.6.4__ee169bf1/",
  {
    name: "@types/babel__generator",
    reference: "7.6.4"}],
  ["../../../../../../.esy/source/i/types__s__babel__template__7.4.1__f70ca473/",
  {
    name: "@types/babel__template",
    reference: "7.4.1"}],
  ["../../../../../../.esy/source/i/types__s__babel__traverse__7.17.1__1477451b/",
  {
    name: "@types/babel__traverse",
    reference: "7.17.1"}],
  ["../../../../../../.esy/source/i/types__s__graceful_fs__4.1.5__686e200c/",
  {
    name: "@types/graceful-fs",
    reference: "4.1.5"}],
  ["../../../../../../.esy/source/i/types__s__istanbul_lib_coverage__2.0.4__e440b8f9/",
  {
    name: "@types/istanbul-lib-coverage",
    reference: "2.0.4"}],
  ["../../../../../../.esy/source/i/types__s__istanbul_lib_report__3.0.0__8520c681/",
  {
    name: "@types/istanbul-lib-report",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/types__s__istanbul_reports__1.1.2__d5fe4e5d/",
  {
    name: "@types/istanbul-reports",
    reference: "1.1.2"}],
  ["../../../../../../.esy/source/i/types__s__node__18.6.1__4097dba9/",
  {
    name: "@types/node",
    reference: "18.6.1"}],
  ["../../../../../../.esy/source/i/types__s__normalize_package_data__2.4.1__f7d47d0a/",
  {
    name: "@types/normalize-package-data",
    reference: "2.4.1"}],
  ["../../../../../../.esy/source/i/types__s__prettier__1.19.1__c5161cf8/",
  {
    name: "@types/prettier",
    reference: "1.19.1"}],
  ["../../../../../../.esy/source/i/types__s__stack_utils__1.0.1__d54caf55/",
  {
    name: "@types/stack-utils",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/types__s__yargs__15.0.14__b3c72b18/",
  {
    name: "@types/yargs",
    reference: "15.0.14"}],
  ["../../../../../../.esy/source/i/types__s__yargs_parser__21.0.0__89996650/",
  {
    name: "@types/yargs-parser",
    reference: "21.0.0"}],
  ["../../../../../../.esy/source/i/union_value__1.0.1__b1f6001d/",
  {
    name: "union-value",
    reference: "1.0.1"}],
  ["../../../../../../.esy/source/i/unset_value__1.0.0__54969e15/",
  {
    name: "unset-value",
    reference: "1.0.0"}],
  ["../../../../../../.esy/source/i/update_browserslist_db__1.0.5__7ae71fb4/",
  {
    name: "update-browserslist-db",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/uri_js__4.4.1__7918c241/",
  {
    name: "uri-js",
    reference: "4.4.1"}],
  ["../../../../../../.esy/source/i/urix__0.1.0__578d889a/",
  {
    name: "urix",
    reference: "0.1.0"}],
  ["../../../../../../.esy/source/i/use__3.1.1__6c794d09/",
  {
    name: "use",
    reference: "3.1.1"}],
  ["../../../../../../.esy/source/i/uuid__3.4.0__aded8d7a/",
  {
    name: "uuid",
    reference: "3.4.0"}],
  ["../../../../../../.esy/source/i/v8_to_istanbul__4.1.4__ce221a39/",
  {
    name: "v8-to-istanbul",
    reference: "4.1.4"}],
  ["../../../../../../.esy/source/i/validate_npm_package_license__3.0.4__9b2ae112/",
  {
    name: "validate-npm-package-license",
    reference: "3.0.4"}],
  ["../../../../../../.esy/source/i/verror__1.10.0__a7bd6ab7/",
  {
    name: "verror",
    reference: "1.10.0"}],
  ["../../../../../../.esy/source/i/w3c_hr_time__1.0.2__54e7a2ae/",
  {
    name: "w3c-hr-time",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/w3c_xmlserializer__1.1.2__8775e91e/",
  {
    name: "w3c-xmlserializer",
    reference: "1.1.2"}],
  ["../../../../../../.esy/source/i/walker__1.0.8__74b5814d/",
  {
    name: "walker",
    reference: "1.0.8"}],
  ["../../../../../../.esy/source/i/webidl_conversions__4.0.2__e29d3cf0/",
  {
    name: "webidl-conversions",
    reference: "4.0.2"}],
  ["../../../../../../.esy/source/i/whatwg_encoding__1.0.5__35eb34ef/",
  {
    name: "whatwg-encoding",
    reference: "1.0.5"}],
  ["../../../../../../.esy/source/i/whatwg_mimetype__2.3.0__d8e82697/",
  {
    name: "whatwg-mimetype",
    reference: "2.3.0"}],
  ["../../../../../../.esy/source/i/whatwg_url__7.1.0__8881dc95/",
  {
    name: "whatwg-url",
    reference: "7.1.0"}],
  ["../../../../../../.esy/source/i/which__1.3.1__6a4208c5/",
  {
    name: "which",
    reference: "1.3.1"}],
  ["../../../../../../.esy/source/i/which__2.0.2__12e88ff3/",
  {
    name: "which",
    reference: "2.0.2"}],
  ["../../../../../../.esy/source/i/which_module__2.0.0__dbf9460d/",
  {
    name: "which-module",
    reference: "2.0.0"}],
  ["../../../../../../.esy/source/i/word_wrap__1.2.3__b3ea4240/",
  {
    name: "word-wrap",
    reference: "1.2.3"}],
  ["../../../../../../.esy/source/i/wrap_ansi__6.2.0__630fcb39/",
  {
    name: "wrap-ansi",
    reference: "6.2.0"}],
  ["../../../../../../.esy/source/i/wrappy__1.0.2__5299ea53/",
  {
    name: "wrappy",
    reference: "1.0.2"}],
  ["../../../../../../.esy/source/i/write_file_atomic__3.0.3__6a20bc64/",
  {
    name: "write-file-atomic",
    reference: "3.0.3"}],
  ["../../../../../../.esy/source/i/ws__7.5.9__bf7d0a03/",
  {
    name: "ws",
    reference: "7.5.9"}],
  ["../../../../../../.esy/source/i/xml_name_validator__3.0.0__808c4a12/",
  {
    name: "xml-name-validator",
    reference: "3.0.0"}],
  ["../../../../../../.esy/source/i/xmlchars__2.2.0__15519a46/",
  {
    name: "xmlchars",
    reference: "2.2.0"}],
  ["../../../../../../.esy/source/i/y18n__4.0.3__4dbf3ad1/",
  {
    name: "y18n",
    reference: "4.0.3"}],
  ["../../../../../../.esy/source/i/yargs__15.4.1__02577956/",
  {
    name: "yargs",
    reference: "15.4.1"}],
  ["../../../../../../.esy/source/i/yargs_parser__18.1.3__7d2b106e/",
  {
    name: "yargs-parser",
    reference: "18.1.3"}]]);


  exports.findPackageLocator = function findPackageLocator(location) {
    let relativeLocation = normalizePath(path.relative(__dirname, location));

    if (!relativeLocation.match(isStrictRegExp))
      relativeLocation = `./${relativeLocation}`;

    if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')
      relativeLocation = `${relativeLocation}/`;

    let match;

  
      if (relativeLocation.length >= 103 && relativeLocation[102] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 103)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 101 && relativeLocation[100] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 101)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 96 && relativeLocation[95] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 96)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 92 && relativeLocation[91] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 92)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 91 && relativeLocation[90] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 91)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 90 && relativeLocation[89] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 90)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 88 && relativeLocation[87] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 88)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 87 && relativeLocation[86] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 87)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 86 && relativeLocation[85] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 86)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 85 && relativeLocation[84] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 85)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 84 && relativeLocation[83] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 84)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 83 && relativeLocation[82] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 83)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 82 && relativeLocation[81] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 82)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 81 && relativeLocation[80] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 81)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 80 && relativeLocation[79] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 80)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 79 && relativeLocation[78] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 79)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 78 && relativeLocation[77] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 78)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 77 && relativeLocation[76] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 77)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 76 && relativeLocation[75] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 76)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 75 && relativeLocation[74] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 75)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 74 && relativeLocation[73] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 74)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 73 && relativeLocation[72] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 73)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 72 && relativeLocation[71] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 72)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 71 && relativeLocation[70] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 71)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 70 && relativeLocation[69] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 70)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 69 && relativeLocation[68] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 69)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 68 && relativeLocation[67] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 68)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 67 && relativeLocation[66] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 67)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 66 && relativeLocation[65] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 66)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 65 && relativeLocation[64] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 65)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 64 && relativeLocation[63] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 64)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 63 && relativeLocation[62] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 63)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 62 && relativeLocation[61] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 62)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 61 && relativeLocation[60] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 61)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 60 && relativeLocation[59] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 60)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 59 && relativeLocation[58] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 59)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 58 && relativeLocation[57] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 58)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 57 && relativeLocation[56] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 57)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 56 && relativeLocation[55] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 56)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 55 && relativeLocation[54] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 55)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 54 && relativeLocation[53] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 54)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 53 && relativeLocation[52] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 53)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 52 && relativeLocation[51] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 52)))
          return blacklistCheck(match);
      

      if (relativeLocation.length >= 6 && relativeLocation[5] === '/')
        if (match = locatorsByLocations.get(relativeLocation.substr(0, 6)))
          return blacklistCheck(match);
      

    /*
      this can only happen if inside the _esy
      as any other path will implies the opposite

      topLevelLocatorPath = ../../

      | folder              | relativeLocation |
      | ------------------- | ---------------- |
      | /workspace/app      | ../../           |
      | /workspace          | ../../../        |
      | /workspace/app/x    | ../../x/         |
      | /workspace/app/_esy | ../              |

    */
    if (!relativeLocation.startsWith(topLevelLocatorPath)) {
      return topLevelLocator;
    }
    return null;
  };
  

/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent) {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent;
  }

  return issuer;
}

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator) {
  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw makeError(
      `INTERNAL`,
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`
    );
  }

  return packageInformation;
}

/**
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(unqualifiedPath, {extensions}) {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat;

    try {
      stat = statSync(unqualifiedPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only
      // do this first the last component, and not the rest of the path! This allows us to support the case of bin
      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").
      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".
      //
      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise
      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
      // ancestors.

      if (lstatSync(unqualifiedPath).isSymbolicLink()) {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), readlinkSync(unqualifiedPath)));
      }

      return unqualifiedPath;
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(readFileSync(`${unqualifiedPath}/package.json`, 'utf-8'));
      } catch (error) {}

      let nextUnqualifiedPath;

      if (pkgJson && pkgJson.main) {
        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main);
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
        const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, {extensions});

        if (resolution !== null) {
          return resolution;
        }
      }
    }

    // Otherwise we check if we find a file that match one of the supported extensions

    const qualifiedPath = extensions
      .map(extension => {
        return `${unqualifiedPath}${extension}`;
      })
      .find(candidateFile => {
        return existsSync(candidateFile);
      });

    if (qualifiedPath) {
      return qualifiedPath;
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      const indexPath = extensions
        .map(extension => {
          return `${unqualifiedPath}/index${extension}`;
        })
        .find(candidateFile => {
          return existsSync(candidateFile);
        });

      if (indexPath) {
        return indexPath;
      }
    }

    // Otherwise there's nothing else we can do :(

    return null;
  }
}

/**
 * This function creates fake modules that can be used with the _resolveFilename function.
 * Ideally it would be nice to be able to avoid this, since it causes useless allocations
 * and cannot be cached efficiently (we recompute the nodeModulePaths every time).
 *
 * Fortunately, this should only affect the fallback, and there hopefully shouldn't be a
 * lot of them.
 */

function makeFakeModule(path) {
  const fakeModule = new Module(path, false);
  fakeModule.filename = path;
  fakeModule.paths = Module._nodeModulePaths(path);
  return fakeModule;
}

/**
 * Normalize path to posix format.
 */

// eslint-disable-next-line no-unused-vars
function normalizePath(fsPath) {
  fsPath = path.normalize(fsPath);

  if (process.platform === 'win32') {
    fsPath = fsPath.replace(backwardSlashRegExp, '/');
  }

  return fsPath;
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request, issuer) {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js';
  }

  try {
    enableNativeHooks = false;

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(issuer), false);
  } finally {
    enableNativeHooks = true;
  }
}

/**
 * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
 * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
 * to override the standard, and can only offer new methods.
 *
 * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
 * functions, they'll just have to fix the conflicts and bump their own version number.
 */

exports.VERSIONS = {std: 1};

/**
 * Useful when used together with getPackageInformation to fetch information about the top-level package.
 */

exports.topLevel = {name: null, reference: null};

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

exports.getPackageInformation = function getPackageInformation({name, reference}) {
  const packageInformationStore = packageInformationStores.get(name);

  if (!packageInformationStore) {
    return null;
  }

  const packageInformation = packageInformationStore.get(reference);

  if (!packageInformation) {
    return null;
  }

  return packageInformation;
};

/**
 * Transforms a request (what's typically passed as argument to the require function) into an unqualified path.
 * This path is called "unqualified" because it only changes the package name to the package location on the disk,
 * which means that the end result still cannot be directly accessed (for example, it doesn't try to resolve the
 * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function
 * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveToUnqualified = function resolveToUnqualified(request, issuer, {considerBuiltins = true} = {}) {
  // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

  if (request === `pnpapi`) {
    return pnpFile;
  }

  // Bailout if the request is a native module

  if (considerBuiltins && builtinModules.has(request)) {
    return null;
  }

  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
  // typically solved using workspaces, but not all of them have been converted already.

  if (ignorePattern && ignorePattern.test(normalizePath(issuer))) {
    const result = callNativeResolution(request, issuer);

    if (result === false) {
      throw makeError(
        `BUILTIN_NODE_RESOLUTION_FAIL`,
        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp "$$BLACKLIST")`,
        {
          request,
          issuer
        }
      );
    }

    return result;
  }

  let unqualifiedPath;

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (path.isAbsolute(request)) {
      unqualifiedPath = path.normalize(request);
    } else if (issuer.match(isDirRegExp)) {
      unqualifiedPath = path.normalize(path.resolve(issuer, request));
    } else {
      unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request));
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = exports.findPackageLocator(issuer);

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      const result = callNativeResolution(request, issuer);

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)`,
          {
            request,
            issuer
          },
        );
      }

      return result;
    }

    const issuerInformation = getPackageInformationSafe(issuerLocator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

    // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
    // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
    // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

    if (issuerLocator !== topLevelLocator) {
      for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {
        const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);
        dependencyReference = fallbackInformation.packageDependencies.get(dependencyName);
      }
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
            {request, issuer, dependencyName},
          );
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName},
          );
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,
            {request, issuer, dependencyName},
          );
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys());
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(
              `, `,
            )})`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates},
          );
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = {name: dependencyName, reference: dependencyReference};
    const dependencyInformation = exports.getPackageInformation(dependencyLocator);
    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation);

    if (!dependencyLocation) {
      throw makeError(
        `MISSING_DEPENDENCY`,
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,
        {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)},
      );
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    if (subPath) {
      unqualifiedPath = path.resolve(dependencyLocation, subPath);
    } else {
      unqualifiedPath = dependencyLocation;
    }
  }

  return path.normalize(unqualifiedPath);
};

/**
 * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
 * appends ".js" / ".json", and transforms directory accesses into "index.js").
 */

exports.resolveUnqualified = function resolveUnqualified(
  unqualifiedPath,
  {extensions = Object.keys(Module._extensions)} = {},
) {
  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, {extensions});

  if (qualifiedPath) {
    return path.normalize(qualifiedPath);
  } else {
    throw makeError(
      `QUALIFIED_PATH_RESOLUTION_FAILED`,
      `Couldn't find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,
      {unqualifiedPath},
    );
  }
};

/**
 * Transforms a request into a fully qualified path.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveRequest = function resolveRequest(request, issuer, {considerBuiltins, extensions} = {}) {
  let unqualifiedPath;

  try {
    unqualifiedPath = exports.resolveToUnqualified(request, issuer, {considerBuiltins});
  } catch (originalError) {
    // If we get a BUILTIN_NODE_RESOLUTION_FAIL error there, it means that we've had to use the builtin node
    // resolution, which usually shouldn't happen. It might be because the user is trying to require something
    // from a path loaded through a symlink (which is not possible, because we need something normalized to
    // figure out which package is making the require call), so we try to make the same request using a fully
    // resolved issuer and throws a better and more actionable error if it works.
    if (originalError.code === `BUILTIN_NODE_RESOLUTION_FAIL`) {
      let realIssuer;

      try {
        realIssuer = realpathSync(issuer);
      } catch (error) {}

      if (realIssuer) {
        if (issuer.endsWith(`/`)) {
          realIssuer = realIssuer.replace(/\/?$/, `/`);
        }

        try {
          exports.resolveToUnqualified(request, realIssuer, {extensions});
        } catch (error) {
          // If an error was thrown, the problem doesn't seem to come from a path not being normalized, so we
          // can just throw the original error which was legit.
          throw originalError;
        }

        // If we reach this stage, it means that resolveToUnqualified didn't fail when using the fully resolved
        // file path, which is very likely caused by a module being invoked through Node with a path not being
        // correctly normalized (ie you should use "node $(realpath script.js)" instead of "node script.js").
        throw makeError(
          `SYMLINKED_PATH_DETECTED`,
          `A pnp module ("${request}") has been required from what seems to be a symlinked path ("${issuer}"). This is not possible, you must ensure that your modules are invoked through their fully resolved path on the filesystem (in this case "${realIssuer}").`,
          {
            request,
            issuer,
            realIssuer
          },
        );
      }
    }
    throw originalError;
  }

  if (unqualifiedPath === null) {
    return null;
  }

  try {
    return exports.resolveUnqualified(unqualifiedPath);
  } catch (resolutionError) {
    if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED') {
      Object.assign(resolutionError.data, {request, issuer});
    }
    throw resolutionError;
  }
};

/**
 * Setups the hook into the Node environment.
 *
 * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will
 * be used as path of the file to load.
 */

exports.setup = function setup() {
  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request, parent, isMain) {
    if (!enableNativeHooks) {
      return originalModuleLoad.call(Module, request, parent, isMain);
    }

    // Builtins are managed by the regular Node loader

    if (builtinModules.has(request)) {
      try {
        enableNativeHooks = false;
        return originalModuleLoad.call(Module, request, parent, isMain);
      } finally {
        enableNativeHooks = true;
      }
    }

    // The 'pnpapi' name is reserved to return the PnP api currently in use by the program

    if (request === `pnpapi`) {
      return pnpModule.exports;
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath];

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(modulePath, parent);
    Module._cache[modulePath] = module;

    // The main module is exposed as global variable

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(modulePath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        delete Module._cache[modulePath];
      }
    }

    // Some modules might have to be patched for compatibility purposes

    if (patchedModules.has(request)) {
      module.exports = patchedModules.get(request)(module.exports);
    }

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request, parent, isMain, options) {
    if (!enableNativeHooks) {
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);
    }

    const issuerModule = getIssuerModule(parent);
    const issuer = issuerModule ? issuerModule.filename : process.cwd() + '/';

    const resolution = exports.resolveRequest(request, issuer);
    return resolution !== null ? resolution : request;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request, paths, isMain) {
    if (!enableNativeHooks) {
      return originalFindPath.call(Module, request, paths, isMain);
    }

    for (const path of paths || []) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
  };

  process.versions.pnp = String(exports.VERSIONS.std);

  if (process.env.ESY__NODE_BIN_PATH != null) {
    const delimiter = require('path').delimiter;
    process.env.PATH = `${process.env.ESY__NODE_BIN_PATH}${delimiter}${process.env.PATH}`;
  }
};

exports.setupCompatibilityLayer = () => {
  // see https://github.com/browserify/resolve/blob/master/lib/caller.js
  const getCaller = () => {
    const origPrepareStackTrace = Error.prepareStackTrace;

    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = origPrepareStackTrace;

    return stack[2].getFileName();
  };

  // ESLint currently doesn't have any portable way for shared configs to specify their own
  // plugins that should be used (https://github.com/eslint/eslint/issues/10125). This will
  // likely get fixed at some point, but it'll take time and in the meantime we'll just add
  // additional fallback entries for common shared configs.

  for (const name of [`react-scripts`]) {
    const packageInformationStore = packageInformationStores.get(name);
    if (packageInformationStore) {
      for (const reference of packageInformationStore.keys()) {
        fallbackLocators.push({name, reference});
      }
    }
  }

  // We need to shim the "resolve" module, because Liftoff uses it in order to find the location
  // of the module in the dependency tree. And Liftoff is used to power Gulp, which doesn't work
  // at all unless modulePath is set, which we cannot configure from any other way than through
  // the Liftoff pipeline (the key isn't whitelisted for env or cli options).

  patchedModules.set(/^resolve$/, realResolve => {
    const mustBeShimmed = caller => {
      const callerLocator = exports.findPackageLocator(caller);

      return callerLocator && callerLocator.name === 'liftoff';
    };

    const attachCallerToOptions = (caller, options) => {
      if (!options.basedir) {
        options.basedir = path.dirname(caller);
      }
    };

    const resolveSyncShim = (request, {basedir}) => {
      return exports.resolveRequest(request, basedir, {
        considerBuiltins: false,
      });
    };

    const resolveShim = (request, options, callback) => {
      setImmediate(() => {
        let error;
        let result;

        try {
          result = resolveSyncShim(request, options);
        } catch (thrown) {
          error = thrown;
        }

        callback(error, result);
      });
    };

    return Object.assign(
      (request, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        } else if (!options) {
          options = {};
        }

        const caller = getCaller();
        attachCallerToOptions(caller, options);

        if (mustBeShimmed(caller)) {
          return resolveShim(request, options, callback);
        } else {
          return realResolve.sync(request, options, callback);
        }
      },
      {
        sync: (request, options) => {
          if (!options) {
            options = {};
          }

          const caller = getCaller();
          attachCallerToOptions(caller, options);

          if (mustBeShimmed(caller)) {
            return resolveSyncShim(request, options);
          } else {
            return realResolve.sync(request, options);
          }
        },
        isCore: request => {
          return realResolve.isCore(request);
        }
      }
    );
  });
};

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setupCompatibilityLayer();

  exports.setup();
}

if (process.mainModule === module) {
  exports.setupCompatibilityLayer();

  const reportError = (code, message, data) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = resolution => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request, issuer) => {
    try {
      reportSuccess(exports.resolveRequest(request, issuer));
    } catch (error) {
      reportError(error.code, error.message, error.data);
    }
  };

  const processRequest = data => {
    try {
      const [request, issuer] = JSON.parse(data);
      processResolution(request, issuer);
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data);
    }
  };

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`);
      process.exitCode = 64; /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3]);
    }
  } else {
    let buffer = '';
    const decoder = new StringDecoder.StringDecoder();

    process.stdin.on('data', chunk => {
      buffer += decoder.write(chunk);

      do {
        const index = buffer.indexOf('\n');
        if (index === -1) {
          break;
        }

        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        processRequest(line);
      } while (true);
    });
  }
}
