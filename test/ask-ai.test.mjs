import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/focus-runtime.mjs';

const mathURL = 'https://www.cxyonly.fans/math/practice/categories/8?questionId=42';
const cases = [
  ['daguanyuan-bridge?action=open&provider=math&question=42&year=0&url=' + encodeURIComponent(mathURL), 'DAGUANYUAN_QUESTION_ID:42'],
  ['daguanyuan-bridge?action=open&provider=408&question=42&year=2023&url=' + encodeURIComponent('https://www.408os.cn/exercise?year=2023&questionId=42'), 'DAGUANYUAN_408_QUESTION_ID:42'],
  ['jifengjincao-bridge?action=open&paper=8&question=42', 'JFJC_QUESTION:8:42'],
  ['jifengjincao-bridge?action=open&paper=0&question=42', 'JFJC_QUESTION:0:42'],
];
function card(note, [route, marker] = cases[0]) {
  note.comments = [{ text: '完整题干' }, { text: `[查看原题](marginnote4app://addon/${route})\n\n<!-- ${marker} -->` }];
}

test('问 AI 独立默认关闭，保留偏好、位置及总开关控制', () => {
  const defaults = {}, r = runtime(defaults); r.addon.notebookWillOpen();
  assert.equal(r.addon.__focusAiButton, undefined);
  r.addon.setAiEnabled({ on: true });
  assert.equal(r.addon.__focusAiButton.title, '问 AI');
  assert.equal(r.addon.__focusSourceButton, undefined);
  r.addon.handleFocusAiButtonPan({ state: 1 });
  r.addon.handleFocusAiButtonPan({ state: 2, translationInView: () => ({ x: -70, y: -40 }), setTranslationInView() {} });
  r.addon.handleFocusAiButtonPan({ state: 3 });
  const pos = { ...r.addon.__focusAiButton.frame };
  const restarted = runtime(defaults); restarted.addon.notebookWillOpen();
  assert.deepEqual({ ...restarted.addon.__focusAiButton.frame }, pos);
  restarted.addon.setFocusEnabled({ on: false });
  assert.equal(restarted.addon.__focusAiButton.superview, undefined);
  restarted.addon.setFocusEnabled({ on: true });
  assert.ok(restarted.addon.__focusAiButton.superview);
});

for (const info of cases) test('问 AI 使用当前题目身份并保留原题链接：' + info[1], () => {
  const r = runtime(); card(r.nodes.a2, info); r.addon.setAiEnabled({ on: true });
  const before = JSON.stringify(r.nodes.a2.comments);
  r.controller.notebookController.mindmapView.selViewLst = [{ note: r.nodes.a2 }];
  r.addon.pressAi(); r.addon.openAi();
  assert.equal(r.urls[0], 'marginnote4app://addon/' + info[0].replace('?action=open&', '?action=ask-ai&'));
  assert.equal(JSON.stringify(r.nodes.a2.comments), before);
  r.controller.notebookController.mindmapView.selViewLst = [];
  r.controller.notebookController.visibleFocusNote = r.nodes.a2;
  r.addon.openAi(); assert.equal(r.urls[1], r.urls[0]);
});

test('问 AI 拒绝研可岸、普通卡、多选、身份冲突及按下后换题', () => {
  for (const scenario of ['yankean', 'ordinary', 'multi', 'conflict', 'changed', 'disabled']) {
    const r = runtime(); card(r.nodes.a1); r.addon.setAiEnabled({ on: true });
    if (scenario === 'yankean') card(r.nodes.a1, ['yankean-bridge?action=open&source=math&question=42', 'YANKEAN_QUESTION:MATH:42']);
    if (scenario === 'ordinary') r.nodes.a1.comments = [{ text: '笔记' }];
    if (scenario === 'conflict') r.nodes.a1.comments[1].text += '\n<!-- DAGUANYUAN_QUESTION_ID:43 -->';
    if (scenario === 'multi') r.controller.notebookController.mindmapView.selViewLst = [{ note: r.nodes.a1 }, { note: r.nodes.a2 }];
    r.addon.pressAi();
    if (scenario === 'changed') r.controller.notebookController.visibleFocusNote = r.nodes.a2;
    if (scenario === 'disabled') r.addon.setAiEnabled({ on: false });
    r.addon.openAi(); assert.equal(r.urls.length, 0, scenario);
    if (scenario !== 'disabled') assert.ok(r.messages.length, scenario);
  }
});

test('问 AI 按下后选中项被宿主清空仍定位按下题目，拖动不触发跳转', () => {
  const r = runtime(); card(r.nodes.a2); r.addon.setAiEnabled({ on: true });
  r.controller.notebookController.mindmapView.selViewLst = [{ note: r.nodes.a2 }];
  r.addon.pressAi(); r.controller.notebookController.mindmapView.selViewLst = []; r.addon.openAi();
  assert.equal(r.urls.length, 1);
  r.addon.handleFocusAiButtonPan({ state: 1 }); r.addon.handleFocusAiButtonPan({ state: 3 });
  r.addon.openAi(); assert.equal(r.urls.length, 1);
});

test('问 AI 参与图标、集中横竖排列与设置计数，分散按钮不重叠', () => {
  for (const icons of [false, true]) for (const grouped of [false, true]) for (const horizontal of [false, true]) {
    const r = runtime({}, 300, 320); r.addon.notebookWillOpen();
    r.addon.setAiEnabled({ on: true }); r.addon.setSourceEnabled({ on: true });
    r.addon.setIconDisplay({ on: icons }); r.addon.setGroupedDisplay({ on: grouped });
    r.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    const ai = r.addon.__focusAiButton;
    if (icons) assert.equal(ai.image.resourcePath, 'button-icons/message-circle.png');
    assert.equal(ai.superview, grouped ? r.addon.__focusNextGroup.view : r.controller.view);
    const buttons = [r.addon.__focusNextButton, r.addon.__focusSourceButton, ai, r.addon.__focusCollapseCommentsButton, r.addon.__focusExpandCommentsButton];
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i].frame, b = buttons[j].frame;
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
    }
    r.addon.focusToolbarClick(); r.advance(300);
    assert.equal(r.addon.__focusNextSettings.groups[2].description.text, '已开启 6/6');
    r.addon.setAiEnabled({ on: false }); assert.equal(ai.superview, undefined);
  }
});
