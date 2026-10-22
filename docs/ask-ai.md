# 问 AI 接入与验证

## 行为

“问 AI”独立开关默认关闭，位于设置的显示按钮分组。选中题卡优先于焦点，复用原题链接解析、来源身份校验及按下到松手的短暂上下文。按钮沿用位置持久化、集中横竖排列、文字／图标切换和总开关控制。研可岸、普通卡片、多选及身份冲突提示停止。

Focus Switch 保留卡片中的原题链接，只在本次打开时将 `action=open` 转为 `action=ask-ai`。两个 Bridge 须升级到支持此指令的版本；旧版本没有该指令，无法处理问 AI。Focus Switch 1.1.1 正式发布包含本功能，Bridge 接入测试包另行提供。

## 网站证据（2026-10-22）

只读取公开部署脚本，没有调用网站写接口，也未发送 AI 提问。

- 疾风劲草首页当前部署 [index-Cr7Ih_Sw.js](https://bbkaoyan.cn/assets/index-Cr7Ih_Sw.js)：`/questions/:id` 固定渲染 `question-ai-panel`（“本题 AI 解题面板”）。试卷题卡也改用该题详情页，不停留在原卷。网站负责登录、权限和恢复旧对话；创建对话和发送问题由网站原有提交动作处理。
- 大观园数学 [LearningQuestionPage-DgxH-Bui.js](https://www.cxyonly.fans/assets/LearningQuestionPage-DgxH-Bui.js) 与 [LearningQuestionCard-DhxNq82k.js](https://www.cxyonly.fans/assets/LearningQuestionCard-DhxNq82k.js)：`assistant=1` 是网站自身的本题辅导入口，因此打开 `/math/questions/<id>?assistant=1`。
- 408 当前入口脚本的 `ExerciseView`：`button.action-btn-ai` 的点击处理调用原有 `openAi(question.id)`，界面为 `.ai-workspace .question-ai-tutor`。使用题目 ID 的单题入口，避免知识点分类尚未选中目标题时误开。年份入口等待既有定位器 `success:year:<year>:<id>`，再点击一次并确认界面；不点击预设、提交或发送控件。无权限或加载失败在等待超时后提示。

## 宿主接口

先尝试最新官方文档入口；本次工具不可访问，改读 mndocs 的 UIWebView 全文，并阅读 JavaScriptCore 运行时和全局入口。尝试 MN Utils 在线文档失败。继续使用项目现有 `Application.openURL(NSURL)`、UIButton、NSUserDefaults、UIWebView.evaluateJavaScript 与 NSTimer；原生层不使用浏览器计时器。没有增加 MN Utils 依赖。

## 自动化与真机边界

Focus Switch 测试覆盖默认开关、持久化、选中／焦点、按下清空选中、拖动抑制、错误来源、身份冲突、分散／集中横竖布局及计数。两个 Bridge 测试覆盖外部指令校验、当前窗口与旧原题指令；408 额外验证等待真实定位、只点击一次、打开确认、过期回调、切页、关闭、重复请求与超时。

自动化不替代 iPad MarginNote 和真实登录账号验收。安装三个测试包后，在“显示按钮”中开启“问 AI”，分别测试疾风劲草、大观园数学及 408 题卡；确认显示本题 AI、没有自动发送，并检查普通卡片、研可岸、多选提示及关闭总开关后的按钮移除。
