var isFx = Array.isArray;
var isFn = function(value) {
  return typeof value === "function";
};

function assign(from, assignments) {
  var obj = {};

  for (var i in from) obj[i] = from[i];
  for (var i in assignments) obj[i] = assignments[i];

  return obj;
}

function set(prefixes, value, from) {
  var target = {};
  if (prefixes.length) {
    target[prefixes[0]] =
      prefixes.length > 1
        ? set(prefixes.slice(1), value, from[prefixes[0]])
        : value;
    return assign(from, target);
  }
  return value;
}

function get(prefixes, from) {
  for (var i = 0; i < prefixes.length; i++) {
    from = from[prefixes[i]];
  }
  return from;
}

function resolvePathInNamespace(namespace, path) {
  path = path || "";
  var splitPath = path.split(".").filter(function(part) {
    return part;
  });
  var fullNamespace =
    path.startsWith(".") && splitPath.length
      ? splitPath
      : namespace.concat(splitPath);
  return fullNamespace;
}

export function h() {
  if (isFn(arguments[0])) {
    return arguments[0](arguments[1] || {}, arguments[2]);
  }
  var vnode = [arguments[0]];
  var index = 1;
  if (
    arguments[index] === Object(arguments[index]) &&
    !Array.isArray(arguments[index])
  ) {
    vnode.push(arguments[index]);
    index++;
  }
  var children = [];
  for (; index < arguments.length; index++) {
    var child = arguments[index];
    if (child !== undefined) {
      children.push(child);
    }
  }
  if (children.length) {
    vnode.push(children);
  }

  return vnode;
}

export function fxapp(props) {
  var globalState = assign(props.state);
  var wiredActions = assign(props.actions);

  function wireFx(namespace, state, actions) {
    var defaultFx = {
      get: function(path) {
        var prefixes = resolvePathInNamespace(namespace, path);
        return get(prefixes, globalState);
      },
      merge: function(partialState, path) {
        return [
          "merge",
          {
            partialState: partialState,
            path: path
          }
        ];
      },
      action: function(path, data) {
        return [
          "action",
          {
            path: path,
            data: data
          }
        ];
      }
    };
    var fxRunners = {
      merge: function(fxProps) {
        var fullNamespace = resolvePathInNamespace(namespace, fxProps.path);
        var updatedSlice = assign(
          get(fullNamespace, globalState),
          fxProps.partialState
        );
        globalState = set(fullNamespace, updatedSlice, globalState);
      },
      action: function(fxProps) {
        var fullNamespace = resolvePathInNamespace(namespace, fxProps.path);
        var requestedAction = get(fullNamespace, wiredActions);
        requestedAction(fxProps.data);
      }
    };
    function runIfFx(maybeFx) {
      if (!isFx(maybeFx)) {
        // Not an effect
      } else if (isFx(maybeFx[0])) {
        // Run an array of effects
        for (var i in maybeFx) {
          runIfFx(maybeFx[i]);
        }
      } else if (maybeFx.length) {
        // Run a single effect
        var fxType = maybeFx[0];
        var fxProps = maybeFx[1];
        var fxRunner = fxRunners[fxType];
        if (isFn(fxRunner)) {
          fxRunner(fxProps);
        } else {
          throw new Error("no such fx type: " + fxType);
        }
      }
    }
    for (var key in actions) {
      isFn(actions[key])
        ? (function(key, action) {
            actions[key] = function(data) {
              var actionFx = assign(defaultFx, {
                data: data
              });
              var actionResult = action(actionFx);
              runIfFx(actionResult);
              return actionResult;
            };
          })(key, actions[key])
        : wireFx(
            namespace.concat(key),
            (state[key] = assign(state[key])),
            (actions[key] = assign(actions[key]))
          );
    }
  }
  wireFx([], globalState, wiredActions);

  return wiredActions;
}
