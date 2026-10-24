export function generateExtensionManifest(version: string = '1.0.0'): Record<string, any> {
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
          title: 'Show System Status',
          category: 'Agent Guard',
        },
        {
          command: 'agentGuard.toggleKeepAwake',
          title: 'Toggle OS Sleep Prevention (Keep-Awake)',
          category: 'Agent Guard',
          icon: '$(flame)',
        },
        {
          command: 'agentGuard.toggleAutoAccept',
          title: 'Toggle Auto-Accept Turbo Mode',
          category: 'Agent Guard',
          icon: '$(zap)',
        },
        {
          command: 'agentGuard.switchAccount',
          title: 'Switch Antigravity Account',
          category: 'Agent Guard',
          icon: '$(sync)',
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
            name: 'Agent Guard Dashboard',
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
