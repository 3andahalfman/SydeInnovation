'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  UniqueIdentifier
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, ChevronDown, ChevronRight,
  Type, Minus, Image as ImageIcon, Square, Columns,
  Layers, FolderOpen, Sliders, Plus
} from 'lucide-react';
import type {
  ConfiguratorLayout, LayoutElement, LayoutElementType,
  ParameterElement, GroupElement, TabGroupElement, RowElement,
  PictureElement, EmptySpaceElement, LabelElement, SplitterElement,
  SectionElement
} from '@/types/product';

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
  group?: string;
}

interface LayoutBuilderProps {
  parameters: Parameter[];
  layout: ConfiguratorLayout;
  onLayoutChange: (layout: ConfiguratorLayout) => void;
  showToolbox?: boolean;
  hideToolbar?: boolean;
  externalDraggedToolboxItem?: string | null;
  onExternalDrop?: () => void;
  onSelectElement?: (element: LayoutElement | null) => void;
  onSelectParam?: (paramName: string | null) => void;
}

// ============================================================================
// HELPER: Create element from type
// ============================================================================

function createElementFromType(type: LayoutElementType, order: number): LayoutElement {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, order };

  switch (type) {
    case 'section':
      return { ...base, type: 'section', label: 'New Section', collapsible: true, defaultExpanded: true, children: [] } as SectionElement;
    case 'group':
      return { ...base, type: 'group', label: 'Group', collapsible: true, defaultExpanded: true, children: [] } as GroupElement;
    case 'tab-group':
      return { ...base, type: 'tab-group', tabs: [
        { id: `tab-${Date.now()}-1`, label: 'Tab 1', children: [] },
        { id: `tab-${Date.now()}-2`, label: 'Tab 2', children: [] }
      ]} as TabGroupElement;
    case 'row':
      return { ...base, type: 'row', children: [], gap: 8 } as RowElement;
    case 'picture':
      return { ...base, type: 'picture', url: '', alt: 'Image' } as PictureElement;
    case 'empty-space':
      return { ...base, type: 'empty-space', height: 20 } as EmptySpaceElement;
    case 'label':
      return { ...base, type: 'label', text: 'Label text', variant: 'body' } as LabelElement;
    case 'splitter':
      return { ...base, type: 'splitter', lineStyle: 'solid' } as SplitterElement;
    default:
      return { ...base, type: 'label', text: 'Unknown', variant: 'body' } as LabelElement;
  }
}

// ============================================================================
// HELPER: Get icon for element type
// ============================================================================

function getElementIcon(type: LayoutElementType) {
  switch (type) {
    case 'parameter': return Sliders;
    case 'section': return FolderOpen;
    case 'group': return FolderOpen;
    case 'tab-group': return Layers;
    case 'row': return Columns;
    case 'picture': return ImageIcon;
    case 'empty-space': return Square;
    case 'label': return Type;
    case 'splitter': return Minus;
    default: return Square;
  }
}

// ============================================================================
// HELPER: Get label for element
// ============================================================================

function getElementLabel(element: LayoutElement, parameters: Parameter[]): string {
  switch (element.type) {
    case 'parameter': {
      const param = parameters.find(p => p.name === (element as ParameterElement).parameterName);
      return param?.displayName || (element as ParameterElement).parameterName;
    }
    case 'section': return (element as SectionElement).label;
    case 'group': return (element as GroupElement).label;
    case 'tab-group': return `Tab Group (${(element as TabGroupElement).tabs.length} tabs)`;
    case 'row': return `Row (${(element as RowElement).children.length} items)`;
    case 'picture': return 'Picture';
    case 'empty-space': return `Space (${(element as EmptySpaceElement).height}px)`;
    case 'label': return (element as LabelElement).text || 'Label';
    case 'splitter': return 'Divider';
    default: return 'Element';
  }
}

// ============================================================================
// HELPER: Collect all element IDs recursively
// ============================================================================

function collectIds(elements: LayoutElement[]): string[] {
  const ids: string[] = [];
  for (const el of elements) {
    ids.push(el.id);
    if (el.type === 'section' || el.type === 'group') {
      ids.push(...collectIds((el as SectionElement | GroupElement).children));
    } else if (el.type === 'row') {
      ids.push(...collectIds((el as RowElement).children));
    } else if (el.type === 'tab-group') {
      for (const tab of (el as TabGroupElement).tabs) {
        ids.push(...collectIds(tab.children));
      }
    }
  }
  return ids;
}

// ============================================================================
// HELPER: Find and remove element by ID from tree, returning [newTree, removedElement]
// ============================================================================

function removeFromTree(elements: LayoutElement[], id: string): [LayoutElement[], LayoutElement | null] {
  let removed: LayoutElement | null = null;
  
  const filter = (items: LayoutElement[]): LayoutElement[] => {
    return items.reduce<LayoutElement[]>((acc, el) => {
      if (el.id === id) {
        removed = el;
        return acc;
      }
      
      if (el.type === 'section' || el.type === 'group') {
        const container = el as SectionElement | GroupElement;
        const newChildren = filter(container.children);
        acc.push({ ...container, children: newChildren } as LayoutElement);
      } else if (el.type === 'row') {
        const row = el as RowElement;
        const newChildren = filter(row.children);
        acc.push({ ...row, children: newChildren } as LayoutElement);
      } else if (el.type === 'tab-group') {
        const tg = el as TabGroupElement;
        const newTabs = tg.tabs.map(tab => ({
          ...tab,
          children: filter(tab.children)
        }));
        acc.push({ ...tg, tabs: newTabs } as LayoutElement);
      } else {
        acc.push(el);
      }
      return acc;
    }, []);
  };

  const newTree = filter(elements);
  return [newTree, removed];
}

// ============================================================================
// HELPER: Insert element at position in a list
// ============================================================================

function insertAt(elements: LayoutElement[], element: LayoutElement, index: number): LayoutElement[] {
  const result = [...elements];
  result.splice(index, 0, element);
  return result.map((el, i) => ({ ...el, order: i }));
}

// ============================================================================
// HELPER: Find container ID and index for an element ID
// ============================================================================

type ContainerInfo = { containerId: string; index: number } | null;

function findContainer(elements: LayoutElement[], targetId: string, parentId: string = 'root'): ContainerInfo {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.id === targetId) {
      return { containerId: parentId, index: i };
    }
    if (el.type === 'section' || el.type === 'group') {
      const result = findContainer((el as SectionElement | GroupElement).children, targetId, el.id);
      if (result) return result;
    }
    if (el.type === 'row') {
      const result = findContainer((el as RowElement).children, targetId, el.id);
      if (result) return result;
    }
    if (el.type === 'tab-group') {
      for (const tab of (el as TabGroupElement).tabs) {
        const result = findContainer(tab.children, targetId, `${el.id}:${tab.id}`);
        if (result) return result;
      }
    }
  }
  return null;
}

// ============================================================================
// HELPER: Insert element into tree by container ID
// ============================================================================

function insertIntoContainer(
  elements: LayoutElement[], 
  containerId: string, 
  element: LayoutElement, 
  index: number
): LayoutElement[] {
  if (containerId === 'root') {
    return insertAt(elements, element, index);
  }

  return elements.map(el => {
    if (el.id === containerId) {
      if (el.type === 'section' || el.type === 'group') {
        const container = el as SectionElement | GroupElement;
        return { ...container, children: insertAt(container.children, element, index) } as LayoutElement;
      }
      if (el.type === 'row') {
        const row = el as RowElement;
        return { ...row, children: insertAt(row.children, element, index) } as LayoutElement;
      }
    }

    // Check tab containers (format: "tabGroupId:tabId")
    if (containerId.includes(':') && el.type === 'tab-group') {
      const [tgId, tabId] = containerId.split(':');
      if (el.id === tgId) {
        const tg = el as TabGroupElement;
        const newTabs = tg.tabs.map(tab => {
          if (tab.id === tabId) {
            return { ...tab, children: insertAt(tab.children, element, index) };
          }
          return tab;
        });
        return { ...tg, tabs: newTabs } as LayoutElement;
      }
    }

    // Recurse into children
    if (el.type === 'section' || el.type === 'group') {
      const container = el as SectionElement | GroupElement;
      return { ...container, children: insertIntoContainer(container.children, containerId, element, index) } as LayoutElement;
    }
    if (el.type === 'row') {
      const row = el as RowElement;
      return { ...row, children: insertIntoContainer(row.children, containerId, element, index) } as LayoutElement;
    }
    if (el.type === 'tab-group') {
      const tg = el as TabGroupElement;
      const newTabs = tg.tabs.map(tab => ({
        ...tab,
        children: insertIntoContainer(tab.children, containerId, element, index)
      }));
      return { ...tg, tabs: newTabs } as LayoutElement;
    }

    return el;
  });
}

// ============================================================================
// SORTABLE ITEM COMPONENT
// ============================================================================

interface SortableItemProps {
  element: LayoutElement;
  parameters: Parameter[];
  selectedId: string | null;
  onSelect: (element: LayoutElement) => void;
  onDelete: (id: string) => void;
  depth?: number;
  renderChildren?: (children: LayoutElement[], containerId: string) => React.ReactNode;
}

function SortableItem({ element, parameters, selectedId, onSelect, onDelete, depth = 0, renderChildren }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const [isExpanded, setIsExpanded] = useState(true);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const Icon = getElementIcon(element.type);
  const label = getElementLabel(element, parameters);
  const isSelected = selectedId === element.id;
  const isContainer = element.type === 'section' || element.type === 'group' || element.type === 'row' || element.type === 'tab-group';

  // Type badge colors
  const typeBadgeColor = (() => {
    switch (element.type) {
      case 'parameter': return 'bg-blue-500/20 text-blue-400';
      case 'section': return 'bg-orange-500/20 text-orange-400';
      case 'group': return 'bg-purple-500/20 text-purple-400';
      case 'tab-group': return 'bg-cyan-500/20 text-cyan-400';
      case 'row': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-500/20 text-gray-400';
    }
  })();

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Main item row */}
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(element); }}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all group ${
          isSelected
            ? 'bg-orange-500/15 border border-orange-500/40 ring-1 ring-orange-500/20'
            : 'hover:bg-slate-700/50 border border-transparent'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Expand/collapse toggle for containers */}
        {isContainer ? (
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-0.5 text-gray-500 hover:text-white shrink-0"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Icon */}
        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-orange-400' : 'text-gray-500'}`} />

        {/* Label */}
        <span className={`text-xs truncate flex-1 ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
          {label}
        </span>

        {/* Type badge */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${typeBadgeColor}`}>
          {element.type}
        </span>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
          className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Children for containers */}
      {isContainer && isExpanded && renderChildren && (() => {
        if (element.type === 'section' || element.type === 'group') {
          const container = element as SectionElement | GroupElement;
          return (
            <div className="ml-2 border-l border-slate-700/50">
              {renderChildren(container.children, element.id)}
              <DroppableEmptyZone containerId={element.id} isEmpty={container.children.length === 0} />
            </div>
          );
        }
        if (element.type === 'row') {
          const row = element as RowElement;
          return (
            <div className="ml-2 border-l border-slate-700/50">
              {renderChildren(row.children, element.id)}
              <DroppableEmptyZone containerId={element.id} isEmpty={row.children.length === 0} />
            </div>
          );
        }
        if (element.type === 'tab-group') {
          const tg = element as TabGroupElement;
          return (
            <div className="ml-2 border-l border-slate-700/50">
              {tg.tabs.map(tab => (
                <div key={tab.id}>
                  <div className="px-2 py-1 text-[10px] font-medium text-cyan-400/70 flex items-center gap-1" style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}>
                    <Layers className="w-2.5 h-2.5" />
                    {tab.label}
                  </div>
                  {renderChildren(tab.children, `${element.id}:${tab.id}`)}
                  <DroppableEmptyZone containerId={`${element.id}:${tab.id}`} isEmpty={tab.children.length === 0} />
                </div>
              ))}
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

// ============================================================================
// DROPPABLE EMPTY ZONE - Shows drop target for empty containers
// ============================================================================

function DroppableEmptyZone({ containerId, isEmpty }: { containerId: string; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${containerId}`,
    data: { containerId, type: 'empty-zone' }
  });

  if (!isEmpty) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mx-3 my-1.5 py-3 border border-dashed rounded-lg flex items-center justify-center text-[10px] transition-colors ${
        isOver
          ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
          : 'border-slate-700 text-gray-600'
      }`}
    >
      Drop items here
    </div>
  );
}

// ============================================================================
// DRAG OVERLAY ITEM - Ghost element shown while dragging
// ============================================================================

function DragOverlayItem({ element, parameters }: { element: LayoutElement; parameters: Parameter[] }) {
  const Icon = getElementIcon(element.type);
  const label = getElementLabel(element, parameters);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-orange-500/50 rounded-lg shadow-xl shadow-black/50 opacity-90 max-w-64">
      <GripVertical className="w-3.5 h-3.5 text-orange-400" />
      <Icon className="w-3.5 h-3.5 text-orange-400" />
      <span className="text-xs text-white truncate">{label}</span>
    </div>
  );
}

// ============================================================================
// TOOLBOX OVERLAY ITEM - Ghost for toolbox drags
// ============================================================================

function ToolboxOverlayItem({ type }: { type: string }) {
  const Icon = getElementIcon(type as LayoutElementType);
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-blue-500/50 rounded-lg shadow-xl shadow-black/50 opacity-90">
      <Icon className="w-3.5 h-3.5 text-blue-400" />
      <span className="text-xs text-white capitalize">{type.replace('-', ' ')}</span>
    </div>
  );
}

// ============================================================================
// MAIN LAYOUT BUILDER COMPONENT
// ============================================================================

export default function LayoutBuilder({
  parameters,
  layout,
  onLayoutChange,
  externalDraggedToolboxItem,
  onExternalDrop,
  onSelectElement,
  onSelectParam,
}: LayoutBuilderProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Children from layout
  const children = layout.children || [];

  // Unassigned parameters (not placed on canvas)
  const placedParams = useMemo(() => {
    const placed = new Set<string>();
    const walk = (elements: LayoutElement[]) => {
      for (const el of elements) {
        if (el.type === 'parameter') {
          placed.add((el as ParameterElement).parameterName);
        } else if (el.type === 'section' || el.type === 'group') {
          walk((el as SectionElement | GroupElement).children);
        } else if (el.type === 'row') {
          walk((el as RowElement).children);
        } else if (el.type === 'tab-group') {
          for (const tab of (el as TabGroupElement).tabs) {
            walk(tab.children);
          }
        }
      }
    };
    walk(children);
    return placed;
  }, [children]);

  const unassignedParams = useMemo(
    () => parameters.filter(p => !placedParams.has(p.name)),
    [parameters, placedParams]
  );

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // All sortable IDs (flat collection for the root level)
  const rootIds = useMemo(() => children.map(el => el.id), [children]);

  // Find active element for overlay
  const activeElement = useMemo(() => {
    if (!activeId) return null;
    const findInTree = (elements: LayoutElement[]): LayoutElement | null => {
      for (const el of elements) {
        if (el.id === activeId) return el;
        if (el.type === 'section' || el.type === 'group') {
          const found = findInTree((el as SectionElement | GroupElement).children);
          if (found) return found;
        }
        if (el.type === 'row') {
          const found = findInTree((el as RowElement).children);
          if (found) return found;
        }
        if (el.type === 'tab-group') {
          for (const tab of (el as TabGroupElement).tabs) {
            const found = findInTree(tab.children);
            if (found) return found;
          }
        }
      }
      return null;
    };
    return findInTree(children);
  }, [activeId, children]);

  // ============================================================================
  // DND HANDLERS
  // ============================================================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;
    if (active.id === over.id) return;

    const activeInfo = findContainer(children, active.id as string);
    const overInfo = findContainer(children, over.id as string);

    // Check if dropping on an empty zone
    const overIdStr = over.id as string;
    if (overIdStr.startsWith('drop-zone-')) {
      const targetContainerId = overIdStr.replace('drop-zone-', '');
      const [newTree, removed] = removeFromTree(children, active.id as string);
      if (removed) {
        const result = insertIntoContainer(newTree, targetContainerId, removed, 0);
        onLayoutChange({ ...layout, children: result });
      }
      return;
    }

    if (!activeInfo || !overInfo) return;

    // Same container: reorder
    if (activeInfo.containerId === overInfo.containerId) {
      const [newTree, removed] = removeFromTree(children, active.id as string);
      if (removed) {
        // Find the new index of the over item after removal
        const overInNew = findContainer(newTree, over.id as string);
        if (overInNew) {
          const result = insertIntoContainer(newTree, overInNew.containerId, removed, overInNew.index);
          onLayoutChange({ ...layout, children: result });
        }
      }
    } else {
      // Different container: move between containers
      const [newTree, removed] = removeFromTree(children, active.id as string);
      if (removed) {
        const overInNew = findContainer(newTree, over.id as string);
        if (overInNew) {
          const result = insertIntoContainer(newTree, overInNew.containerId, removed, overInNew.index);
          onLayoutChange({ ...layout, children: result });
        }
      }
    }
  }, [children, layout, onLayoutChange]);

  // ============================================================================
  // SELECTION
  // ============================================================================

  const handleSelect = useCallback((element: LayoutElement) => {
    setSelectedId(element.id);
    if (element.type === 'parameter') {
      onSelectParam?.((element as ParameterElement).parameterName);
      onSelectElement?.(null);
    } else {
      onSelectElement?.(element);
      onSelectParam?.(null);
    }
  }, [onSelectElement, onSelectParam]);

  // ============================================================================
  // DELETE
  // ============================================================================

  const handleDelete = useCallback((id: string) => {
    const [newTree] = removeFromTree(children, id);
    onLayoutChange({ ...layout, children: newTree });
    if (selectedId === id) {
      setSelectedId(null);
      onSelectElement?.(null);
      onSelectParam?.(null);
    }
  }, [children, layout, onLayoutChange, selectedId, onSelectElement, onSelectParam]);

  // ============================================================================
  // EXTERNAL DROP (from page-level toolbox)
  // ============================================================================

  const handleExternalDrop = useCallback((e: React.DragEvent, containerId: string = 'root', index?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!externalDraggedToolboxItem) return;

    const newElement = createElementFromType(externalDraggedToolboxItem as LayoutElementType, children.length);
    const targetIndex = index ?? (containerId === 'root' ? children.length : 0);
    const result = insertIntoContainer(children, containerId, newElement, targetIndex);
    onLayoutChange({ ...layout, children: result });
    onExternalDrop?.();

    // Select the new element
    handleSelect(newElement);
  }, [externalDraggedToolboxItem, children, layout, onLayoutChange, onExternalDrop, handleSelect]);

  // ============================================================================
  // ADD PARAMETER TO CANVAS
  // ============================================================================

  const addParameterToCanvas = useCallback((paramName: string) => {
    const newElement: ParameterElement = {
      id: `param-${paramName}-${Date.now()}`,
      type: 'parameter',
      order: children.length,
      parameterName: paramName
    };
    onLayoutChange({ ...layout, children: [...children, newElement] });
    handleSelect(newElement);
  }, [children, layout, onLayoutChange, handleSelect]);

  // ============================================================================
  // KEYBOARD DELETE
  // ============================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedId) {
      handleDelete(selectedId);
    }
  }, [selectedId, handleDelete]);

  // ============================================================================
  // RENDER CHILDREN RECURSIVELY
  // ============================================================================

  const renderSortableChildren = useCallback((items: LayoutElement[], containerId: string, depth: number = 0) => {
    const ids = items.map(el => el.id);
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map(element => (
          <SortableItem
            key={element.id}
            element={element}
            parameters={parameters}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            depth={depth}
            renderChildren={(childItems, childContainerId) => renderSortableChildren(childItems, childContainerId, depth + 1)}
          />
        ))}
      </SortableContext>
    );
  }, [parameters, selectedId, handleSelect, handleDelete]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      className="flex flex-col h-full bg-slate-900/50" 
      onKeyDown={handleKeyDown} 
      tabIndex={0}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Canvas area */}
        <div
          className="flex-1 overflow-y-auto p-2"
          onDragOver={(e) => {
            if (externalDraggedToolboxItem) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => handleExternalDrop(e)}
        >
          {children.length === 0 ? (
            /* Empty canvas */
            <div
              className={`h-full min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors ${
                externalDraggedToolboxItem
                  ? 'border-orange-500/50 bg-orange-500/5'
                  : 'border-slate-700 bg-slate-800/20'
              }`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => handleExternalDrop(e)}
            >
              <div className="text-center p-6">
                <div className="w-12 h-12 mx-auto mb-3 bg-slate-800 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Empty Canvas</h3>
                <p className="text-xs text-gray-600 max-w-[200px]">
                  Drag elements from the toolbox or add parameters from the list below
                </p>
              </div>
            </div>
          ) : (
            /* Elements tree */
            <div className="space-y-0.5">
              {renderSortableChildren(children, 'root', 0)}
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeElement ? (
            <DragOverlayItem element={activeElement} parameters={parameters} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Unassigned Parameters Panel */}
      {unassignedParams.length > 0 && (
        <div className="border-t border-slate-700 bg-slate-800/30">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Unassigned Parameters ({unassignedParams.length})
            </span>
          </div>
          <div className="px-2 pb-2 space-y-0.5 max-h-[150px] overflow-y-auto">
            {unassignedParams.map(param => (
              <button
                key={param.name}
                onClick={() => addParameterToCanvas(param.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-700/50 transition-colors group"
                title={`Click to add ${param.displayName} to canvas`}
              >
                <Sliders className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-xs text-gray-400 truncate flex-1 group-hover:text-white">
                  {param.displayName}
                </span>
                <span className="text-[9px] text-gray-600">
                  {param.unit || param.type}
                </span>
                <Plus className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
