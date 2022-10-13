import { RenderData } from './index.js';
export declare class Renderer {
    verbose: boolean;
    constructor(verbose?: boolean, clear?: boolean);
    static write(s?: string, nlCount?: number, nlChar?: string): void;
    suiteName({ suiteName }: Partial<RenderData>): void;
    result({ type, label, error, duration }: Partial<RenderData>): void;
    stats(stats: any, prefix?: string, output?: boolean): string;
    runAllTitle({ whitelist }: {
        whitelist: any;
    }): void;
    runAllSuiteError({ error, name }: {
        error: any;
        name: any;
    }): void;
    runAllStats({ stats, invalid }: {
        stats: any;
        invalid: any;
    }): void;
    runAllErrorsSummary({ errorDetails, invalid }: {
        errorDetails: any;
        invalid: any;
    }): void;
    log(type: any, s: any): void;
    static sanitizeError(e: Error): string;
    static sanitizeStack(stack: any): string;
}
