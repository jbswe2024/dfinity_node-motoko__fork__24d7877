import { file } from './file';
import { fetchPackage, loadPackages, PackageInfo } from './package';
import { resolveMain, resolveLib } from './utils/resolveEntryPoint';

export type Motoko = ReturnType<typeof wrapMotoko>;

type Compiler = any; // TODO

// TODO
export type Diagnostic = {
    code?: string | number | { target: any; value: string | number };
    message: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    severity: string;
    source?: string;
    tags?: string[];
};

export type WasmMode = 'ic' | 'wasi';

export default function wrapMotoko(compiler: Compiler, version: string) {
    const debug = require('debug')(version ? `motoko:${version}` : 'motoko');

    const invoke = (key: string, unwrap: boolean, args: any[]) => {
        if (!compiler) {
            throw new Error(
                'Please load a Motoko compiler before running this function',
            );
        }
        if (typeof compiler[key] !== 'function') {
            throw new Error(`Unknown compiler function: '${key}'`);
        }
        let result;
        try {
            result = compiler[key](...args);
        } catch (err) {
            if (err instanceof Error) {
                throw err;
            }
            throw new Error(
                `Unable to execute ${key}(${[...args]
                    .map((x) => typeof x)
                    .join(', ')}):\n${JSON.stringify(err)}`,
            );
        }
        if (!unwrap) {
            return result;
        }
        if (!result.code) {
            throw new Error(
                result.diagnostics
                    ? result.diagnostics
                          .map(({ message }: Diagnostic) => message)
                          .join('; ')
                    : '(no diagnostics)',
            );
        }
        return result.code;
    };

    const mo = {
        version,
        compiler,
        file(path: string) {
            return file(mo, path);
        },
        read(path: string): string {
            return invoke('readFile', false, [path]);
        },
        write(path: string, content: string = '') {
            if (typeof content !== 'string') {
                throw new Error('Non-string file content');
            }
            debug('+file', path);
            invoke('saveFile', false, [path, content]);
        },
        rename(path: string, newPath: string) {
            invoke('renameFile', false, [path, newPath]);
        },
        delete(path: string) {
            debug('-file', path);
            invoke('removeFile', false, [path]);
        },
        list(directory: string): string[] {
            return invoke('readDir', false, [directory]);
        },
        async fetchPackage(info: string | PackageInfo) {
            return fetchPackage(info);
        },
        async loadPackages(packages: Record<string, string | PackageInfo>) {
            return loadPackages(mo, packages);
        },
        addPackage(name: string, directory: string) {
            debug('+package', name, directory);
            invoke('addPackage', false, [name, directory]);
        },
        clearPackages() {
            debug('-packages');
            invoke('clearPackage', false, []);
        },
        setAliases(aliases: Record<string, string>) {
            debug('aliases', aliases);
            invoke('setActorAliases', false, [Object.entries(aliases)]);
        },
        setMetadata(values: string) {
            invoke('setPublicMetadata', false, [values]);
        },
        check(path: string): Diagnostic[] {
            const result = invoke('check', false, [path]);
            return result.diagnostics;
        },
        run(
            path: string,
            libPaths?: string[] | undefined,
        ): { stdout: string; stderr: string; result: number | string } {
            return invoke('run', false, [libPaths || [], path]);
        },
        candid(path: string): string {
            return invoke('candid', true, [path]);
        },
        wasm(path: string, mode: WasmMode) {
            if (!mode) {
                mode = 'ic';
            } else if (mode !== 'ic' && mode !== 'wasi') {
                throw new Error(`Invalid WASM format: ${mode}`);
            }
            return invoke('compileWasm', true, [mode, path]);
        },
        parseMotoko(content: string): object {
            return invoke('parseMotoko', true, [content]);
        },
        parseMotokoTypes(content: string): { ast: object; outputType: object } {
            return invoke('parseMotokoTypes', true, [content]);
        },
        parseCandid(content: string): object {
            return invoke('parseCandid', true, [content]);
        },
        resolveMain(directory: string = ''): string | undefined {
            return resolveMain(mo, directory);
        },
        resolveLib(directory: string = ''): string | undefined {
            return resolveLib(mo, directory);
        },
    };
    // @ts-ignore
    mo.default = mo;
    return mo;
}
