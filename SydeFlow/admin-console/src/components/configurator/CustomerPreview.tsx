'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Monitor, Tablet, Smartphone, Maximize2, RefreshCw,
  ChevronDown, ChevronRight, Play, ShoppingCart, Download,
  FileText, Minus, Sliders, Eye, GripVertical, X
} from 'lucide-react';
import type { 
  ConfiguratorLayout, LayoutSection, LayoutSubsection, ControlConfig,
  LayoutElement, GroupElement, TabGroupElement, RowElement, 
  PictureElement, EmptySpaceElement, LabelElement, SplitterElement, ParameterElement,
  SectionElement, ElementStyle, PricingConfig, PricingRule
} from '@/types/product';
import { elementStyleToCSS } from '@/types/product';

// ============================================================================
// TYPES
// ============================================================================

interface Parameter {
  name: string;
  displayName: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  unit?: string;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

interface CustomerPreviewProps {
  productName: string;
  parameters: Parameter[];
  layout: ConfiguratorLayout;
  values: Record<string, string | number | boolean>;
  onValueChange: (name: string, value: string | number | boolean) => void;
  onFullScreen?: () => void;
  // Builder mode toggle
  builderMode?: 'edit' | 'preview';
  onBuilderModeChange?: (mode: 'edit' | 'preview') => void;
  // Editable mode props
  editable?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (element: LayoutElement | null) => void;
  onSelectParam?: (paramName: string | null) => void;
  onLayoutChange?: (layout: ConfiguratorLayout) => void;
  // Pricing
  pricing?: PricingConfig;
  configValues?: Record<string, string | number | boolean>;
  // Update selection callback
  onUpdateSelection?: (values: Record<string, string | number | boolean>) => void;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px'
};

// ============================================================================
// CUSTOMER PREVIEW COMPONENT
// ============================================================================

export default function CustomerPreview({
  productName,
  parameters,
  layout,
  values,
  onValueChange,
  onFullScreen,
  builderMode,
  onBuilderModeChange,
  editable = false,
  selectedElementId,
  onSelectElement,
  onSelectParam,
  onLayoutChange,
  pricing,
  configValues,
  onUpdateSelection
}: CustomerPreviewProps) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set<string>());
  const [dragState, setDragState] = useState<{ draggedId: string | null; targetId: string | null; position: 'before' | 'after'; parentId: string | null }>({ draggedId: null, targetId: null, position: 'before', parentId: null });
  const [containerDropHighlight, setContainerDropHighlight] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Extract sections for navigation sidebar (preview mode only)
  const navSections = useMemo(() => {
    if (!layout.children) return [];
    return layout.children
      .filter((c): c is SectionElement => c.type === 'section')
      .map(s => ({ id: s.id, label: s.label }));
  }, [layout.children]);

  // Sync expandedSections whenever layout changes — expand all sections, groups, etc. by default
  useEffect(() => {
    const expanded = new Set<string>();
    const walk = (elements: LayoutElement[]) => {
      for (const el of elements) {
        if (el.type === 'section') {
          expanded.add(el.id);
          walk((el as SectionElement).children);
        } else if (el.type === 'group') {
          expanded.add(el.id);
          walk((el as GroupElement).children);
        } else if (el.type === 'row') {
          walk((el as RowElement).children);
        } else if (el.type === 'tab-group') {
          for (const tab of (el as TabGroupElement).tabs) {
            walk(tab.children);
          }
        }
      }
    };
    // Walk V2 children
    if (layout.children && layout.children.length > 0) {
      walk(layout.children);
    }
    // Fallback: V1 sections
    if ((!layout.children || layout.children.length === 0) && layout.sections) {
      layout.sections.forEach(s => {
        expanded.add(s.id);
        (s.subsections || []).forEach(ss => expanded.add(ss.id));
        (s.elements || []).forEach(el => {
          if (el.type === 'group') expanded.add(el.id);
        });
      });
    }
    setExpandedSections(expanded);
  }, [layout]);

  // Toggle section
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Reset all values to defaults
  const resetValues = () => {
    parameters.forEach(p => {
      onValueChange(p.name, p.defaultValue);
    });
  };

  // ============================================================================
  // THEME CSS VARIABLES from LayoutStyling
  // ============================================================================

  const themeVars = useMemo((): React.CSSProperties => {
    const s = layout.styling;
    const accent = s.accentColor || '#f97316';
    const isDark = (s.theme || 'dark') === 'dark';

    return {
      '--accent': accent,
      '--accent-hover': accent + 'dd',
      '--bg-primary': isDark ? '#0f172a' : '#ffffff',
      '--bg-secondary': isDark ? '#1e293b' : '#f8fafc',
      '--bg-card': isDark ? '#1e293b' : '#ffffff',
      '--bg-input': isDark ? '#1e293b' : '#f8fafc',
      '--border': isDark ? '#334155' : '#e2e8f0',
      '--border-focus': accent,
      '--text-primary': isDark ? '#f1f5f9' : '#1e293b',
      '--text-secondary': isDark ? '#cbd5e1' : '#475569',
      '--text-muted': '#94a3b8',
      '--control-size-factor': s.controlSize === 'compact' ? '0.85' : s.controlSize === 'large' ? '1.15' : '1',
    } as React.CSSProperties;
  }, [layout.styling]);

  // Get control config for parameter
  const getControlConfig = (paramName: string): ControlConfig => {
    return layout.controls[paramName] || {
      controlType: 'input',
      showLabel: true,
      showUnit: true,
      showDescription: false,
      showMinMax: true,
      width: 'full'
    };
  };

  // Render a single control based on config — 3DTHD horizontal layout
  const renderControl = (param: Parameter, config: ControlConfig) => {
    const value = values[param.name] ?? param.defaultValue;
    const label = config.customLabel || param.displayName;
    const effMin = config.customMin ?? param.min;
    const effMax = config.customMax ?? param.max;
    const effStep = config.customStep ?? param.step;
    const unitStr = config.showUnit && param.unit ? param.unit : '';

    return (
      <div key={param.name} className="w-full px-3 py-0.5">
        {/* Slider types: label on top, slider below */}
        {(config.controlType === 'slider' || config.controlType === 'slider-input') && param.type === 'number' ? (
          <div className="space-y-1.5">
            {config.showLabel && (
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  {config.prefix && <span className="mr-1" style={{ color: 'var(--text-muted)' }}>{config.prefix}</span>}
                  {label}
                  {config.suffix && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{config.suffix}</span>}
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {value}{unitStr && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>{unitStr}</span>}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={effMin ?? 0}
                max={effMax ?? 100}
                step={effStep ?? 1}
                value={value as number}
                onChange={(e) => onValueChange(param.name, parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)', backgroundColor: 'var(--border)' } as React.CSSProperties}
                aria-label={label}
              />
              {config.controlType === 'slider-input' && (
                <input
                  type="number"
                  min={effMin}
                  max={effMax}
                  step={effStep}
                  value={value as number}
                  onChange={(e) => onValueChange(param.name, parseFloat(e.target.value) || 0)}
                  className="w-16 text-xs px-2 py-1 rounded border text-right"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  aria-label={`${label} value`}
                />
              )}
            </div>
            {config.showMinMax && config.controlType === 'slider' && (
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span>{effMin ?? 0}</span>
                <span>{effMax ?? 100}</span>
              </div>
            )}
          </div>
        ) : config.controlType === 'toggle' ? (
          /* Toggle: horizontal label + toggle on right */
          <div className="flex items-center justify-between py-1">
            {config.showLabel && (
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <button
              onClick={() => onValueChange(param.name, !value)}
              className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ backgroundColor: value ? 'var(--accent)' : 'var(--border)' }}
              title={label}
              aria-label={`Toggle ${label}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                value ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        ) : config.controlType === 'color' ? (
          /* Color picker: horizontal label + color swatch + hex */
          <div className="py-1">
            {config.showLabel && (
              <span className="block text-[13px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value as string}
                onChange={(e) => onValueChange(param.name, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                title={`${label} color picker`}
                aria-label={`${label} color picker`}
              />
              <input
                type="text"
                value={value as string}
                onChange={(e) => onValueChange(param.name, e.target.value)}
                className="flex-1 px-2 py-1 rounded border text-xs uppercase"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                aria-label={`${label} hex value`}
              />
            </div>
          </div>
        ) : config.controlType === 'dropdown' ? (
          /* Dropdown: horizontal label + select on right */
          <div className="flex items-center justify-between py-1 gap-3">
            {config.showLabel && (
              <span className="text-[13px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <select
              value={value as string}
              onChange={(e) => onValueChange(param.name, e.target.value)}
              title={label}
              className="px-2 py-1 rounded border text-[13px] min-w-[100px] max-w-[160px]"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              {(param.options || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ) : (
          /* Number/Text input: horizontal label + input with unit on right */
          <div className="flex items-center justify-between py-1 gap-3">
            {config.showLabel && (
              <span className="text-[13px] flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[50%]" style={{ color: 'var(--text-secondary)' }}>
                {config.prefix && <span className="mr-1" style={{ color: 'var(--text-muted)' }}>{config.prefix}</span>}
                {label}
                {config.suffix && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{config.suffix}</span>}
              </span>
            )}
            <div className="flex items-center gap-1">
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                min={effMin}
                max={effMax}
                step={effStep}
                value={value as any}
                onChange={(e) => {
                  const v = param.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                  onValueChange(param.name, v);
                }}
                placeholder={config.placeholder}
                className="w-20 px-2 py-1 rounded border text-[13px] text-right"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                aria-label={label}
              />
              {unitStr && (
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{unitStr}</span>
              )}
            </div>
          </div>
        )}

        {config.showDescription && config.customDescription && (
          <p className="text-[11px] mt-0.5 px-0" style={{ color: 'var(--text-muted)' }}>{config.customDescription}</p>
        )}
      </div>
    );
  };

  // Get action button icon
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'quote': return FileText;
      case 'add-to-cart': return ShoppingCart;
      case 'download': return Download;
      default: return Play;
    }
  };

  // Active tab state for tab groups
  const [activeTabIds, setActiveTabIds] = useState<Record<string, string>>({});

  // ============================================================================
  // EDITABLE MODE: Selection + Drop helpers
  // ============================================================================

  const handleElementClick = (e: React.MouseEvent, element: LayoutElement) => {
    if (!editable) return;
    e.stopPropagation();
    if (element.type === 'parameter') {
      const pe = element as ParameterElement;
      onSelectParam?.(pe.parameterName);
      onSelectElement?.(null);
    } else {
      onSelectElement?.(element);
      onSelectParam?.(null);
    }
  };

  const handleBackgroundClick = () => {
    if (!editable) return;
    onSelectElement?.(null);
    onSelectParam?.(null);
  };

  // Find and remove an element from any level, returning [removed, updatedLayout]
  const removeElementFromTree = (children: LayoutElement[], id: string): [LayoutElement | null, LayoutElement[]] => {
    const idx = children.findIndex(c => c.id === id);
    if (idx !== -1) {
      const removed = children[idx];
      return [removed, [...children.slice(0, idx), ...children.slice(idx + 1)]];
    }
    let removed: LayoutElement | null = null;
    const updated = children.map(c => {
      if (removed) return c;
      if (c.type === 'section') {
        const [r, newCh] = removeElementFromTree((c as SectionElement).children, id);
        if (r) { removed = r; return { ...c, children: newCh }; }
      } else if (c.type === 'group') {
        const [r, newCh] = removeElementFromTree((c as GroupElement).children, id);
        if (r) { removed = r; return { ...c, children: newCh }; }
      } else if (c.type === 'row') {
        const [r, newCh] = removeElementFromTree((c as RowElement).children, id);
        if (r) { removed = r; return { ...c, children: newCh }; }
      } else if (c.type === 'tab-group') {
        const tg = c as TabGroupElement;
        for (let ti = 0; ti < tg.tabs.length; ti++) {
          const [r, newCh] = removeElementFromTree(tg.tabs[ti].children, id);
          if (r) {
            removed = r;
            const updatedTabs = tg.tabs.map((tab, i) => i === ti ? { ...tab, children: newCh } : tab);
            return { ...c, tabs: updatedTabs };
          }
        }
      }
      return c;
    });
    return [removed, updated];
  };

  // Insert an element into a specific container
  const insertIntoContainer = (children: LayoutElement[], parentId: string | null, element: LayoutElement, targetId: string, position: 'before' | 'after'): LayoutElement[] => {
    if (parentId === null) {
      // Insert at top level
      const targetIdx = children.findIndex(c => c.id === targetId);
      if (targetIdx === -1) return [...children, element];
      const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
      const result = [...children];
      result.splice(insertIdx, 0, element);
      result.forEach((c, i) => { (c as any).order = i; });
      return result;
    }
    return children.map(c => {
      if (c.id === parentId) {
        if (c.type === 'tab-group') {
          const tg = c as TabGroupElement;
          const atid = activeTabIds[c.id] || tg.tabs[0]?.id || '';
          const updatedTabs = tg.tabs.map(tab => {
            if (tab.id !== atid) return tab;
            const ch = [...tab.children];
            const ti = ch.findIndex(x => x.id === targetId);
            const ii = ti === -1 ? ch.length : (position === 'after' ? ti + 1 : ti);
            ch.splice(ii, 0, element);
            ch.forEach((x, i) => { (x as any).order = i; });
            return { ...tab, children: ch };
          });
          return { ...c, tabs: updatedTabs };
        }
        let ch: LayoutElement[] = [];
        if (c.type === 'section') ch = [...(c as SectionElement).children];
        else if (c.type === 'group') ch = [...(c as GroupElement).children];
        else if (c.type === 'row') ch = [...(c as RowElement).children];
        const targetIdx = ch.findIndex(x => x.id === targetId);
        const insertIdx = targetIdx === -1 ? ch.length : (position === 'after' ? targetIdx + 1 : targetIdx);
        ch.splice(insertIdx, 0, element);
        ch.forEach((x, i) => { (x as any).order = i; });
        return { ...c, children: ch };
      }
      if (c.type === 'section') return { ...c, children: insertIntoContainer((c as SectionElement).children, parentId, element, targetId, position) };
      if (c.type === 'group') return { ...c, children: insertIntoContainer((c as GroupElement).children, parentId, element, targetId, position) };
      if (c.type === 'row') return { ...c, children: insertIntoContainer((c as RowElement).children, parentId, element, targetId, position) };
      if (c.type === 'tab-group') {
        const tg = c as TabGroupElement;
        const updatedTabs = tg.tabs.map(tab => ({ ...tab, children: insertIntoContainer(tab.children, parentId, element, targetId, position) }));
        return { ...c, tabs: updatedTabs };
      }
      return c;
    });
  };

  const handleReorder = (targetId: string) => {
    if (!dragState.draggedId || !onLayoutChange || dragState.draggedId === targetId) return;
    const allChildren = [...(layout.children || [])];
    const [removed, afterRemove] = removeElementFromTree(allChildren, dragState.draggedId);
    if (!removed) return;
    const result = insertIntoContainer(afterRemove, dragState.parentId, removed, targetId, dragState.position);
    onLayoutChange({ ...layout, children: result });
    setDragState({ draggedId: null, targetId: null, position: 'before', parentId: null });
  };

  // Drop a toolbox item directly into a container
  const handleContainerDrop = (e: React.DragEvent, containerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContainerDropHighlight(null);
    if (!editable || !onLayoutChange) return;

    // Helper to append an element into a container (section/group/row/tab-group)
    const appendToContainer = (children: LayoutElement[], cId: string, el: LayoutElement): LayoutElement[] => {
      return children.map(c => {
        if (c.id === cId) {
          if (c.type === 'tab-group') {
            const tg = c as TabGroupElement;
            const atid = activeTabIds[c.id] || tg.tabs[0]?.id || '';
            const updatedTabs = tg.tabs.map(tab => {
              if (tab.id !== atid) return tab;
              const ch = [...tab.children, el];
              ch.forEach((x: any, i: number) => { x.order = i; });
              return { ...tab, children: ch };
            });
            return { ...c, tabs: updatedTabs };
          }
          if (c.type === 'section' || c.type === 'group' || c.type === 'row') {
            const ch = [...((c as any).children || []), el];
            ch.forEach((x: any, i: number) => { x.order = i; });
            return { ...c, children: ch };
          }
        }
        // Recurse into nested containers
        if (c.type === 'section') return { ...c, children: appendToContainer((c as SectionElement).children, cId, el) };
        if (c.type === 'group') return { ...c, children: appendToContainer((c as GroupElement).children, cId, el) };
        if (c.type === 'row') return { ...c, children: appendToContainer((c as RowElement).children, cId, el) };
        if (c.type === 'tab-group') {
          const tg = c as TabGroupElement;
          return { ...c, tabs: tg.tabs.map(tab => ({ ...tab, children: appendToContainer(tab.children, cId, el) })) };
        }
        return c;
      });
    };

    // Handle internal reorder - move into this container
    if (dragState.draggedId) {
      const allChildren = [...(layout.children || [])];
      const [removed, afterRemove] = removeElementFromTree(allChildren, dragState.draggedId);
      if (!removed) return;
      const result = appendToContainer(afterRemove, containerId, removed);
      onLayoutChange({ ...layout, children: result });
      setDragState({ draggedId: null, targetId: null, position: 'before', parentId: null });
      return;
    }
  };

  // Render children with drag/sort in edit mode
  // Get the flex-item width class for an element (used in flex-wrap containers)
  const getElementWidthClass = (element: LayoutElement): string => {
    if (element.type === 'parameter') {
      const pe = element as ParameterElement;
      const config = getControlConfig(pe.parameterName);
      return config.width === 'half' ? 'w-1/2' : config.width === 'third' ? 'w-1/3' : 'w-full';
    }
    return 'w-full';
  };

  const renderSortableChildren = (children: LayoutElement[], parentId: string | null, direction: 'vertical' | 'horizontal' = 'vertical') => {
    if (!editable) {
      return children.map(child => (
        <div key={child.id} className={direction === 'horizontal' ? 'flex-1' : getElementWidthClass(child)}>
          {renderElement(child)}
        </div>
      ));
    }
    return children.map(child => {
      const rendered = renderElement(child);
      const isDragging = dragState.draggedId === child.id;
      const isDropTarget = dragState.targetId === child.id && dragState.draggedId !== null && dragState.draggedId !== child.id;
      const indicatorDir = direction === 'horizontal' ? 'left' : 'top';
      const widthClass = direction === 'horizontal' ? 'flex-1' : getElementWidthClass(child);

      return (
        <div
          key={child.id}
          className={`relative group/sort transition-opacity ${widthClass} ${isDragging ? 'opacity-30 scale-[0.98]' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (!dragState.draggedId || dragState.draggedId === child.id) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = direction === 'horizontal'
              ? (e.clientX < rect.left + rect.width / 2 ? 'before' : 'after')
              : (e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
            if (dragState.targetId !== child.id || dragState.position !== pos || dragState.parentId !== parentId) {
              setDragState(prev => ({ ...prev, targetId: child.id, position: pos as 'before' | 'after', parentId }));
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragState(prev => prev.targetId === child.id ? { ...prev, targetId: null } : prev);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleReorder(child.id);
          }}
        >
          {isDropTarget && dragState.position === 'before' && (
            direction === 'horizontal'
              ? <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-orange-500 rounded-full z-20"><div className="absolute -top-0.5 -left-[3px] w-2 h-2 bg-orange-500 rounded-full" /></div>
              : <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-orange-500 rounded-full z-20"><div className="absolute -left-0.5 -top-[3px] w-2 h-2 bg-orange-500 rounded-full" /></div>
          )}
          <div className="flex items-start gap-0">
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', child.id);
                setDragState({ draggedId: child.id, targetId: null, position: 'before', parentId });
              }}
              onDragEnd={() => setDragState({ draggedId: null, targetId: null, position: 'before', parentId: null })}
              className="shrink-0 mt-1 opacity-0 group-hover/sort:opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all z-20"
              title="Drag to reorder"
            >
              <GripVertical className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">{rendered}</div>
          </div>
          {isDropTarget && dragState.position === 'after' && (
            direction === 'horizontal'
              ? <div className="absolute -right-1 top-0 bottom-0 w-0.5 bg-orange-500 rounded-full z-20"><div className="absolute -top-0.5 -left-[3px] w-2 h-2 bg-orange-500 rounded-full" /></div>
              : <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-orange-500 rounded-full z-20"><div className="absolute -left-0.5 -top-[3px] w-2 h-2 bg-orange-500 rounded-full" /></div>
          )}
        </div>
      );
    });
  };

  const handleDeleteElement = (e: React.MouseEvent, element: LayoutElement) => {
    e.stopPropagation();
    if (!onLayoutChange) return;
    const removeFromChildren = (children: LayoutElement[]): LayoutElement[] => {
      return children.filter(c => c.id !== element.id).map(c => {
        if (c.type === 'section') {
          const se = c as SectionElement;
          return { ...se, children: removeFromChildren(se.children) };
        }
        if (c.type === 'group') {
          const ge = c as GroupElement;
          return { ...ge, children: removeFromChildren(ge.children) };
        }
        if (c.type === 'row') {
          const re = c as RowElement;
          return { ...re, children: removeFromChildren(re.children) };
        }
        if (c.type === 'tab-group') {
          const tg = c as TabGroupElement;
          return { ...tg, tabs: tg.tabs.map(tab => ({ ...tab, children: removeFromChildren(tab.children) })) };
        }
        return c;
      });
    };
    onLayoutChange({ ...layout, children: removeFromChildren(layout.children || []) });
    // Clear selection if deleted element was selected
    if (element.id === selectedElementId) {
      onSelectElement?.(null);
      onSelectParam?.(null);
    } else if (element.type === 'parameter' && (element as ParameterElement).parameterName === selectedElementId) {
      onSelectParam?.(null);
    }
  };

  const wrapEditable = (element: LayoutElement, rendered: React.ReactNode): React.ReactNode => {
    if (!editable || !rendered) return rendered;
    const isSelected = element.type === 'parameter'
      ? (element as ParameterElement).parameterName === (selectedElementId || '')
      : element.id === selectedElementId;
    return (
      <div
        key={element.id}
        onClick={(e) => handleElementClick(e, element)}
        className={`relative group/el cursor-pointer transition-all rounded-lg ${
          isSelected
            ? 'ring-2 ring-inset ring-orange-500'
            : 'hover:ring-1 hover:ring-inset hover:ring-blue-400/40'
        }`}
      >
        {rendered}
        {/* Delete button - visible on hover or when selected */}
        <button
          onClick={(e) => handleDeleteElement(e, element)}
          className={`absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 text-white shadow-lg transition-all z-20 ${
            isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover/el:opacity-100 group-hover/el:scale-100'
          }`}
          title="Remove element"
        >
          <X className="w-3 h-3" />
        </button>
        {isSelected && (
          <div className="absolute top-0 right-4 px-1.5 py-0.5 text-[9px] font-medium bg-orange-500 text-white rounded-b-md z-10">
            {element.type}
          </div>
        )}
      </div>
    );
  };

  // Render a layout element
  const renderElement = (element: LayoutElement): React.ReactNode => {
    // Per-element style override
    const elStyle = elementStyleToCSS(element.style);

    let rendered: React.ReactNode = null;

    switch (element.type) {
      case 'parameter': {
        const pe = element as ParameterElement;
        const param = parameters.find(p => p.name === pe.parameterName);
        if (!param) return null;
        rendered = renderControl(param, getControlConfig(pe.parameterName));
        break;
      }

      case 'section': {
        const se = element as SectionElement;
        const isOpen = expandedSections.has(element.id);
        rendered = (
          <div key={element.id} id={`section-${element.id}`} className="overflow-hidden" style={elStyle}>
            {se.collapsible ? (
              <button
                onClick={() => toggleSection(element.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:opacity-80"
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{se.label}</span>
                <span className="text-xs transition-transform" style={{ color: 'var(--accent)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▲</span>
              </button>
            ) : (
              <div className="px-4 py-2.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{se.label}</span>
                {se.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{se.description}</p>}
              </div>
            )}
            {(!se.collapsible || isOpen) && (
              <div className="px-2 py-1 space-y-0">
                <div className="flex flex-wrap">
                  {renderSortableChildren(se.children, element.id)}
                </div>
                {editable && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setContainerDropHighlight(element.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setContainerDropHighlight(null); }}
                    onDrop={(e) => handleContainerDrop(e, element.id)}
                    className={`border border-dashed rounded-lg py-2 text-center text-[10px] transition-colors mt-1 ${
                      containerDropHighlight === element.id
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-slate-300/50 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    Drop here
                  </div>
                )}
              </div>
            )}
          </div>
        );
        break;
      }
      
      case 'label': {
        const le = element as LabelElement;
        const variantClasses: Record<string, string> = {
          heading: 'text-base font-semibold',
          subheading: 'text-sm font-medium',
          body: 'text-sm',
          caption: 'text-xs',
        };
        const variantColor = le.variant === 'caption' ? 'var(--text-muted)' : le.variant === 'body' ? 'var(--text-secondary)' : 'var(--text-primary)';
        rendered = (
          <div key={element.id} className="w-full px-2 py-1" style={elStyle}>
            <p 
              className={variantClasses[le.variant] || 'text-sm'}
              style={{ color: variantColor, textAlign: le.align || 'left' }}
            >
              {le.text}
            </p>
          </div>
        );
        break;
      }
      
      case 'empty-space': {
        const es = element as EmptySpaceElement;
        rendered = <div key={element.id} style={{ height: `${es.height}px`, ...elStyle }} />;
        break;
      }
      
      case 'splitter': {
        const sp = element as SplitterElement;
        const marginPx = sp.margin ?? 8;
        if (sp.orientation === 'vertical') {
          rendered = (
            <div key={element.id} className="self-stretch flex items-center" style={{ paddingLeft: `${marginPx}px`, paddingRight: `${marginPx}px`, ...elStyle }}>
              <div className="h-full min-h-[24px]" style={{ width: '1px', backgroundColor: 'var(--border)', borderStyle: sp.lineStyle || 'solid' }} />
            </div>
          );
        } else {
          rendered = (
            <div key={element.id} className="w-full px-2" style={{ paddingTop: `${marginPx}px`, paddingBottom: `${marginPx}px`, ...elStyle }}>
              <hr style={{ borderColor: 'var(--border)', borderStyle: sp.lineStyle || 'solid' }} />
            </div>
          );
        }
        break;
      }
      
      case 'picture': {
        const pic = element as PictureElement;
        rendered = (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <img 
              src={pic.url} 
              alt={pic.alt || 'Image'} 
              className="w-full rounded-lg"
              style={{ 
                width: pic.width || '100%', 
                height: pic.height || 'auto', 
                objectFit: pic.objectFit || 'contain' 
              }}
            />
          </div>
        );
        break;
      }
      
      case 'group': {
        const ge = element as GroupElement;
        const isOpen = expandedSections.has(element.id);
        rendered = (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
              {ge.collapsible ? (
                <button
                  onClick={() => toggleSection(element.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:opacity-80"
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{ge.label}</span>
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  )}
                </button>
              ) : (
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{ge.label}</span>
                </div>
              )}
              {(!ge.collapsible || isOpen) && (
                <div className="p-2 flex flex-wrap">
                  {renderSortableChildren(ge.children, element.id)}
                </div>
              )}
              {editable && (!ge.collapsible || isOpen) && (
                <div className="px-2 pb-2">
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setContainerDropHighlight(element.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setContainerDropHighlight(null); }}
                    onDrop={(e) => handleContainerDrop(e, element.id)}
                    className={`border border-dashed rounded-lg py-2 text-center text-[10px] transition-colors ${
                      containerDropHighlight === element.id
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700/50 text-gray-600 hover:border-slate-600'
                    }`}
                  >
                    Drop here
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        break;
      }
      
      case 'row': {
        const re = element as RowElement;
        const gapPx = re.gap ?? 8;
        rendered = (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="flex" style={{ gap: `${gapPx}px` }}>
              {renderSortableChildren(re.children, element.id, 'horizontal')}
            </div>
          </div>
        );
        break;
      }
      
      case 'tab-group': {
        const tg = element as TabGroupElement;
        const activeTab = activeTabIds[element.id] || tg.tabs[0]?.id || '';
        const activeTabChildren = tg.tabs.find(t => t.id === activeTab)?.children || [];
        rendered = (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center gap-0 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {tg.tabs.map((tab, idx) => (
                  <div key={tab.id} className="flex items-center">
                    {idx > 0 && <span className="mx-2" style={{ color: 'var(--text-muted)' }}>|</span>}
                    <button
                      onClick={() => setActiveTabIds(prev => ({ ...prev, [element.id]: tab.id }))}
                      className="text-sm font-medium transition-colors"
                      style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {tab.label}
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-2 flex flex-wrap">
                {renderSortableChildren(activeTabChildren, element.id)}
              </div>
              {editable && (
                <div className="px-2 pb-2">
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setContainerDropHighlight(element.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setContainerDropHighlight(null); }}
                    onDrop={(e) => handleContainerDrop(e, element.id)}
                    className={`border border-dashed rounded-lg py-2 text-center text-[10px] transition-colors ${
                      containerDropHighlight === element.id
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700/50 text-gray-600 hover:border-slate-600'
                    }`}
                  >
                    Drop here
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        break;
      }
      
      default:
        return null;
    }

    return wrapEditable(element, rendered);
  };

  const PrimaryIcon = getActionIcon(layout.actions.primaryButton.action);
  const SecondaryIcon = layout.actions.secondaryButton 
    ? getActionIcon(layout.actions.secondaryButton.action) 
    : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 configurator-3dthd">
      {/* Device Selector */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-1 bg-slate-700/50 p-1 rounded-lg">
          {([
            { type: 'desktop', icon: Monitor, label: 'Desktop' },
            { type: 'tablet', icon: Tablet, label: 'Tablet' },
            { type: 'mobile', icon: Smartphone, label: 'Mobile' },
          ] as const).map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setDevice(type)}
              className={`p-2 rounded-md transition-colors ${
                device === type 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-slate-600'
              }`}
              style={device === type ? { backgroundColor: layout.styling.accentColor || '#f97316' } : {}}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Edit / Preview mode toggle */}
          {builderMode && onBuilderModeChange && (
            <div className="flex items-center bg-slate-700/50 p-0.5 rounded-lg">
              <button
                onClick={() => onBuilderModeChange('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  builderMode === 'edit'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={builderMode === 'edit' ? { backgroundColor: layout.styling.accentColor || '#f97316' } : {}}
              >
                <Sliders className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => onBuilderModeChange('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  builderMode === 'preview'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={builderMode === 'preview' ? { backgroundColor: layout.styling.accentColor || '#f97316' } : {}}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          )}
          {!builderMode && (
            <span className="text-xs text-gray-500">Preview Mode</span>
          )}
          {onFullScreen && (
            <button
              onClick={onFullScreen}
              className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Full Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas / Preview Frame */}
      {editable ? (
        /* ── EDIT MODE: Full scrollable canvas ── */
        <div
          className="flex-1 overflow-y-auto min-h-0"
          onClick={handleBackgroundClick}
          style={{
            ...themeVars,
            backgroundImage: 'radial-gradient(circle, rgba(71,85,105,0.25) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: '#0c1222',
          }}
        >
          <div className="w-full p-4 space-y-4" style={{ minHeight: '100%' }}>
            {layout.children && layout.children.length > 0 ? (
              (() => {
                const hasSections = layout.children.some(c => c.type === 'section');
                const sStyle = layout.styling.sectionStyle;
                const containerBg = sStyle === 'flat'
                  ? {}
                  : sStyle === 'bordered'
                    ? { borderWidth: '1px', borderColor: 'var(--border)' }
                    : { backgroundColor: 'rgba(51,65,85,0.4)' };
                const containerClass = sStyle === 'flat'
                  ? ''
                  : sStyle === 'bordered'
                    ? 'rounded-xl border'
                    : 'rounded-xl shadow-sm';

                const childrenContent = (
                  <div className="space-y-3">
                    {renderSortableChildren(layout.children, null)}
                  </div>
                );

                return !hasSections && sStyle !== 'flat' ? (
                  <div className={`overflow-hidden p-3 ${containerClass}`} style={containerBg}>
                    {childrenContent}
                  </div>
                ) : childrenContent;
              })()
            ) : (
              /* Empty canvas state */
              <div
                className="flex items-center justify-center border-2 border-dashed rounded-xl transition-colors border-slate-700/60"
                style={{ minHeight: 'calc(100vh - 10rem)' }}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/80 flex items-center justify-center">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    Click tools in the left toolbar to add elements
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Use the toolbox to build your layout</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── PREVIEW MODE: Device frame simulation ── */
        <div className="flex-1 flex justify-center p-4 min-h-0 overflow-hidden" onClick={handleBackgroundClick}>
          <div 
            className={`rounded-xl border border-slate-700 overflow-hidden transition-all flex flex-col min-h-0 ${
              device === 'desktop' ? 'w-full' : ''
            }`}
            style={{ 
              ...themeVars,
              width: device !== 'desktop' ? DEVICE_WIDTHS[device] : undefined,
              maxWidth: '100%',
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border)',
            }}
          >
            {/* Customer View Header */}
            <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{productName}</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure your product</p>
            </div>

            {/* Content: Section Nav + Configurator Panel */}
            <div className="flex-1 flex min-h-0 w-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {/* Section Navigation Sidebar — only in preview mode with 2+ sections */}
              {navSections.length >= 2 && (
                <nav className="w-44 shrink-0 border-r overflow-y-auto py-3" style={{ borderColor: 'var(--border)' }}>
                  {navSections.map((section, i) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSectionId(section.id);
                        const el = document.getElementById(`section-${section.id}`);
                        if (el && scrollContainerRef.current) {
                          const container = scrollContainerRef.current;
                          const elTop = el.offsetTop - container.offsetTop;
                          container.scrollTo({ top: elTop - 16, behavior: 'smooth' });
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm transition-colors relative"
                      style={{
                        color: activeSectionId === section.id || (!activeSectionId && i === 0)
                          ? 'var(--text-primary)'
                          : 'var(--accent)',
                        fontWeight: activeSectionId === section.id || (!activeSectionId && i === 0) ? 600 : 400,
                      }}
                    >
                      {(activeSectionId === section.id || (!activeSectionId && i === 0)) && (
                        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r" style={{ backgroundColor: 'var(--accent)' }} />
                      )}
                      {section.label}
                    </button>
                  ))}
                </nav>
              )}
              <div className="flex-1 overflow-y-auto min-h-0" ref={scrollContainerRef}>
              <div className="w-full">
                <div className="p-4 space-y-4">
                  {layout.children && layout.children.length > 0 ? (
                    (() => {
                      const hasSections = layout.children.some(c => c.type === 'section');
                      const sStyle = layout.styling.sectionStyle;
                      const containerBg = sStyle === 'flat'
                        ? {}
                        : sStyle === 'bordered'
                          ? { borderWidth: '1px', borderColor: 'var(--border)' }
                          : { backgroundColor: 'rgba(51,65,85,0.4)' };
                      const containerClass = sStyle === 'flat'
                        ? ''
                        : sStyle === 'bordered'
                          ? 'rounded-xl border'
                          : 'rounded-xl shadow-sm';

                      const childrenContent = (
                      <div className="space-y-3">
                        {renderSortableChildren(layout.children, null)}
                      </div>
                      );

                      return !hasSections && sStyle !== 'flat' ? (
                        <div className={`overflow-hidden p-3 ${containerClass}`} style={containerBg}>
                          {childrenContent}
                        </div>
                      ) : childrenContent;
                    })()
                  ) : (
                    /* V1 Fallback: Render from sections */
                    layout.sections.map((section) => (
                      <div key={section.id} className="bg-slate-800/50 rounded-xl overflow-hidden">
                        {section.collapsible ? (
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
                          >
                            <span className="text-sm font-medium text-white">{section.label}</span>
                            {expandedSections.has(section.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        ) : (
                          <div className="px-4 py-3 border-b border-slate-700/50">
                            <span className="text-sm font-medium text-white">{section.label}</span>
                          </div>
                        )}

                        {(!section.collapsible || expandedSections.has(section.id)) && (
                          <div className="px-2 py-2 space-y-2">
                            {section.parameters.length > 0 && (
                              <div className="flex flex-wrap">
                                {section.parameters.map((paramName) => {
                                  const param = parameters.find(p => p.name === paramName);
                                  if (!param) return null;
                                  return renderControl(param, getControlConfig(paramName));
                                })}
                              </div>
                            )}
                            {(section.elements || []).length > 0 && (
                              <div className="flex flex-wrap">
                                {(section.elements || []).map((element) => renderElement(element))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Action Button — matches configure page */}
                  <div className="pt-2">
                    <button
                      onClick={() => onUpdateSelection?.(configValues || values)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl hover:opacity-90 transition-colors text-sm shadow-sm"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Update Model Dimension
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
