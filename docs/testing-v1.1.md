# Common Hours v1.1 测试指南

公开入口可以直接用手机或电脑打开。此页测试本地模式。使用问答时请先选 **On-device search**。若要测试实时模型，请打开[实时问答测试指南](testing-live.md)。以下案例可直接复制，组与组之间点 **Start a new chat**，同组的追问请留在同一个对话里。

[打开问答](https://rongsenzhang.github.io/common-hours/#ask) · [打开目录](https://rongsenzhang.github.io/common-hours/)

| 场景 | 操作 | 预期结果 |
| --- | --- | --- |
| 新目录里有遛狗岗位 | 在问答里输入 `Can I walk dogs?`。 | 出现 **Shelter dog walking buddy** 和 **Neighbourhood dog walker**。点开可以查看具体任务、时间和路线。河岸捡垃圾不会出现在结果里。 |
| 同一兴趣，修改时间 | 继续输入 `Only weekends`，再输入 `What about weekdays?`。 | 周末只留下收容所遛狗，换成工作日后只留下社区遛狗。两个岗位分别标明平坦路线和有台阶的路线。 |
| 时间合适但地点冲突 | 在上一组后继续输入 `Can I do it from home?`。 | 两个遛狗岗位均需到场，因此没有符合当前条件的岗位。 |
| 中文查询 | 新开对话，输入 `我想周末遛狗`。 | 只出现周末的 **Shelter dog walking buddy**。 |
| 多个备选 | 新开对话，输入 `What can I do from home?`，然后追问 `Show more options`。 | 每次最多三个，下一页是不同岗位。参与方式尚待核实的岗位标为 **To confirm**。点岗位名可查看，点 **Save role** 后回 Discover → Saved 可再次打开。 |
| 缺少无障碍信息 | 在 Discover 的 **Your preferences**（窄屏先点 **Edit**）输入 `allotment`，选择 **Weekends**、**At the venue**，勾选 **Step-free access required** 并点 **Find roles**。 | **Community garden buddy** 出现在 **To confirm**。该岗位的无台阶通道仍待主办方确认。 |
| 排除看似相近的活动 | 在 Discover 重置筛选，分别搜索 `walk horses` 和 `litter walk`。 | 前者没有匹配；后者找到 **Riverside litter walk**。详情说明路线有台阶且地面不平。 |
| 公开和私有边界 | 普通访客打开公开网站；再用未登录 GitHub 的无痕窗口打开私有仓库。 | 网站只显示志愿者目录和问答。私有仓库在未授权窗口无法读取。 |

## 面试演示旧问题

1. 打开 [v1.0 原始发布记录](https://github.com/rongsenzhang/common-hours/releases/tag/v1.0.0)，指出当时目录没有遛狗岗位，而 *walk dogs* 误推了 *Riverside litter walk*。
2. 打开 [冻结的 B22 案例](../fixtures/history/v1.0-B22.json)。当前回归测试对同一份旧目录要求返回空。仓库根目录运行 `node --test tests/matching.mjs` 可以复现。
3. 返回当前公开页面，演示新增遛狗岗位的正例，再用 *walk horses* 作反例。两次比较检验不同能力：系统能在有记录时找到它，也能在缺乏依据时留空。

## 查看技术后台

使用有权限的 GitHub 账号打开[私有后台](https://github.com/rongsenzhang/common-hours-admin)。在查询索引中按 A–Z 找到 **walk dogs · B29**，比较各方法的结果。若要操作下拉列表和协调员核实/撤销流程，按[交互后台说明](admin.md)打开控制台。审核结果用于本次演示，不会修改所有访客看到的原始目录。
