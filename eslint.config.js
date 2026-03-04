import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { fixupConfigRules } from "@eslint/compat";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  // 1. Global Ignores
  {
    ignores: [
      "*.yml",
      "*.json",
      "assets/**",
      "*.scss",
      "*.css",
      "*.mjs",
      "node_modules/**",
      "dist/**",
      "coverage/**",
    ],
  },

  // 2. Base Configurations
  js.configs.recommended,

  // 3. TypeScript Configurations with files restriction
  ...fixupConfigRules(tseslint.configs.strictTypeChecked).map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  ...fixupConfigRules(tseslint.configs.stylisticTypeChecked).map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),

  // 4. Main Configuration Block
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: false,
        },
        jsDocParsingMode: "all",
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
      },
    },
    rules: {
      // ─────────────────────────────────────────────────────────────────────
      // Core JavaScript – general correctness & safety
      // ─────────────────────────────────────────────────────────────────────
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "all"],
      "no-constant-condition": "error",
      "no-implicit-coercion": ["error", {
        boolean: true,
        number: true,
        string: true,
        disallowTemplateShorthand: true,
        allow: [],
      }],
      "no-return-assign": ["error", "except-parens"],
      "no-sequences": "error",
      "no-var": "error",
      "prefer-const": ["error", {
        destructuring: "all",
        ignoreReadBeforeAssign: false,
      }],
      "no-unreachable": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-void": ["error", { allowAsStatement: true }],
      "no-self-assign": ["error", { props: true }],
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unreachable-loop": "error",
      "no-fallthrough": "error",
      "guard-for-in": "error",
      "no-dupe-else-if": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "no-extend-native": "error",
      "no-new-wrappers": "error",
      "no-new": "error",
      "no-new-native-nonconstructor": "error",
      "no-invalid-regexp": "error",
      "no-constructor-return": "error",
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",
      "no-await-in-loop": "warn",
      "no-unmodified-loop-condition": "error",
      "accessor-pairs": "error",
      "no-labels": "error",
      "no-caller": "error",
      "no-with": "error",
      "no-octal": "error",
      "no-octal-escape": "error",
      "consistent-return": "off",
      "no-proto": "error",
      "no-sparse-arrays": "error",
      "no-compare-neg-zero": "error",
      "no-ex-assign": "error",
      "no-unsafe-optional-chaining": ["error", { disallowArithmeticOperators: true }],
      "no-constant-binary-expression": "error",
      "no-duplicate-case": "error",
      "no-useless-backreference": "error",
      "no-setter-return": "error",
      "no-lone-blocks": "error",
      "no-extra-boolean-cast": ["error", { enforceForInnerExpressions: true }],
      "symbol-description": "error",
      "valid-typeof": ["error", { requireStringLiterals: true }],
      "no-delete-var": "error",
      "no-unsafe-negation": ["error", { enforceForOrderingRelations: true }],
      "use-isnan": ["error", { enforceForSwitchCase: true, enforceForIndexOf: true }],
      "getter-return": "error",
      "for-direction": "error",
      "radix": "error",
      "no-debugger": "error",
      "no-irregular-whitespace": "error",
      "require-atomic-updates": "off",
      "no-alert": "error",
      "no-script-url": "error",
      "no-multi-str": "error",
      "no-useless-catch": "error",
      "no-useless-concat": "error",
      "no-useless-escape": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-useless-call": "error",
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      "no-useless-constructor": "off", // handled by @typescript-eslint/no-useless-constructor
      "no-param-reassign": ["error", { props: false }],
      "no-else-return": ["error", { allowElseIf: false }],
      "no-lonely-if": "error",
      "no-unneeded-ternary": ["error", { defaultAssignment: false }],
      "no-nested-ternary": "error",
      "no-bitwise": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-extra-label": "error",
      "no-label-var": "error",
      "no-shadow-restricted-names": "error",
      "no-undef-init": "error",
      "prefer-object-spread": "error",
      "prefer-object-has-own": "error",
      "prefer-template": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "prefer-arrow-callback": ["error", { allowNamedFunctions: false, allowUnboundThis: true }],
      "prefer-destructuring": ["error", {
        VariableDeclarator: { array: false, object: true },
        AssignmentExpression: { array: false, object: false },
      }],
      "prefer-numeric-literals": "error",
      "prefer-promise-reject-errors": "error",
      "prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
      "prefer-exponentiation-operator": "error",
      "object-shorthand": ["error", "always", {
        avoidQuotes: true,
        ignoreConstructors: false,
        avoidExplicitReturnArrows: false,
      }],
      "array-callback-return": ["error", {
        allowImplicit: false,
        checkForEach: true,
        allowVoid: true,
      }],
      "default-case-last": "error",
      "grouped-accessor-pairs": ["error", "getBeforeSet"],
      "no-implicit-globals": "error",
      "no-iterator": "error",
      "no-restricted-globals": ["error", "event", "fdescribe"],
      "no-throw-literal": "off", // handled by @typescript-eslint/only-throw-error
      "no-object-constructor": "error",

      // ─────────────────────────────────────────────────────────────────────
      // Disabled base rules superseded by @typescript-eslint equivalents
      // ─────────────────────────────────────────────────────────────────────
      "no-unused-expressions": "off",
      "no-implied-eval": "off",
      "no-use-before-define": "off",
      "no-return-await": "off",
      "no-shadow": "off",
      "dot-notation": "off",
      "no-array-constructor": "off",
      "no-loss-of-precision": "off",
      "no-unused-vars": "off",
      "no-dupe-class-members": "off",
      "no-invalid-this": "off",
      "no-loop-func": "off",
      "no-redeclare": "off",
      "default-param-last": "off",
      "no-empty-function": "off",
      "require-await": "off",

      // ─────────────────────────────────────────────────────────────────────
      // @typescript-eslint – type safety & strictness
      // ─────────────────────────────────────────────────────────────────────
      "@typescript-eslint/switch-exhaustiveness-check": ["error", {
        allowDefaultCaseForExhaustiveSwitch: false,
        requireDefaultForNonUnion: true,
      }],

      "@typescript-eslint/no-unnecessary-condition": ["error", {
        allowConstantLoopConditions: true,
      }],

      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/dot-notation": ["error", {
        allowKeywords: true,
        allowPrivateClassPropertyAccess: false,
        allowProtectedClassPropertyAccess: false,
        allowIndexSignaturePropertyAccess: false,
      }],
      "@typescript-eslint/no-shadow": ["error", {
        builtinGlobals: true,
        hoist: "all",
        allow: [],
        ignoreOnInitialization: false,
        ignoreTypeValueShadow: false,
        ignoreFunctionTypeParameterNameValueShadow: false,
      }],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-readonly": "error",

      "@typescript-eslint/require-array-sort-compare": ["error", {
        ignoreStringArrays: false,
      }],

      // Safety against 'any'
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-explicit-any": ["error", {
        fixToUnknown: true,
        ignoreRestArgs: false,
      }],

      // Non-null assertions
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "@typescript-eslint/no-extra-non-null-assertion": "error",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",

      // Type assertions
      "@typescript-eslint/consistent-type-assertions": ["error", {
        assertionStyle: "as",
        objectLiteralTypeAssertions: "never",
      }],

      "@typescript-eslint/no-unused-vars": ["error", {
        args: "all",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/no-unused-expressions": ["error", {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: false,
      }],

      "@typescript-eslint/no-implied-eval": "error",

      "@typescript-eslint/no-use-before-define": ["error", {
        functions: false,
        classes: true,
        variables: true,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: true,
      }],

      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/no-unnecessary-type-constraint": "error",

      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
        "ts-check": false,
        minimumDescriptionLength: 10,
      }],

      "@typescript-eslint/prefer-nullish-coalescing": ["error", {
        ignorePrimitives: {
          bigint: false,
          boolean: true,
          number: false,
          string: true,
        },
        ignoreMixedLogicalExpressions: false,
        ignoreConditionalTests: true,
      }],

      "@typescript-eslint/prefer-optional-chain": "error",

      "@typescript-eslint/no-meaningless-void-operator": ["error", {
        checkNever: true,
      }],

      "@typescript-eslint/no-confusing-void-expression": ["error", {
        ignoreArrowShorthand: true,
        ignoreVoidOperator: true,
      }],

      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: false,
        allowFunctionsWithoutTypeParameters: false,
        allowIIFEs: false,
      }],

      "@typescript-eslint/explicit-member-accessibility": ["error", {
        accessibility: "explicit",
        overrides: {
          constructors: "explicit",
        },
      }],

      "@typescript-eslint/explicit-module-boundary-types": ["error", {
        allowArgumentsExplicitlyTypedAsAny: false,
        allowDirectConstAssertionInArrowFunctions: true,
        allowHigherOrderFunctions: true,
        allowTypedFunctionExpressions: true,
      }],

      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-base-to-string": "error",

      "@typescript-eslint/restrict-template-expressions": ["error", {
        allowNumber: true,
        allowBoolean: true,
        allowAny: false,
        allowNullish: false,
        allowRegExp: false,
        allowNever: false,
      }],

      "@typescript-eslint/restrict-plus-operands": ["error", {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: false,
        allowRegExp: false,
      }],

      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/no-misused-spread": "error",
      "@typescript-eslint/prefer-for-of": "error",

      "@typescript-eslint/promise-function-async": ["error", {
        checkArrowFunctions: false,
        checkFunctionDeclarations: true,
        checkFunctionExpressions: true,
        checkMethodDeclarations: true,
      }],

      "@typescript-eslint/unified-signatures": "error",
      "@typescript-eslint/no-unnecessary-qualifier": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-extraneous-class": ["error", {
        allowStaticOnly: true,
        allowWithDecorator: true,
      }],

      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",

      "@typescript-eslint/no-empty-function": ["error", {
        allow: [
          "arrowFunctions",
          "private-constructors",
          "protected-constructors",
          "overrideMethods",
          "decoratedFunctions",
        ],
      }],

      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-array-constructor": "error",
      "@typescript-eslint/no-loss-of-precision": "error",
      "@typescript-eslint/no-array-delete": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "error",
      "@typescript-eslint/no-wrapper-object-types": "error",
      "@typescript-eslint/prefer-literal-enum-member": ["error", {
        allowBitwiseExpressions: false,
      }],

      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowString: false,
        allowNumber: false,
        allowNullableObject: true,
        allowNullableBoolean: true,
        allowNullableString: true,
        allowNullableNumber: false,
        allowNullableEnum: false,
        allowAny: false,
      }],

      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/no-dupe-class-members": "error",
      "@typescript-eslint/no-invalid-this": "error",
      "@typescript-eslint/no-loop-func": "error",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-require-imports": "error",

      "@typescript-eslint/no-this-alias": ["error", {
        allowDestructuring: true,
      }],

      "@typescript-eslint/no-deprecated": "off",

      "@typescript-eslint/no-floating-promises": ["error", {
        ignoreVoid: true,
        ignoreIIFE: true,
      }],

      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-misused-promises": ["error", {
        checksConditionals: true,
        checksVoidReturn: {
          arguments: true,
          attributes: false,
          properties: true,
          returns: true,
          variables: true,
        },
        checksSpreads: true,
      }],

      "@typescript-eslint/return-await": ["error", "always"],

      "@typescript-eslint/unbound-method": "off",

      "@typescript-eslint/no-useless-constructor": "error",

      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
        disallowTypeAnnotations: true,
      }],

      "@typescript-eslint/consistent-type-exports": ["error", {
        fixMixedExportsWithInlineTypeSpecifier: false,
      }],

      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

      "@typescript-eslint/consistent-generic-constructors": ["error", "constructor"],

      "@typescript-eslint/consistent-indexed-object-style": ["error", "record"],

      "@typescript-eslint/no-import-type-side-effects": "error",

      "@typescript-eslint/no-inferrable-types": "off",

      "@typescript-eslint/typedef": "off",

      "@typescript-eslint/naming-convention": ["error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "forbid",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "forbid",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "property",
          format: null,
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],

      "@typescript-eslint/prefer-enum-initializers": "error",
      "@typescript-eslint/prefer-return-this-type": "error",
      "@typescript-eslint/prefer-find": "error",
      "@typescript-eslint/prefer-regexp-exec": "error",
      "@typescript-eslint/no-unnecessary-template-expression": "error",
      "@typescript-eslint/no-mixed-enums": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-unsafe-declaration-merging": "error",
      "@typescript-eslint/no-unsafe-unary-minus": "error",
    },
  },
];
