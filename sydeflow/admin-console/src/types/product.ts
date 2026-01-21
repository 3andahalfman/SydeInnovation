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

  // Design Automation configuration
  automation: {
    activityId: string;
    appBundleId?: string;
    outputFormat: string; // 'ipt', 'step', 'pdf', etc.
    additionalOutputs?: string[]; // ['step', 'pdf']
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
// PRODUCT PIPELINE STATE
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
