// API client for communicating with the Python backend

const API_BASE_URL = "http://localhost:8000"

// Status
export async function getApiStatus() {
  const res = await fetch(`${API_BASE_URL}/status`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Update settings via REST
export async function updateModelSettings(settings: any) {
  const res = await fetch(`${API_BASE_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Start training with a brand-new synthetic dataset each time
export async function trainModel(
  options: {
    model_type?: string
    epochs?: number
    batch_size?: number
    encoding_dim?: number
    nu?: number
    contamination?: number
    n_components?: number
    dataset_size?: number
    set_active_when_done?: boolean
  } = {},
) {
  const body = {
    model_type: options.model_type ?? "autoencoder",
    epochs: options.epochs ?? 50,
    batch_size: options.batch_size ?? 32,
    encoding_dim: options.encoding_dim ?? 8,
    nu: options.nu ?? 0.1,
    contamination: options.contamination ?? 0.1,
    n_components: options.n_components ?? 2,
    dataset_size: options.dataset_size ?? 3000,
    set_active_when_done: options.set_active_when_done ?? false,
  }
  const res = await fetch(`${API_BASE_URL}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getTrainingStatus() {
  const res = await fetch(`${API_BASE_URL}/train/status`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// On-demand detect endpoint
export async function detectBatch(trafficData: any[]) {
  const res = await fetch(`${API_BASE_URL}/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: trafficData }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// WebSocket for real-time data
let socket: WebSocket | null = null
let isConnecting = false
const messageQueue: any[] = []
let onMessageCallback: ((data: any) => void) | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000
let stopCommandSent = false
let forceDisconnectTimeout: NodeJS.Timeout | null = null

export function connectWebSocket(onMessage: (data: any) => void) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    onMessageCallback = onMessage
    stopCommandSent = false
    return true
  }
  if (isConnecting) {
    onMessageCallback = onMessage
    stopCommandSent = false
    return true
  }
  isConnecting = true
  onMessageCallback = onMessage
  stopCommandSent = false

  try {
    const wsUrl = API_BASE_URL.replace(/^http:\/\//, "ws://") + "/ws"
    socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      isConnecting = false
      reconnectAttempts = 0
      while (messageQueue.length > 0) {
        const message = messageQueue.shift()
        sendWebSocketMessage(message)
      }
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (onMessageCallback && !stopCommandSent) onMessageCallback(data)
        if (data.type === "command_response" && data.command === "stop" && data.status === "success") {
          if (forceDisconnectTimeout) {
            clearTimeout(forceDisconnectTimeout)
            forceDisconnectTimeout = null
          }
          setTimeout(() => {
            if (socket) {
              socket.close()
              socket = null
            }
          }, 500)
        }
      } catch (e) {
        console.error("WS parse error:", e)
      }
    }

    socket.onerror = (e) => {
      console.error("WebSocket error:", e)
      isConnecting = false
    }

    socket.onclose = () => {
      isConnecting = false
      socket = null
      if (forceDisconnectTimeout) {
        clearTimeout(forceDisconnectTimeout)
        forceDisconnectTimeout = null
      }
      if (!stopCommandSent && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        setTimeout(() => {
          if (onMessageCallback) connectWebSocket(onMessageCallback)
        }, RECONNECT_DELAY)
      } else {
        stopCommandSent = false
      }
    }

    return true
  } catch (e) {
    console.error("WS create failed:", e)
    isConnecting = false
    return false
  }
}

export function sendWebSocketMessage(message: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    messageQueue.push(message)
    if (!isConnecting && onMessageCallback) connectWebSocket(onMessageCallback)
    return false
  }
  try {
    socket.send(JSON.stringify(message))
    if (message.command === "stop") stopCommandSent = true
    return true
  } catch (e) {
    console.error("WS send error:", e)
    return false
  }
}

export function disconnectWebSocket() {
  if (socket) {
    sendWebSocketMessage({ command: "stop" })
    if (forceDisconnectTimeout) clearTimeout(forceDisconnectTimeout)
    forceDisconnectTimeout = setTimeout(() => {
      if (socket) {
        socket.close()
        socket = null
      }
      stopCommandSent = false
    }, 2000)
  }
}

export async function sendStopCommand() {
  const sent = sendWebSocketMessage({ command: "stop" })
  if (!sent) {
    try {
      const res = await fetch(`${API_BASE_URL}/stop`, { method: "POST" })
      return res.ok
    } catch {
      return false
    }
  }
  return sent
}

export function updateSettingsViaWebSocket(settings: any) {
  return sendWebSocketMessage({ settings })
}

export function changeActiveModel(modelType: string) {
  return sendWebSocketMessage({ settings: { model_type: modelType } })
}
