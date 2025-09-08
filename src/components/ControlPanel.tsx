import React, { useEffect, useRef } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronDownIcon, PlayIcon, StopIcon, WifiIcon } from '@heroicons/react/24/outline';
import { useTelemetryStore } from '../store/telemetryStore';
import { useTelemetryWebSocket } from '../hooks/useTelemetryWebSocket';
import { useTelemetrySimulation } from '../hooks/useTelemetrySimulation';
import { format } from 'date-fns';

// Mock serial devices for development
const MOCK_DEVICES = [
  '/dev/ttyUSB0 - Flight Computer',
  '/dev/ttyUSB1 - Ground Station',
  '/dev/ttyACM0 - Arduino Mega',
  'COM3 - Serial Bridge',
  'COM7 - USB UART',
];

export const ControlPanel: React.FC = () => {
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const {
    isConnected,
    isSimulating,
    selectedDevice,
    logs,
    followLatest,
    setSelectedDevice,
    setSimulating,
    setFollowLatest,
    addLog,
  } = useTelemetryStore();

  // WebSocket connection for real telemetry
  const { connect, disconnect } = useTelemetryWebSocket({
    url: 'ws://localhost:8080/telemetry',
    enabled: isConnected && !isSimulating,
  });

  // Simulation for development
  useTelemetrySimulation();

  // Auto-scroll console when followLatest is enabled
  useEffect(() => {
    if (followLatest && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, followLatest]);

  const handleConnect = () => {
    if (isConnected) {
      if (isSimulating) {
        setSimulating(false);
      } else {
        disconnect();
      }
    } else {
      if (selectedDevice.includes('Simulation') || !selectedDevice) {
        setSimulating(true);
      } else {
        connect();
      }
    }
  };

  const handleDeviceSelect = (device: string) => {
    setSelectedDevice(device);
    addLog({
      type: 'info',
      message: `Selected device: ${device}`,
      timestamp: new Date(),
    });
  };

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Control Panel</h2>
        
        {/* Device Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Telemetry Source
          </label>
          <Listbox value={selectedDevice} onChange={handleDeviceSelect}>
            <div className="relative">
              <Listbox.Button className="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                <span className="block truncate">
                  {selectedDevice || 'Select Device'}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                </span>
              </Listbox.Button>
              
              <Listbox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                <Listbox.Option
                  value="Simulation Mode"
                  className={({ active }) =>
                    `cursor-default select-none relative py-2 pl-10 pr-4 ${
                      active ? 'text-white bg-blue-600' : 'text-gray-900'
                    }`
                  }
                >
                  Simulation Mode
                </Listbox.Option>
                {MOCK_DEVICES.map((device) => (
                  <Listbox.Option
                    key={device}
                    value={device}
                    className={({ active }) =>
                      `cursor-default select-none relative py-2 pl-10 pr-4 ${
                        active ? 'text-white bg-blue-600' : 'text-gray-900'
                      }`
                    }
                  >
                    {device}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Connection Button */}
        <button
          onClick={handleConnect}
          disabled={!selectedDevice}
          className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isConnected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
          }`}
        >
          {isConnected ? (
            <>
              <StopIcon className="w-4 h-4 mr-2" />
              Disconnect
            </>
          ) : (
            <>
              <PlayIcon className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </button>

        {/* Connection Status */}
        <div className="mt-3 flex items-center space-x-2">
          <WifiIcon className={`w-5 h-5 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
          <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-gray-500'}`}>
            {isConnected ? (isSimulating ? 'Simulation Active' : 'Connected') : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Console */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Console</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={followLatest}
              onChange={(e) => setFollowLatest(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-xs text-gray-600">Follow Latest</span>
          </label>
        </div>
        
        <div
          ref={consoleRef}
          className="flex-1 bg-black text-green-400 font-mono text-xs p-3 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">No messages...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500">
                  [{format(log.timestamp, 'HH:mm:ss.SSS')}]
                </span>
                <span
                  className={`ml-2 ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warning'
                      ? 'text-yellow-400'
                      : log.type === 'success'
                      ? 'text-green-400'
                      : 'text-white'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};