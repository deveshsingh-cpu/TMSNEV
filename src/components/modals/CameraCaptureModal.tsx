import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  Check,
  AlertTriangle,
  RotateCcw,
  Copy,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { getIstDateTimeParts } from '../../utils/logBookReconciliation.js';

interface CameraCaptureModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  vehicleLabel?: string;
  onCapture: (dataUrl: string, capturedAtIso: string) => void;
  onClose: () => void;
}

type CameraErrorType =
  | 'permission_denied'
  | 'no_camera'
  | 'camera_in_use'
  | 'unsupported'
  | 'other';

interface CameraErrorState {
  type: CameraErrorType;
  message: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  title,
  subtitle,
  vehicleLabel,
  onCapture,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<CameraErrorState | null>(null);
  const [permissionState, setPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unknown'
  >('unknown');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedIso, setCapturedIso] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isInIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const refreshPermissionStatus = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const res = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (res?.state === 'granted' || res?.state === 'prompt' || res?.state === 'denied') {
          setPermissionState(res.state);
          return res.state;
        }
      }
    } catch {
      // Some browsers (Safari / WebView) do not support permissions.query('camera')
    }
    setPermissionState('unknown');
    return 'unknown';
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setCopiedUrl(false);
    setIsStarting(true);
    await refreshPermissionStatus();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setIsStarting(false);
      setCameraError({
        type: 'unsupported',
        message:
          'Direct live camera access is blocked or not supported in this browser/webview. Open the app directly in Chrome or Safari over HTTPS with camera access enabled.',
      });
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
      } catch (primaryErr: any) {
        const errName = String(primaryErr?.name || '');
        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errName === 'SecurityError'
        ) {
          throw primaryErr;
        }
        // Fallback to any available camera if exact facingMode/resolution constraint fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setPermissionState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setIsStarting(false);
    } catch (err: any) {
      setIsStarting(false);
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setPermissionState('denied');
        setCameraError({
          type: 'permission_denied',
          message:
            'Camera permission is currently blocked or denied. Enable camera access using the steps below to capture live verification photos.',
        });
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError({
          type: 'no_camera',
          message:
            'No camera hardware was detected on this device. Uploading pre-recorded gallery photos is disabled for verification.',
        });
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError({
          type: 'camera_in_use',
          message:
            'Camera is currently being used by another app or tab. Close other camera/video apps and tap Retry Camera.',
        });
      } else {
        setCameraError({
          type: 'other',
          message: err?.message || 'Unable to start live camera feed.',
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCapturedIso('');
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.max(320, Math.round(video.videoWidth * scale));
    const height = Math.max(240, Math.round(video.videoHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Subtle verification stamp strip at bottom
    const now = new Date();
    const { dateStr, timeWithSecondsStr, iso } = getIstDateTimeParts(now);
    const stampText = `${vehicleLabel ? `${vehicleLabel} · ` : ''}${title} · ${dateStr} ${timeWithSecondsStr} IST`;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, height - 26, width, 26);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(stampText, 10, height - 9, width - 20);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    setCapturedPreview(dataUrl);
    setCapturedIso(iso);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setCapturedIso('');
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (!capturedPreview) return;
    const out = capturedPreview;
    const iso = capturedIso || new Date().toISOString();
    stopCamera();
    onCapture(out, iso);
  };

  const handleCopyAppUrl = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 3000);
      }
    } catch {
      // ignore clipboard errors silently
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h4 className="text-sm font-bold truncate">{title}</h4>
            <p className="text-[11px] text-slate-300 truncate">
              {subtitle || 'Live camera capture only — gallery/file uploads disabled'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div
            className={`relative w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center ${
              cameraError ? 'min-h-[280px]' : 'aspect-[4/3]'
            }`}
          >
            {capturedPreview ? (
              <img
                src={capturedPreview}
                alt={title}
                className="w-full h-full object-contain"
              />
            ) : cameraError ? (
              <div className="p-4 sm:p-5 text-left space-y-3 text-slate-100 w-full">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                    {cameraError.type === 'permission_denied' ||
                    cameraError.type === 'unsupported' ? (
                      <ShieldAlert className="w-5 h-5 text-amber-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-xs sm:text-sm font-bold text-white">
                        {cameraError.type === 'permission_denied'
                          ? 'Camera Permission Required'
                          : cameraError.type === 'camera_in_use'
                          ? 'Camera Busy in Another App'
                          : cameraError.type === 'no_camera'
                          ? 'No Camera Detected'
                          : 'Live Camera Unavailable'}
                      </h5>
                      {permissionState !== 'unknown' && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/30 text-[10px] font-bold uppercase text-rose-200">
                          Status: {permissionState}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {cameraError.message}
                    </p>
                  </div>
                </div>

                {(cameraError.type === 'permission_denied' ||
                  cameraError.type === 'unsupported' ||
                  cameraError.type === 'other') && (
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 text-[11px] text-slate-200">
                    <div className="font-bold text-amber-300 uppercase tracking-wider text-[10px]">
                      How to Enable Live Camera Permission
                    </div>

                    {isAndroid ? (
                      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                        <li>
                          <strong className="text-white">In Browser (Chrome):</strong> Tap the{' '}
                          <strong className="text-white">Lock / Tune icon</strong> or{' '}
                          <strong className="text-white">⋮ Menu → Site settings → Camera</strong>{' '}
                          and select <strong className="text-emerald-300">Allow</strong>.
                        </li>
                        <li>
                          <strong className="text-white">In Android App / WebView:</strong> Open phone{' '}
                          <strong className="text-white">
                            Settings → Apps → Browser / App → Permissions → Camera
                          </strong>{' '}
                          and choose <strong className="text-emerald-300">Allow only while using the app</strong>.
                        </li>
                        <li>
                          Come back to this screen and tap{' '}
                          <strong className="text-amber-300">Retry Camera</strong>.
                        </li>
                      </ol>
                    ) : isIOS ? (
                      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                        <li>
                          Tap <strong className="text-white">AA / Page Settings</strong> in Safari&apos;s address bar →{' '}
                          <strong className="text-white">Website Settings → Camera → Allow</strong>.
                        </li>
                        <li>
                          Also verify iPhone{' '}
                          <strong className="text-white">Settings → Safari → Camera → Allow</strong>.
                        </li>
                        <li>
                          Tap <strong className="text-amber-300">Retry Camera</strong> below.
                        </li>
                      </ol>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                        <li>
                          Click the <strong className="text-white">Camera / Lock / Site Settings icon</strong> on the left side of the browser address bar.
                        </li>
                        <li>
                          Change <strong className="text-white">Camera</strong> from Block to{' '}
                          <strong className="text-emerald-300">Allow</strong> (and check OS privacy settings if still blocked).
                        </li>
                        <li>
                          Click <strong className="text-amber-300">Retry Camera</strong> below (or reload the page if your browser asks).
                        </li>
                      </ol>
                    )}

                    {isInIframe && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <p className="text-[11px] text-slate-300 leading-relaxed flex items-start gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span>
                            Running inside an embedded preview window. If the host app blocks camera access even after enabling phone settings, copy the direct app link and open it in{' '}
                            <strong className="text-white">Chrome / Safari</strong>.
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={handleCopyAppUrl}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold text-[11px] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-sky-300" />
                          <span>{copiedUrl ? 'App Link Copied — Paste in Chrome' : 'Copy Direct App Link'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {isStarting && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs font-semibold text-white">
                    Starting camera viewfinder...
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 shrink-0">
            {!capturedPreview ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  disabled={!!cameraError || isStarting}
                  className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{facingMode === 'environment' ? 'Rear Camera' : 'Front Camera'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTakeSnapshot}
                  disabled={!!cameraError || isStarting}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Capture Live Photo</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake via Camera</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Use This Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
