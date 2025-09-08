import React, { useEffect, useCallback } from 'react';
import { DockviewReact, DockviewReadyEvent, IDockviewPanelProps } from 'dockview';
import { ControlPanel } from './components/ControlPanel';
import { IMULineChart } from './components/IMULineChart';
import { Orientation3D } from './components/Orientation3D';
import { StatusPanel } from './components/StatusPanel';
import { LiveMap } from './components/LiveMap';
import { useTelemetryStore } from './store/telemetryStore';
import Trajectory3D from './components/Trajectory3D.tsx';

// Panel wrapper components
const ControlPanelWrapper: React.FC<IDockviewPanelProps> = () => <ControlPanel />;
const IMUChartWrapper: React.FC<IDockviewPanelProps> = () => <IMULineChart />;
const Orientation3DWrapper: React.FC<IDockviewPanelProps> = () => <Orientation3D />;
const StatusPanelWrapper: React.FC<IDockviewPanelProps> = () => <StatusPanel />;
const LiveMapWrapper: React.FC<IDockviewPanelProps> = () => <LiveMap />;
const Trajectory3DWrapper: React.FC<IDockviewPanelProps> = () => <Trajectory3D />;


function App() {
  const { isConnected, currentPacket } = useTelemetryStore();

  const layoutKey = 'dockview_layout_v1';

  const onReady = useCallback((event: DockviewReadyEvent) => {
    // Clear any saved layout to enforce the default
    localStorage.removeItem(layoutKey);

    // Calculate optimal panel sizes based on screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const squareSize = Math.min(Math.floor(screenWidth * 0.25), Math.floor(screenHeight * 0.35));
    const landscapeWidth = Math.floor(squareSize * 1.8);
    const landscapeHeight = Math.floor(squareSize * 0.8);

    // Create a structured layout to prevent overlaps
    // Top row: Trajectory 3D | Orientation 3D | Live Map | Control Panel
    // Bottom row: IMU Chart | Status Panel

    // Add panels in a controlled order with proper positioning

        // Trajectory 3D - top left
    const trajectoryPanel = event.api.addPanel({
      id: 'trajectory-3d',
      component: 'trajectory-3d',
      title: 'Trajectory 3D',
      minimumWidth: Math.floor(squareSize * 0.8),
      minimumHeight: Math.floor(squareSize * 0.8),
      maximumWidth: Math.floor(screenWidth * 0.5),
      maximumHeight: Math.floor(screenHeight * 0.6)
    });

    // Orientation 3D - next to Trajectory
    const orientationPanel = event.api.addPanel({
      id: 'orientation-3d',
      component: 'orientation-3d',
      title: 'Orientation 3D',
      position: { referencePanel: trajectoryPanel, direction: 'right' },
      minimumWidth: Math.floor(squareSize * 0.8),
      minimumHeight: Math.floor(squareSize * 0.8),
      maximumWidth: Math.floor(screenWidth * 0.5),
      maximumHeight: Math.floor(screenHeight * 0.6)
    });

    // Live Map - next to Orientation
    const liveMapPanel = event.api.addPanel({
      id: 'live-map',
      component: 'live-map',
      title: 'Live Map',
      position: { referencePanel: orientationPanel, direction: 'right' },
      minimumWidth: Math.floor(squareSize * 0.6),
      minimumHeight: Math.floor(squareSize * 0.6),
      maximumWidth: Math.floor(screenWidth * 0.4),
      maximumHeight: Math.floor(screenHeight * 0.5)
    });

    // Control Panel - next to Live Map
    event.api.addPanel({
      id: 'control-panel',
      component: 'control-panel',
      title: 'Control',
      position: { referencePanel: liveMapPanel, direction: 'right' },
      minimumWidth: Math.floor(squareSize * 0.8),
      maximumWidth: Math.floor(screenWidth * 0.3)
    });

    // IMU Chart - below Trajectory
    const imuPanel = event.api.addPanel({
      id: 'imu-chart',
      component: 'imu-chart',
      title: 'IMU Chart',
      position: { referencePanel: trajectoryPanel, direction: 'below' },
      minimumWidth: landscapeWidth,
      minimumHeight: landscapeHeight,
      maximumWidth: Math.floor(screenWidth * 0.8),
      maximumHeight: Math.floor(screenHeight * 0.4)
    });

    // Status Panel - next to IMU Chart
    event.api.addPanel({
      id: 'status-panel',
      component: 'status-panel',
      title: 'Status',
      position: { referencePanel: imuPanel, direction: 'right' },
      minimumWidth: Math.floor(squareSize * 0.8),
      minimumHeight: landscapeHeight,
      maximumWidth: Math.floor(screenWidth * 0.4),
      maximumHeight: Math.floor(screenHeight * 0.4)
    });

    // Add CSS to prevent overlaps and improve layout
    const style = document.createElement('style');
    style.textContent = `
      .dockview-theme-light .dv-pane-container {
        position: relative !important;
        z-index: 1 !important;
        overflow: hidden !important;
      }
      .dockview-theme-light .dv-floating-group {
        display: none !important;
      }
      .dockview-theme-light .dv-tabs-and-actions-container {
        position: relative !important;
        z-index: 2 !important;
      }
      .dockview-theme-light .dv-groupview {
        position: relative !important;
        overflow: hidden !important;
      }
      .dockview-theme-light .dv-gridview {
        position: relative !important;
        overflow: hidden !important;
      }
      .dockview-theme-light .dv-view-container {
        position: relative !important;
        overflow: hidden !important;
        contain: layout style paint;
      }
      .dockview-theme-light .dv-resize-handle {
        z-index: 10 !important;
        position: relative !important;
      }
      .panel {
        position: relative !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .panel canvas {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Update document title based on connection status
  useEffect(() => {
    const baseTitle = 'Rocket Telemetry Dashboard';
    const status = isConnected ? '🟢 LIVE' : '🔴 OFFLINE';
    const phase = currentPacket?.phase ? ` - ${currentPacket.phase.toUpperCase()}` : '';
    
    document.title = `${status} ${baseTitle}${phase}`;
  }, [isConnected, currentPacket?.phase]);

  const components = {
    'control-panel': ControlPanelWrapper,
    'imu-chart': IMUChartWrapper,
    'orientation-3d': Orientation3DWrapper,
    'trajectory-3d': Trajectory3DWrapper,
    'status-panel': StatusPanelWrapper,
    'live-map': LiveMapWrapper,
  } as const;

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">
            🚀 Rocket Telemetry Dashboard
          </h1>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {currentPacket && (
            <>
              <div className="text-sm text-gray-600">
                Flight ID: <span className="font-mono">TEST-001</span>
              </div>
              <div className="text-sm text-gray-600">
                Altitude: <span className="font-mono">{currentPacket.baro.altitude.toFixed(1)}m</span>
              </div>
              <div className={`text-sm font-medium uppercase px-2 py-1 rounded ${
                currentPacket.phase === 'powered-ascent' ? 'bg-orange-100 text-orange-800' :
                currentPacket.phase === 'apogee' ? 'bg-blue-100 text-blue-800' :
                currentPacket.phase === 'landed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {currentPacket.phase.replace('-', ' ')}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dockview Layout */}
      <div className="flex-1">
        <DockviewReact
          components={components}
          onReady={(e) => {
            // Disable layout saving to allow rearranging but maintain constraints
            onReady(e);
          }}
          className="dockview-theme-light"
        />
      </div>
    </div>
  );
}

export default App;