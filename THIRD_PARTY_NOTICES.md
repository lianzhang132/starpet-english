# Third-party notices / 第三方说明

顶层 MIT 许可证适用于项目自有代码与原创课程文本。以下第三方作品、素材和依赖按各自许可证使用；本项目不对第三方商标授予额外权利，不暗示任何原作者或机构背书。

## Book Dash 绘本与插画 · CC BY 4.0

文件：`server/app/static/videos/book-*.mp4`、对应封面、字幕和来源说明，以及视频中使用的原作插画。

六部原作：Come Back, Cat!、Fifi and Teddy、A House for Mouse、Little Goat、Sleepy Mr Sloth、Hippo Wants to Dance。

- 出版方与原作库：https://bookdash.org/books/
- 复用说明：https://bookdash.org/re-using-the-book-dash-content/
- 许可证：https://creativecommons.org/licenses/by/4.0/
- 完整逐部作者、插画师、设计师、原作链接、校验值及改编说明：[`bookdash-sources.json`](server/app/static/videos/bookdash-sources.json)
- 应用中的作品说明：[`bookdash.mjs`](server/app/static/videos/bookdash.mjs)

改编增加简化英语合成讲述、中文提示、轻缓转场和学习任务。各集片尾与应用界面保留原作署名。Book Dash 标志用于原作署名，保留原样，不表示合作或背书。

## Caminandes: Llamigos · CC BY 4.0

文件：`server/app/static/videos/film-llamigos.mp4`、对应封面、字幕和来源说明。

- 原作：Blender Studio / Blender Foundation，https://studio.blender.org/projects/caminandes-3/
- 许可来源：https://studio.blender.org/projects/api/assets/2417/?site_context=featured_artwork
- 许可证：https://creativecommons.org/licenses/by/4.0/
- 主要署名：Blender Institute / Blender Foundation（制作）；Pablo Vazquez（导演）；Hjalti Hjalmarsson（动画导演）；Torin Borrowdale（音乐）；Sander Houtman（音效）；Ton Roosendaal（制片）。完整制作名单保留在原片内。
- 原作校验值与改编记录：[`open-film-sources.json`](server/app/static/videos/open-film-sources.json)

本项目保留完整原片、原配乐和制作名单，增加独立的英语学习合成讲述、中文提示、互动任务及改编片尾，并调整配乐音量和分辨率。原片没有英语对白，本版不是原作英语配音。

CC BY 4.0 许可证正文见 [`licenses/CC-BY-4.0.txt`](licenses/CC-BY-4.0.txt)。

## 合成英语示范音

文件：`server/app/static/audio/en-us/*.wav`，以及视频中后配的英语讲述。

在开发机使用 Kokoro-82M v1.0 / `af_heart` 音色生成；不使用儿童录音或声音克隆。生成模型和运行时未随仓库或 APK 分发。

保留的上游信息、模型修订及训练资料归属说明见 [`audio/NOTICE.md`](server/app/static/audio/NOTICE.md)，Apache 2.0 许可证正文见 [`audio/LICENSE-APACHE-2.0.txt`](server/app/static/audio/LICENSE-APACHE-2.0.txt)。

## 运行及构建依赖

依赖通过各自包管理器安装，许可证以对应的固定版本上游为准，不由本项目改为 MIT。

| 依赖 | 上游许可证 / 地址 |
| --- | --- |
| FastAPI | MIT · https://github.com/fastapi/fastapi |
| Uvicorn | BSD-3-Clause · https://github.com/encode/uvicorn |
| Requests | Apache-2.0 · https://github.com/psf/requests |
| Vosk API / small-en-us 模型 | Apache-2.0 · https://alphacephei.com/vosk/ |
| whisper.cpp | MIT · https://github.com/ggml-org/whisper.cpp |
| Whisper 模型 | MIT · https://github.com/openai/whisper |
| AndroidX WebKit | Apache-2.0 · https://developer.android.com/jetpack/androidx/releases/webkit |
| Kokoro / kokoro-js / Transformers.js | Apache-2.0；详见音频 NOTICE |
| sharp（媒体构建） | Apache-2.0 · https://github.com/lovell/sharp |
| Gradle Wrapper | Apache-2.0 · https://github.com/gradle/gradle |
| FFmpeg（单独安装的媒体工具） | 具体许可证取决于所安装版本的编译配置 · https://ffmpeg.org/legal.html |

Huawei DevEco、HarmonyOS SDK、Android SDK 等开发工具需要开发者自行按各自协议安装；本仓库不分发 SDK、模型权重、第三方应用安装包或未获授权的商业课程。
