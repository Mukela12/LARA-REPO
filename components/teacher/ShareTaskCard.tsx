import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, Link, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatTaskCode } from '../../lib/taskCodes';

interface ShareTaskCardProps {
  taskCode: string;
  isDisabled?: boolean;
}

export const ShareTaskCard: React.FC<ShareTaskCardProps> = ({
  taskCode,
  isDisabled = false,
}) => {
  const [copied, setCopied] = useState(false);

  const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
  const taskLink = `${baseUrl}?taskCode=${taskCode}`;
  const formattedCode = formatTaskCode(taskCode);

  const handleCopy = async () => {
    if (isDisabled) return;

    try {
      await navigator.clipboard.writeText(taskLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Silent fail - clipboard API may not be available
    }
  };

  return (
    <motion.div
      data-tutorial="share-task"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border p-5 ${
        isDisabled
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-gradient-to-br from-brand-50 to-white border-brand-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isDisabled ? 'bg-slate-200 text-slate-400' : 'bg-brand-100 text-brand-600'
        }`}>
          <Share2 className="w-4 h-4" />
        </div>
        <h3 className={`font-semibold ${isDisabled ? 'text-slate-500' : 'text-slate-900'}`}>
          Share with Students
        </h3>
      </div>

      {/* Link Display */}
      <div className={`flex items-center gap-2 rounded-lg border p-3 mb-4 ${
        isDisabled
          ? 'bg-slate-100 border-slate-200'
          : 'bg-white border-slate-200'
      }`}>
        <Link className={`w-4 h-4 flex-shrink-0 ${isDisabled ? 'text-slate-300' : 'text-slate-400'}`} />
        <span className={`flex-1 font-mono text-sm truncate ${
          isDisabled ? 'text-slate-400' : 'text-slate-700'
        }`}>
          {taskLink}
        </span>

        {/* Copy Button */}
        <motion.button
          onClick={handleCopy}
          disabled={isDisabled}
          whileHover={!isDisabled ? { scale: 1.02 } : {}}
          whileTap={!isDisabled ? { scale: 0.98 } : {}}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
            isDisabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : copied
              ? 'bg-emerald-500 text-white'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* QR Code and Helper Text */}
      <div className="flex items-start gap-4">
        {/* QR Code */}
        <div className={`flex-shrink-0 p-2 rounded-lg border ${
          isDisabled
            ? 'bg-slate-100 border-slate-200'
            : 'bg-white border-slate-200'
        }`}>
          <QRCodeSVG
            value={taskLink}
            size={80}
            level="M"
            includeMargin={false}
            bgColor="transparent"
            fgColor={isDisabled ? '#94a3b8' : '#1e293b'}
          />
        </div>

        {/* Helper Text */}
        <div className="flex-1">
          <p className={`text-sm ${isDisabled ? 'text-slate-400' : 'text-slate-600'}`}>
            Students can scan the QR code, use the link, or enter code:{' '}
            <span className={`font-mono font-bold ${isDisabled ? 'text-slate-500' : 'text-slate-800'}`}>
              {formattedCode}
            </span>
          </p>
          <p className={`text-xs mt-1 ${isDisabled ? 'text-slate-400' : 'text-slate-500'}`}>
            <QrCode className="w-3 h-3 inline mr-1" />
            Show QR code on projector for quick classroom access
          </p>
        </div>
      </div>

      {/* Disabled Warning */}
      {isDisabled && (
        <p className="text-xs text-amber-600 mt-3 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          This task is inactive. Activate it to share with students.
        </p>
      )}
    </motion.div>
  );
};
