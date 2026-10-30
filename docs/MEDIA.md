# 媒体文件与重建

所有成品均已随源码提供，正常运行、测试和 APK 构建不需要重新生成，也不需要安装语音模型到平板。

- `server/app/static/videos/`：14 个 MP4、封面、VTT 字幕、课程目录、来源及许可记录。
- `server/app/static/audio/en-us/`：433 条教学合成音频。
- `server/app/static/audio-manifest.json`：文本、文件路径、时长及摘要。
- `server/app/static/assets/bobo.png`：本项目波波角色图像。

## 可选：重建音频

需要 Node.js 22，并允许下载固定版本的上游模型。默认缓存目录为项目 `.cache/voice/`，可用 `STARPET_VOICE_CACHE` 指定其他目录；缓存不会提交到 Git。

```bash
cd tools/voice-runtime
npm ci
cd ../..
node tools/voice-runtime/build-pack.mjs
```

脚本仅根据固定课程文字生成示范音；不处理儿童录音。生成清单及上游声明见 `server/app/static/audio/NOTICE.md`。

## 可选：重建视频

需要 FFmpeg / ffprobe 加入 PATH，以及上述媒体构建依赖。Book Dash 导入脚本使用 Python 标准库。

```bash
# 原创基础短片与波波故事
node tools/video/build.mjs
node tools/video/build-stories.mjs

# Book Dash 公开许可原作 → 有声绘本
python tools/video/import-bookdash.py
node tools/voice-runtime/build-pack.mjs
node tools/video/build-bookdash.mjs

# Blender 公开许可原作 → 英语导读（导入脚本使用 PowerShell）
pwsh -File tools/video/import-open-film.ps1
node tools/voice-runtime/build-pack.mjs
node tools/video/build-open-film.mjs
```

外部站点内容或链接可能变化。导入时应重新核对公开许可、来源记录和 SHA-256；重建脚本会保存许可证据及完整改编署名，不应绕过检查以使用其他来路的成片。

`output/` 中的原作下载、许可证据、渲染中间文件和验收截图属于本地构建材料，不提交到仓库。原作来源、创作者、许可和摘要已保留在随媒体分发的 JSON 中。
