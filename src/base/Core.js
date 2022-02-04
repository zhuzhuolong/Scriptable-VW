import md5 from '../utils/md5'

class Core {
  constructor(arg = '') {
    this.arg = arg
    this._actions = {}
    this.init()
  }

  /**
   * 初始化配置
   * @param {string} widgetFamily
   */
  init(widgetFamily = config.widgetFamily) {
    // 组件大小：small,medium,large
    this.widgetFamily = widgetFamily
    // 系统设置的key，这里分为三个类型：
    // 1. 全局
    // 2. 不同尺寸的小组件
    // 3. 不同尺寸+小组件自定义的参数
    // 当没有key2时，获取key1，没有key1获取全局key的设置
    // this.SETTING_KEY = md5(Script.name()+'@'+this.widgetFamily+'@'+this.arg)
    // this.SETTING_KEY1 = md5(Script.name()+'@'+this.widgetFamily)
    this.SETTING_KEY = md5(Script.name())
    // 插件设置
    this.settings = this.getSettings()
  }

  /**
   * 注册点击操作菜单
   * @param {string} name 操作函数名
   * @param {Function} func 点击后执行的函数
   */
  registerAction(name, func) {
    this._actions[name] = func.bind(this)
  }

  /**
   * 动态设置组件字体或者图片颜色
   * @param {WidgetText || WidgetImage || WidgetStack} widget
   * @param {'textColor' || 'tintColor' || 'borderColor' || 'backgroundColor'} type
   * @param {'Small' || 'Medium' || 'Large'} size
   * @param {number} alpha
   */
  setWidgetNodeColor(widget, type = 'textColor', size = 'Small', alpha = 1) {
    if (
      this.settings['backgroundPhoto' + size + 'Light'] ||
      this.settings['backgroundPhoto' + size + 'Dark']
    ) {
      const lightTextColor = this.settings['backgroundImageLightTextColor'] || '#000000'
      const darkTextColor = this.settings['backgroundImageDarkTextColor'] || '#ffffff'
      widget[type] = Color.dynamic(new Color(lightTextColor, alpha), new Color(darkTextColor, alpha))
    } else {
      const lightTextColor = this.settings['lightTextColor'] ? this.settings['lightTextColor'] : '#000000'
      const darkTextColor = this.settings['darkTextColor'] ? this.settings['darkTextColor'] : '#ffffff'
      widget[type] = Color.dynamic(new Color(lightTextColor, alpha), new Color(darkTextColor, alpha))
    }
  }

  /**
   * 设置字体
   * @param {WidgetText} widget
   * @param size
   * @param { 'regular' || 'bold' } type
   */
  setFontFamilyStyle(widget, size, type = 'regular') {
    const regularFont = this.settings['regularFont'] || 'PingFangSC-Regular '
    const boldFont = this.settings['boldFont'] || 'PingFangSC-Semibold'

    widget.font = new Font(type === 'regular' ? regularFont : boldFont, size)
  }

  /**
   * 获取当前插件的设置
   * @param {boolean} json 是否为json格式
   * @param key
   */
  getSettings(json = true, key = this.SETTING_KEY) {
    let result = json ? {} : ''
    let cache = ''
    if (Keychain.contains(key)) {
      cache = Keychain.get(key)
    }
    if (json) {
      try {
        result = JSON.parse(cache)
      } catch (error) {
        // throw new Error('JSON 数据解析失败' + error)
      }
    } else {
      result = cache
    }

    return result
  }

  /**
   * 新增 Stack 布局
   * @param {WidgetStack | ListWidget} stack 节点信息
   * @param {'horizontal' | 'vertical'} layout 布局类型
   * @returns {WidgetStack}
   */
  addStackTo(stack, layout) {
    const newStack = stack.addStack()
    layout === 'horizontal' ? newStack.layoutHorizontally() : newStack.layoutVertically()
    return newStack
  }

  /**
   * 时间格式化
   * @param date
   * @param format
   * @return {string}
   */
  formatDate(date = new Date(), format = 'MM-dd HH:mm') {
    const formatter = new DateFormatter()
    formatter.dateFormat = format
    const updateDate = new Date(date)
    return formatter.string(updateDate)
  }

  /**
   * 生成操作回调URL，点击后执行本脚本，并触发相应操作
   * @param {string} name 操作的名称
   * @param {string} data 传递的数据
   */
  actionUrl(name = '', data = '') {
    let u = URLScheme.forRunningScript()
    let q = `act=${encodeURIComponent(name)}&data=${encodeURIComponent(data)}&__arg=${encodeURIComponent(this.arg)}&__size=${this.widgetFamily}`
    let result = ''
    if (u.includes('run?')) {
      result = `${u}&${q}`
    } else {
      result = `${u}?${q}`
    }
    return result
  }

  /**
   * HTTP 请求接口
   * @param {Object} options request 选项配置
   * @returns {Promise<JSON | String>}
   */
  async http(options) {
    const url = options?.url || url
    const method = options?.method || 'GET'
    const headers = options?.headers || {}
    const body = options?.body || ''
    const json = options?.json || true

    let response = new Request(url)
    response.method = method
    response.headers = headers
    if (method === 'POST' || method === 'post') response.body = body
    return (json ? response.loadJSON() : response.loadString())
  }

  /**
   * 获取远程图片内容
   * @param {string} url 图片地址
   * @param {boolean} useCache 是否使用缓存（请求失败时获取本地缓存）
   */
  async getImageByUrl(url, useCache = true) {
    const cacheKey = md5(url)
    const cacheFile = FileManager.local().joinPath(FileManager.local().temporaryDirectory(), cacheKey)
    // 判断是否有缓存
    if (useCache && FileManager.local().fileExists(cacheFile)) {
      return Image.fromFile(cacheFile)
    }
    try {
      const req = new Request(url)
      const img = await req.loadImage()
      // 存储到缓存
      FileManager.local().writeImage(cacheFile, img)
      return img
    } catch (e) {
      // 没有缓存+失败情况下，返回自定义的绘制图片（红色背景）
      let ctx = new DrawContext()
      ctx.size = new Size(100, 100)
      ctx.setFillColor(Color.red())
      ctx.fillRect(new Rect(0, 0, 100, 100))
      return ctx.getImage()
    }
  }

  /**
   * 弹出一个通知
   * @param {string} title 通知标题
   * @param {string} body 通知内容
   * @param {string} url 点击后打开的URL
   * @param {Object} opts
   * @returns {Promise<void>}
   */
  async notify(title, body = '', url = undefined, opts = {}) {
    try {
      let n = new Notification()
      n = Object.assign(n, opts)
      n.title = title
      n.body = body
      if (url) n.openURL = url
      return await n.schedule()
    } catch (error) {
      console.warn(error)
    }
  }

  /**
   * 存储当前设置
   * @param {boolean} notify 是否通知提示
   */
  async saveSettings(notify = true) {
    const result = (typeof this.settings === 'object') ? JSON.stringify(this.settings) : String(this.settings)
    Keychain.set(this.SETTING_KEY, result)
    if (notify) await this.notify('设置成功', '桌面组件稍后将自动刷新')
  }

  /**
   * 获取用户车辆照片
   * @returns {Promise<Image|*>}
   */
  async getMyCarPhoto(photo) {
    let myCarPhoto = await this.getImageByUrl(photo)
    if (this.settings['myCarPhoto']) myCarPhoto = await FileManager.local().readImage(this.settings['myCarPhoto'])
    return myCarPhoto
  }

  /**
   * 关于组件
   */
  async actionAbout() {
    Safari.open( 'https://joiner.i95.me/about.html')
  }
}

export default Core
