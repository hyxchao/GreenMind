// app.js
App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-3gj6r99z08df5d49', // 替换为您的实际环境ID
      traceUser: true,
    })
  },
  globalData: {
    apiBaseUrl: 'https://www.eoc.beyondsoft.com/outbound/',
    // 警报阈值配置
    alarmConfig: {
      pagecheckInterval:1,       //页面主动刷新(分钟)
      temperature: 48,           // 温度报警阈值（°C）
      humidity: 60,              // 湿度报警阈值（%）
      enablePush: true,          // 是否启用推送
      maxAlertsPerDay: 5,        // 每天最多推送次数
      cooldownMinutes: 30,       // 推送冷却时间（分钟）
      // 新增：定时检查配置
      checkInterval: 30,         // 检查间隔（分钟）
      dataFreshness: 10          // 数据新鲜度（分钟）
    },
    // 订阅消息模板ID
    templateId: 'tAeYgyuyP4ybJbSFIYDHHkJAh63Kfq6814NhNRsmEeI'
  }
})