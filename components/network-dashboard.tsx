"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { NetworkGraph } from "@/components/network-graph"
import { TrafficChart } from "@/components/traffic-chart"
import { AnomalyTable } from "@/components/anomaly-table"
import { ModelSettings } from "@/components/model-settings"
import { NetworkStats } from "@/components/network-stats"
import { ModelSelector } from "@/components/model-selector"
import { AlertCircle, Activity, BarChart3, Settings, RefreshCw, Brain, Database } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  connectWebSocket,
  disconnectWebSocket,
  getApiStatus,
  trainModel,
  sendStopCommand,
  changeActiveModel,
} from "@/lib/api-client"
import { ModelTraining } from "@/components/model-training"
import { Badge } from "@/components/ui/badge"

export function NetworkDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [isRunning, setIsRunning] = useState(false)
  const [trafficData, setTrafficData] = useState<any[]>([])
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [stats, setStats] = useState({
    packetsAnalyzed: 0,
    anomaliesDetected: 0,
    lastUpdated: new Date(),
    alertLevel: "normal",
  })
  const [modelSettings, setModelSettings] = useState({
    threshold: 0.15,
    sensitivity: 0.7,
    features: ["packetSize", "flowDuration", "throughput", "packetLoss", "latency"],
  })
  const [apiStatus, setApiStatus] = useState({
    models_loaded: {
      autoencoder: false,
      one_class_svm: false,
      isolation_forest: false,
      pca: false,
    },
    active_model: "autoencoder",
    is_generating: false,
    connected: false,
  })
  const [isTraining, setIsTraining] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState({
    api: false,
    websocket: false,
    checking: true,
  })

  const isStopping = useRef(false)
  const lastDataTime = useRef(Date.now())

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        setConnectionStatus((prev) => ({ ...prev, checking: true }))
        const status = await getApiStatus()
        setApiStatus({
          ...status,
          connected: true,
        })
        setConnectionStatus((prev) => ({ ...prev, api: true, checking: false }))
      } catch (error) {
        console.error("Failed to connect to API:", error)
        setApiStatus({
          models_loaded: {
            autoencoder: false,
            one_class_svm: false,
            isolation_forest: false,
            pca: false,
          },
          active_model: "autoencoder",
          is_generating: false,
          connected: false,
        })
        setConnectionStatus((prev) => ({ ...prev, api: false, checking: false }))
      }
    }

    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleWebSocketMessage = (message: any) => {
    setConnectionStatus((prev) => ({ ...prev, websocket: true }))
    lastDataTime.current = Date.now()

    if (message.type === "traffic_data" && isRunning && !isStopping.current) {
      const newData = message.data.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }))

      setTrafficData((prev) => {
        const updated = [...prev, ...newData]
        return updated.slice(Math.max(0, updated.length - 100))
      })

      const newAnomalies = newData
        .filter((item: any) => item.isAnomaly)
        .map((item: any) => ({
          timestamp: item.timestamp,
          type: item.anomalyType,
          score: item.anomalyScore,
          source: item.source,
          destination: item.destination,
          protocol: item.protocol,
          modelUsed: item.modelUsed || apiStatus.active_model,
        }))

      if (newAnomalies.length > 0) {
        setAnomalies((prev) => {
          const updated = [...prev, ...newAnomalies]
          return updated.slice(Math.max(0, updated.length - 50))
        })
      }

      setStats((prev) => ({
        packetsAnalyzed: prev.packetsAnalyzed + newData.length,
        anomaliesDetected: prev.anomaliesDetected + newAnomalies.length,
        lastUpdated: new Date(),
        alertLevel: newAnomalies.length > 2 ? "high" : newAnomalies.length > 0 ? "medium" : prev.alertLevel,
      }))
    } else if (message.type === "settings_updated") {
      setModelSettings({
        threshold: message.settings.threshold,
        sensitivity: message.settings.sensitivity,
        features: message.settings.selected_features,
      })

      if (message.settings.active_model) {
        setApiStatus((prev) => ({ ...prev, active_model: message.settings.active_model }))
      }
    } else if (message.type === "command_response" && message.command === "stop") {
      isStopping.current = false
      setIsRunning(false)
      setConnectionStatus((prev) => ({ ...prev, websocket: false }))
    }
  }

  useEffect(() => {
    if (!isRunning || isStopping.current) return

    const interval = setInterval(() => {
      const now = Date.now()
      if (isRunning && !isStopping.current && now - lastDataTime.current > 5000) {
        disconnectWebSocket()
        setTimeout(() => {
          if (isRunning && !isStopping.current) {
            connectWebSocket(handleWebSocketMessage)
          }
        }, 1000)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (isRunning) {
      connectWebSocket(handleWebSocketMessage)
      lastDataTime.current = Date.now()
    } else {
      if (connectionStatus.websocket && !isStopping.current) {
        isStopping.current = true
        sendStopCommand()
        setTimeout(() => {
          if (isStopping.current) {
            disconnectWebSocket()
            isStopping.current = false
            setConnectionStatus((prev) => ({ ...prev, websocket: false }))
          }
        }, 3000)
      }
    }

    return () => {
      if (connectionStatus.websocket) {
        isStopping.current = true
        sendStopCommand()
        setTimeout(() => {
          disconnectWebSocket()
          isStopping.current = false
        }, 1000)
      }
    }
  }, [isRunning, connectionStatus.websocket])

  const toggleRunning = async () => {
    if (isRunning) {
      isStopping.current = true
      await sendStopCommand()
    } else {
      isStopping.current = false
    }
    setIsRunning(!isRunning)
  }

  const handleSettingsChange = (newSettings: any) => {
    setModelSettings((prev) => ({ ...prev, ...newSettings }))
  }

  const handleModelChange = (modelType: string) => {
    changeActiveModel(modelType)
    setApiStatus((prev) => ({ ...prev, active_model: modelType }))
  }

  const resetData = () => {
    setTrafficData([])
    setAnomalies([])
    setStats({ packetsAnalyzed: 0, anomaliesDetected: 0, lastUpdated: new Date(), alertLevel: "normal" })
  }

  const handleTrainModel = async (options: any) => {
    try {
      setIsTraining(true)
      await trainModel(options)
      setTimeout(() => {
        getApiStatus().then((status) => setApiStatus((prev) => ({ ...prev, ...status })))
      }, 5000)
    } catch (error) {
      console.error("Error training model:", error)
    } finally {
      setIsTraining(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Network Traffic Anomaly Detection</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">API:</span>
          <span
            className={`inline-block w-3 h-3 rounded-full ${connectionStatus.api ? "bg-green-500" : "bg-red-500"}`}
          ></span>

          <span className="font-medium ml-4">WebSocket:</span>
          <span
            className={`inline-block w-3 h-3 rounded-full ${
              connectionStatus.websocket
                ? "bg-green-500"
                : isStopping.current
                  ? "bg-yellow-500"
                  : connectionStatus.checking
                    ? "bg-yellow-500"
                    : "bg-red-500"
            }`}
          ></span>

          <span className="font-medium ml-4">Active Model:</span>
          <Badge variant="outline" className="ml-1">
            {apiStatus.active_model === "one_class_svm"
              ? "One-Class SVM"
              : apiStatus.active_model === "isolation_forest"
                ? "Isolation Forest"
                : apiStatus.active_model === "pca"
                  ? "PCA"
                  : "Autoencoder"}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <Button variant={isRunning ? "destructive" : "default"} onClick={toggleRunning} disabled={isStopping.current}>
            {isRunning ? (isStopping.current ? "Stopping..." : "Stop Analysis") : "Start Analysis"}
          </Button>
          <Button variant="outline" onClick={resetData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {!apiStatus.connected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Cannot connect to the backend API. Please make sure the Python backend is running.
          </AlertDescription>
        </Alert>
      )}

      {apiStatus.connected && !Object.values(apiStatus.models_loaded).some(Boolean) && (
        <Alert>
          <Brain className="h-4 w-4" />
          <AlertTitle>No Models Loaded</AlertTitle>
          <AlertDescription>
            No trained models detected. Please train at least one model using the Model Training tab.
          </AlertDescription>
        </Alert>
      )}

      {stats.alertLevel !== "normal" && (
        <Alert variant={stats.alertLevel === "high" ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{stats.alertLevel === "high" ? "Critical Alert!" : "Warning"}</AlertTitle>
          <AlertDescription>
            {stats.alertLevel === "high"
              ? "Multiple network anomalies detected. Possible security breach in progress."
              : "Unusual network activity detected. Monitor the situation."}
          </AlertDescription>
        </Alert>
      )}

      <NetworkStats stats={stats} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="overview">
            <Activity className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="traffic">
            <BarChart3 className="mr-2 h-4 w-4" />
            Traffic Analysis
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <AlertCircle className="mr-2 h-4 w-4" />
            Anomalies
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Model Settings
          </TabsTrigger>
          <TabsTrigger value="models">
            <Database className="mr-2 h-4 w-4" />
            Model Selection
          </TabsTrigger>
          <TabsTrigger value="training">
            <Brain className="mr-2 h-4 w-4" />
            Model Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Network Traffic Visualization</CardTitle>
                <CardDescription>Real-time network traffic flow</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <NetworkGraph data={trafficData} anomalies={anomalies} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Traffic Metrics</CardTitle>
                <CardDescription>Key network metrics over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <TrafficChart data={trafficData} selectedFeatures={["packetSize", "throughput", "latency"]} combined />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Anomalies</CardTitle>
              <CardDescription>Latest detected unusual activities</CardDescription>
            </CardHeader>
            <CardContent>
              <AnomalyTable anomalies={anomalies.slice(0, 5)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Traffic Analysis</CardTitle>
              <CardDescription>Comprehensive view of network traffic patterns</CardDescription>
            </CardHeader>
            <CardContent className="py-6">
              <TrafficChart data={trafficData} detailed selectedFeatures={modelSettings.features} combined={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Log</CardTitle>
              <CardDescription>Complete history of detected anomalies</CardDescription>
            </CardHeader>
            <CardContent>
              <AnomalyTable anomalies={anomalies} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly Detection Settings</CardTitle>
              <CardDescription>Configure the anomaly detection parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <ModelSettings settings={modelSettings} onSettingsChange={setModelSettings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <ModelSelector
            modelsLoaded={apiStatus.models_loaded}
            activeModel={apiStatus.active_model}
            onModelChange={handleModelChange}
          />
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Training</CardTitle>
              <CardDescription>Train machine learning models on your network traffic data</CardDescription>
            </CardHeader>
            <CardContent>
              <ModelTraining
                onTrain={handleTrainModel}
                isTraining={isTraining}
                modelsLoaded={apiStatus.models_loaded}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
