import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  RefreshCw,
  Layers,
  Camera,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { AdbDevice, SampleApp, InteractiveElement } from '../../types';

interface AdbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleMode: () => void;
  onCaptureDevice?: (app: SampleApp) => void;
}

export const AdbModal: React.FC<AdbModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleMode,
  onCaptureDevice,
}) => {
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const devList = await api.getAdbDevices();
      setDevices(devList);
      if (devList.length > 0) {
        setSelectedDeviceId(devList[0].id);
      }
    } catch (err: any) {
      setStatusMessage('ADB daemon is running. No devices attached via USB or wireless.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptureFromDevice = async () => {
    if (!selectedDeviceId) return;
    setIsCapturing(true);
    setStatusMessage(null);
    try {
      const [screenRes, hierRes] = await Promise.all([
        api.captureAdbScreen(selectedDeviceId),
        api.getAdbHierarchy(selectedDeviceId),
      ]);

      const rawNodes = hierRes.nodes || [];
      const maxX = Math.max(...rawNodes.map((n: any) => n.bounds?.x2 || n.bounds?.width || 390), 390);
      const maxY = Math.max(...rawNodes.map((n: any) => n.bounds?.y2 || 844), 844);
      const scale = maxX > 450 ? 390 / maxX : 1;
      const viewportHeight = Math.max(844, Math.round(maxY * scale));

      const interactiveElements: InteractiveElement[] = rawNodes.map((n: any) => {
        const rawX = n.bounds?.x ?? n.bounds?.x1 ?? 0;
        const rawY = n.bounds?.y ?? n.bounds?.y1 ?? 0;
        const rawW = n.bounds?.width ?? (n.bounds?.x2 ? n.bounds.x2 - rawX : 100);
        const rawH = n.bounds?.height ?? (n.bounds?.y2 ? n.bounds.y2 - rawY : 40);

        return {
          id: n.id,
          name: n.text || (n.resourceId ? n.resourceId.split('/').pop() : '') || n.className.split('.').pop() || 'Widget',
          selector: n.resourceId || n.className,
          bounds: {
            x: Math.round(rawX * scale),
            y: Math.round(rawY * scale),
            width: Math.max(20, Math.round(rawW * scale)),
            height: Math.max(10, Math.round(rawH * scale)),
          },
          tagName: n.className.split('.').pop() || 'View',
          className: n.className,
          codeSnippet: `<${n.className.split('.').pop()} ${
            n.resourceId ? `android:id="${n.resourceId}" ` : ''
          }${n.text ? `android:text="${n.text}" ` : ''}/>`,
          styles: {
            backgroundColor: '#0f172a',
            textColor: '#f8fafc',
            fontSize: '14px',
            borderRadius: '8px',
          },
        };
      });

      const activeDev = devices.find((d) => d.id === selectedDeviceId);
      const app: SampleApp = {
        id: `adb-live-${selectedDeviceId}-${Date.now()}`,
        platform: 'mobile',
        name: `Android: ${activeDev?.model || selectedDeviceId}`,
        viewport: { width: 390, height: viewportHeight },
        description: `Live capture from Android device (${selectedDeviceId})`,
        interactiveElements,
        screenshotUrl: screenRes.imageBase64,
      };

      if (onCaptureDevice) {
        onCaptureDevice(app);
      }
      onClose();
    } catch (err: any) {
      setStatusMessage(`Capture failed: ${err.message}. Loaded simulated mobile mode.`);
      onSelectSampleMode();
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-studio-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Android ADB Device Inspector</h3>
              <p className="text-[11px] text-studio-400">
                Inspect native view hierarchies & capture mobile UI screens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-studio-400 hover:text-white hover:bg-studio-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-studio-300">Attached Devices</span>
            <button
              onClick={loadDevices}
              disabled={isLoading}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="bg-studio-950 p-4 rounded-xl border border-studio-800 text-center space-y-2">
              <Smartphone className="w-8 h-8 text-studio-600 mx-auto stroke-1" />
              <p className="text-xs font-medium text-studio-300">No physical device connected</p>
              <p className="text-[11px] text-studio-500 max-w-xs mx-auto">
                Connect your Android phone with <strong>USB Debugging enabled</strong> or start an Android Emulator.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    onSelectSampleMode();
                    onClose();
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-xs font-semibold border border-indigo-500/40 transition-colors"
                >
                  Load Simulated Mobile Device Screen
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDeviceId(dev.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedDeviceId === dev.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-studio-950 border-studio-800 text-studio-300 hover:border-studio-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-medium text-xs block">{dev.model}</span>
                      <span className="text-[10px] font-mono text-studio-500">{dev.id}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {dev.state}
                  </span>
                </div>
              ))}
            </div>
          )}

          {statusMessage && (
            <p className="text-[11px] text-studio-400 bg-studio-950 p-2.5 rounded-lg border border-studio-800">
              {statusMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-studio-800 flex justify-end gap-2 bg-studio-900">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-studio-300 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
          {devices.length > 0 && (
            <button
              onClick={handleCaptureFromDevice}
              disabled={isCapturing || !selectedDeviceId}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCapturing ? 'Capturing Screen & Tree...' : 'Capture Screen & Nodes'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
