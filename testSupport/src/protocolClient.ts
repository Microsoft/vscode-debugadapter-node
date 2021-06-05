/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import stream = require('stream');
import * as ee from 'events';
import {DebugProtocol} from 'vscode-debugprotocol';

export class ProtocolClient extends ee.EventEmitter {

	private static TWO_CRLF = '\r\n\r\n';

	private outputStream: stream.Writable;
	private sequence: number;
	private pendingRequests = new Map<number, (e: DebugProtocol.Response) => void>();
	private rawData = Buffer.alloc(0);
	private contentLength: number;

	constructor() {
		super();
		this.sequence = 1;
		this.contentLength = -1;
	}

	protected connect(readable: stream.Readable, writable: stream.Writable): void {

		this.outputStream = writable;

		readable.on('data', (data: Buffer) => {
			this.handleData(data);
		});
	}

	public send(command: 'initialize', args: DebugProtocol.InitializeRequestArguments) : Promise<DebugProtocol.InitializeResponse>;
	public send(command: 'configurationDone', args: DebugProtocol.ConfigurationDoneArguments) : Promise<DebugProtocol.ConfigurationDoneResponse>;
	public send(command: 'launch', args: DebugProtocol.LaunchRequestArguments) : Promise<DebugProtocol.LaunchResponse>;
	public send(command: 'attach', args: DebugProtocol.AttachRequestArguments) : Promise<DebugProtocol.AttachResponse>;
	public send(command: 'restart', args: DebugProtocol.RestartArguments) : Promise<DebugProtocol.RestartResponse>;
	public send(command: 'disconnect', args: DebugProtocol.DisconnectArguments) : Promise<DebugProtocol.DisconnectResponse>;
	public send(command: 'setBreakpoints', args: DebugProtocol.SetBreakpointsArguments) : Promise<DebugProtocol.SetBreakpointsResponse>;
	public send(command: 'setFunctionBreakpoints', args: DebugProtocol.SetFunctionBreakpointsArguments) : Promise<DebugProtocol.SetFunctionBreakpointsResponse>;
	public send(command: 'setExceptionBreakpoints', args: DebugProtocol.SetExceptionBreakpointsArguments) : Promise<DebugProtocol.SetExceptionBreakpointsResponse>;
	public send(command: 'dataBreakpointInfo', args: DebugProtocol.DataBreakpointInfoArguments) : Promise<DebugProtocol.DataBreakpointInfoResponse>;
	public send(command: 'setDataBreakpoints', args: DebugProtocol.SetDataBreakpointsArguments) : Promise<DebugProtocol.SetDataBreakpointsResponse>;
	public send(command: 'continue', args: DebugProtocol.ContinueArguments) : Promise<DebugProtocol.ContinueResponse>;
	public send(command: 'next', args: DebugProtocol.NextArguments) : Promise<DebugProtocol.NextResponse>;
	public send(command: 'stepIn', args: DebugProtocol.StepInArguments) : Promise<DebugProtocol.StepInResponse>;
	public send(command: 'stepOut', args: DebugProtocol.StepOutArguments) : Promise<DebugProtocol.StepOutResponse>;
	public send(command: 'stepBack', args: DebugProtocol.StepBackArguments) : Promise<DebugProtocol.StepBackResponse>;
	public send(command: 'reverseContinue', args: DebugProtocol.ReverseContinueArguments) : Promise<DebugProtocol.ReverseContinueResponse>;
	public send(command: 'restartFrame', args: DebugProtocol.RestartFrameArguments) : Promise<DebugProtocol.RestartFrameResponse>;
	public send(command: 'goto', args: DebugProtocol.GotoArguments) : Promise<DebugProtocol.GotoResponse>;
	public send(command: 'pause', args: DebugProtocol.PauseArguments) : Promise<DebugProtocol.PauseResponse>;
	public send(command: 'stackTrace', args: DebugProtocol.StackTraceArguments) : Promise<DebugProtocol.StackTraceResponse>;
	public send(command: 'scopes', args: DebugProtocol.ScopesArguments) : Promise<DebugProtocol.ScopesResponse>;
	public send(command: 'variables', args: DebugProtocol.VariablesArguments) : Promise<DebugProtocol.VariablesResponse>;
	public send(command: 'setVariable', args: DebugProtocol.SetVariableArguments) : Promise<DebugProtocol.SetVariableResponse>;
	public send(command: 'source', args: DebugProtocol.SourceArguments) : Promise<DebugProtocol.SourceResponse>;
	public send(command: 'threads') : Promise<DebugProtocol.ThreadsResponse>;
	public send(command: 'modules') : Promise<DebugProtocol.ModulesResponse>;
	public send(command: 'evaluate', args: DebugProtocol.EvaluateArguments) : Promise<DebugProtocol.EvaluateResponse>;
	public send(command: 'stepInTargets', args: DebugProtocol.StepInTargetsArguments) : Promise<DebugProtocol.StepInTargetsResponse>;
	public send(command: 'gotoTargets', args: DebugProtocol.GotoTargetsArguments) : Promise<DebugProtocol.GotoTargetsResponse>;
	public send(command: 'completions', args: DebugProtocol.CompletionsArguments) : Promise<DebugProtocol.CompletionsResponse>;
	public send(command: 'exceptionInfo', args: DebugProtocol.ExceptionInfoArguments) : Promise<DebugProtocol.ExceptionInfoResponse>;
	public send(command: string, args?: any) : Promise<DebugProtocol.Response>;

	public send(command: string, args?: any): Promise<DebugProtocol.Response> {

		return new Promise((completeDispatch, errorDispatch) => {
			this.doSend(command, args, (result: DebugProtocol.Response) => {
				if (result.success) {
					completeDispatch(result);
				} else {
					errorDispatch(new Error(result.message));
				}
			});
		});
	}

	private doSend(command: string, args: any, clb: (result: DebugProtocol.Response) => void): void {

		const request: DebugProtocol.Request = {
			type: 'request',
			seq: this.sequence++,
			command: command
		};
		if (args && Object.keys(args).length > 0) {
			request.arguments = args;
		}

		// store callback for this request
		this.pendingRequests.set(request.seq, clb);

		const json = JSON.stringify(request);
		this.emit("send", json);
		this.outputStream.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`, 'utf8');
	}

	private handleData(data: Buffer): void {

		this.rawData = Buffer.concat([this.rawData, data]);

		while (true) {
			if (this.contentLength >= 0) {
				if (this.rawData.length >= this.contentLength) {
					const message = this.rawData.toString('utf8', 0, this.contentLength);
					this.rawData = this.rawData.slice(this.contentLength);
					this.contentLength = -1;
					if (message.length > 0) {
						this.dispatch(message);
					}
					continue;	// there may be more complete messages to process
				}
			} else {
				const idx = this.rawData.indexOf(ProtocolClient.TWO_CRLF);
				if (idx !== -1) {
					const header = this.rawData.toString('utf8', 0, idx);
					const lines = header.split('\r\n');
					for (let i = 0; i < lines.length; i++) {
						const pair = lines[i].split(/: +/);
						if (pair[0] === 'Content-Length') {
							this.contentLength = +pair[1];
						}
					}
					this.rawData = this.rawData.slice(idx + ProtocolClient.TWO_CRLF.length);
					continue;
				}
			}
			break;
		}
	}

	private dispatch(body: string): void {
		this.emit("recv", body);
		const rawData = JSON.parse(body);

		if (typeof rawData.event !== 'undefined') {
			const event = <DebugProtocol.Event> rawData;
			this.emit(event.event, event);
		} else {
			const response = <DebugProtocol.Response> rawData;
			const clb = this.pendingRequests.get(response.request_seq);
			if (clb) {
				this.pendingRequests.delete(response.request_seq);
				clb(response);
			}
		}
	}
}
