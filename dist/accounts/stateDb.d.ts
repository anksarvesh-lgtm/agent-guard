export interface StateDbCredentials {
    oauthToken?: string;
    userStatus?: string;
    profileUrl?: string;
}
export declare function getStateDbPath(customHome?: string): string | null;
/**
 * Reads Antigravity IDE credential entries from state.vscdb.
 */
export declare function readStateDbCredentials(dbPath: string): StateDbCredentials;
/**
 * Writes Antigravity IDE credential entries into state.vscdb atomically.
 */
export declare function writeStateDbCredentials(dbPath: string, creds: StateDbCredentials): boolean;
//# sourceMappingURL=stateDb.d.ts.map