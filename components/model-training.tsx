"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTrainingStatus, trainModel } from "@/lib/api-client"

interface ModelTrainingProps {
  onTrain?: (options: any) => void // optional, we call API directly
  isTraining: boolean
  modelsLoaded: {
    autoencoder: boolean
    one_class_svm: boolean
    isolation_forest: boolean
    pca: boolean
  }
}

export function ModelTraining({ isTraining, modelsLoaded }: ModelTrainingProps) {
  const [activeTab, setActiveTab] = useState("autoencoder")

  // Common
  const [datasetSize, setDatasetSize] = useState(3000)

  // Autoencoder
  const [epochs, setEpochs] = useState(50)
  const [batchSize, setBatchSize] = useState(32)
  const [encodingDim, setEncodingDim] = useState(8)

  // OCSVM
  const [nu, setNu] = useState(0.1)

  // Isolation Forest
  const [contamination, setContamination] = useState(0.1)

  // PCA
  const [nComponents, setNComponents] = useState(2)

  // Training status poll
  const [trainState, setTrainState] = useState<any>({
    running: false,
    model_type: null,
    epoch: 0,
    total_epochs: 0,
    progress: 0,
    message: "",
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const tick = async () => {
      try {
        const s = await getTrainingStatus()
        setTrainState(s)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleTrain = async () => {
    const body: any = {
      model_type: activeTab,
      dataset_size: datasetSize,
    }
    if (activeTab === "autoencoder") {
      body.epochs = epochs
      body.batch_size = batchSize
      body.encoding_dim = encodingDim
    } else if (activeTab === "one_class_svm") {
      body.nu = nu
    } else if (activeTab === "isolation_forest") {
      body.contamination = contamination
    } else if (activeTab === "pca") {
      body.n_components = nComponents
    }

    setBusy(true)
    try {
      await trainModel(body)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const progressPct = Math.round((trainState.progress || 0) * 100)

  return (
    <div className="space-y-6">
      {Object.values(modelsLoaded).some(Boolean) && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Some models are already trained. Training a new model replaces the existing one of the same type.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Dataset size (new each run)</Label>
          <Input
            type="number"
            min={500}
            step={100}
            value={datasetSize}
            onChange={(e) => setDatasetSize(Number(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2 flex items-end text-sm text-muted-foreground">
          A fresh synthetic dataset will be generated every time you click Train.
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="autoencoder">Autoencoder</TabsTrigger>
          <TabsTrigger value="one_class_svm">One-Class SVM</TabsTrigger>
          <TabsTrigger value="isolation_forest">Isolation Forest</TabsTrigger>
          <TabsTrigger value="pca">PCA</TabsTrigger>
        </TabsList>

        <TabsContent value="autoencoder" className="space-y-4">
          <div className="space-y-2">
            <Label>Training Epochs</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={10}
                max={100}
                step={5}
                value={[epochs]}
                onValueChange={(v) => setEpochs(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Batch Size</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={8}
                max={128}
                step={8}
                value={[batchSize]}
                onValueChange={(v) => setBatchSize(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Encoding Dimension</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={2}
                max={16}
                step={1}
                value={[encodingDim]}
                onValueChange={(v) => setEncodingDim(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={encodingDim}
                onChange={(e) => setEncodingDim(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="one_class_svm" className="space-y-4">
          <div className="space-y-2">
            <Label>Nu Parameter</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={0.01}
                max={0.5}
                step={0.01}
                value={[nu]}
                onValueChange={(v) => setNu(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                step={0.01}
                value={nu}
                onChange={(e) => setNu(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="isolation_forest" className="space-y-4">
          <div className="space-y-2">
            <Label>Contamination</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={0.01}
                max={0.5}
                step={0.01}
                value={[contamination]}
                onValueChange={(v) => setContamination(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                step={0.01}
                value={contamination}
                onChange={(e) => setContamination(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pca" className="space-y-4">
          <div className="space-y-2">
            <Label>Number of Components</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={1}
                max={10}
                step={1}
                value={[nComponents]}
                onValueChange={(v) => setNComponents(v[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={nComponents}
                onChange={(e) => setNComponents(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Training progress */}
      <div className="rounded-md border p-3 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">
              Status: {trainState.message || (trainState.running ? "Training..." : "Idle")}
            </div>
            {trainState.model_type && <div className="text-muted-foreground">Model: {trainState.model_type}</div>}
          </div>
          <div className="text-right">
            {trainState.total_epochs > 0 && (
              <div>
                Epoch {trainState.epoch}/{trainState.total_epochs} ({Math.round((trainState.progress || 0) * 100)}%)
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 h-2 w-full rounded bg-gray-200 dark:bg-gray-800">
          <div
            className="h-2 rounded bg-emerald-500 transition-all"
            style={{ width: `${Math.round((trainState.progress || 0) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleTrain} disabled={busy || trainState.running}>
          {trainState.running ? (
            <>
              <Brain className="mr-2 h-4 w-4 animate-pulse" />
              Training...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Train {activeTab.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase())}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
