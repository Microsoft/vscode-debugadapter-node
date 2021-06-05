/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import {DebugSession} from '../debugSession';

class TestDebugSession extends DebugSession {

	constructor() {
		super();
	}

	public convertClientPath2Debugger(clientPath: string): string {
		return this.convertClientPathToDebugger(clientPath);
	}

	public convertDebuggerPath2Client(debuggerPath: string): string {
		return this.convertDebuggerPathToClient(debuggerPath);
	}
}

suite('URI', () => {

	let da: TestDebugSession;

	setup( () => {
		da = new TestDebugSession();
	});

	teardown( () => {
		da.stop();
	} );

	suite('path conversion', () => {

		test('convertClientPathToDebugger', () => {

			da.setDebuggerPathFormat('url');

			if (process.platform === 'win32') {

				assert.equal(da.convertClientPath2Debugger('c:\\abc\\test.js'), 'file:///c:/abc/test.js');
				// drive letters are normalized to lower case
				assert.equal(da.convertClientPath2Debugger('C:\\abc\\test.js'), 'file:///c:/abc/test.js');

				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo bar.js'), 'file:///c:/abc/foo%20bar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo%bar.js'), 'file:///c:/abc/foo%25bar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\föö bär.js'), 'file:///c:/abc/f%C3%B6%C3%B6%20b%C3%A4r.js');

				// 'path' percent-encode set
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo{bar.js'), 'file:///c:/abc/foo%7Bbar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo}bar.js'), 'file:///c:/abc/foo%7Dbar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo#bar.js'), 'file:///c:/abc/foo%23bar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo?bar.js'), 'file:///c:/abc/foo%3Fbar.js');

				// not percent-encoded
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo:bar.js'), 'file:///c:/abc/foo:bar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo+bar.js'), 'file:///c:/abc/foo+bar.js');	// see https://github.com/microsoft/vscode-debugadapter-node/issues/182
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo_bar.js'), 'file:///c:/abc/foo_bar.js');
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\foo@bar.js'), 'file:///c:/abc/foo@bar.js');

				// see https://github.com/microsoft/vscode-debugadapter-node/issues/#159
				assert.equal(da.convertClientPath2Debugger('c:\\abc\\test.js'), 'file:///c:/abc/test.js');

			} else {

				assert.equal(da.convertClientPath2Debugger('/abc/test.js'), 'file:///abc/test.js');

				assert.equal(da.convertClientPath2Debugger('/abc/foo bar.js'), 'file:///abc/foo%20bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo%bar.js'), 'file:///abc/foo%25bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/föö bär.js'), 'file:///abc/f%C3%B6%C3%B6%20b%C3%A4r.js');

				// 'path' percent-encode set
				assert.equal(da.convertClientPath2Debugger('/abc/foo{bar.js'), 'file:///abc/foo%7Bbar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo}bar.js'), 'file:///abc/foo%7Dbar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo#bar.js'), 'file:///abc/foo%23bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo?bar.js'), 'file:///abc/foo%3Fbar.js');

				// not percent-encoded
				assert.equal(da.convertClientPath2Debugger('/abc/foo:bar.js'), 'file:///abc/foo:bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo+bar.js'), 'file:///abc/foo+bar.js');	// see https://github.com/microsoft/vscode-debugadapter-node/issues/182
				assert.equal(da.convertClientPath2Debugger('/abc/foo_bar.js'), 'file:///abc/foo_bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo@bar.js'), 'file:///abc/foo@bar.js');
			}
		});

		test('convertDebuggerPathToClient', () => {

			da.setDebuggerPathFormat('url');

			if (process.platform === 'win32') {
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/test.js'), 'c:\\abc\\test.js');
				// drive letter casing are preserved
				assert.equal(da.convertDebuggerPath2Client('file:///C:/abc/test.js'), 'c:\\abc\\test.js');

				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%20bar.js'), 'c:\\abc\\foo bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%25bar.js'), 'c:\\abc\\foo%bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/f%C3%B6%C3%B6%20b%C3%A4r.js'), 'c:\\abc\\föö bär.js');

				// 'path' percent-encode set
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%7Bbar.js'), 'c:\\abc\\foo{bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%7Dbar.js'), 'c:\\abc\\foo}bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%23bar.js'), 'c:\\abc\\foo#bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%3Fbar.js'), 'c:\\abc\\foo?bar.js');

				// not percent-encoded
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo:bar.js'), 'c:\\abc\\foo:bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo+bar.js'), 'c:\\abc\\foo+bar.js');	//see https://github.com/microsoft/vscode-debugadapter-node/issues/182
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo_bar.js'), 'c:\\abc\\foo_bar.js');
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo@bar.js'), 'c:\\abc\\foo@bar.js');

				// see https://github.com/microsoft/vscode-debugadapter-node/issues/#159
				assert.equal(da.convertDebuggerPath2Client('file:///c:/abc/foo%20bar/test.js'), 'c:\\abc\\foo bar\\test.js');

			} else {

				assert.equal(da.convertClientPath2Debugger('/abc/test.js'), 'file:///abc/test.js');

				assert.equal(da.convertClientPath2Debugger('/abc/foo bar.js'), 'file:///abc/foo%20bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo%bar.js'), 'file:///abc/foo%25bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/föö bär.js'), 'file:///abc/f%C3%B6%C3%B6%20b%C3%A4r.js');

				// 'path' percent-encode set
				assert.equal(da.convertClientPath2Debugger('/abc/foo{bar.js'), 'file:///abc/foo%7Bbar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo}bar.js'), 'file:///abc/foo%7Dbar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo#bar.js'), 'file:///abc/foo%23bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo?bar.js'), 'file:///abc/foo%3Fbar.js');

				// not percent-encoded
				assert.equal(da.convertClientPath2Debugger('/abc/foo:bar.js'), 'file:///abc/foo:bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo+bar.js'), 'file:///abc/foo+bar.js');	// see https://github.com/microsoft/vscode-debugadapter-node/issues/182
				assert.equal(da.convertClientPath2Debugger('/abc/foo_bar.js'), 'file:///abc/foo_bar.js');
				assert.equal(da.convertClientPath2Debugger('/abc/foo@bar.js'), 'file:///abc/foo@bar.js');

			}
		});

	});

});
