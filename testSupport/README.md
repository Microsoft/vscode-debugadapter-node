# Test Support for VS Code Debug Adapters

[![NPM Version](https://img.shields.io/npm/v/vscode-debugadapter-testsupport.svg)](https://npmjs.org/package/vscode-debugadapter-testsupport)
[![NPM Downloads](https://img.shields.io/npm/dm/vscode-debugadapter-testsupport.svg)](https://npmjs.org/package/vscode-debugadapter-testsupport)

Npm module with support classes for writing automated tests for a VS Code debug adapter.

The module provides a toolkit with Promise-based building blocks for individual protocol requests (e.g. `stepInRequest`) and for common request sequences (e.g. `hitBreakpoint`). These building blocks can be easily configured for a specific adapter and combined to form complex scenarios.

Here are three example Mocha tests:

```js
var dc: DebugClient;

setup( () => {
    dc = new DebugClient('node', './out/node/nodeDebug.js', 'node');
	dc.on("send", (body: string) =>  console.log("send>>> " + body))
	dc.on("recv", (body: string) =>  console.log("recv<<< " + body))
    return dc.start();
});

teardown( () => dc.stop() );


test('should run program to the end', () => {
    return Promise.all([
        dc.configurationSequence(),
        dc.launch({ program: "main.js" }),
        dc.waitForEvent('terminated')
    ]);
});

test('should stop on entry', () => {
    return Promise.all([
        dc.configurationSequence(),
        dc.launch({ program: "main.js", stopOnEntry: true }),
        dc.assertStoppedLocation('entry', 1)
    ]);
});

test('should stop on a breakpoint', () => {
    return dc.hitBreakpoint({ program: "main.js" }, "test.js", 15);
});
```


## License

[MIT](https://github.com/Microsoft/vscode-languageserver-node/blob/master/License.txt)