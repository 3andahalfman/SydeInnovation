'use client';

import { useState } from 'react';
import { LayoutGrid, AlertTriangle, X } from 'lucide-react';
import { CONFIGURATOR_TEMPLATES } from '@/types/product';

// ============================================================================
// TEMPLATE PICKER DIALOG
// ============================================================================

interface TemplatePickerDialogProps {
  onSelect: (templateId: string) => void;
  onClose: () => void;
  isReset?: boolean; // When true, show warning about layout reset
}

export default function TemplatePickerDialog({ onSelect, onClose, isReset }: TemplatePickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[560px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center border border-orange-500/30">
              <LayoutGrid className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isReset ? 'Change Template' : 'Choose a Template'}
              </h2>
              <p className="text-sm text-gray-400">
                {isReset
                  ? 'Select a new template for your configurator'
                  : 'Pick a starting layout for your product configurator'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reset Warning */}
        {isReset && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">This will replace your current layout</p>
              <p className="text-xs text-amber-400/80 mt-0.5">All existing elements and arrangements will be reset. This action cannot be undone.</p>
            </div>
          </div>
        )}

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            {CONFIGURATOR_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={`group text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg ${
                  selectedId === template.id
                    ? 'border-orange-500 bg-orange-500/5 shadow-orange-500/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                }`}
              >
                {/* SVG Thumbnail */}
                <div
                  className={`w-full aspect-[200/140] p-3 transition-colors ${
                    selectedId === template.id
                      ? 'bg-slate-800'
                      : 'bg-slate-900 group-hover:bg-slate-800/80'
                  }`}
                  dangerouslySetInnerHTML={{ __html: template.thumbnail }}
                />

                {/* Info */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold transition-colors ${
                      selectedId === template.id ? 'text-orange-400' : 'text-white group-hover:text-orange-300'
                    }`}>
                      {template.name}
                    </h3>
                    {selectedId === template.id && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-orange-500/20 text-orange-400 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedId
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-slate-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isReset ? 'Apply Template' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
