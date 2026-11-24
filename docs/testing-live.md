# Common Hours 实时问答测试

用手机或电脑打开 [Ask the role finder](https://rongsenzhang.github.io/common-hours/#ask)，选择 **Live AI**。每条成功的回复旁会显示 OpenAI 和模型名称。示例使用虚构的志愿者岗位。测试时只需输入示例内容。

**同一位志愿者，两组岗位。** 在 [评委练习](https://rongsenzhang.github.io/common-hours/#exercise) 中先运行 Case A 和 B，查看附件原有的 7 条记录。再打开 [Discover A](https://rongsenzhang.github.io/common-hours/#discover-case-a) 或 [Discover B](https://rongsenzhang.github.io/common-hours/#discover-case-b)，比较同一条件在 100 个虚构岗位中的结果。里程从虚构起点计算。

**在 Live AI 试三种问法。**

1. 输入 `Case A` 或粘贴原文。查看晚间、三英里、一对一及数字支持的解释。接着输入 Case B 原文，检查新推荐中是否还有纯远程岗位。
2. 输入 `Why do these roles suit me?`。检查理由能否对应你说过的偏好，以及这份岗位写明的任务或参加条件。
3. 新开一段对话，输入 `I’d like to volunteer but I’m not sure what I’d be good at.`。回答助手的问题，例如 `People often ask me to help them use their phones. I’m usually free after work.`。再补充 `In person only, within two miles.`，看看哪些岗位还适合，哪些信息需要确认。

也可以全程用中文。先说“我想做志愿者，但不知道自己擅长什么”，再说“朋友常找我教他们用手机。我喜欢一次帮一个人，只能在工作日晚上线上参加”。检查岗位是否支持线上、是否有工作日晚间场次，再问“你为什么觉得这几个岗位适合我？”。教朋友用手机是经验，可以支持相近任务；只能线上参加是限制，纯现场岗位不应进入推荐。如果再要求“必须晚上 6:35 准时开始”，现有记录只有时段，助手应提示向主办方确认。

| 顺序 | 发给助手的消息 | 检查什么 |
| --- | --- | --- |
| 1 | Can I walk dogs at weekends? | 应找到 **Shelter dog walking buddy**。点岗位卡可以看时间和活动说明。 |
| 2 | How are you? | 助手回应问候，并且不插入岗位卡。 |
| 3 | Are you Gemini? | 助手说明由 OpenAI 提供支持，可以核对回复旁的实际模型名称。 |
| 4 | What about weekdays instead? | 接着前三句提问，检查它能否记得你想遛狗。应改为 **Neighbourhood dog walker**。 |
| 5 | I want to help at the community garden at weekends. I need a step-free route to the beds. | 先点 **Start a new chat**。**Community garden buddy** 应归入 **To confirm**，请主办方确认通往种植床的路线。 |
| 6 | 我第一次去做志愿者，出发前应该向负责人问些什么？ | 新开对话。检查它能否用中文给出针对第一次参加活动的建议。具体措辞每次可能不同。 |

要演示两种模式的区别，可以在 **On-device search** 中试同样的问候，再切回 **Live AI**。两种模式分别保留本标签页内的对话。刷新页面即可重新开始。所有访客均可不限次发送。遇到 OpenAI 限流时，可以稍后重试，也可以切到本地查找岗位。

在仓库的 [真实模型测试记录](https://github.com/rongsenzhang/common-hours/actions/workflows/live-smoke.yml) 中可以查看真实模型场景的执行结果。浏览器测试使用固定回复，单独检查桌面和手机界面的发送、取消、错误恢复和岗位卡。
