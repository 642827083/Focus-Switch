# 浮动按钮图标

本目录保存用户选定的 SVG 原图：

| 功能 | 图标 | 来源 |
| --- | --- | --- |
| 上一张 | [arrow-up](https://lucide.dev/icons/arrow-up) | Lucide |
| 下一张 | [arrow-down](https://lucide.dev/icons/arrow-down) | Lucide |
| 查看原题 | [zoom-scan](https://tabler.io/icons?icon=zoom-scan) | Tabler，用户选定的 C「定位查看」 |
| 折叠评论 | [fold-vertical](https://lucide.dev/icons/fold-vertical) | Lucide |
| 展开评论 | [unfold-vertical](https://lucide.dev/icons/unfold-vertical) | Lucide |

来源：<https://github.com/lucide-icons/lucide/tree/main/icons> 与 <https://github.com/tabler/tabler-icons/tree/main/icons/outline>，于 2026-10-19 获取。

运行资源位于 `src/button-icons/`：将原图描边改为白色、线宽改为 1.8，以透明背景输出 72 × 72 像素 PNG。插件通过 `UIImage.imageWithDataScale(data, 3)` 按 24 点显示，和候选预览保持一致，不在运行时请求网络。

图标按钮统一使用 36 × 36 点外框；文字模式仍为原来的样式。

Lucide 授权及版权声明保留在 [LICENSE.txt](../../src/button-icons/LICENSE.txt)，Tabler 的 MIT 声明保留在 [TABLER-LICENSE.txt](../../src/button-icons/TABLER-LICENSE.txt)，均随插件安装包分发。
