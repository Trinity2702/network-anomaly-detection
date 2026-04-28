"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Package, Shield } from "lucide-react";

interface NetworkStatsProps {
  stats: {
    packetsAnalyzed: number;
    anomaliesDetected: number;
    lastUpdated: Date;
    alertLevel: string;
  };
}

export function NetworkStats({ stats }: NetworkStatsProps) {
  const [clientTime, setClientTime] = useState<string>("");

  // Fix hydration mismatch: render time only after client mounts
  useEffect(() => {
    if (stats.lastUpdated) {
      setClientTime(new Date(stats.lastUpdated).toLocaleTimeString());
    }
  }, [stats.lastUpdated]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Packets Analyzed */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Package className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Packets Analyzed</p>
              <h3 className="text-2xl font-bold">{stats.packetsAnalyzed.toLocaleString()}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies Detected */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <AlertTriangle
              className={`h-10 w-10 ${
                stats.anomaliesDetected > 0 ? "text-amber-500" : "text-green-500"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Anomalies Detected</p>
              <h3 className="text-2xl font-bold">{stats.anomaliesDetected.toLocaleString()}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Level */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Shield
              className={`h-10 w-10 ${
                stats.alertLevel === "high"
                  ? "text-red-500"
                  : stats.alertLevel === "medium"
                  ? "text-amber-500"
                  : "text-green-500"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Alert Level</p>
              <h3 className="text-2xl font-bold capitalize">{stats.alertLevel}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Clock className="h-10 w-10 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <h3 className="text-sm font-bold">
                {clientTime || "—"}
              </h3>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
