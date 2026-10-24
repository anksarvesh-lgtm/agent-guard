export function generateExtensionManifest(version = '1.0.0') {
    return {
        name: 'agent-guard',
        displayName: 'Agent Guard',
        description: 'Universal AI Agent Supervisor: Sleep Prevention, Auto-Accept Turbo, Live Token Counter & Seamless Account Switcher at <= 1% quota for Antigravity IDE, VS Code, Cursor, and Windsurf.',
        version,
        publisher: 'sarvesh',
        author: {
            name: 'Sarvesh',
            url: 'https://github.com/anksarvesh-lgtm/agent-guard',
        },
        license: 'Apache-2.0',
        homepage: 'https://github.com/anksarvesh-lgtm/agent-guard',
        repository: {
            type: 'git',
            url: 'https://github.com/anksarvesh-lgtm/agent-guard.git',
        },
        bugs: {
            url: 'https://github.com/anksarvesh-lgtm/agent-guard/issues',
        },
        icon: 'icon.png',
        engines: {
            vscode: '^1.75.0',
        },
        categories: [
            'Machine Learning',
            'Other',
            'Programming Languages',
            'Linters',
        ],
        keywords: [
            'antigravity',
            'agent-guard',
            'account-switcher',
            'keep-awake',
            'auto-accept',
            'token-counter',
            'supervisor',
        ],
        activationEvents: [
            'onStartupFinished',
        ],
        main: './extension.js',
        contributes: {
            commands: [
                {
                    command: 'agentGuard.openDashboard',
                    title: 'Open Agent Guard Dashboard',
                    category: 'Agent Guard',
                    icon: '$(shield)',
                },
                {
                    command: 'agentGuard.showStatus',
                    title: 'Show System Status Menu',
                    category: 'Agent Guard',
                    icon: '$(info)',
                },
                {
                    command: 'agentGuard.toggleKeepAwake',
                    title: 'Toggle OS Sleep Prevention (Keep-Awake)',
                    category: 'Agent Guard',
                    icon: '$(flame)',
                },
                {
                    command: 'agentGuard.acquireAwakeLease',
                    title: 'Acquire Sleep Prevention Lease (Select Duration)',
                    category: 'Agent Guard',
                    icon: '$(clock)',
                },
                {
                    command: 'agentGuard.releaseAwakeLease',
                    title: 'Release Sleep Prevention Lease',
                    category: 'Agent Guard',
                    icon: '$(close)',
                },
                {
                    command: 'agentGuard.toggleAutoAccept',
                    title: 'Toggle Auto-Accept Turbo Mode',
                    category: 'Agent Guard',
                    icon: '$(zap)',
                },
                {
                    command: 'agentGuard.manageGrants',
                    title: 'Manage Auto-Approved Tool Grants',
                    category: 'Agent Guard',
                    icon: '$(checklist)',
                },
                {
                    command: 'agentGuard.switchAccount',
                    title: 'Switch Antigravity Account',
                    category: 'Agent Guard',
                    icon: '$(sync)',
                },
                {
                    command: 'agentGuard.addAccount',
                    title: 'Add Account to Pool',
                    category: 'Agent Guard',
                    icon: '$(add)',
                },
                {
                    command: 'agentGuard.removeAccount',
                    title: 'Remove Account from Pool',
                    category: 'Agent Guard',
                    icon: '$(trash)',
                },
                {
                    command: 'agentGuard.toggleAutoSwitch',
                    title: 'Toggle 1% Quota Auto-Switch Tripwire',
                    category: 'Agent Guard',
                    icon: '$(pulse)',
                },
                {
                    command: 'agentGuard.setTripwireThreshold',
                    title: 'Configure Auto-Switch Threshold %',
                    category: 'Agent Guard',
                    icon: '$(settings)',
                },
                {
                    command: 'agentGuard.testTripwire',
                    title: 'Simulate 1% Quota Rotation Tripwire',
                    category: 'Agent Guard',
                    icon: '$(beaker)',
                },
                {
                    command: 'agentGuard.countTokensCurrentFile',
                    title: 'Count Tokens in Active File / Selection',
                    category: 'Agent Guard',
                    icon: '$(symbol-number)',
                },
                {
                    command: 'agentGuard.switchTokenModel',
                    title: 'Select Active Model for Token Budgeting',
                    category: 'Agent Guard',
                    icon: '$(server-process)',
                },
                {
                    command: 'agentGuard.resetTokenSession',
                    title: 'Reset Token Counter Budget Session',
                    category: 'Agent Guard',
                    icon: '$(clear-all)',
                },
                {
                    command: 'agentGuard.browseSkills',
                    title: 'Browse Awesome Skills Catalog',
                    category: 'Agent Guard',
                    icon: '$(book)',
                },
                {
                    command: 'agentGuard.generateProjectMap',
                    title: 'Generate Project Map & Architecture Chart',
                    category: 'Agent Guard',
                    icon: '$(map)',
                },
                {
                    command: 'agentGuard.runDoctor',
                    title: 'Run Agent Guard Readiness Doctor',
                    category: 'Agent Guard',
                    icon: '$(heart)',
                },
                {
                    command: 'agentGuard.checkForUpdates',
                    title: 'Check for Agent Guard Updates',
                    category: 'Agent Guard',
                    icon: '$(cloud-download)',
                },
                {
                    command: 'agentGuard.performUpdate',
                    title: 'Update Agent Guard to Latest Release',
                    category: 'Agent Guard',
                    icon: '$(cloud-download)',
                },
                {
                    command: 'agentGuard.toggleStartupUpdate',
                    title: 'Toggle Auto Check Update and Install on Startup',
                    category: 'Agent Guard',
                    icon: '$(sync)',
                },
                {
                    command: 'agentGuard.snapshotAccount',
                    title: 'Snapshot Active Session Credentials into Pool',
                    category: 'Agent Guard',
                    icon: '$(camera)',
                },
                {
                    command: 'agentGuard.importStockAuth',
                    title: 'Save & Import Stock Auth Session Cache',
                    category: 'Agent Guard',
                    icon: '$(save)',
                },
                {
                    command: 'agentGuard.refresh',
                    title: 'Refresh Status',
                    category: 'Agent Guard',
                    icon: '$(refresh)',
                },
            ],
            viewsContainers: {
                activitybar: [
                    {
                        id: 'agentGuard',
                        title: 'Agent Guard',
                        icon: 'icon.svg',
                    },
                ],
            },
            views: {
                agentGuard: [
                    {
                        type: 'webview',
                        id: 'agentGuard.dashboardView',
                        name: 'Agent Guard Supervisor',
                    },
                ],
            },
            configuration: {
                title: 'Agent Guard',
                properties: {
                    'agentGuard.statusBar.showTokenPercent': {
                        type: 'boolean',
                        default: true,
                        description: 'Show live estimated quota remaining in the status bar.',
                    },
                    'agentGuard.statusBar.showActiveAccount': {
                        type: 'boolean',
                        default: true,
                        description: 'Show current active Antigravity account name in the status bar.',
                    },
                    'agentGuard.autoSwitchOnLowQuota': {
                        type: 'boolean',
                        default: true,
                        description: 'Automatically rotate accounts when quota drops to <= 1.0%.',
                    },
                    'agentGuard.lowQuotaThresholdPercent': {
                        type: 'number',
                        default: 1.0,
                        description: 'Quota percentage threshold that triggers automatic non-disruptive rotation.',
                    },
                    'agentGuard.defaultAwakeMinutes': {
                        type: 'number',
                        default: 120,
                        description: 'Default OS sleep prevention duration in minutes.',
                    },
                    'agentGuard.defaultModel': {
                        type: 'string',
                        default: 'gemini-2.5-flash',
                        enum: [
                            'gemini-2.5-flash',
                            'gemini-2.5-pro',
                            'claude-3-7-sonnet',
                            'claude-3-5-sonnet',
                            'claude-3-opus',
                            'gpt-4o',
                            'gpt-4o-mini',
                            'o3-mini',
                        ],
                        description: 'Default model for token counter and quota estimation.',
                    },
                    'agentGuard.pollIntervalSeconds': {
                        type: 'number',
                        default: 2,
                        minimum: 1,
                        maximum: 60,
                        description: 'Interval in seconds between background status checks.',
                    },
                },
            },
        },
        __metadata: {
            installedTimestamp: Date.now(),
            targetPlatform: 'universal',
        },
    };
}
//# sourceMappingURL=manifest.js.map