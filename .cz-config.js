module.exports = {
  // 提交类型配置
  types: [
    { value: 'feat', name: 'feat:     新功能' },
    { value: 'fix', name: 'fix:      修复bug' },
    { value: 'docs', name: 'docs:     文档更新' },
    { value: 'style', name: 'style:    代码格式调整' },
    { value: 'refactor', name: 'refactor: 代码重构' },
    { value: 'perf', name: 'perf:     性能优化' },
    { value: 'test', name: 'test:     测试相关' },
    { value: 'chore', name: 'chore:    构建过程或辅助工具的变动' },
    { value: 'revert', name: 'revert:   回滚' },
    { value: 'ci', name: 'ci:       CI配置相关' },
    { value: 'build', name: 'build:    构建相关' },
    { value: 'release', name: 'release:  发布版本' },
    { value: 'tag', name: 'tag:      版本标签' },
    { value: 'security', name: 'security: 安全相关' },
    { value: 'i18n', name: 'i18n:     国际化' },
    { value: 'design', name: 'design:   设计相关' },
    { value: 'debug', name: 'debug:    调试相关' },
    { value: 'responsive', name: 'responsive: 响应式设计' },
    { value: 'plugin', name: 'plugin:   插件相关' },
    { value: 'analytics', name: 'analytics: 分析相关' },
  ],

  // 作用域配置
  scopes: [
    { name: 'core' }, // 核心功能
    { name: 'ui' }, // 用户界面
    { name: 'docs' }, // 文档相关
    { name: 'test' }, // 测试相关
    { name: 'ci' }, // CI配置相关
    { name: 'api' },
    { name: 'config' },
    { name: 'deps' },
    { name: 'auth' },
    { name: 'db' },
    { name: 'security' },
    { name: 'i18n' },
    { name: 'performance' },
  ],

  // 是否使用预定义的提交信息
  usePreparedCommit: false, // to re-use commit from ./.git/COMMIT_EDITMSG

  // 是否允许自定义作用域
  allowCustomScopes: true,

  // 是否允许票号
  allowTicketNumber: false,
  isTicketNumberRequired: false,
  ticketNumberPrefix: 'TICKET-',
  ticketNumberRegExp: '\\d{1,5}',

  // 作用域重写
  scopeOverrides: {
    fix: [{ name: 'merge' }, { name: 'style' }, { name: 'e2eTest' }, { name: 'unitTest' }],
  },

  messages: {
    type: '选择你要提交的类型:',
    scope: '选择一个作用域 (可选):',
    customScope: '请输入自定义的作用域:',
    subject: '写一个简短的描述 (最多200个字符):\n',
    body: '提供更详细的描述 (可选). 使用 "|" 换行:\n',
    breaking: '列出任何破坏性变更 (可选):\n',
    footer: '列出任何关闭的issue (可选). 例如: #31, #34:\n',
    confirmCommit: '确认提交以上内容?',
  },

  // 允许破坏性变更的类型
  allowBreakingChanges: ['✨ feat', '🐛 fix'],

  // 跳过的问题
  // skipQuestions: ['body', 'footer'],

  // 主题长度限制
  subjectLimit: 200,

  // 换行符
  breaklineChar: '|', // 换行符
  askForBreakingChangeFirst: false, // 是否先询问破坏性变更
  appendBranchNameToCommitMessage: false, // 是否在提交消息中添加分支名称
  upperCaseSubject: false, // 是否将主题转换为大写
};
