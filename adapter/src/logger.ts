/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import {OutputEvent} from './debugSession';

export enum LogLevel {
	Verbose = 0,
	Log = 1,
	Warn = 2,
	Error = 3,
	Stop = 4
}

export type ILogCallback = (outputEvent: OutputEvent) => void;

interface ILogItem {
	msg: string;
	level: LogLevel;
}

export interface ILogger {
	log(msg: string, level?: LogLevel): void;
	verbose(msg: string): void;
	warn(msg: string): void;
	error(msg: string): void;
}

export class Logger {
	private _logFilePathFromInit: string;

	private _currentLogger: InternalLogger;
	private _pendingLogQ: ILogItem[] = [];

	log(msg: string, level = LogLevel.Log): void {
		msg = msg + '\n';
		this._write(msg, level);
	}

	verbose(msg: string): void {
		this.log(msg, LogLevel.Verbose);
	}

	warn(msg: string): void {
		this.log(msg, LogLevel.Warn);
	}

	error(msg: string): void {
		this.log(msg, LogLevel.Error);
	}

	dispose(): Promise<void> {
		if (this._currentLogger) {
			const disposeP = this._currentLogger.dispose();
			this._currentLogger = null;
			return disposeP;
		} else {
			return Promise.resolve();
		}
	}

	/**
	 * `log` adds a newline, `write` doesn't
	 */
	private _write(msg: string, level = LogLevel.Log): void {
		// [null, undefined] => string
		msg = msg + '';
		if (this._pendingLogQ) {
			this._pendingLogQ.push({ msg, level });
		} else if (this._currentLogger) {
			this._currentLogger.log(msg, level);
		}
	}

	/**
	 * Set the logger's minimum level to log in the console, and whether to log to the file. Log messages are queued before this is
	 * called the first time, because minLogLevel defaults to Warn.
	 */
	setup(consoleMinLogLevel: LogLevel, _logFilePath?: string|boolean, prependTimestamp: boolean = true): void {
		const logFilePath = typeof _logFilePath === 'string' ?
			_logFilePath :
			(_logFilePath && this._logFilePathFromInit);

		if (this._currentLogger) {
			const options = {
				consoleMinLogLevel,
				logFilePath,
				prependTimestamp
			};
			this._currentLogger.setup(options).then(() => {
				// Now that we have a minimum logLevel, we can clear out the queue of pending messages
				if (this._pendingLogQ) {
					const logQ = this._pendingLogQ;
					this._pendingLogQ = null;
					logQ.forEach(item => this._write(item.msg, item.level));
				}
			});

		}
	}

	init(logCallback: ILogCallback, logFilePath?: string, logToConsole?: boolean): void {
		// Re-init, create new global Logger
		this._pendingLogQ = this._pendingLogQ || [];
		this._currentLogger = new InternalLogger(logCallback, logToConsole);
		this._logFilePathFromInit = logFilePath;
	}
}

export const logger = new Logger();

interface IInternalLoggerOptions {
	consoleMinLogLevel: LogLevel;
	logFilePath?: string;
	prependTimestamp?: boolean;
}

/**
 * Manages logging, whether to console.log, file, or VS Code console.
 * Encapsulates the state specific to each logging session
 */
class InternalLogger {
	private _minLogLevel: LogLevel;
	private _logToConsole: boolean;

	/** Log info that meets minLogLevel is sent to this callback. */
	private _logCallback: ILogCallback;

	/** Write steam for log file */
	private _logFileStream: fs.WriteStream;

	/** Dispose and allow exit to continue normally */
	private beforeExitCallback = () => this.dispose();

	/** Dispose and exit */
	private disposeCallback;

	/** Whether to add a timestamp to messages in the logfile */
	private _prependTimestamp: boolean;

	constructor(logCallback: ILogCallback, isServer?: boolean) {
		this._logCallback = logCallback;
		this._logToConsole = isServer;

		this._minLogLevel = LogLevel.Warn;

		this.disposeCallback = (signal: string, code: number) => {
			this.dispose();

			// Exit with 128 + value of the signal code.
			// https://nodejs.org/api/process.html#process_exit_codes
			code = code || 2; // SIGINT
			code += 128;

			process.exit(code);
		};
	}

	public async setup(options: IInternalLoggerOptions): Promise<void> {
		this._minLogLevel = options.consoleMinLogLevel;
		this._prependTimestamp = options.prependTimestamp;

		// Open a log file in the specified location. Overwritten on each run.
		if (options.logFilePath) {
			if (!path.isAbsolute(options.logFilePath)) {
				this.log(`logFilePath must be an absolute path: ${options.logFilePath}`, LogLevel.Error);
			} else {
				const handleError = err => this.sendLog(`Error creating log file at path: ${options.logFilePath}. Error: ${err.toString()}\n`, LogLevel.Error);

				try {
					await mkdirp(path.dirname(options.logFilePath));
					this.log(`Verbose logs are written to:\n`, LogLevel.Warn);
					this.log(options.logFilePath + '\n', LogLevel.Warn);

					this._logFileStream = fs.createWriteStream(options.logFilePath);
					this.logDateTime();
					this.setupShutdownListeners();
					this._logFileStream.on('error', err => {
						handleError(err);
					});
				} catch (err) {
					handleError(err);
				}
			}
		}
	}

	private logDateTime(): void {
		let d = new Date();
		let dateString = d.getUTCFullYear() + '-' + `${d.getUTCMonth() + 1}` + '-' + d.getUTCDate();
		const timeAndDateStamp = dateString + ', ' + getFormattedTimeString();
		this.log(timeAndDateStamp + '\n', LogLevel.Verbose, false);
	}

	private setupShutdownListeners(): void {
		process.addListener('beforeExit', this.beforeExitCallback);
		process.addListener('SIGTERM', this.disposeCallback);
		process.addListener('SIGINT', this.disposeCallback);
	}

	private removeShutdownListeners(): void {
		process.removeListener('beforeExit', this.beforeExitCallback);
		process.removeListener('SIGTERM', this.disposeCallback);
		process.removeListener('SIGINT', this.disposeCallback);
	}

	public dispose(): Promise<void> {
		return new Promise(resolve => {
			this.removeShutdownListeners();
			if (this._logFileStream) {
				this._logFileStream.end(resolve);
				this._logFileStream = null;
			} else {
				resolve();
			}
		});
	}

	public log(msg: string, level: LogLevel, prependTimestamp = true): void {
		if (this._minLogLevel === LogLevel.Stop) {
			return;
		}

		const shouldBeLogged: boolean = level >= this._minLogLevel;
		if (shouldBeLogged) {
			this.sendLog(msg, level);
		}

		if (this._logToConsole) {
			const logFn =
				level === LogLevel.Error ? console.error :
				level === LogLevel.Warn ? console.warn :
				null;

			if (logFn) {
				logFn(trimLastNewline(msg));
			}
		}

		// If an error, prepend with '[Error]'
		if (level === LogLevel.Error) {
			msg = `[${LogLevel[level]}] ${msg}`;
		}

		if (this._prependTimestamp && prependTimestamp) {
			msg = '[' + getFormattedTimeString() + '] ' + msg;
		}

		if (this._logFileStream && shouldBeLogged) {
			this._logFileStream.write(msg);
		}
	}

	private sendLog(msg: string, level: LogLevel): void {
		// Truncate long messages, they can hang VS Code
		if (msg.length > 1500) {
			const endsInNewline = !!msg.match(/(\n|\r\n)$/);
			msg = msg.substr(0, 1500) + '[...]';
			if (endsInNewline) {
				msg = msg + '\n';
			}
		}

		if (this._logCallback) {
			const event = new LogOutputEvent(msg, level);
			this._logCallback(event);
		}
	}
}

export class LogOutputEvent extends OutputEvent {
	constructor(msg: string, level: LogLevel) {
		const category =
			level === LogLevel.Error ? 'stderr' :
			level === LogLevel.Warn ? 'console' :
			'stdout';
		super(msg, category);
	}
}

export function trimLastNewline(str: string): string {
	return str.replace(/(\n|\r\n)$/, '');
}

function getFormattedTimeString(): string {
	let d = new Date();
	let hourString = _padZeroes(2, String(d.getUTCHours()));
	let minuteString = _padZeroes(2, String(d.getUTCMinutes()));
	let secondString = _padZeroes(2, String(d.getUTCSeconds()));
	let millisecondString = _padZeroes(3, String(d.getUTCMilliseconds()));
	return hourString + ':' + minuteString + ':' + secondString + '.' + millisecondString + ' UTC';
}

function _padZeroes(minDesiredLength: number, numberToPad: string): string {
	if (numberToPad.length >= minDesiredLength) {
		return numberToPad;
	} else {
		return String('0'.repeat(minDesiredLength) + numberToPad).slice(-minDesiredLength);
	}
}
