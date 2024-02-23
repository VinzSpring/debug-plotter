import * as vscode from 'vscode';
import { getWebviewContent } from './webview';

class VariableEntry extends vscode.TreeItem {
    constructor(public readonly label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }

    contextValue = 'variable';
}


type BreakpointResultRecord = {
    globalIdx: number;
    breakpointId: number;
    threadId: number;
    results: { [name: string]: string };
};


function updatePanel(panel: vscode.WebviewPanel, breakpointHistory: Array<BreakpointResultRecord>) {
    panel.webview.postMessage({
        command: 'updatePanel',
        breakpointHistory
    });
}

class DebugPlotterProvider implements vscode.TreeDataProvider<VariableEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<VariableEntry | undefined | null> = new vscode.EventEmitter<VariableEntry | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<VariableEntry | undefined | null> = this._onDidChangeTreeData.event;

    public globalIdx = 0;
    public variables: string[] = [];
    private _valueHistory: Array<BreakpointResultRecord> = new Array();

    constructor(private ctx: vscode.ExtensionContext) {}

    private panel: vscode.WebviewPanel | undefined;

    private _initPanel() {
        if (this.panel) {
            return;
        }
        this.panel = vscode.window.createWebviewPanel(
            'debugPlotter', // Identifies the type of the webview. Used internally
            'DebugPlotter', // Title of the panel displayed to the user
            vscode.ViewColumn.Two, // Editor column to show the new webview panel in
            {
                // Enable scripts in the webview
                enableScripts: true
            }
        );

        this.panel.webview.html = getWebviewContent();
    }

    getTreeItem(element: VariableEntry): vscode.TreeItem {
        return element;
    }

    getChildren(element?: VariableEntry): Thenable<VariableEntry[]> {
        if (!element) {
            return Promise.resolve(this.variables.map(name => new VariableEntry(name)));
        }
        return Promise.resolve([]);
    }

    addVariable(name: string) {
        this.variables.push(name);
        this._onDidChangeTreeData.fire(null);
        this._initPanel();
    }

    deleteVariable(name: string) {
        const index = this.variables.indexOf(name);
        if (index > -1) {
            this.variables.splice(index, 1);
            const historyIndicesToDelete: number[] = [];
            this._valueHistory.forEach((record, idx) => {
                delete record.results[name];
                if (Object.keys(record.results).length === 0) {
                    historyIndicesToDelete.push(idx);
                }
            });
            for (let i = historyIndicesToDelete.length - 1; i >= 0; i--) {
                this._valueHistory.splice(historyIndicesToDelete[i], 1);
            }
            updatePanel(this.panel!, this._valueHistory);
            this._onDidChangeTreeData.fire(null);
        }
    }

    addResult(results: BreakpointResultRecord) {
        this._valueHistory.push(results);
        updatePanel(this.panel!, this._valueHistory);
    }

    dispose() {
        this.panel?.dispose();
        this._valueHistory = [];
        this.variables = [];
    }
}

let debugPlotterProvider: DebugPlotterProvider | undefined;
export function activate(context: vscode.ExtensionContext) {
    console.log('Whats good from bro!');

    debugPlotterProvider = new DebugPlotterProvider(context);
    vscode.window.registerTreeDataProvider('debugPlotterView', debugPlotterProvider);
    context.subscriptions.push(vscode.commands.registerCommand('debugPlotter.addVariable', () => {
        vscode.window.showInputBox({ prompt: 'Enter variable name' }).then(value => {
            if (value) {
                debugPlotterProvider?.addVariable(value);
            }
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('debugPlotter.deleteVariable', (node: VariableEntry) => debugPlotterProvider?.deleteVariable(node.label)));

    // Register the debug adapter tracker factory
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            return {
                onDidSendMessage: async message => {
                    if (message.type === 'event' && message.event === 'stopped' && message.body.reason === 'breakpoint') {
                        if (debugPlotterProvider?.variables.length === 0) {
                            return;
                        }

                        // Use the first thread as an example
                        const threadId = message.body.threadId || 1; // Fallback to threadId 1 if not specified
                        const hitBreakpointIds: number[] = message.body.hitBreakpointIds ?? [];

                        console.log(`Hit breakpoint in thread ${threadId} with breakpoint IDs: ${hitBreakpointIds.join(', ')}`);
                        
                        if (!debugPlotterProvider) {
                            return;
                        }

                        const globalIdx = debugPlotterProvider.globalIdx++;

                        // Evaluate a variable when a breakpoint is hit
                        const results: { name: string, result: string | undefined }[] = await Promise.all(debugPlotterProvider.variables.map(
                            async variable => {
                                const result = await evaluateVariable(session, threadId, variable);
                                return {
                                    name: variable,
                                    result: result,
                                };
                            }
                        ));

                        const breakpointRecord: BreakpointResultRecord = {
                            globalIdx: globalIdx,
                            breakpointId: hitBreakpointIds[0],
                            threadId,
                            results: {},
                        };
                        results.forEach(({ name, result }) => {
                            if (result !== undefined) {
                                breakpointRecord.results[name] = result;
                            }
                        });
                        debugPlotterProvider.addResult(breakpointRecord);
                    }
                }
            };
        }
    }));
}

async function evaluateVariable(session: vscode.DebugSession, threadId: number, variableName: string): Promise<string | undefined> {
    // Fetch stack frames to get the context for evaluation
    const stackFramesResponse = await session.customRequest('stackTrace', { threadId });
    if (stackFramesResponse && stackFramesResponse.stackFrames.length > 0) {
        const frameId = stackFramesResponse.stackFrames[0].id;

        try {
            // Evaluate the variable in the current stack frame
            const evaluateResponse = await session.customRequest('evaluate', {
                expression: variableName,
                frameId,
                context: 'watch'
            });

            if (evaluateResponse && evaluateResponse.result) {
                const value = evaluateResponse.result;
                return value;
            }
        } catch (e) {
            console.error(e);
        }
    }
    return undefined;
}

// clean up the panel when the extension is deactivated
export function deactivate() {
    console.log('Whats good from bro!');
    if (debugPlotterProvider && debugPlotterProvider) {
        debugPlotterProvider.dispose();
    }
}
