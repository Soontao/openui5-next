const { dirname } = require("path");
const { get, isEmpty, concat, filter, size, zipObject, map, min } = require("lodash");
const { readFileSync } = require("fs");
const { warn } = require("console")

module.default = (babel) => {

  const { types: t } = babel;

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
                  requireExpressions.push(
                    t.variableDeclaration(
                      "var", [
                        t.variableDeclarator(
                          id,
                          t.callExpression(
                            t.identifier("require"), [module]
                          )
                        )
                      ]
                    )
                  )
                }

                expresions = concat(requireExpressions, expresions)
              }

              var endExpression = expresions.pop();

              if (endExpression.type == "ReturnStatement") {
                endExpression = t.expressionStatement(
                  t.assignmentExpression("=",
                    t.memberExpression(t.identifier("module"), t.identifier("exports")),
                    endExpression.argument
                  )
                )
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