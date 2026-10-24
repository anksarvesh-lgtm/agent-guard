import { z } from 'zod';
export declare function truncateText(text: string, maxLength: number): string;
export declare const StepInputSchema: z.ZodObject<{
    title: z.ZodEffects<z.ZodString, string, string>;
    depends_on: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    depends_on: string[];
}, {
    title: string;
    depends_on?: string[] | undefined;
}>;
export declare const TaskStartSchema: z.ZodObject<{
    goal: z.ZodEffects<z.ZodString, string, string>;
    steps: z.ZodArray<z.ZodObject<{
        title: z.ZodEffects<z.ZodString, string, string>;
        depends_on: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        depends_on: string[];
    }, {
        title: string;
        depends_on?: string[] | undefined;
    }>, "many">;
    max_tries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    replace: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    replace: boolean;
    goal: string;
    steps: {
        title: string;
        depends_on: string[];
    }[];
    max_tries: number;
    project_path?: string | undefined;
}, {
    goal: string;
    steps: {
        title: string;
        depends_on?: string[] | undefined;
    }[];
    replace?: boolean | undefined;
    max_tries?: number | undefined;
    project_path?: string | undefined;
}>;
export declare const TaskCheckpointSchema: z.ZodObject<{
    step_id: z.ZodString;
    status: z.ZodEnum<["in_progress", "done", "failed"]>;
    note: z.ZodEffects<z.ZodString, string, string>;
    error: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    add_steps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodEffects<z.ZodString, string, string>;
        depends_on: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        depends_on: string[];
    }, {
        title: string;
        depends_on?: string[] | undefined;
    }>, "many">>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "in_progress" | "done" | "failed";
    step_id: string;
    note: string;
    error?: string | undefined;
    project_path?: string | undefined;
    add_steps?: {
        title: string;
        depends_on: string[];
    }[] | undefined;
}, {
    status: "in_progress" | "done" | "failed";
    step_id: string;
    note: string;
    error?: string | undefined;
    project_path?: string | undefined;
    add_steps?: {
        title: string;
        depends_on?: string[] | undefined;
    }[] | undefined;
}>;
export declare const TaskStatusSchema: z.ZodObject<{
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    project_path?: string | undefined;
}, {
    project_path?: string | undefined;
}>;
export declare const KeepAwakeSchema: z.ZodObject<{
    action: z.ZodEnum<["hold", "release", "status"]>;
    minutes: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "status" | "hold" | "release";
    project_path?: string | undefined;
    minutes?: number | undefined;
    reason?: string | undefined;
}, {
    action: "status" | "hold" | "release";
    project_path?: string | undefined;
    minutes?: number | undefined;
    reason?: string | undefined;
}>;
export declare const RepoBriefSchema: z.ZodObject<{
    refresh: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refresh: boolean;
    project_path?: string | undefined;
}, {
    project_path?: string | undefined;
    refresh?: boolean | undefined;
}>;
export declare const TokenCounterSchema: z.ZodObject<{
    model: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    text: z.ZodOptional<z.ZodString>;
    file_path: z.ZodOptional<z.ZodString>;
    transcript_path: z.ZodOptional<z.ZodString>;
    compare_all: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    model: string;
    compare_all: boolean;
    project_path?: string | undefined;
    text?: string | undefined;
    file_path?: string | undefined;
    transcript_path?: string | undefined;
}, {
    project_path?: string | undefined;
    model?: string | undefined;
    text?: string | undefined;
    file_path?: string | undefined;
    transcript_path?: string | undefined;
    compare_all?: boolean | undefined;
}>;
export declare const AccountSwitcherSchema: z.ZodObject<{
    action: z.ZodEnum<["status", "switch", "list", "add", "snapshot", "remove", "auto_rotate", "configure", "proxy", "failover_proxy"]>;
    account_id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    provider: z.ZodDefault<z.ZodOptional<z.ZodEnum<["antigravity", "gemini", "claude", "openai", "custom"]>>>;
    token_content: z.ZodOptional<z.ZodString>;
    token_source_file: z.ZodOptional<z.ZodString>;
    api_key: z.ZodOptional<z.ZodString>;
    threshold_percent: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    reason: z.ZodOptional<z.ZodString>;
    project_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "status" | "switch" | "list" | "add" | "snapshot" | "remove" | "auto_rotate" | "configure" | "proxy" | "failover_proxy";
    provider: "antigravity" | "claude" | "custom" | "gemini" | "openai";
    threshold_percent: number;
    project_path?: string | undefined;
    reason?: string | undefined;
    account_id?: string | undefined;
    name?: string | undefined;
    token_content?: string | undefined;
    token_source_file?: string | undefined;
    api_key?: string | undefined;
    enabled?: boolean | undefined;
}, {
    action: "status" | "switch" | "list" | "add" | "snapshot" | "remove" | "auto_rotate" | "configure" | "proxy" | "failover_proxy";
    project_path?: string | undefined;
    reason?: string | undefined;
    account_id?: string | undefined;
    name?: string | undefined;
    provider?: "antigravity" | "claude" | "custom" | "gemini" | "openai" | undefined;
    token_content?: string | undefined;
    token_source_file?: string | undefined;
    api_key?: string | undefined;
    threshold_percent?: number | undefined;
    enabled?: boolean | undefined;
}>;
/**
 * Formats Zod errors into a clean, human-readable BAD_INPUT error string
 */
export declare function formatZodError(error: z.ZodError): string;
//# sourceMappingURL=schema.d.ts.map