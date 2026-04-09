// Translation keys and translations for English and Chinese

export type Language = 'en' | 'zh';

type TranslationValue =
  string
  | ((arg?: any) => string)
  | ((arg?: any, arg2?: any) => string)
  | ((arg?: any, arg2?: any, arg3?: any) => string);

export const translations = {
  en: {
    // Common
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    pending: 'Pending',
    logout: 'Logout',
    login: 'Login',
    notLoggedIn: 'Not logged in',
    refresh: 'Refresh',

    // App title and description
    appTitle: 'Outlook Junk Rescue',
    appDescription: 'A tool to help recover emails mistakenly marked as junk in Outlook.',
    appTagline: 'Rescue mysterious Outlook junk mail filters',

    // Login page
    loginLabel: 'Please enter the panel password.',
    loggingIn: 'Logging in...',
    networkErrorLogin: 'Network error while logging in.',
    loginFailed: 'Login failed.',

    // Not logged in page
    notAuthorizedTitle: 'Not logged in',
    notAuthorizedDescription:
      'Please go to the login page first, then bind Outlook and manage subscriptions.',
    notAuthorizedBadge: 'Not logged in',

    // Panel logout button
    logoutPending: 'Logging out...',
    panelLogout: 'Panel Logout',
    logoutFailed: 'Logout failed. Please try again later.',
    networkErrorLogout: 'Network error. Unable to logout at this time.',

    // Status section
    statusTitle: 'Running Status',
    statusLoggedIn: 'Logged in',
    outlookBinding: 'Outlook Binding',
    outlookBound: 'Bound',
    outlookNotBound: 'Not bound',
    subscriptionStatus: 'Subscription Status',
    subscribed: 'Subscribed',
    subscriptionCount: (count: number) => `Subscribed (${count})`,
    notSubscribed: 'Not subscribed',
    tokenExpiration: 'Token expiration time',
    userInfoFailed: 'User info failed to load',

    // Operation panel
    operationPanel: 'Operation Panel',
    currentSubscriptions: 'Current subscriptions',
    recentSubscription: 'Recent subscription',

    // Outlook account section
    outlookAccount: 'Outlook Account',
    displayName: 'Display name',
    email: 'Email',
    loginName: 'Login name',
    bindingStatus: 'Binding status',
    boundOutlook: 'Bound to Outlook',
    notBoundOutlook: 'Not yet bound to Outlook',
    bindingTime: 'Binding time',

    // Subscriptions list
    subscriptionsList: 'Subscriptions list',
    noSubscriptions: 'Currently no subscriptions. You can create one after binding Outlook.',
    expiration: 'Expiration',
    created: 'Created',
    renewed: 'Renewed',

    // Recent activity
    activity: 'Activity',
    allLogs: 'All logs',
    movedEmails: 'Moved emails',
    noLogs: 'No logs yet.',
    noRecentMails: 'No recently moved junk emails.',
    loadingLogsFailed: 'Failed to load logs',
    invalidLogsFormat: 'Invalid logs response format',
    refreshFailed: 'Refresh failed. Please try again later.',
    refreshing: 'Refreshing...',

    // Dashboard actions
    bindOutlook: 'Bind Outlook',
    createSubscription: 'Create subscription',
    disconnectOutlook: 'Unsubscribe and disconnect',
    renewAllSubscriptions: 'Renew all subscriptions',
    reconcileTrash: 'Manually organize trash',

    // Action messages
    createSubscriptionSuccess: (id: string) => `Create subscription successful: ${id}`,
    disconnectSuccessFormat: (deleted: number, failed: number) =>
      `Disconnected Outlook, deleted ${deleted} subscriptions, ${failed} failed.`,
    renewSuccessFormat: (success: number, failed: number) =>
      `Renew complete: ${success} successful, ${failed} failed.`,
    reconcileSuccessFormat: (count: number) => `Organized trash, moved ${count} emails.`,
    actionCompleteFormat: (action: string) => `${action} done`,
    actionFailedFormat: (action: string) => `${action} failed`,
    actionExecutingFormat: (action: string) => `Executing: ${action}`,
    networkErrorActionFormat: (action: string) => `${action} failed due to network issue.`,
    trashOrganizingComplete: 'Trash organizing complete.',
    renewRequestSubmitted: 'Submitted renewal request for all subscriptions.',
    createSubscriptionComplete: 'Create subscription complete.',
    disconnectedOutlook: 'Disconnected Outlook.',

    // OAuth notices
    outlookBoundSuccess: 'Outlook bound successfully',
    outlookBoundSuccessDesc: 'Microsoft account bound successfully. Create a subscription to automatically move junk emails.',
    invalidCallbackState: 'Invalid callback state',
    invalidCallbackStateDesc: 'This binding callback was rejected. Please click "Bind Outlook" again.',
    missingAuthorizationCode: 'Missing authorization code in callback',
    missingAuthorizationCodeDesc: 'The binding process did not return a code. Please rebind Outlook.',
    outlookBindingFailed: 'Outlook binding failed',
    outlookBindingFailedDesc: 'Binding callback processing failed. Please try again later.',

    // Database error
    databaseOfflineTitle: 'Database Service Unavailable',
    databaseOfflineDescription: 'Unable to connect to the database service. Please check your database configuration.',

    // General error
    generalErrorTitle: 'Something Went Wrong',
    generalErrorDescription: 'An unexpected error occurred. Please try refreshing the page or contact support.',

    // Language switcher
    language: 'Language',
    english: 'English',
    chinese: 'Chinese (中文)',
  },
  zh: {
    // 通用
    success: '成功',
    error: '错误',
    warning: '警告',
    pending: '进行中',
    logout: '登出',
    login: '登录',
    notLoggedIn: '未登录',
    refresh: '刷新',

    // 应用标题和描述
    appTitle: 'Outlook Junk Rescue',
    appDescription: '一个帮助恢复误标记为 Outlook 垃圾邮件的工具。',
    appTagline: '拯救神秘的 Outlook 垃圾邮件过滤器',

    // 登录页面
    loginLabel: '请输入面板密码。',
    loggingIn: '登录中...',
    networkErrorLogin: '网络异常，暂时无法登录。',
    loginFailed: '登录失败。',

    // 未登录页面
    notAuthorizedTitle: '当前未登录',
    notAuthorizedDescription: '请先进入登录页，然后再绑定 Outlook 和管理订阅。',
    notAuthorizedBadge: '未登录',

    // 面板登出按钮
    logoutPending: '登出中...',
    panelLogout: '面板登出',
    logoutFailed: '登出失败，请稍后重试。',
    networkErrorLogout: '网络异常，暂时无法登出。',

    // 状态部分
    statusTitle: '运行状态',
    statusLoggedIn: '已登录',
    outlookBinding: 'Outlook 绑定',
    outlookBound: '已绑定',
    outlookNotBound: '未绑定',
    subscriptionStatus: '订阅状态',
    subscribed: '已订阅',
    subscriptionCount: (count: number) => `已订阅（${count}）`,
    notSubscribed: '未订阅',
    tokenExpiration: 'Token 到期时间',
    userInfoFailed: '用户信息读取失败',

    // 操作面板
    operationPanel: '操作面板',
    currentSubscriptions: '当前订阅数',
    recentSubscription: '最近订阅',

    // Outlook 账户部分
    outlookAccount: 'Outlook 账户',
    displayName: '显示名称',
    email: '邮箱',
    loginName: '登录名',
    bindingStatus: '绑定状态',
    boundOutlook: '已绑定 Outlook',
    notBoundOutlook: '尚未绑定 Outlook',
    bindingTime: '绑定时间',

    // 订阅列表
    subscriptionsList: '订阅列表',
    noSubscriptions: '当前还没有订阅，绑定 Outlook 后可以一键创建订阅。',
    expiration: '到期',
    created: '创建',
    renewed: '续订',

    // 最近活动
    activity: '活动',
    allLogs: '所有日志',
    movedEmails: '已移动邮件',
    noLogs: '暂无日志。',
    noRecentMails: '暂无最近移动的垃圾邮件。',
    loadingLogsFailed: '加载日志失败',
    invalidLogsFormat: '日志响应格式无效',
    refreshFailed: '刷新失败，请稍后再试。',
    refreshing: '刷新中...',

    // 仪表板操作
    bindOutlook: '绑定 Outlook',
    createSubscription: '创建订阅',
    disconnectOutlook: '取消订阅并解绑',
    renewAllSubscriptions: '续订全部订阅',
    reconcileTrash: '手动整理垃圾箱',

    // 操作消息
    createSubscriptionSuccess: (id: string) => `创建订阅成功：${id}`,
    disconnectSuccessFormat: (deleted: number, failed: number) =>
      `已解绑 Outlook，删除订阅 ${deleted} 个，失败 ${failed} 个。`,
    renewSuccessFormat: (success: number, failed: number) =>
      `续订完成：成功 ${success} 个，失败 ${failed} 个。`,
    reconcileSuccessFormat: (count: number) => `已整理垃圾箱，移动 ${count} 封邮件。`,
    actionCompleteFormat: (action: string) => `${action} 完成`,
    actionFailedFormat: (action: string) => `${action} 失败`,
    actionExecutingFormat: (action: string) => `执行中：${action}`,
    networkErrorActionFormat: (action: string) => `${action} 因网络原因失败。`,
    trashOrganizingComplete: '垃圾箱整理完成。',
    renewRequestSubmitted: '已提交全部订阅的续订请求。',
    createSubscriptionComplete: '创建订阅完成。',
    disconnectedOutlook: '已解绑 Outlook。',

    // OAuth 通知
    outlookBoundSuccess: 'Outlook 已绑定',
    outlookBoundSuccessDesc: 'Microsoft 账户绑定成功，创建订阅以自动移动垃圾邮件。',
    invalidCallbackState: '回调状态无效',
    invalidCallbackStateDesc: '已拒绝这次绑定回调，请重新点击"绑定 Outlook"。',
    missingAuthorizationCode: '回调缺少授权码',
    missingAuthorizationCodeDesc: '绑定流程未返回 code，请重新绑定 Outlook。',
    outlookBindingFailed: 'Outlook 绑定失败',
    outlookBindingFailedDesc: '绑定回调处理失败，请稍后再试。',

    // 数据库错误
    databaseOfflineTitle: '数据库服务不可用',
    databaseOfflineDescription: '无法连接至数据库服务，请检查数据库配置。',

    // 通用错误
    generalErrorTitle: '出错了',
    generalErrorDescription: '发生了意外错误，请尝试刷新页面或联系支持。',

    // 语言切换
    language: '语言',
    english: 'English',
    chinese: '中文',
  },
} as const satisfies { en: Record<string, TranslationValue>; zh: Record<string, TranslationValue> };

export function getTranslation(language: Language, key: keyof typeof translations.en): TranslationValue {
  return (translations[language] as Record<string, TranslationValue>)[key];
}

export function t(language: Language, key: keyof typeof translations.en, ...args: any[]): string {
  const translation = getTranslation(language, key);
  if (typeof translation === 'function') {
    return translation(...args);
  }
  return typeof translation === 'string' ? translation : '';
}

// Detect preferred language from browser
export function detectPreferredLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';

  const browserLanguage = navigator.language.toLowerCase();

  // Check if browser language preference is Chinese
  if (browserLanguage.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}
