const { get, isEmpty, concat, filter, size, zipObject, map, min, split, lastIndexOf, join, slice } = require("lodash");
const { readFileSync, existsSync } = require("fs");
const { warn } = require("console")
const { dirname, relative, join: pJoin } = require("path")
const { type } = require("os")

module.default = (babel) => {

  const { types: t } = babel;

  const isRelativeModuleImport = (m = "") => {
    return m.startsWith("./") || m.startsWith("../")
  }

  const getLatestSAPFolderAbsPath = (filepath) => {
    if (existsSync(pJoin(dirname(filepath), "sap"))) {
      return filepath
    } else {
      const pathSequenses = split(filepath, "/")
      const lastSAPDIRIndex = lastIndexOf(pathSequenses, "sap")
      const latestSAPFolder = join(slice(pathSequenses, 0, lastSAPDIRIndex + 1), "/")
      return latestSAPFolder
    }
  }

  const visitor = {
    Program: {
      enter: path => {
        if (!path.state) {
          path.state = {}
        }
        path.state.ui5next = { inserts: [] }
      },
      exit: path => {
        var state = path.state.ui5next
        if (!isEmpty(state.inserts)) {
          path.node.body = concat(path.node.body, state.inserts)
        }
      }
    },

    CallExpression: {
      enter: path => {
        var node = path.node;
        var state = path.state.ui5next;
        var filepath = path.hub.file.opts.filename;
        // fix jquery.sap.xxx.js require path
        var relativePrefix = relative(filepath, getLatestSAPFolderAbsPath(filepath)).replace(/\\/g, "/") || "."

        if (
          // is sap.ui.define call expression
          get(node, ["callee", "object", "object", "name"], "") == "sap" &&
          get(node, ["callee", "object", "property", "name"], "") == "ui" &&
          get(node, ["callee", "property", "name"], "") == "define"
        ) {
          var args = node.arguments;
          var imports = []
          var definationFunction

          if (args[0].type == "FunctionExpression") {
            definationFunction = args[0];
          } else if (args[0].type == "ArrayExpression") {
            imports = args[0].elements;
            definationFunction = args[1];
          }

          if (definationFunction) {
            var definationFunctionParams = definationFunction.params;

            var expresions = definationFunction.body.body // is array

            if (!isEmpty(expresions)) {
              // convert to require
              if (!isEmpty(imports)) {
                // add require expressions 
                var requireExpressions = []
                for (let index = 0; index < min([size(imports), size(definationFunctionParams)]); index++) {
                  const id = definationFunctionParams[index];
                  const module = imports[index]
                  // if not relative module improt, convert to relative
                  if (!isRelativeModuleImport(module.value)) {
                    module.value = `${relativePrefix}/${module.value}`
                  }
                  requireExpressions.push(
                    t.importDeclaration([t.importDefaultSpecifier(id)], module) // es6 import
                    // t.variableDeclaration(
                    //   "var", [

                    //     t.variableDeclarator(
                    //       id,
                    //       t.callExpression(
                    //         t.identifier("require"), [module]
                    //       )
                    //     )
                    //   ]
                    // )
                  )
                }

                expresions = concat(requireExpressions, expresions)
              }

              var endExpression = expresions.pop();

              if (endExpression.type == "ReturnStatement") {
                endExpression = t.exportDefaultDeclaration(endExpression.argument) // es6 export
                // endExpression = t.expressionStatement(
                //   t.assignmentExpression("=",
                //     t.memberExpression(t.identifier("module"), t.identifier("exports")),
                //     endExpression.argument
                //   )
                // )
              }

              expresions = concat(expresions, endExpression)
              state.inserts = concat(state.inserts, expresions);
              path.remove();
            } else {

            }

          } else {

          }
        }
      }
    }

  }
  return {
    visitor: visitor
  };
}

module.exports = module.default;