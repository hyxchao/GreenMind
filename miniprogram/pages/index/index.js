// pages/index/index.js
const app = getApp()

Page({
  data: {
    // 首次使用标志
    showWelcomeScreen: true,
    isPushEnabled: false, // 推送开关状态
    // 设备信息相关
    deviceName: '',
    deviceId: '',
    tempDeviceName: '',
    tempDeviceId: '',
    showSetting: false,
    
    // 警报相关
    showAlarmPanel: false,
    alarmData: {
      temperature: 0,
      humidity: 0,
      timestamp: '',
      message: ''
    },
    alertHistory: [],
    lastAlertTime: null,
    todayAlertCount: 0,
    
    // 状态相关
    statusClass: 'normal',
    statusText: '正常',
    updateTime: '',
    
    // 第一条数据
    firstData: {
      temperature: '--',
      humidity: '--',
      timestamp: '暂无数据',
      tempClass: 'normal',
      humidityClass: 'normal'
    },
    
    // 统计数据
    stats: {
      temperature: { avg: '--', max: '--', min: '--' },
      humidity: { avg: '--', max: '--', min: '--' }
    },
    
    // 最新数据列表
    latestData: [],
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.checkDeviceInfo()
    this.loadAlertHistory()
    this.startScheduledCheck()  // 启动定时检查
    // 从本地存储加载推送设置
    this.loadPushSettings();
  },

  onShow() {
    this.checkDeviceInfo()
  },

  onUnload() {
    if (this.autoRefresh) clearInterval(this.autoRefresh)
    if (this.scheduledCheckTimer) clearInterval(this.scheduledCheckTimer)
  },

  // 加载推送设置
  loadPushSettings() {
    try {
      const pushSettings = wx.getStorageSync('push_settings') || {
        enabled: false,
        temperatureThreshold: 60,
        humidityThreshold: 50
      };
      
      this.setData({
        isPushEnabled: pushSettings.enabled,
        temperatureThreshold: pushSettings.temperatureThreshold,
        humidityThreshold: pushSettings.humidityThreshold
      });
    } catch (error) {
      console.error('加载推送设置失败:', error);
    }
  },
  // 切换推送开关
  togglePushSwitch(e) {
    const isEnabled = e.detail.value;
    
    this.setData({
      isPushEnabled: isEnabled
    });
    
    // 保存设置到本地存储
    this.savePushSettings(isEnabled);
    
    // 根据开关状态执行不同操作
    if (isEnabled) {
      this.enablePushNotifications();
    } else {
      this.disablePushNotifications();
    }
    
    // 显示状态提示
    wx.showToast({
      title: isEnabled ? '已开启告警推送' : '已关闭告警推送',
      icon: 'success',
      duration: 1500
    });
  },
// 开启推送通知
enablePushNotifications() {
  
 // 1. 检查是否已配置模板ID
  if (!app.globalData.templateId) {
    wx.showModal({
      title: '提示',
      content: '推送功能暂未配置，请联系管理员',
      showCancel: false
    });
    this.setData({ isPushEnabled: false });
    this.savePushSettings(false);
    return;
  }
 // 2. 请求用户授权订阅消息 (此调用由用户点击switch触发，符合规范)
  wx.requestSubscribeMessage({
    tmplIds: [app.globalData.templateId],
    success: (res) => {
      console.log('订阅授权结果:', res);
      
      if (res[app.globalData.templateId] === 'accept') {
        console.log('用户已同意订阅');
        
        // 开启定时检查
        this.startScheduledCheck();
        
        // 保存订阅状态
        wx.setStorageSync('has_subscribed', true);
        wx.setStorageSync('subscribe_template_id', app.globalData.templateId); // 保存当前模板ID

      } else if (res[app.globalData.templateId] === 'reject') {
        console.log('用户拒绝订阅');
        
        // 用户拒绝，关闭开关
        this.setData({ isPushEnabled: false });
        this.savePushSettings(false);
        wx.removeStorageSync('has_subscribed');

        wx.showModal({
          title: '提示',
          content: '您已拒绝订阅消息，无法接收告警通知。如需开启，请在微信设置中开启订阅消息权限。',
          showCancel: false
        });
      }
    },
    fail: (err) => {
      console.error('订阅授权失败:', err);
      
      // 授权失败，关闭开关
      this.setData({ isPushEnabled: false });
      this.savePushSettings(false);
      wx.removeStorageSync('has_subscribed');
      
      wx.showToast({
        title: '授权失败',
        icon: 'none',
        duration: 2000
      });
    }
  });
},
 // 关闭推送通知
 disablePushNotifications() {
  // 停止定时检查
  if (this.scheduledCheckTimer) {
    clearInterval(this.scheduledCheckTimer);
    this.scheduledCheckTimer = null;
    console.log('已停止定时检查');
  }
  
  // 清除订阅状态
  wx.removeStorageSync('has_subscribed');
  
  // 显示关闭提示
  wx.showToast({
    title: '已关闭告警推送',
    icon: 'success',
    duration: 1500
  });
},
 // 保存推送设置
 savePushSettings(enabled) {
  try {
    const pushSettings = {
      enabled: enabled,
      temperatureThreshold: this.data.temperatureThreshold || 60,
      humidityThreshold: this.data.humidityThreshold || 50,
      lastUpdate: new Date().toISOString()
    };
    
    wx.setStorageSync('push_settings', pushSettings);
    console.log('推送设置已保存:', pushSettings);
  } catch (error) {
    console.error('保存推送设置失败:', error);
  }
},
  // ==================== 设备信息管理 ====================
  checkDeviceInfo() {
    try {
      const deviceInfo = wx.getStorageSync('sensor_device_info')
      if (deviceInfo && deviceInfo.deviceId && deviceInfo.deviceName) {
        this.setData({
          showWelcomeScreen: false,
          deviceName: deviceInfo.deviceName,
          deviceId: deviceInfo.deviceId
        })
        
        this.loadAllData()
        const pagecheckInterval = app.globalData.alarmConfig.pagecheckInterval
        if (!this.autoRefresh) {
          this.autoRefresh = setInterval(() => {
            this.loadAllData()
          }, pagecheckInterval * 60 * 1000)
        }
      } else {
        this.setData({ showWelcomeScreen: true })
      }
    } catch (error) {
      console.error('检查设备信息失败:', error)
      this.setData({ showWelcomeScreen: true })
    }
  },

  onDeviceNameInput(e) {
    this.setData({ tempDeviceName: e.detail.value.trim() })
  },

  onDeviceIdInput(e) {
    this.setData({ tempDeviceId: e.detail.value.trim() })
  },

  saveDeviceInfoAndEnter() {
    const deviceName = this.data.tempDeviceName
    const deviceId = this.data.tempDeviceId
    
    if (!deviceName) {
      wx.showToast({ title: '请输入设备名称', icon: 'none' })
      return
    }
    
    if (!deviceId) {
      wx.showToast({ title: '请输入设备ID', icon: 'none' })
      return
    }
    
    try {
      const deviceInfo = {
        deviceName: deviceName,
        deviceId: deviceId,
        createdAt: new Date().toISOString()
      }
      
      wx.setStorageSync('sensor_device_info', deviceInfo)
      
      this.setData({
        deviceName: deviceName,
        deviceId: deviceId,
        showWelcomeScreen: false
      })
      
      wx.showToast({ title: '设备信息设置成功', icon: 'success' })
      this.loadAllData()
      
      this.autoRefresh = setInterval(() => {
        this.loadAllData()
      }, 30000)
      
    } catch (error) {
      console.error('保存设备信息失败:', error)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  toggleSetting() {
    this.setData({
      showSetting: !this.data.showSetting,
      tempDeviceName: this.data.deviceName,
      tempDeviceId: this.data.deviceId
    })
  },

  saveDeviceInfo() {
    const deviceName = this.data.tempDeviceName
    const deviceId = this.data.tempDeviceId
    
    if (!deviceName || !deviceId) {
      wx.showToast({ title: '设备信息和ID不能为空', icon: 'none' })
      return
    }
    
    try {
      const deviceInfo = {
        deviceName: deviceName,
        deviceId: deviceId,
        updatedAt: new Date().toISOString()
      }
      
      wx.setStorageSync('sensor_device_info', deviceInfo)
      
      this.setData({
        deviceName: deviceName,
        deviceId: deviceId,
        showSetting: false
      })
      
      wx.showToast({ title: '设备信息已更新', icon: 'success' })
      this.loadAllData()
      
    } catch (error) {
      console.error('保存设备信息失败:', error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // ==================== 定时检查功能 ====================
  startScheduledCheck() {
    const checkInterval = app.globalData.alarmConfig.checkInterval
    console.log(`启动定时检查：每${checkInterval}分钟检查一次`)
    
    this.performScheduledCheck()
    
    this.scheduledCheckTimer = setInterval(() => {
      this.performScheduledCheck()
    }, checkInterval * 60 * 1000)
  },

  async performScheduledCheck() {
    if (!this.data.deviceId) {
      console.log('设备ID未设置，跳过定时检查')
      return
    }
    // 检查推送开关是否开启
    if (!this.data.isPushEnabled) {
      console.log('推送开关已关闭，跳过定时检查');
      return;
    }
    if (!app.globalData.alarmConfig.enablePush) {
      console.log('推送功能已禁用，跳过定时检查')
      return
    }
    
    console.log('执行定时检查...')
    
    try {
      const latestData = await this.fetchLatestData()
      if (latestData) {
        this.checkAndTriggerAlert(latestData)
      }
    } catch (error) {
      console.error('定时检查失败:', error)
    }
  },

  async fetchLatestData() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/wkapi/latest`,
        data: { device_id: this.data.deviceId, limit: 1 },
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200 && (res.data.code === 999 || res.data.success === true)) {
            const data = res.data.data || []
            resolve(data.length > 0 ? data[0] : null)
          } else {
            reject(new Error('API返回格式错误'))
          }
        },
        fail: reject
      })
    })
  },

  checkAndTriggerAlert(dataItem) {
    if (!dataItem) return
    
    const temp = dataItem.temperature ? parseFloat(dataItem.temperature) : 0
    const humidity = dataItem.humidity ? parseFloat(dataItem.humidity) : 0
    const dataTimestamp = dataItem.timestamp
    const dataFreshness = app.globalData.alarmConfig.dataFreshness
    
    const isDataFresh = this.checkDataFreshness(dataTimestamp, dataFreshness)
    if (!isDataFresh) {
      console.log('数据不新鲜，跳过检查')
      return
    }
    
    const isExceedsThreshold = this.checkDataExceedsThreshold(temp, humidity)
    if (!isExceedsThreshold) {
      console.log('数据未超标，跳过推送')
      return
    }
    
    console.log('检测到新鲜数据超标，触发推送')
    this.sendAlert(temp, humidity, dataTimestamp || new Date().toISOString())
  },

  checkDataFreshness(dataTimestamp, freshnessMinutes) {
    if (!dataTimestamp) {
      console.log('无时间戳，默认认为数据过期')
      return false
    }
    
    const now = new Date()
    let dataTime
    
    if (typeof dataTimestamp === 'number' && dataTimestamp > 1000000000000) {
      dataTime = new Date(dataTimestamp)
    } else if (typeof dataTimestamp === 'string' && !isNaN(Date.parse(dataTimestamp))) {
      dataTime = new Date(dataTimestamp)
    } else {
      console.log('时间戳格式无法解析，认为数据过期')
      return false
    }
    
    const timeDiff = (now - dataTime) / (1000 * 60)
    const isFresh = timeDiff <= freshnessMinutes
    
    console.log(`数据时间: ${dataTime.toLocaleString()}, 时间差: ${timeDiff.toFixed(2)}分钟, 是否新鲜: ${isFresh}`)
    
    return isFresh
  },

  checkDataExceedsThreshold(temperature, humidity) {
    const config = app.globalData.alarmConfig
    const tempExceeds = temperature > config.temperature
    const humidityExceeds = humidity > config.humidity
    
    console.log(`温度: ${temperature}°C (阈值: ${config.temperature}°C), 超标: ${tempExceeds}`)
    console.log(`湿度: ${humidity}% (阈值: ${config.humidity}%), 超标: ${humidityExceeds}`)
    
    return tempExceeds || humidityExceeds
  },

  // ==================== 警报推送功能 ====================
  shouldSendAlert() {
    if (!app.globalData.alarmConfig.enablePush) {
      console.log('推送功能已禁用')
      return false
    }
    
    const now = new Date()
    const lastTime = this.data.lastAlertTime
    
    if (this.data.todayAlertCount >= app.globalData.alarmConfig.maxAlertsPerDay) {
      console.log('已达到今日推送上限')
      return false
    }
    
    if (lastTime) {
      const diffMinutes = (now - new Date(lastTime)) / (1000 * 60)
      if (diffMinutes < app.globalData.alarmConfig.cooldownMinutes) {
        console.log(`冷却时间内，剩余${(app.globalData.alarmConfig.cooldownMinutes - diffMinutes).toFixed(2)}分钟`)
        return false
      }
    }
    
    return true
  },

  sendAlert(temperature, humidity, timestamp) {
    console.log(`发送警报: 温度=${temperature}°C, 湿度=${humidity}%, 时间=${timestamp}`)
    // 检查推送开关是否开启
    if (!this.data.isPushEnabled) {
      console.log('推送开关已关闭，不发送警报');
      return;
    }

    if (!this.shouldSendAlert()) {
      console.log('不满足发送条件，跳过推送')
      return
    }
    
    const now = new Date()
    const alertData = {
      temperature: temperature,
      humidity: humidity,
      time: now.toISOString(),
      timestamp: timestamp,
      deviceName: this.data.deviceName,
      deviceId: this.data.deviceId
    }
    
    const newHistory = [alertData, ...this.data.alertHistory.slice(0, 49)]
    this.setData({
      alertHistory: newHistory,
      lastAlertTime: now.toISOString(),
      todayAlertCount: this.data.todayAlertCount + 1
    })
    
    try {
      wx.setStorageSync('alert_history', newHistory)
    } catch (error) {
      console.error('保存警报历史失败:', error)
    }
    
    this.sendSubscribeMessage(alertData)
    this.showAlarmNotification(alertData)
  },

  loadAlertHistory() {
    try {
      const history = wx.getStorageSync('alert_history') || []
      const todayStr = new Date().toDateString()
      const todayCount = history.filter(item => {
        return new Date(item.time).toDateString() === todayStr
      }).length
      
      this.setData({
        alertHistory: history,
        todayAlertCount: todayCount
      })
    } catch (error) {
      console.error('加载警报历史失败:', error)
    }
  },

  showAlarmNotification(alertData) {
    const message = `⚠️ 警报！温度 ${alertData.temperature.toFixed(2)}°C，湿度 ${alertData.humidity.toFixed(2)}% 已超过阈值！`
    
    this.setData({
      showAlarmPanel: true,
      alarmData: {
        temperature: alertData.temperature.toFixed(2),
        humidity: alertData.humidity.toFixed(2),
        timestamp: this.formatTime(alertData.timestamp, 'HH:mm:ss'),
        message: message
      }
    })
    
    wx.showToast({
      title: '⚠️ 检测到异常数据',
      icon: 'none',
      duration: 3000
    })
    
    setTimeout(() => {
      this.setData({ showAlarmPanel: false })
    }, 5000)
  },

  closeAlarmPanel() {
    this.setData({ showAlarmPanel: false })
  },

  sendSubscribeMessage(alertData) {
    const hasSubscribed = wx.getStorageSync('has_subscribed');
    const savedTemplateId = wx.getStorageSync('subscribe_template_id');

    if (!hasSubscribed || app.globalData.templateId != savedTemplateId) {
      console.log('用户未授权或模板已变更，跳过发送订阅消息');
      return
    }
     // 3. 已授权，直接调用云函数发送消息
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        thing6: { value: this.data.deviceName },  // 设备名称
        character_string10: { value: alertData.temperature.toFixed(2) },  // 温度值
        character_string11: { value: alertData.humidity.toFixed(2) },  // 湿度值
        time1: { value: this.formatTime(alertData.timestamp, 'YYYY-MM-DD HH:mm') }  // 报警时间
      }
    }).then(res => {
      console.log('订阅消息发送成功:', res);
  }).catch(err => {
    console.error('订阅消息发送失败:', err);
    });
    
  },
  // ==================== 数据加载功能 ====================
  async loadAllData() {
    if (!this.data.deviceId) return
    
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.checkHealth(),
        this.loadLatestData(),
        this.loadStats()
      ])
      
      this.setData({
        updateTime: this.formatTime(new Date(), 'HH:mm:ss')
      })
      
    } catch (error) {
      console.error('数据加载失败:', error)
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async checkHealth() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/wkapi/health`,
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200) {
            const isHealthy = (res.data.code === 999 || res.data.success === true)
            this.setData({
              statusClass: isHealthy ? 'normal' : 'error',
              statusText: isHealthy ? '正常' : '异常'
            })
            resolve()
          } else {
            this.setData({ statusClass: 'error', statusText: '异常' })
            resolve()
          }
        },
        fail: (err) => {
          this.setData({ statusClass: 'error', statusText: '连接失败' })
          reject(err)
        }
      })
    })
  },

  async loadLatestData() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/wkapi/latest`,
        data: { device_id: this.data.deviceId, limit: 10 },
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200 && (res.data.code === 999 || res.data.success === true)) {
            const data = res.data.data || []
            
            if (data.length > 0) {
              const firstItem = data[0]
              const temp = firstItem.temperature ? parseFloat(firstItem.temperature) : 0
              const humidity = firstItem.humidity ? parseFloat(firstItem.humidity) : 0
              
               // 新增：从配置文件获取阈值
            const tempThreshold = app.globalData.alarmConfig.temperature
            const humidityThreshold = app.globalData.alarmConfig.humidity

              const firstData = {
                temperature: temp.toFixed(2),
                humidity: humidity.toFixed(2),
                timestamp: this.formatTime(firstItem.timestamp, 'MM-DD HH:mm'),
                tempClass: (temp > tempThreshold) ? 'warning' : 'normal',
                humidityClass: (humidity > humidityThreshold) ? 'warning' : 'normal'
              }
              
              const latestData = data.map(item => {
                const itemTemp = item.temperature ? parseFloat(item.temperature) : 0
                const itemHumidity = item.humidity ? parseFloat(item.humidity) : 0
                
                return {
                  temperature: itemTemp.toFixed(2),
                  humidity: itemHumidity.toFixed(2),
                  timestamp: this.formatTime(item.timestamp, 'HH:mm:ss'),
                  tempClass: (itemTemp > tempThreshold) ? 'warning' : 'normal',
                  humidityClass: (itemHumidity > humidityThreshold) ? 'warning' : 'normal'
                }
              })
              
              this.setData({ firstData, latestData })
            } else {
              this.setData({
                firstData: {
                  temperature: '--',
                  humidity: '--',
                  timestamp: '暂无数据',
                  tempClass: 'normal',
                  humidityClass: 'normal'
                },
                latestData: []
              })
            }
            resolve()
          } else {
            reject(new Error('数据格式错误'))
          }
        },
        fail: reject
      })
    })
  },

  async loadStats() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/wkapi/stats`,
        data: { device_id: this.data.deviceId, hours: 24 },
        timeout: 10000,
        success: (res) => {
          if (res.statusCode === 200 && (res.data.code === 999 || res.data.success === true)) {
            const stats = res.data.data || res.data
            
            if (stats) {
              this.setData({
                stats: {
                  temperature: {
                    avg: stats.temperature?.avg?.toFixed(2) || '--',
                    max: stats.temperature?.max?.toFixed(2) || '--',
                    min: stats.temperature?.min?.toFixed(2) || '--'
                  },
                  humidity: {
                    avg: stats.humidity?.avg?.toFixed(2) || '--',
                    max: stats.humidity?.max?.toFixed(2) || '--',
                    min: stats.humidity?.min?.toFixed(2) || '--'
                  }
                }
              })
            } else {
              this.setData({
                stats: {
                  temperature: { avg: '--', max: '--', min: '--' },
                  humidity: { avg: '--', max: '--', min: '--' }
                }
              })
            }
            resolve()
          } else {
            this.setData({
              stats: {
                temperature: { avg: '--', max: '--', min: '--' },
                humidity: { avg: '--', max: '--', min: '--' }
              }
            })
            resolve()
          }
        },
        fail: reject
      })
    })
  },

  // ==================== 工具函数 ====================
  formatTime(time, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!time) return ''
    
    let date
    if (typeof time === 'number' && time > 1000000000000) {
      date = new Date(time)
    } else if (typeof time === 'string' && !isNaN(Date.parse(time))) {
      date = new Date(time)
    } else {
      return String(time).substring(0, 16)
    }
    
    const padZero = (num) => num.toString().padStart(2, '0')
    
    const map = {
      'YYYY': date.getFullYear(),
      'MM': padZero(date.getMonth() + 1),
      'DD': padZero(date.getDate()),
      'HH': padZero(date.getHours()),
      'mm': padZero(date.getMinutes()),
      'ss': padZero(date.getSeconds())
    }
    
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => map[match])
  },

  onRefresh() {
    if (!this.data.deviceId) {
      wx.showToast({ title: '请先设置设备信息', icon: 'none' })
      return
    }
    
    wx.showToast({ title: '刷新中...', icon: 'loading', duration: 1000 })
    
    this.loadAllData().then(() => {
      wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
    }).catch(() => {
      wx.showToast({ title: '刷新失败', icon: 'none', duration: 1000 })
    })
  }
})