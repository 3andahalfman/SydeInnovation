'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Type, Hash, ToggleLeft, List, Sliders, Folder, Tag, Move,
  Trash2, Copy, Settings, Eye, Save, Undo, Redo, Grid3X3,
  AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronRight,
  Plus, X, GripVertical, MousePointer, Hand, Layers
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface FormControl {
  id: string;
  type: 'text' | 'number' | 'slider' | 'dropdown' | 'toggle' | 'label' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  parameterId?: string;  // Links to CAD parameter
  properties: {
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    unit?: string;
    defaultValue?: string | number | boolean;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
  };
  children?: string[];  // For groups - IDs of child controls
}

interface Parameter {
  name: string;
  displayName: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  unit?: string;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

interface FormDesignerProps {
  parameters: Parameter[];
  initialLayout?: FormControl[];
  onSave?: (controls: FormControl[]) => void;
  onPreview?: () => void;
}

// ============================================================================
// TOOLBOX ITEMS
// ============================================================================

const TOOLBOX_ITEMS = [
  { type: 'label', icon: Tag, label: 'Label', defaultWidth: 120, defaultHeight: 30 },
  { type: 'text', icon: Type, label: 'Text Field', defaultWidth: 200, defaultHeight: 40 },
  { type: 'number', icon: Hash, label: 'Number Field', defaultWidth: 150, defaultHeight: 40 },
  { type: 'slider', icon: Sliders, label: 'Slider', defaultWidth: 250, defaultHeight: 50 },
  { type: 'dropdown', icon: List, label: 'Dropdown', defaultWidth: 180, defaultHeight: 40 },
  { type: 'toggle', icon: ToggleLeft, label: 'Toggle', defaultWidth: 100, defaultHeight: 40 },
  { type: 'group', icon: Folder, label: 'Group Box', defaultWidth: 300, defaultHeight: 200 },
] as const;

// ============================================================================
// FORM DESIGNER COMPONENT
// ============================================================================

export default function FormDesigner({ parameters, initialLayout, onSave, onPreview }: FormDesignerProps) {
  // State
  const [controls, setControls] = useState<FormControl[]>(initialLayout || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedToolType, setDraggedToolType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<FormControl[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedControl = controls.find(c => c.id === selectedId);

  // ============================================================================
  // HISTORY (UNDO/REDO)
  // ============================================================================

  const saveToHistory = useCallback((newControls: FormControl[]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newControls]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setControls(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setControls(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // ============================================================================
  // GRID SNAPPING
  // ============================================================================

  const snapToGridValue = useCallback((value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  // ============================================================================
  // DRAG & DROP FROM TOOLBOX
  // ============================================================================

  const handleToolboxDragStart = (type: string) => {
    setDraggedToolType(type);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedToolType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGridValue((e.clientX - rect.left) / zoom);
    const y = snapToGridValue((e.clientY - rect.top) / zoom);

    const toolItem = TOOLBOX_ITEMS.find(t => t.type === draggedToolType);
    if (!toolItem) return;

    const newControl: FormControl = {
      id: `control-${Date.now()}`,
      type: draggedToolType as FormControl['type'],
      x,
      y,
      width: toolItem.defaultWidth,
      height: toolItem.defaultHeight,
      label: toolItem.label,
      properties: {},
    };

    const newControls = [...controls, newControl];
    setControls(newControls);
    saveToHistory(newControls);
    setSelectedId(newControl.id);
    setDraggedToolType(null);
  };

  // ============================================================================
  // CONTROL DRAGGING (MOVE)
  // ============================================================================

  const handleControlMouseDown = (e: React.MouseEvent, controlId: string) => {
    e.stopPropagation();
    const control = controls.find(c => c.id === controlId);
    if (!control) return;

    setSelectedId(controlId);
    setIsDragging(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: (e.clientX - rect.left) / zoom - control.x,
        y: (e.clientY - rect.top) / zoom - control.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGridValue((e.clientX - rect.left) / zoom - dragOffset.x);
    const y = snapToGridValue((e.clientY - rect.top) / zoom - dragOffset.y);

    setControls(prev => prev.map(c => 
      c.id === selectedId ? { ...c, x: Math.max(0, x), y: Math.max(0, y) } : c
    ));
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      saveToHistory(controls);
    }
    setIsDragging(false);
  };

  // ============================================================================
  // CONTROL ACTIONS
  // ============================================================================

  const deleteControl = useCallback((id: string) => {
    const newControls = controls.filter(c => c.id !== id);
    setControls(newControls);
    saveToHistory(newControls);
    setSelectedId(null);
  }, [controls, saveToHistory]);

  const duplicateControl = useCallback((id: string) => {
    const control = controls.find(c => c.id === id);
    if (!control) return;

    const newControl: FormControl = {
      ...control,
      id: `control-${Date.now()}`,
      x: control.x + 20,
      y: control.y + 20,
    };

    const newControls = [...controls, newControl];
    setControls(newControls);
    saveToHistory(newControls);
    setSelectedId(newControl.id);
  }, [controls, saveToHistory]);

  const updateControlProperty = useCallback((id: string, updates: Partial<FormControl>) => {
    setControls(prev => prev.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  }, []);

  const updateControlProperties = useCallback((id: string, propUpdates: Partial<FormControl['properties']>) => {
    setControls(prev => prev.map(c => 
      c.id === id ? { ...c, properties: { ...c.properties, ...propUpdates } } : c
    ));
  }, []);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId) {
        deleteControl(selectedId);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedId) {
        e.preventDefault();
        duplicateControl(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteControl, duplicateControl, undo, redo]);

  // ============================================================================
  // RENDER CONTROL ON CANVAS
  // ============================================================================

  const renderControl = (control: FormControl) => {
    const isSelected = control.id === selectedId;
    const param = parameters.find(p => p.name === control.parameterId);

    return (
      <div
        key={control.id}
        className={`absolute cursor-move select-none ${
          isSelected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900' : ''
        }`}
        style={{
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
        }}
        onMouseDown={(e) => handleControlMouseDown(e, control.id)}
      >
        {/* Control Content */}
        <div className="w-full h-full bg-slate-800 border border-slate-600 rounded-lg p-2 flex flex-col">
          {control.type === 'label' && (
            <span 
              className="text-white truncate"
              style={{ 
                fontSize: control.properties.fontSize || 14,
                fontWeight: control.properties.fontWeight || 'normal',
                textAlign: control.properties.textAlign || 'left',
              }}
            >
              {control.label}
            </span>
          )}

          {control.type === 'text' && (
            <>
              <label className="text-xs text-gray-400 mb-1 truncate">{control.label}</label>
              <input
                type="text"
                placeholder={control.properties.placeholder || 'Enter text...'}
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-sm text-white pointer-events-none"
                readOnly
              />
            </>
          )}

          {control.type === 'number' && (
            <>
              <label className="text-xs text-gray-400 mb-1 truncate">
                {control.label}
                {control.properties.unit && <span className="text-gray-500 ml-1">({control.properties.unit})</span>}
              </label>
              <input
                type="number"
                placeholder={String(control.properties.defaultValue || 0)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-sm text-white pointer-events-none"
                readOnly
              />
            </>
          )}

          {control.type === 'slider' && (
            <>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span className="truncate">{control.label}</span>
                <span>{control.properties.defaultValue || control.properties.min || 0}</span>
              </div>
              <input
                type="range"
                min={control.properties.min || 0}
                max={control.properties.max || 100}
                defaultValue={Number(control.properties.defaultValue) || 50}
                className="flex-1 accent-orange-500 pointer-events-none"
                aria-label={control.label}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{control.properties.min || 0}</span>
                <span>{control.properties.max || 100}</span>
              </div>
            </>
          )}

          {control.type === 'dropdown' && (
            <>
              <label className="text-xs text-gray-400 mb-1 truncate">{control.label}</label>
              <select 
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 text-sm text-white pointer-events-none"
                disabled
                aria-label={control.label}
              >
                <option>{control.properties.options?.[0] || 'Select...'}</option>
              </select>
            </>
          )}

          {control.type === 'toggle' && (
            <div className="flex items-center gap-2 h-full">
              <div className="w-10 h-5 bg-slate-600 rounded-full relative">
                <div className="absolute left-1 top-1 w-3 h-3 bg-gray-400 rounded-full" />
              </div>
              <span className="text-sm text-white truncate">{control.label}</span>
            </div>
          )}

          {control.type === 'group' && (
            <div className="h-full border-2 border-dashed border-slate-500 rounded-lg p-2">
              <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
                <Folder className="w-3 h-3" />
                {control.label}
              </div>
              <div className="text-xs text-gray-500 text-center py-4">
                Drop controls here
              </div>
            </div>
          )}
        </div>

        {/* Resize Handle (when selected) */}
        {isSelected && (
          <div
            className="absolute -right-1 -bottom-1 w-3 h-3 bg-orange-500 rounded-sm cursor-se-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: Implement resize
            }}
          />
        )}

        {/* Parameter Link Indicator */}
        {control.parameterId && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center" title={`Linked to: ${control.parameterId}`}>
            <Hash className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-full bg-slate-900">
      {/* Left Panel - Toolbox */}
      <div className="w-56 border-r border-slate-700 flex flex-col">
        {/* Toolbox Header */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500" />
            Toolbox
          </h3>
        </div>

        {/* Tool Items */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {TOOLBOX_ITEMS.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={() => handleToolboxDragStart(item.type)}
              onDragEnd={() => setDraggedToolType(null)}
              className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-grab active:cursor-grabbing transition-colors"
            >
              <item.icon className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-white">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Parameters List */}
        <div className="border-t border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-500" />
              Parameters
            </h3>
          </div>
          <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
            {parameters.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No parameters defined</p>
            ) : (
              parameters.map((param) => (
                <div
                  key={param.name}
                  draggable
                  onDragStart={() => {
                    // Create a control linked to this parameter
                    const type = param.type === 'boolean' ? 'toggle' : 
                                param.type === 'select' ? 'dropdown' : 
                                param.type === 'number' ? 'number' : 'text';
                    setDraggedToolType(`param:${param.name}:${type}`);
                  }}
                  onDragEnd={() => setDraggedToolType(null)}
                  className="flex items-center gap-2 p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded text-xs cursor-grab"
                >
                  <Hash className="w-3 h-3 text-cyan-400" />
                  <span className="text-gray-300 truncate flex-1">{param.displayName || param.name}</span>
                  <span className="text-gray-500">{param.type}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-slate-700 flex items-center gap-2 px-4">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 hover:bg-slate-700 disabled:opacity-50 rounded transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 hover:bg-slate-700 disabled:opacity-50 rounded transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-4 h-4 text-gray-400" />
          </button>
          
          <div className="w-px h-6 bg-slate-700 mx-2" />
          
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded transition-colors ${showGrid ? 'bg-slate-700 text-orange-400' : 'hover:bg-slate-700 text-gray-400'}`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${snapToGrid ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-slate-700 text-gray-400'}`}
          >
            Snap
          </button>
          
          <div className="w-px h-6 bg-slate-700 mx-2" />
          
          <span className="text-xs text-gray-500">Zoom:</span>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            title="Zoom level"
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
          
          <div className="flex-1" />
          
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => onSave?.(controls)}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Layout
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950">
          <div
            ref={canvasRef}
            className="relative bg-slate-900 border border-slate-700 rounded-xl mx-auto"
            style={{
              width: 800 * zoom,
              height: 600 * zoom,
              backgroundImage: showGrid 
                ? `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`
                : 'none',
              backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            onDragOver={handleCanvasDragOver}
            onDrop={(e) => {
              // Handle both regular tool drops and parameter drops
              if (draggedToolType?.startsWith('param:')) {
                e.preventDefault();
                const [, paramName, type] = draggedToolType.split(':');
                const param = parameters.find(p => p.name === paramName);
                if (!param || !canvasRef.current) return;

                const rect = canvasRef.current.getBoundingClientRect();
                const x = snapToGridValue((e.clientX - rect.left) / zoom);
                const y = snapToGridValue((e.clientY - rect.top) / zoom);

                const toolItem = TOOLBOX_ITEMS.find(t => t.type === type);
                const newControl: FormControl = {
                  id: `control-${Date.now()}`,
                  type: type as FormControl['type'],
                  x,
                  y,
                  width: toolItem?.defaultWidth || 200,
                  height: toolItem?.defaultHeight || 40,
                  label: param.displayName || param.name,
                  parameterId: param.name,
                  properties: {
                    min: param.min,
                    max: param.max,
                    unit: param.unit,
                    defaultValue: param.defaultValue,
                    options: param.options,
                  },
                };

                const newControls = [...controls, newControl];
                setControls(newControls);
                saveToHistory(newControls);
                setSelectedId(newControl.id);
                setDraggedToolType(null);
              } else {
                handleCanvasDrop(e);
              }
            }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onClick={() => setSelectedId(null)}
          >
            {/* Render all controls */}
            {controls.map(renderControl)}

            {/* Drop indicator */}
            {draggedToolType && (
              <div className="absolute inset-0 border-2 border-dashed border-orange-500/50 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-orange-400 text-sm bg-slate-900/80 px-3 py-1 rounded">
                  Drop here to add control
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-72 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-500" />
            Properties
          </h3>
        </div>

        {selectedControl ? (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Label</label>
                <input
                  type="text"
                  value={selectedControl.label}
                  onChange={(e) => updateControlProperty(selectedId!, { label: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                  aria-label="Control label"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Link to Parameter</label>
                <select
                  value={selectedControl.parameterId || ''}
                  onChange={(e) => {
                    const paramName = e.target.value;
                    const param = parameters.find(p => p.name === paramName);
                    updateControlProperty(selectedId!, { 
                      parameterId: paramName || undefined,
                      ...(param && {
                        properties: {
                          ...selectedControl.properties,
                          min: param.min,
                          max: param.max,
                          unit: param.unit,
                          defaultValue: param.defaultValue,
                          options: param.options,
                        }
                      })
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                  title="Select parameter to link"
                >
                  <option value="">None</option>
                  {parameters.map(p => (
                    <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Position & Size */}
            <div className="space-y-3 pt-3 border-t border-slate-700">
              <h4 className="text-xs font-medium text-gray-400">Position & Size</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">X</label>
                  <input
                    type="number"
                    value={selectedControl.x}
                    onChange={(e) => updateControlProperty(selectedId!, { x: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                    aria-label="X position"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Y</label>
                  <input
                    type="number"
                    value={selectedControl.y}
                    onChange={(e) => updateControlProperty(selectedId!, { y: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                    aria-label="Y position"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width</label>
                  <input
                    type="number"
                    value={selectedControl.width}
                    onChange={(e) => updateControlProperty(selectedId!, { width: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                    aria-label="Width"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedControl.height}
                    onChange={(e) => updateControlProperty(selectedId!, { height: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                    aria-label="Height"
                  />
                </div>
              </div>
            </div>

            {/* Type-specific properties */}
            {(selectedControl.type === 'number' || selectedControl.type === 'slider') && (
              <div className="space-y-3 pt-3 border-t border-slate-700">
                <h4 className="text-xs font-medium text-gray-400">Number Settings</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <input
                      type="number"
                      value={selectedControl.properties.min || 0}
                      onChange={(e) => updateControlProperties(selectedId!, { min: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      aria-label="Minimum value"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <input
                      type="number"
                      value={selectedControl.properties.max || 100}
                      onChange={(e) => updateControlProperties(selectedId!, { max: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      aria-label="Maximum value"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Step</label>
                    <input
                      type="number"
                      value={selectedControl.properties.step || 1}
                      onChange={(e) => updateControlProperties(selectedId!, { step: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      aria-label="Step value"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit</label>
                  <input
                    type="text"
                    value={selectedControl.properties.unit || ''}
                    onChange={(e) => updateControlProperties(selectedId!, { unit: e.target.value })}
                    placeholder="mm, kg, etc."
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {selectedControl.type === 'dropdown' && (
              <div className="space-y-3 pt-3 border-t border-slate-700">
                <h4 className="text-xs font-medium text-gray-400">Dropdown Options</h4>
                <div className="space-y-1">
                  {(selectedControl.properties.options || []).map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(selectedControl.properties.options || [])];
                          newOptions[idx] = e.target.value;
                          updateControlProperties(selectedId!, { options: newOptions });
                        }}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        aria-label={`Option ${idx + 1}`}
                      />
                      <button
                        onClick={() => {
                          const newOptions = (selectedControl.properties.options || []).filter((_, i) => i !== idx);
                          updateControlProperties(selectedId!, { options: newOptions });
                        }}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                        title="Remove option"
                        aria-label="Remove option"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newOptions = [...(selectedControl.properties.options || []), 'New Option'];
                      updateControlProperties(selectedId!, { options: newOptions });
                    }}
                    className="w-full flex items-center justify-center gap-1 p-1 text-xs text-orange-400 hover:bg-orange-500/20 rounded border border-dashed border-slate-600"
                  >
                    <Plus className="w-3 h-3" />
                    Add Option
                  </button>
                </div>
              </div>
            )}

            {selectedControl.type === 'label' && (
              <div className="space-y-3 pt-3 border-t border-slate-700">
                <h4 className="text-xs font-medium text-gray-400">Text Style</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedControl.properties.fontSize || 14}
                      onChange={(e) => updateControlProperties(selectedId!, { fontSize: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      aria-label="Font size"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Weight</label>
                    <select
                      value={selectedControl.properties.fontWeight || 'normal'}
                      onChange={(e) => updateControlProperties(selectedId!, { fontWeight: e.target.value as 'normal' | 'bold' })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      title="Font weight"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Alignment</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateControlProperties(selectedId!, { textAlign: align })}
                        className={`flex-1 p-2 rounded ${
                          (selectedControl.properties.textAlign || 'left') === align 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                        }`}
                      >
                        {align === 'left' && <AlignLeft className="w-4 h-4 mx-auto" />}
                        {align === 'center' && <AlignCenter className="w-4 h-4 mx-auto" />}
                        {align === 'right' && <AlignRight className="w-4 h-4 mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-700 flex gap-2">
              <button
                onClick={() => duplicateControl(selectedId!)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                onClick={() => deleteControl(selectedId!)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-500">
              <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a control to edit its properties</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
