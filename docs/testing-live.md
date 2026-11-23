# Common Hours 实时问答测试

用手机或电脑打开 [Ask the role finder](https://rongsenzhang.github.io/common-hours/#ask)，选择 **Live AI**。每条成功的回复旁会显示 OpenAI 和模型名称。示例使用虚构的志愿者岗位。测试时只需输入示例内容。

要测试附件里的 Case A 和 B，请打开[七岗位面试案例入口](https://rongsenzhang.github.io/common-hours/#ask-exercise)，粘贴 Case A，再输入 Case B 的追问。这组结果由评委页的匹配规则在浏览器内生成。下面的实时 AI 示例使用另一组社区岗位。

| 顺序 | 发给助手的消息 | 检查什么 |
| --- | --- | --- |
| 1 | Can I walk dogs at weekends? | 应找到 **Shelter dog walking buddy**。点岗位卡可以看时间和活动说明。 |
| 2 | How are you? | 助手回应问候，并且不插入岗位卡。 |
| 3 | Are you Gemini? | 助手说明由 OpenAI 提供支持，可以核对回复旁的实际模型名称。 |
| 4 | What about weekdays instead? | 接着前三句提问，检查它能否记得你想遛狗。应改为 **Neighbourhood dog walker**。 |
| 5 | I want to help at the community garden at weekends. I need a step-free route to the beds. | 先点 **Start a new chat**。**Community garden buddy** 应归入 **To confirm**，请主办方确认通往种植床的路线。 |
| 6 | 我第一次去做志愿者，出发前应该向负责人问些什么？ | 新开对话。检查它能否用中文给出针对第一次参加活动的建议。具体措辞每次可能不同。 |

要演示两种模式的区别，可以在 **On-device search** 中试同样的问候，再切回 **Live AI**。两种模式分别保留本标签页内的对话。刷新页面即可重新开始。公开站点达到用量上限时会提示稍后重试，也可立即切到本地查找岗位。

在仓库的 [真实模型测试记录](https://github.com/rongsenzhang/common-hours/actions/workflows/live-smoke.yml) 中可以查看前五个场景的执行结果。浏览器测试使用固定回复，单独检查桌面和手机界面的发送、取消、错误恢复和岗位卡。
