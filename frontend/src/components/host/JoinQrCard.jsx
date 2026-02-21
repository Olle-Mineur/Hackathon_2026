import { useEffect, useState } from "react";
import QRCode from "qrcode";

const JoinQrCard = ({ lobbyId }) => {
  const [joinUrl, setJoinUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!lobbyId || typeof window === "undefined") {
      setJoinUrl("");
      setQrDataUrl("");
      return () => {};
    }

    const url = `${window.location.origin}/play/${lobbyId}`;
    setJoinUrl(url);

    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (alive) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (alive) setQrDataUrl("");
      });

    return () => {
      alive = false;
    };
  }, [lobbyId]);

  if (!lobbyId) return null;

  const onCopy = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <div className="max-w-sm mx-auto mb-6 bg-white rounded-xl p-4 shadow-lg text-center">
      <p className="font-semibold text-gray-800 mb-2">Scan to join</p>

      {qrDataUrl ? (
        <img
          className="mx-auto rounded"
          width="220"
          height="220"
          alt="Join lobby QR code"
          src={qrDataUrl}
        />
      ) : (
        <div className="w-[220px] h-[220px] mx-auto bg-gray-100 rounded animate-pulse" />
      )}

      <p className="mt-3 text-sm text-gray-600 break-all">{joinUrl || "..."}</p>
      <p className="mt-1 text-xs text-gray-500">
        Code: {String(lobbyId).toUpperCase()}
      </p>

      <button
        type="button"
        onClick={onCopy}
        disabled={!joinUrl}
        className="mt-3 px-3 py-1.5 rounded bg-gray-800 text-white text-sm disabled:opacity-50"
      >
        {copied ? "Copied!" : "Copy join link"}
      </button>
    </div>
  );
};

export default JoinQrCard;
