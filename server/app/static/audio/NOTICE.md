# 离线英语示范音（合成音频）

课程音频在开发机使用 Kokoro-82M v1.0 本地生成，并非真人录制或专业音素教学录音。
仅输入本项目既有教学文字；不使用儿童声音，不做声音克隆。

- 原始模型：hexgrad/Kokoro-82M，Apache-2.0：https://huggingface.co/hexgrad/Kokoro-82M
- ONNX 转换：onnx-community/Kokoro-82M-v1.0-ONNX，修订 1939ad2a8e416c0acfeecc08a694d14ef25f2231。
- 生成库：hexgrad/kokoro 的 kokoro-js 1.2.1，Apache-2.0：https://github.com/hexgrad/kokoro/tree/main/kokoro.js
- 构建依赖：Transformers.js 3.8.1（Apache-2.0）、phonemizer（eSpeak NG）；模型及生成运行时不随 APK 分发。
- 音色 af_heart，美式英语，速度 0.94。生成结果转换为 24 kHz、单声道 PCM16，限制峰值以避免削波。
- 保留上游模型卡声明的训练资料归属：Koniwa tnc（CC BY 3.0，https://github.com/koniwa/koniwa），SIWIS（CC BY 4.0，https://datashare.ed.ac.uk/handle/10283/2353）。这些是上游训练资料说明，不代表本项目持有原始录音。

完整 Apache 许可见同目录 LICENSE-APACHE-2.0.txt。生成音频仅作为课程示范，不宣称是专业发音评测依据；独立音素、发音准确性和儿童可懂度仍需人工及真机试听。
