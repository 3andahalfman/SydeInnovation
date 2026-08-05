// ============================================================================
// PRODUCT AUTOMATION PIPELINE - TYPE DEFINITIONS
// ============================================================================
// Schema-driven product configuration - NO HARDCODED VALUES
// ============================================================================

export interface ConfigurableProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';

  // Source CAD file in OSS
  sourceFile: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
    fileSize: number;
    urn?: string; // For viewer preview
  };

  // Associated drawing file in OSS (Inventor Drawing .idw for DWG export)
  drawingFile?: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
    fileSize: number;
    urn?: string; // For 2D viewer preview
  };

  // Design Automation configuration
  automation: {
    activityId: string;
    dwgActivityId?: string; // AutoCAD activity for DWG parameter updates (2D view)
    appBundleId?: string;
    outputFormat: string; // 'ipt', 'step', 'pdf', etc.
    additionalOutputs?: string[]; // ['step', 'pdf', 'dwg']
    enableDwgExport?: boolean; // When true, uses UpdateModelActivity for combined IPT+DWG
  };

  // Dynamic parameters - extracted from Inventor, configured by admin
  parameters: ParameterConfig[];

  // Pricing configuration
  pricing: PricingConfig;
}

export interface ParameterConfig {
  // Inventor parameter info (from extraction)
  inventorName: string; // Original parameter name in Inventor
  inventorType: 'ModelParameter' | 'UserParameter' | 'ReferenceParameter';
  
  // Display configuration
  displayName: string; // User-friendly name
  description?: string;
  
  // UI Control type
  controlType: 'number' | 'slider' | 'dropdown' | 'checkbox' | 'text';
  
  // Value configuration
  defaultValue: number | string | boolean;
  unit?: string;
  
  // Validation rules
  validation: {
    required: boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: SelectOption[]; // For dropdown
    pattern?: string; // Regex for text validation
  };

  // Visibility
  exposed: boolean; // Show to end customers?
  adminOnly?: boolean; // Only visible in admin panel?
  
  // Price impact
  priceModifier?: PriceModifier;
}

export interface SelectOption {
  value: string | number;
  label: string;
  priceAdjustment?: number;
}

export interface PriceModifier {
  type: 'none' | 'fixed' | 'per-unit' | 'multiplier' | 'formula';
  value?: number;
  formula?: string; // e.g., "value * 0.05" for 5% per unit
}

export interface PricingConfig {
  basePrice: number;
  currency: string;
  showPrice: boolean;
  
  // Per-parameter pricing rules
  parameterRules?: Record<string, PricingRule>;
  
  // Quantity-based pricing
  quantityBreaks?: {
    minQty: number;
    pricePerUnit: number;
  }[];
  
  // Discount rules
  discounts?: DiscountRule[];
  
  // Additional fees
  setupFee?: number;
  rushFee?: number;
}

export interface PricingRule {
  type: 'none' | 'per-unit' | 'fixed' | 'multiplier' | 'option-based';
  value?: number;
  description?: string;
  optionPrices?: Record<string, number>;
}

export interface DiscountRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'code';
  value: number;
  code?: string; // For promo codes
  conditions?: {
    minOrderValue?: number;
    minQuantity?: number;
    validFrom?: string;
    validUntil?: string;
  };
}

// ============================================================================
// PARAMETER EXTRACTION TYPES
// ============================================================================

export interface ExtractedParameter {
  name: string;
  value: number | string | boolean;
  unit: string;
  type: 'ModelParameter' | 'UserParameter' | 'ReferenceParameter';
  expression?: string; // If it's a formula-driven parameter
  isKey: boolean; // Marked as key parameter in Inventor
  isDriven: boolean; // Driven by another parameter
}

export interface ParameterExtractionResult {
  success: boolean;
  fileName: string;
  fileType: 'ipt' | 'iam';
  extractedAt: string;
  parameters: ExtractedParameter[];
  error?: string;
}

// ============================================================================
// PRODUCT MANAGER STATE
// ============================================================================

export type PipelineStep = 
  | 'product-details'
  | 'file-upload'
  | 'parameter-config'
  | 'automation-setup'
  | 'pricing'
  | 'preview';

export interface ProductPipelineState {
  currentStep: PipelineStep;
  product: Partial<ConfigurableProduct>;
  extractedParameters: ExtractedParameter[];
  isDirty: boolean;
  errors: Record<string, string>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ProductListResponse {
  products: ConfigurableProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductSaveResponse {
  success: boolean;
  product?: ConfigurableProduct;
  error?: string;
}

// ============================================================================
// CONFIGURATOR LAYOUT TYPES
// ============================================================================

// Layout Element Types - All draggable items in the toolbox
export type LayoutElementType = 
  | 'parameter'       // CAD parameter control
  | 'section'         // Collapsible section container (like Inventor Form sections)
  | 'group'           // Container for grouping elements
  | 'tab-group'       // Tabbed container with multiple tabs
  | 'row'             // Horizontal row for side-by-side elements
  | 'picture'         // Image element (URL-based)
  | 'empty-space'     // Spacer/padding element
  | 'label'           // Static text label
  | 'splitter';       // Visual divider line

// Per-element style overrides
export interface ElementStyle {
  backgroundColor?: string;
  textColor?: string;
  padding?: number;       // Uniform padding in pixels
  margin?: number;        // Uniform margin in pixels
  borderRadius?: number;  // Border radius in pixels
  borderColor?: string;
  borderWidth?: number;   // Border width in pixels
  opacity?: number;       // 0–1
  fontFamily?: string;
  fontSize?: number;      // In pixels
  fontWeight?: number | string; // 400, 600, 'bold', etc.
}

// Base interface for all layout elements
export interface BaseLayoutElement {
  id: string;
  type: LayoutElementType;
  order: number;
  style?: ElementStyle;
}

// Parameter element - references a CAD parameter
export interface ParameterElement extends BaseLayoutElement {
  type: 'parameter';
  parameterName: string;
}

// Group element - container with collapsible header
export interface GroupElement extends BaseLayoutElement {
  type: 'group';
  label: string;
  collapsible: boolean;
  defaultExpanded: boolean;
  children: LayoutElement[];
}

// Tab group element - tabbed container
export interface TabGroupElement extends BaseLayoutElement {
  type: 'tab-group';
  tabs: {
    id: string;
    label: string;
    children: LayoutElement[];
  }[];
  defaultTab?: string;
}

// Row element - horizontal layout
export interface RowElement extends BaseLayoutElement {
  type: 'row';
  children: LayoutElement[];
  gap?: number; // Gap in pixels
}

// Picture element - URL-based image
export interface PictureElement extends BaseLayoutElement {
  type: 'picture';
  url: string;
  alt?: string;
  width?: string;  // CSS width (e.g., '100%', '200px')
  height?: string; // CSS height
  objectFit?: 'cover' | 'contain' | 'fill';
}

// Empty space element - spacer
export interface EmptySpaceElement extends BaseLayoutElement {
  type: 'empty-space';
  height: number; // Height in pixels
}

// Label element - static text
export interface LabelElement extends BaseLayoutElement {
  type: 'label';
  text: string;
  variant: 'heading' | 'subheading' | 'body' | 'caption';
  align?: 'left' | 'center' | 'right';
}

// Splitter element - visual divider
export interface SplitterElement extends BaseLayoutElement {
  type: 'splitter';
  margin?: number; // Margin in pixels
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  orientation?: 'horizontal' | 'vertical'; // Default: horizontal
}

// Section element - collapsible container (like Inventor Form sections)
export interface SectionElement extends BaseLayoutElement {
  type: 'section';
  label: string;
  icon?: string; // Lucide icon name
  description?: string;
  collapsible: boolean;
  defaultExpanded: boolean;
  children: LayoutElement[];
}

// Union type for all layout elements
export type LayoutElement = 
  | ParameterElement 
  | SectionElement
  | GroupElement 
  | TabGroupElement 
  | RowElement 
  | PictureElement 
  | EmptySpaceElement 
  | LabelElement 
  | SplitterElement;

// Toolbox item definition
export interface ToolboxItem {
  type: LayoutElementType;
  label: string;
  icon: string; // Lucide icon name
  description: string;
}

// Predefined toolbox items
export const TOOLBOX_ITEMS: ToolboxItem[] = [
  { type: 'section', label: 'Section', icon: 'FolderOpen', description: 'Collapsible section container' },
  { type: 'tab-group', label: 'Tab Group', icon: 'Layers', description: 'Tabbed container' },
  { type: 'picture', label: 'Picture', icon: 'Image', description: 'URL-based image' },
  { type: 'empty-space', label: 'Empty Space', icon: 'Square', description: 'Spacer element' },
  { type: 'label', label: 'Label', icon: 'Type', description: 'Static text' },
  { type: 'splitter', label: 'Splitter', icon: 'Minus', description: 'Divider line' },
];

export interface ConfiguratorLayout {
  // Version for migration support
  version: number;
  
  // V2: Flat list of top-level children (parameters, sections, elements)
  children: LayoutElement[];

  // V1 legacy: Section-based layout (kept for migration)
  sections: LayoutSection[];
  
  // Per-parameter control configuration
  controls: Record<string, ControlConfig>;
  
  // Visual styling
  styling: LayoutStyling;
  
  // Action buttons
  actions: LayoutActions;
  
  // Unassigned parameters (not placed on canvas)
  unassignedParameters: string[];
}

export interface LayoutSection {
  id: string;
  label: string;
  icon?: string; // Lucide icon name
  description?: string;
  collapsible: boolean;
  defaultExpanded: boolean;
  order: number;
  parameters: string[]; // Parameter names in display order (legacy)
  subsections?: LayoutSubsection[]; // Nested subsections (legacy)
  elements?: LayoutElement[]; // New: mixed elements including parameters
}

export interface LayoutSubsection {
  id: string;
  label: string;
  collapsible: boolean;
  defaultExpanded: boolean;
  parameters: string[]; // Parameter names in display order
}

export interface ControlConfig {
  controlType: 'slider' | 'input' | 'slider-input' | 'dropdown' | 'toggle' | 'color' | 'text';
  showLabel: boolean;
  showUnit: boolean;
  showDescription: boolean;
  showMinMax: boolean;
  width: 'full' | 'half' | 'third';
  customLabel?: string; // Override displayName
  customDescription?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  customMin?: number; // Override param.min
  customMax?: number; // Override param.max
  customStep?: number; // Override param.step
}

export interface LayoutStyling {
  theme: 'dark' | 'light' | 'auto';
  accentColor: string;
  panelPosition: 'left' | 'right' | 'top' | 'bottom';
  panelWidth: 'narrow' | 'medium' | 'wide';
  sectionStyle: 'card' | 'flat' | 'bordered';
  controlSize: 'compact' | 'normal' | 'large';
}

export interface LayoutActions {
  primaryButton: ActionButton;
  secondaryButton?: ActionButton;
  showResetButton: boolean;
}

export interface ActionButton {
  label: string;
  action: 'quote' | 'add-to-cart' | 'download' | 'custom';
  customAction?: string;
  style: 'primary' | 'secondary' | 'outline';
}

// Convert ElementStyle to React CSSProperties
export function elementStyleToCSS(style?: ElementStyle): React.CSSProperties {
  if (!style) return {};
  const css: React.CSSProperties = {};
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textColor) css.color = style.textColor;
  if (style.padding !== undefined) css.padding = `${style.padding}px`;
  if (style.margin !== undefined) css.margin = `${style.margin}px`;
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`;
  if (style.borderColor) css.borderColor = style.borderColor;
  if (style.borderWidth !== undefined) { css.borderWidth = `${style.borderWidth}px`; css.borderStyle = 'solid'; }
  if (style.opacity !== undefined) css.opacity = style.opacity;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize !== undefined) css.fontSize = `${style.fontSize}px`;
  if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight;
  return css;
}

// Default layout factory - V2 flat canvas
export function createDefaultLayout(parameters: string[]): ConfiguratorLayout {
  // Put all parameters as top-level children (flat canvas, no mandatory sections)
  const children: LayoutElement[] = parameters.map((name, i) => ({
    id: `param-${name}`,
    type: 'parameter' as const,
    order: i,
    parameterName: name
  }));

  return {
    version: 2,
    children,
    sections: [], // Empty for V2 layouts
    controls: {},
    styling: {
      theme: 'dark',
      accentColor: '#f97316', // orange-500
      panelPosition: 'right',
      panelWidth: 'medium',
      sectionStyle: 'card',
      controlSize: 'normal'
    },
    actions: {
      primaryButton: {
        label: 'Request Quote',
        action: 'quote',
        style: 'primary'
      },
      showResetButton: true
    },
    unassignedParameters: []
  };
}

// ============================================================================
// LAYOUT MIGRATION: V1 (section-based) → V2 (flat children)
// ============================================================================

export function migrateLayoutV1toV2(layout: ConfiguratorLayout): ConfiguratorLayout {
  // Already V2
  if (layout.version >= 2 && layout.children && layout.children.length > 0) {
    return layout;
  }

  // No sections to migrate from
  if (!layout.sections || layout.sections.length === 0) {
    return { ...layout, version: 2, children: [] };
  }

  const children: LayoutElement[] = [];
  let order = 0;

  for (const section of layout.sections) {
    // If there's only one section with default id and it's not collapsible,
    // flatten its contents directly to the root (no section wrapper)
    const isDefaultSingleSection = layout.sections.length === 1 
      && section.id === 'default' 
      && !section.collapsible;

    const sectionChildren: LayoutElement[] = [];

    // Convert section parameters to ParameterElements
    for (const paramName of (section.parameters || [])) {
      sectionChildren.push({
        id: `param-${paramName}-${Date.now()}-${order}`,
        type: 'parameter',
        order: order++,
        parameterName: paramName
      });
    }

    // Add existing elements
    for (const element of (section.elements || [])) {
      sectionChildren.push({ ...element, order: order++ });
    }

    // Convert subsections to GroupElements
    for (const sub of (section.subsections || [])) {
      const subChildren: LayoutElement[] = (sub.parameters || []).map(pName => ({
        id: `param-${pName}-${Date.now()}-${order}`,
        type: 'parameter' as const,
        order: order++,
        parameterName: pName
      }));

      sectionChildren.push({
        id: sub.id,
        type: 'group',
        order: order++,
        label: sub.label,
        collapsible: sub.collapsible,
        defaultExpanded: sub.defaultExpanded,
        children: subChildren
      });
    }

    if (isDefaultSingleSection) {
      // Flatten directly into root
      children.push(...sectionChildren);
    } else {
      // Wrap in a SectionElement
      children.push({
        id: section.id,
        type: 'section',
        order: order++,
        label: section.label,
        icon: section.icon,
        description: section.description,
        collapsible: section.collapsible,
        defaultExpanded: section.defaultExpanded,
        children: sectionChildren
      });
    }
  }

  return {
    ...layout,
    version: 2,
    children,
    // Keep sections for backward compat but they won't be used
    sections: layout.sections
  };
}

// ============================================================================
// CONFIGURATOR TEMPLATES
// ============================================================================

export interface ConfiguratorTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // Inline SVG string
  createLayout: (parameters: string[]) => ConfiguratorLayout;
}

// SVG thumbnail helpers — simple layout diagrams
const svgWrap = (inner: string) =>
  `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="140" rx="8" fill="#0f172a"/>
    ${inner}
  </svg>`;

export const CONFIGURATOR_TEMPLATES: ConfiguratorTemplate[] = [
  // ── 1. Header + Left Panel ──────────────────────────────────────────────
  {
    id: 'header-left-panel',
    name: 'Header + Left Panel',
    description: 'Full-width header bar with a narrow panel on the left and 3D viewer on the right.',
    thumbnail: svgWrap(`
      <rect x="8" y="8" width="184" height="18" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="14" y="12" width="50" height="4" rx="2" fill="#3b82f6" opacity="0.8"/>
      <rect x="14" y="17" width="30" height="3" rx="1" fill="#475569"/>
      <rect x="8" y="32" width="68" height="100" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="14" y="40" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="14" y="50" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="14" y="60" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="14" y="70" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="14" y="82" width="56" height="8" rx="3" fill="#3b82f6" opacity="0.6"/>
      <rect x="82" y="32" width="110" height="100" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="112" y="60" width="50" height="40" rx="4" fill="#334155"/>
      <polygon points="137,68 152,86 122,86" fill="#3b82f6" opacity="0.5"/>
    `),
    createLayout: (parameters) => {
      const children: LayoutElement[] = parameters.map((name, i) => ({
        id: `param-${name}`,
        type: 'parameter' as const,
        order: i,
        parameterName: name
      }));
      return {
        version: 2,
        children,
        sections: [],
        controls: {},
        styling: {
          theme: 'light',
          accentColor: '#3b82f6',
          panelPosition: 'left',
          panelWidth: 'narrow',
          sectionStyle: 'flat',
          controlSize: 'normal'
        },
        actions: {
          primaryButton: { label: 'Request Quote', action: 'quote', style: 'primary' },
          showResetButton: true
        },
        unassignedParameters: []
      };
    }
  },

  // ── 2. Header + Right Panel ─────────────────────────────────────────────
  {
    id: 'header-right-panel',
    name: 'Header + Right Panel',
    description: 'Full-width header with 3D viewer on the left and a controls panel on the right.',
    thumbnail: svgWrap(`
      <rect x="8" y="8" width="184" height="18" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="14" y="12" width="50" height="4" rx="2" fill="#f97316" opacity="0.8"/>
      <rect x="170" y="12" width="16" height="10" rx="3" fill="#334155"/>
      <text x="178" y="19" font-size="6" fill="#94a3b8" text-anchor="middle">✕</text>
      <rect x="8" y="32" width="110" height="100" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="38" y="60" width="50" height="40" rx="4" fill="#334155"/>
      <polygon points="63,68 78,86 48,86" fill="#f97316" opacity="0.5"/>
      <rect x="124" y="32" width="68" height="100" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <rect x="130" y="40" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="130" y="50" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="130" y="60" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="130" y="70" width="56" height="4" rx="2" fill="#475569"/>
      <rect x="130" y="82" width="56" height="8" rx="3" fill="#f97316" opacity="0.6"/>
    `),
    createLayout: (parameters) => {
      const children: LayoutElement[] = parameters.map((name, i) => ({
        id: `param-${name}`,
        type: 'parameter' as const,
        order: i,
        parameterName: name
      }));
      return {
        version: 2,
        children,
        sections: [],
        controls: {},
        styling: {
          theme: 'dark',
          accentColor: '#f97316',
          panelPosition: 'right',
          panelWidth: 'narrow',
          sectionStyle: 'flat',
          controlSize: 'normal'
        },
        actions: {
          primaryButton: { label: 'Get Quote', action: 'quote', style: 'primary' },
          showResetButton: true
        },
        unassignedParameters: []
      };
    }
  },
];
