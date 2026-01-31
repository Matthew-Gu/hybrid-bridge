# Hybrid Bridge

> A reliable, async-queue based Hybrid JS ↔ Native bridge with request/response and ready handshake.

一个 **Hybrid WebView 通信 SDK**，用于解决 JS 与 Native 通信中的 **时序不确定、消息丢失、并发混乱、生命周期不可控** 等常见问题。

---

## 特性

- **Async Queue 发送模型**
    - 消息先入队，永不丢失
    - 串行发送，避免 Native 并发问题

- **Request / Response**
    - Promise 化调用
    - 内建超时控制

- **Ready Handshake（关键）**
    - Native 显式通知 JS：Bridge 已就绪
    - 无轮询、无 setInterval、无猜测

- **事件系统**
    - 多订阅者
    - 自动清理

- **生命周期安全**
    - destroy 自动 reject 所有 pending request
    - 无内存泄漏

- **TypeScript First**
    - 完整类型定义
    - 可作为基础设施长期维护

---

## 安装

```bash
npm install @your-scope/hybrid-bridge
```

或

```bash
pnpm add @your-scope/hybrid-bridge
```

---

## 快速开始（JS 侧）

### 引入

```ts
import { hybridBridge } from '@your-scope/hybrid-bridge';
```

---

### 发送事件（fire-and-forget）

```ts
hybridBridge.emit('log', {
	level: 'info',
	message: 'hello native'
});
```

---

### 请求 / 响应模式

```ts
const user = await hybridBridge.request({
	type: 'getUser',
	timeout: 3000
});

console.log(user);
```

---

### 监听 Native 事件

```ts
const off = hybridBridge.on('networkChange', (status) => {
	console.log('network:', status);
});

// 取消监听
off();
```

---

### Native → JS

Native 在 Bridge 注入完成后，主动发送：

```js
window.postMessage({ type: '__bridge_ready__' }, '*');
```

### 行为说明

- Ready 之前的所有消息都会 **进入队列**
- Ready 之后按顺序发送
- 无轮询、无延时猜测

---

## 通信协议约定

### 消息结构

```ts
interface HybridMessage<T = any> {
	type: string;
	data?: T;
	requestId?: string;
	__bridge?: 'request' | 'response' | 'event';
}
```

### 协议语义

| \_\_bridge | 说明                |
| ---------- | ------------------- |
| event      | 单向通知            |
| request    | 请求（JS → Native） |
| response   | 响应（Native → JS） |

---

## Native 示例

下面示例展示 **Android WebView** 与 **iOS WKWebView** 如何与本 Bridge 协作，包括：

- Bridge 注入
- JS → Native 消息接收
- Native → JS 响应
- Ready Handshake

---

## Android（WebView + JavaScriptInterface）

### 注入 Bridge

```kotlin
class HybridBridge(private val webView: WebView) {

    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val json = JSONObject(message)
            handleMessage(json)
        } catch (e: Exception) {
            Log.e("HybridBridge", "Invalid message", e)
        }
    }

    private fun handleMessage(msg: JSONObject) {
        val type = msg.optString("type")
        val requestId = msg.optString("requestId", null)
        val data = msg.opt("data")

        when (type) {
            "getUser" -> {
                val result = JSONObject().apply {
                    put("id", "1001")
                    put("name", "Android User")
                }
                reply(requestId, result)
            }
        }
    }

    private fun reply(requestId: String?, data: Any?) {
        if (requestId == null) return

        val response = JSONObject().apply {
            put("type", "response")
            put("requestId", requestId)
            put("__bridge", "response")
            put("data", data)
        }

        webView.post {
            webView.evaluateJavascript(
                "window.postMessage($response, '*');",
                null
            )
        }
    }
}
```

---

### WebView 初始化

```kotlin
webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(
    HybridBridge(webView),
    "Android"
)
```

---

### Ready Handshake

在 **JS Bridge 可用后**，通知前端：

```kotlin
webView.post {
    webView.evaluateJavascript(
        "window.postMessage({ type: '__bridge_ready__' }, '*');",
        null
    )
}
```

---

## iOS（WKWebView + WKScriptMessageHandler）

### 注入 message handler

```swift
class HybridBridge: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any] else { return }
        handleMessage(body)
    }

    private func handleMessage(_ msg: [String: Any]) {
        let type = msg["type"] as? String
        let requestId = msg["requestId"] as? String

        if type == "getUser" {
            let data: [String: Any] = [
                "id": "1001",
                "name": "iOS User"
            ]
            reply(requestId: requestId, data: data)
        }
    }

    private func reply(requestId: String?, data: Any) {
        guard let requestId else { return }

        let response: [String: Any] = [
            "type": "response",
            "requestId": requestId,
            "__bridge": "response",
            "data": data
        ]

        if let json = try? JSONSerialization.data(withJSONObject: response),
           let str = String(data: json, encoding: .utf8) {
            webView?.evaluateJavaScript(
                "window.postMessage(\(str), '*');",
                completionHandler: nil
            )
        }
    }
}
```

---

### WebView 配置

```swift
let config = WKWebViewConfiguration()
let controller = WKUserContentController()

let bridge = HybridBridge(webView: webView)
controller.add(bridge, name: "Bridge")

config.userContentController = controller
webView = WKWebView(frame: .zero, configuration: config)
```

---

### Ready Handshake

```swift
webView.evaluateJavaScript(
    "window.postMessage({ type: '__bridge_ready__' }, '*');",
    completionHandler: nil
)
```

---

## 通信流程示意

```text
JS emit / request
        ↓
AsyncQueue 缓存
        ↓
等待 __bridge_ready__
        ↓
Native postMessage
        ↓
Native 处理
        ↓
window.postMessage(response)
        ↓
Promise resolve / event emit
```

---

## 生命周期管理

### 销毁 Bridge

```ts
hybridBridge.destroy();
```

销毁时会：

- 移除 `message` 监听
- reject 所有 pending request
- 清空事件监听
- 关闭发送协程

---

## 注意事项

- Native **必须**发送 `__bridge_ready__`
- response 必须携带：
    - `requestId`
    - `__bridge: 'response'`

- 推荐所有 Native → JS 消息统一通过 `window.postMessage`

---

## License

MIT

---
