import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { runtime } from './helpers/focus-runtime.mjs';

const requestEvent = 'cn.marginnote.ai-bridge.workflow.request.v1';
const responseEvent = 'cn.marginnote.ai-bridge.workflow.response.v1';
const aiRoot = new URL('../../Ai%20Bridge/src/', import.meta.url);
const integration = existsSync(new URL('AIBExternalWorkflows.js', aiRoot)) ? test : test.skip;
const workflow = (id = 'wf-one', site = 'deepseek') => ({ id, name: '讲解题目', site, cardItems: [1], handwriting: 'none', extraText: 'PRIVATE-PROMPT' });
function linked({ items = [workflow()], enabled = true, width = 1024, height = 768 } = {}) {
  const run = runtime({}, width, height), observers = [], posts = [], runs = [];
  let record = { schema: 1, revision: 'revision-one', items };
  const center = {
    addObserverSelectorName(target, selector, name) { observers.push({ target, selector: selector.replace(':', ''), name }); },
    removeObserverName(target, name) { for (let i = observers.length - 1; i >= 0; i--) if (observers[i].target === target && observers[i].name === name) observers.splice(i, 1); },
    postNotificationNameObjectUserInfo(name, object, userInfo) {
      posts.push({ name, object, payload: JSON.parse(userInfo.payload) });
      const notification = { object: () => object, userInfo: () => ({ objectForKey: key => userInfo[key] }) };
      for (const observer of observers.slice()) if (observer.name === name) observer.target[observer.selector](notification);
    },
  };
  run.context.NSNotificationCenter = { defaultCenter: () => center };
  run.context.__FOCUS_NEXT_AI_WORKFLOWS_GLOBAL__.connect(run.addon);
  for (const note of run.nodes.notes) note.notebookId = 'study-set';
  const server = vm.createContext({ console, Date: run.context.Date, NSNotificationCenter: run.context.NSNotificationCenter,
    Application: { sharedInstance: () => ({ documentPath: '/documents', focusWindow: run.addon.window, studyController: () => run.controller }) },
    Database: { sharedInstance: () => ({ getNoteById: id => run.nodes.notes.find(note => note.noteId === id) }) },
    NSFileManager: { defaultManager: () => ({ fileExistsAtPath: () => true, contentsAtPath: () => ({ length: 100, record }) }) },
    NSJSONSerialization: { JSONObjectWithDataOptions: data => JSON.parse(JSON.stringify(data.record)) },
    AIBWorkflowRunner: { run: (...args) => runs.push(args) },
  });
  for (const name of ['AIBNative', 'AIBSettings', 'AIBWorkflows', 'AIBNotes', 'AIBExternalWorkflows']) vm.runInContext(readFileSync(new URL(name + '.js', aiRoot), 'utf8'), server);
  const addon = { window: run.addon.window, receiveExternalWorkflow: notification => server.AIBExternalWorkflows.receive(addon, notification) };
  if (enabled) server.AIBExternalWorkflows.connect(addon);
  run.addon.setAiEnabled({ on: true });
  return { run, server, addon, observers, posts, runs, center, record: () => record, update: value => { record = value; } };
}
function open(h) { h.run.addon.pressAi(); h.run.addon.openAi(); return h.run.addon.__focusNextAiMenu; }
function choose(h, index = 1) { h.run.addon.chooseAiWorkflow(h.run.addon.__focusNextAiMenu.rows[index]); }

test('AI Bridge 无法联动时，安装提示里的链接能打开社区下载帖', () => {
  for (const canRequest of [false, true]) {
    const run = runtime();
    if (canRequest) {
      const center = { addObserverSelectorName() {}, postNotificationNameObjectUserInfo() {} };
      run.context.NSNotificationCenter = { defaultCenter: () => center };
      run.context.__FOCUS_NEXT_AI_WORKFLOWS_GLOBAL__.connect(run.addon);
    }
    run.addon.setAiEnabled({ on: true });
    const menu = open({ run });
    if (canRequest) {
      assert.match(menu.status.text, /正在读取/);
      run.advance(1600);
    }
    assert.equal(menu.status.text, '请安装并启用');
    const download = menu.scroll.subviews.find(view => view.title === 'AI Bridge↗');
    assert.ok(download);
    assert.equal(download.frame.x, menu.status.frame.x + menu.status.frame.width);
    assert.equal(download.frame.y, menu.status.frame.y);
    assert.ok(download.frame.y + download.frame.height <= menu.scroll.contentSize.height);
    assert.equal(menu.rows.length, 1);
    assert.deepEqual(run.urls, []);
    download.target[download.selector.replace(':', '')](download);
    assert.deepEqual(run.urls, ['https://bbs.marginnote.com.cn/t/topic/68798']);
  }
});

integration('两个独立 JS 上下文通过通知读取工作流，列表不执行上传也不传递提示词或卡片内容', () => {
  const h = linked({ items: [workflow(), { ...workflow('wf-two', 'gpt'), name: '检查答案' }] }), menu = open(h);
  assert.equal(menu.rows.length, 3);
  assert.equal(menu.rows[0].subviews[0].text, '题库网站问 AI');
  assert.equal(menu.rows[1].subviews[0].text, '讲解题目');
  assert.equal(menu.rows[1].subviews[1].text, 'DeepSeek');
  assert.equal(menu.rows[2].subviews[1].text, 'ChatGPT');
  assert.equal(h.runs.length, 0); assert.equal(h.run.urls.length, 0);
  assert.doesNotMatch(JSON.stringify(h.posts), /PRIVATE-PROMPT|cardItems|extraText/);
  assert.equal(h.posts[0].name, requestEvent); assert.equal(h.posts[1].name, responseEvent);
});

integration('选择工作流后只调用 AI Bridge 既有执行器，普通卡片与焦点均可使用', () => {
  const h = linked(), before = JSON.stringify(h.record()), menu = open(h);
  choose(h);
  assert.equal(h.runs.length, 1); assert.equal(h.runs[0][1], 'wf-one');
  assert.equal(h.runs[0][3].source.noteId, 'a1');
  assert.equal(h.run.addon.__focusNextAiMenu, null); assert.equal(menu.view.superview, undefined);
  assert.equal(h.run.urls.length, 0); assert.equal(JSON.stringify(h.record()), before);
  assert.deepEqual(Object.keys(h.run.defaults), ['cn.marginnote.focus-next.ai-enabled']);
});

integration('弹出和点击菜单清空选中项时仍使用原来选中的卡片，持续校验卡片和学习集', () => {
  const h = linked(), notebook = h.run.controller.notebookController;
  notebook.mindmapView.selViewLst = [{ note: h.run.nodes.a2 }];
  h.run.addon.pressAi(); notebook.mindmapView.selViewLst = []; h.run.addon.openAi();
  choose(h);
  const source = h.runs[0][3].source;
  assert.equal(source.noteId, 'a2'); assert.doesNotThrow(source.validate);
  notebook.mindmapView.selViewLst = [{ note: h.run.nodes.b1 }]; assert.throws(source.validate, /切换/);
  notebook.mindmapView.selViewLst = []; notebook.notebookId = 'other'; assert.throws(source.validate, /学习集/);
});

integration('列表打开后换卡、跨学习集、多选、关闭总开关或问 AI 开关均停止选择', () => {
  for (const action of ['selection', 'focus', 'notebook', 'multi', 'master', 'ai', 'inactive', 'disconnect']) {
    const h = linked(), menu = open(h), notebook = h.run.controller.notebookController;
    if (action === 'selection') notebook.mindmapView.selViewLst = [{ note: h.run.nodes.a2 }];
    if (action === 'focus') notebook.visibleFocusNote = h.run.nodes.a2;
    if (action === 'notebook') notebook.notebookId = 'other';
    if (action === 'multi') notebook.mindmapView.selViewLst = [{ note: h.run.nodes.a1 }, { note: h.run.nodes.a2 }];
    if (action === 'master') h.run.addon.setFocusEnabled({ on: false });
    if (action === 'ai') h.run.addon.setAiEnabled({ on: false });
    if (action === 'inactive') h.run.addon.sceneWillResignActive();
    if (action === 'disconnect') h.run.addon.sceneDidDisconnect();
    h.run.advance(160); h.run.addon.chooseAiWorkflow(menu.rows[1]);
    assert.equal(h.runs.length, 0, action); assert.equal(h.run.addon.__focusNextAiMenu, null, action);
  }
});

integration('AI Bridge 未启用、列表为空或被更新时提示清楚，原网站入口仍可用', () => {
  const offline = linked({ enabled: false }), menu = open(offline);
  offline.run.advance(1600); assert.equal(menu.status.text, '请安装并启用');
  assert.equal(menu.rows[0].subviews[0].text, '题库网站问 AI');
  offline.run.nodes.a1.comments = [{ text: '[查看原题](marginnote4app://addon/jifengjincao-bridge?action=open&paper=1&question=2)' }];
  choose(offline, 0); assert.match(offline.run.urls[0], /action=ask-ai/);
  const empty = linked({ items: [] }), emptyMenu = open(empty);
  assert.match(emptyMenu.status.text, /添加工作流/);
  assert.equal(emptyMenu.rows.length, 1);
  const changed = linked(); open(changed); changed.update({ ...changed.record(), revision: 'new', items: [] }); choose(changed);
  assert.equal(changed.runs.length, 0); assert.match(changed.run.messages.at(-1), /已更新/);
});

integration('错误窗口、无效请求、过期和重放请求都不能执行工作流', () => {
  const h = linked(), menu = open(h), request = { version: 1, requestId: 'run-test', action: 'run', token: menu.token, id: 'wf-one' };
  h.center.postNotificationNameObjectUserInfo(requestEvent, {}, { payload: JSON.stringify(request) }); assert.equal(h.runs.length, 0);
  choose(h); assert.equal(h.runs.length, 1);
  h.center.postNotificationNameObjectUserInfo(requestEvent, h.addon.window, { payload: JSON.stringify(request) }); assert.equal(h.runs.length, 1);
  open(h); h.addon.externalWorkflowTicket.at = -60001; choose(h);
  assert.equal(h.runs.length, 1); assert.match(h.run.messages.at(-1), /失效/);
  h.server.AIBExternalWorkflows.disconnect(h.addon);
  assert.equal(h.observers.some(item => item.target === h.addon), false);
});

integration('20 个工作流在小窗口内滚动显示，集中布局定位正确，关闭后旧回包不复活菜单', () => {
  const h = linked({ items: Array.from({ length: 20 }, (_, i) => ({ ...workflow('wf-' + i, 'doubao'), name: '工作流' + i })), width: 300, height: 320 });
  h.run.addon.setGroupedDisplay({ on: true }); const menu = open(h);
  assert.equal(menu.rows.length, 21); assert.ok(menu.scroll.contentSize.height > menu.scroll.frame.height);
  const f = menu.view.frame; assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.width <= 300 && f.y + f.height <= 320);
  h.run.addon.closeAiWorkflows(); h.run.advance(1600); assert.equal(h.run.addon.__focusNextAiMenu, null);
  const delayed = linked({ enabled: false }); open(delayed);
  const requestId = delayed.posts[0].payload.requestId;
  delayed.run.addon.closeAiWorkflows();
  delayed.center.postNotificationNameObjectUserInfo(responseEvent, delayed.run.addon.window, { payload: JSON.stringify({ version: 1, requestId, ok: true, token: 'late', items: [workflow()] }) });
  assert.equal(delayed.run.addon.__focusNextAiMenu, null);
});

integration('无焦点时仍能列出纯提示词工作流，需要卡片内容的工作流停止执行', () => {
  for (const textOnly of [false, true]) {
    const h = linked({ items: [{ ...workflow(), cardItems: textOnly ? [] : [1] }] });
    h.run.controller.notebookController.focusNote = null; h.run.addon.notebookWillOpen(); open(h); choose(h);
    assert.equal(h.runs.length, textOnly ? 1 : 0);
    if (!textOnly) assert.match(h.run.messages.at(-1), /选中一张卡片/);
  }
});

integration('网站入口和 AI Bridge 工作流之间有分隔标题，分组不占用可点击条目编号', () => {
  const h = linked(), menu = open(h);
  assert.equal(menu.sectionTitle.text, 'AI Bridge 工作流');
  assert.ok(menu.divider.frame.y >= menu.rows[0].frame.y + menu.rows[0].frame.height);
  assert.ok(menu.sectionTitle.frame.y + menu.sectionTitle.frame.height <= menu.rows[1].frame.y);
  assert.equal(menu.sectionTitle.userInteractionEnabled, false);
  choose(h); assert.equal(h.runs[0][1], 'wf-one');
});

integration('问 AI 面板避开集中横竖工具栏和分散按钮，小窗口内仍可滚动', () => {
  for (const grouped of [false, true]) for (const horizontal of [false, true]) for (const width of [300, 1024]) {
    const h = linked({ width, height: 768, items: Array.from({ length: 6 }, (_, i) => ({ ...workflow('wf-' + i), name: '工作流' + i })) });
    h.run.addon.setIconDisplay({ on: true }); h.run.addon.setProgressEnabled({ on: true });
    h.run.addon.setGroupedDisplay({ on: grouped }); h.run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    const menu = open(h), frame = menu.view.frame;
    const controls = grouped ? [h.run.addon.__focusNextGroup.view] : ['__focusProgressButton', '__focusPreviousButton', '__focusNextButton', '__focusAiButton', '__focusCollapseCommentsButton', '__focusExpandCommentsButton'].map(key => h.run.addon[key]);
    for (const control of controls.filter(Boolean)) {
      const b = control.frame;
      assert.ok(frame.x + frame.width <= b.x || b.x + b.width <= frame.x || frame.y + frame.height <= b.y || b.y + b.height <= frame.y, JSON.stringify({ grouped, horizontal, width, frame, b }));
    }
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= width && frame.y + frame.height <= 768);
  }
});

integration('工具栏位于左侧或中间时面板自动换位，窗口缩小后仍避开工具栏', () => {
  for (const horizontal of [false, true]) for (const x of [8, 280, 580]) {
    const h = linked({ width: 800, height: 600 });
    h.run.addon.setIconDisplay({ on: true }); h.run.addon.setGroupedDisplay({ on: true });
    h.run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    const group = h.run.addon.__focusNextGroup.view;
    group.frame = { ...group.frame, x: Math.min(x, 792 - group.frame.width), y: 160 };
    const menu = open(h);
    for (const resized of [false, true]) {
      if (resized) { h.run.controller.view.frame = { x: 0, y: 0, width: 420, height: 480 }; h.run.addon.controllerWillLayoutSubviews(); }
      const f = menu.view.frame, b = group.frame, bounds = h.run.controller.view.bounds;
      assert.ok(f.x + f.width <= b.x || b.x + b.width <= f.x || f.y + f.height <= b.y || b.y + b.height <= f.y);
      assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.width <= bounds.width && f.y + f.height <= bounds.height);
    }
  }
});

integration('原生 superview 每次返回不同包装对象时，横向面板仍避开整组按钮', () => {
  const h = linked();
  h.run.addon.setIconDisplay({ on: true }); h.run.addon.setProgressEnabled({ on: true });
  h.run.addon.setGroupedDisplay({ on: true }); h.run.addon.setGroupDirection({ selectedSegmentIndex: 1 });
  const group = h.run.addon.__focusNextGroup.view;
  group.frame = { ...group.frame, x: 680, y: 220 };
  let parent = group.superview;
  Object.defineProperty(group, 'superview', { configurable: true, get: () => parent && new Proxy(parent, {}), set: value => { parent = value; } });
  const menu = open(h), f = menu.view.frame, b = group.frame;
  assert.ok(f.x + f.width <= b.x || b.x + b.width <= f.x || f.y + f.height <= b.y || b.y + b.height <= f.y, JSON.stringify({ panel: f, toolbar: b }));
});

integration('横向问 AI 面板与最右侧可见按钮对齐，底部空间不足时改在上方展开', () => {
  for (const icons of [false, true]) for (const comments of ['both', 'collapse', 'none']) for (const bottom of [false, true]) {
    const h = linked({ width: 1100, height: 800 });
    h.run.addon.setIconDisplay({ on: icons });
    h.run.addon.setCollapseCommentsEnabled({ on: comments !== 'none' });
    h.run.addon.setExpandCommentsEnabled({ on: comments === 'both' });
    h.run.addon.setGroupedDisplay({ on: true }); h.run.addon.setGroupDirection({ selectedSegmentIndex: 1 });
    const group = h.run.addon.__focusNextGroup.view;
    group.frame = { ...group.frame, x: 600 - group.frame.width / 2, y: bottom ? 700 : 100 };
    const last = comments === 'both' ? h.run.addon.__focusExpandCommentsButton : comments === 'collapse' ? h.run.addon.__focusCollapseCommentsButton : h.run.addon.__focusAiButton;
    const menu = open(h), f = menu.view.frame;
    assert.equal(f.x + f.width, group.frame.x + last.frame.x + last.frame.width, JSON.stringify({ icons, comments, bottom, f }));
    if (bottom) assert.equal(f.y + f.height, group.frame.y - 8);
    else assert.equal(f.y, group.frame.y + group.frame.height + 8);
  }
});
