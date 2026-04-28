// API client for communicating with the Python backend

// Base URL for the API
const API_BASE_URL = "http://localhost:8000"

// Function to detect anomalies using the REST API
export async function detectAnomalies(trafficData: any[]) {
  try {
    const response = await fetch(`${API_BASE_URL}/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: trafficData }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const result = await response.json()
    return result.anomalies || []
  } catch (error) {
    console.error("Error detecting anomalies:", error)
    return []
  }
}

// Function to update model settings
export async function updateModelSettings(settings: any) {
  try {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error updating settings:", error)
    throw error
  }
}

// WebSocket connection for real-time data
let socket: WebSocket | null = null
let isConnecting = false
const messageQueue: any[] = []
let onMessageCallback: ((data: any) => void) | null = null

export function connectWebSocket(onMessage: (data: any) => void) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Already connected
    onMessageCallback = onMessage
    return
  }

  if (isConnecting) {
    // Connection in progress
    onMessageCallback = onMessage
    return
  }

  isConnecting = true
  onMessageCallback = onMessage

  socket = new WebSocket(`ws://localhost:8000/ws`)

  socket.onopen = () => {
    console.log("WebSocket connected")
    isConnecting = false

    // Send any queued messages
    while (messageQueue.length > 0) {
      const message = messageQueue.shift()
      sendWebSocketMessage(message)
    }
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
    setTimeout(() => {
      if (onMessageCallback) {
        connectWebSocket(onMessageCallback)
      }
    }, 5000)
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
    return
  }

  socket.send(JSON.stringify(message))
}

export function disconnectWebSocket() {
  if (socket) {
    socket.close()
    socket = null
  }
}
