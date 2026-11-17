import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, websiteAi } from './helpers/focus-runtime.mjs';

const addresses = [
  'https://www.cxyonly.fans/math/practice/categories/8?questionId=42',
  'https://cxyonly.fans/math/questions/42',
  'https://math.cxyonly.fans/practice/categories/8?questionId=42',
  'https://math.cxyonly.fans/questions/42',
  'https://math.cxyonly.fans/math/questions/42',
];
function card(note, address, identity = 42) {
  const url = 'marginnote4app://addon/daguanyuan-bridge?action=open&provider=math&question=42&year=0&url=' + encodeURIComponent(address);
  note.comments = [{ text: '题干与个人笔记' }, { text: '[查看原题](' + url + ')\n<!-- DAGUANYUAN_QUESTION_ID:' + identity + ' -->' }];
  return url;
}

for (const address of addresses) for (const ai of [false, true]) {
  test('数学新旧站题卡在选中及焦点状态下打开正确入口，问 AI=' + ai + '：' + address, () => {
    const run = runtime(), note = run.nodes.a2, expected = card(note, address);
    const before = JSON.stringify(note.comments);
    if (ai) run.addon.setAiEnabled({ on: true }); else run.addon.setSourceEnabled({ on: true });
    run.controller.notebookController.mindmapView.selViewLst = [{ note }];
    if (ai) { run.addon.pressAi(); websiteAi(run); } else { run.addon.pressOriginal(); run.addon.openOriginal(); }
    const target = ai ? expected.replace('?action=open&', '?action=ask-ai&') : expected;
    assert.equal(run.urls[0], target);
    run.controller.notebookController.mindmapView.selViewLst = [];
    run.controller.notebookController.visibleFocusNote = note;
    if (ai) { run.addon.pressAi(); websiteAi(run); } else { run.addon.pressOriginal(); run.addon.openOriginal(); }
    assert.deepEqual(run.urls, [target, target]);
    assert.equal(JSON.stringify(note.comments), before);
    assert.equal(run.messages.length, 0);
  });
}

test('新数学站原题链接仍定义导入评论的折叠起点', () => {
  const run = runtime(), note = run.nodes.a2, url = card(note, addresses[2]);
  note.comments.push({ text: '手写说明' });
  const boundary = run.context.__FOCUS_NEXT_SOURCE_GLOBAL__.foldBoundary(note);
  assert.equal(boundary.index, 2); assert.equal(boundary.count, 3); assert.equal(boundary.url, url);
});

test('兼容新数学站后仍拒绝外站、伪装网址与题卡身份不一致的链接', () => {
  for (const address of ['https://math.cxyonly.fans.evil.test/questions/42', 'https://evil.test@math.cxyonly.fans/questions/42',
    'http://math.cxyonly.fans/questions/42', 'https://math.cxyonly.fans/settings', addresses[2]]) {
    const run = runtime(), note = run.nodes.a2;
    card(note, address, address === addresses[2] ? 43 : 42);
    run.addon.setSourceEnabled({ on: true }); run.controller.notebookController.mindmapView.selViewLst = [{ note }];
    run.addon.pressOriginal(); run.addon.openOriginal();
    assert.equal(run.urls.length, 0); assert.ok(run.messages.length > 0);
  }
});
