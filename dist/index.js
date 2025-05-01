"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
var CompilerContext_1 = __importDefault(require("@ardatan/relay-compiler/lib/core/CompilerContext"));
var IRPrinter_1 = require("@ardatan/relay-compiler/lib/core/IRPrinter");
var RelayParser_1 = require("@ardatan/relay-compiler/lib/core/RelayParser");
var Schema_1 = require("@ardatan/relay-compiler/lib/core/Schema");
var ApplyFragmentArgumentTransform_1 = require("@ardatan/relay-compiler/lib/transforms/ApplyFragmentArgumentTransform");
var FlattenTransform_1 = require("@ardatan/relay-compiler/lib/transforms/FlattenTransform");
var InlineFragmentsTransform_1 = require("@ardatan/relay-compiler/lib/transforms/InlineFragmentsTransform");
var SkipRedundantNodesTransform_1 = require("@ardatan/relay-compiler/lib/transforms/SkipRedundantNodesTransform");
var graphql_1 = require("graphql");
function isFragment(documentFile) {
    var name = false;
    if (!documentFile.document)
        return false;
    (0, graphql_1.visit)(documentFile.document, {
        FragmentDefinition: function () {
            name = true;
        },
    });
    return name;
}
var plugin = function (schema, documents, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_config) {
    var isFrag = documents.every(function (d) { return isFragment(d); });
    if (isFrag)
        return { content: '' };
    // @TODO way for users to define directives they use, otherwise relay will throw an unknown directive error
    // Maybe we can scan the queries and add them dynamically without users having to do some extra stuff
    // transformASTSchema creates a new schema instance instead of mutating the old one
    var adjustedSchema = (0, Schema_1.create)((0, graphql_1.printSchema)(schema)).extend([
        /* GraphQL */ "\n      directive @connection(key: String!, filter: [String!]) on FIELD\n      directive @client on FIELD\n    ",
    ]);
    var documentAsts = documents.reduce(function (prev, v) { var _a, _b; return __spreadArray(__spreadArray([], prev, true), ((_b = (_a = v.document) === null || _a === void 0 ? void 0 : _a.definitions) !== null && _b !== void 0 ? _b : []), true); }, []);
    var relayDocuments = (0, RelayParser_1.transform)(adjustedSchema, documentAsts);
    var fragmentCompilerContext = new CompilerContext_1.default(adjustedSchema).addAll(relayDocuments);
    var fragmentDocuments = fragmentCompilerContext
        .applyTransforms([
        ApplyFragmentArgumentTransform_1.transform,
        (0, FlattenTransform_1.transformWithOptions)({ flattenAbstractTypes: false }),
        SkipRedundantNodesTransform_1.transform,
    ])
        .documents()
        .filter(function (doc) { return doc.kind === 'Fragment'; });
    var queryCompilerContext = new CompilerContext_1.default(adjustedSchema)
        .addAll(relayDocuments)
        .applyTransforms([
        ApplyFragmentArgumentTransform_1.transform,
        InlineFragmentsTransform_1.transform,
        (0, FlattenTransform_1.transformWithOptions)({ flattenAbstractTypes: false }),
        SkipRedundantNodesTransform_1.transform,
    ]);
    var newQueryDocuments = queryCompilerContext.documents().map(function (doc) { return ({
        location: 'optimized by relay',
        document: (0, graphql_1.parse)((0, IRPrinter_1.print)(adjustedSchema, doc)),
    }); });
    var newDocuments = [];
    if (newQueryDocuments.length === 0) {
        return { content: '' };
    }
    if (newQueryDocuments.length === 1) {
        newDocuments = newQueryDocuments;
    }
    else {
        newDocuments = __spreadArray(__spreadArray([], fragmentDocuments.map(function (doc) { return ({
            location: 'optimized by relay',
            document: (0, graphql_1.parse)((0, IRPrinter_1.print)(adjustedSchema, doc)),
        }); }), true), newQueryDocuments, true);
    }
    documents.splice(0, documents.length);
    documents.push.apply(documents, newDocuments);
    return {
        content: '',
    };
};
exports.plugin = plugin;
