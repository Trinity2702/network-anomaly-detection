// WebSocket client for communicating with the Python backend

// WebSocket URL
const WS_URL = "ws://localhost:8765"

// WebSocket connection
let socket: WebSocket | null = null
let isConnecting = false
const messageQueue: any[] = []
let onMessageCallback: ((data: any) => void) | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000 // 3 seconds

export function connectWebSocket(onMessage: (data: any) => void) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Already connected
    onMessageCallback = onMessage
    return true
  }

  if (isConnecting) {
    // Connection in progress
    onMessageCallback = onMessage
    return true
  }

  isConnecting = true
  onMessageCallback = onMessage

  try {
    socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      console.log("WebSocket connected")
      isConnecting = false
      reconnectAttempts = 0

      // Send any queued messages
      while (messageQueue.length > 0) {
        const message = messageQueue.shift()
        sendWebSocketMessage(message)
      }

      // Start heartbeat
      startHeartbeat()
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (onMessageCallback) {
          onMessageCallback(data)
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error)
      }
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
      isConnecting = false
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      isConnecting = false
      socket = null

      // Attempt to reconnect after a delay
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        console.log(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
        setTimeout(() => {
          if (onMessageCallback) {
            connectWebSocket(onMessageCallback)
          }
        }, RECONNECT_DELAY)
      } else {
        console.error("Max reconnect attempts reached. Please refresh the page.")
      }
    }

    return true
  } catch (error) {
    console.error("Failed to create WebSocket connection:", error)
    isConnecting = false
    return false
  }
}

export function sendWebSocketMessage(message: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    // Queue the message if not connected
    messageQueue.push(message)

    // Try to connect if not already connecting
    if (!isConnecting && onMessageCallback) {
      connectWebSocket(onMessageCallback)
    }
    return false
  }

  try {
    socket.send(JSON.stringify(message))
    return true
  } catch (error) {
    console.error("Error sending WebSocket message:", error)
    return false
  }
}

export function disconnectWebSocket() {
  if (socket) {
    socket.close()
    socket = null
  }
}

// Heartbeat to keep the connection alive
let heartbeatInterval: NodeJS.Timeout | null = null

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }

  heartbeatInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({ ping: Date.now() })
    } else if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }, 30000) // Send heartbeat every 30 seconds
}

// Update model settings
export function updateModelSettings(settings: any) {
  return sendWebSocketMessage({ settings })
}
