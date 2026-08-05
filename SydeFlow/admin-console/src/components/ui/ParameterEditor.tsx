'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sliders, ChevronDown, Hash, Type, ToggleLeft, RefreshCw, Check, AlertCircle, Info } from 'lucide-react';

/**
 * Parameter type extracted from Inventor file
 */
export interface ExtractedParameter {
  name: string;
  value: number | string | boolean;
  type: 'numeric' | 'text' | 'boolean' | 'enum';
  unit?: string;
  min?: number;
  max?: number;
  increment?: number;
  options?: string[];  // For enum/dropdown types
  expression?: string;
  comment?: string;
  isKey?: boolean;     // Key parameter flag
}

/**
 * Parameter values map
 */
export interface ParameterValues {
  [name: string]: number | string | boolean;
}

/**
 * Props for the ParameterEditor component
 */
interface ParameterEditorProps {
  parameters: ExtractedParameter[];
  initialValues?: ParameterValues;
  onChange?: (values: ParameterValues) => void;
  onSubmit?: (values: ParameterValues) => void;
  isLoading?: boolean;
  readOnly?: boolean;
  showUnits?: boolean;
  groupByType?: boolean;
  title?: string;
  submitLabel?: string;
}

/**
 * Dynamic Parameter Editor
 * Renders appropriate UI controls based on parameter types extracted from Inventor files
 */
export function ParameterEditor({
  parameters,
  initialValues = {},
  onChange,
  onSubmit,
  isLoading = false,
  readOnly = false,
  showUnits = true,
  groupByType = false,
  title = 'Parameters',
  submitLabel = 'Apply Changes'
}: ParameterEditorProps) {
  // Initialize values from parameters or initial values
  const [values, setValues] = useState<ParameterValues>(() => {
    const initial: ParameterValues = {};
    parameters.forEach(param => {
      initial[param.name] = initialValues[param.name] ?? param.value;
    });
    return initial;
  });

  const [errors, setErrors] = useState<{ [name: string]: string }>({});

  // Update values when parameters change
  useEffect(() => {
    const newValues: ParameterValues = {};
    parameters.forEach(param => {
      newValues[param.name] = initialValues[param.name] ?? param.value;
    });
    setValues(newValues);
  }, [parameters, initialValues]);

  // Handle value change
  const handleChange = useCallback((name: string, value: number | string | boolean) => {
    const param = parameters.find(p => p.name === name);
    let newValue = value;
    let error = '';

    // Validate numeric parameters
    if (param?.type === 'numeric' && typeof value === 'number') {
      if (param.min !== undefined && value < param.min) {
        error = `Minimum value is ${param.min}`;
        newValue = param.min;
      }
      if (param.max !== undefined && value > param.max) {
        error = `Maximum value is ${param.max}`;
        newValue = param.max;
      }
    }

    setValues(prev => {
      const updated = { ...prev, [name]: newValue };
      onChange?.(updated);
      return updated;
    });

    setErrors(prev => error ? { ...prev, [name]: error } : Object.fromEntries(
      Object.entries(prev).filter(([k]) => k !== name)
    ));
  }, [parameters, onChange]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length === 0) {
      onSubmit?.(values);
    }
  };

  // Group parameters by type if enabled
  const groupedParams = groupByType
    ? parameters.reduce((acc, param) => {
        const type = param.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(param);
        return acc;
      }, {} as { [type: string]: ExtractedParameter[] })
    : { all: parameters };

  // Render individual parameter control
  const renderControl = (param: ExtractedParameter) => {
    const value = values[param.name];
    const error = errors[param.name];
    const hasRange = param.min !== undefined && param.max !== undefined;

    switch (param.type) {
      case 'numeric':
        return (
          <div className="space-y-2">
            {/* Slider if min/max are defined */}
            {hasRange ? (
              <>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.increment || (param.max! - param.min!) / 100}
                    value={value as number}
                    onChange={e => handleChange(param.name, parseFloat(e.target.value))}
                    disabled={readOnly || isLoading}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer 
                      disabled:opacity-50 disabled:cursor-not-allowed
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:hover:bg-blue-700"
                  />
                  <input
                    type="number"
                    value={value as number}
                    min={param.min}
                    max={param.max}
                    step={param.increment || 'any'}
                    onChange={e => handleChange(param.name, parseFloat(e.target.value) || 0)}
                    disabled={readOnly || isLoading}
                    className="w-24 px-2 py-1 text-sm border rounded-md bg-white
                      focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{param.min}{showUnits && param.unit ? ` ${param.unit}` : ''}</span>
                  <span>{param.max}{showUnits && param.unit ? ` ${param.unit}` : ''}</span>
                </div>
              </>
            ) : (
              /* Numeric input without range */
              <input
                type="number"
                value={value as number}
                step={param.increment || 'any'}
                onChange={e => handleChange(param.name, parseFloat(e.target.value) || 0)}
                disabled={readOnly || isLoading}
                className="w-full px-3 py-2 border rounded-md bg-white
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            )}
            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'enum':
        return (
          <div className="relative">
            <select
              value={value as string}
              onChange={e => handleChange(param.name, e.target.value)}
              disabled={readOnly || isLoading}
              className="w-full px-3 py-2 pr-10 border rounded-md bg-white appearance-none
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {param.options?.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        );

      case 'boolean':
        return (
          <button
            type="button"
            onClick={() => handleChange(param.name, !value)}
            disabled={readOnly || isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${value ? 'bg-blue-600' : 'bg-slate-300'}
              ${readOnly || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${value ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={e => handleChange(param.name, e.target.value)}
            disabled={readOnly || isLoading}
            className="w-full px-3 py-2 border rounded-md bg-white
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        );
    }
  };

  // Get icon for parameter type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'numeric': return <Hash className="w-4 h-4" />;
      case 'enum': return <ChevronDown className="w-4 h-4" />;
      case 'boolean': return <ToggleLeft className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      default: return <Sliders className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-slate-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
              {parameters.length} parameters
            </span>
          </div>
          {isLoading && (
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          )}
        </div>
      </div>

      {/* Parameters */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {Object.entries(groupedParams).map(([group, params]) => (
          <div key={group}>
            {groupByType && group !== 'all' && (
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                {getTypeIcon(group)}
                {group} Parameters
              </h4>
            )}
            <div className="space-y-4">
              {params.map(param => (
                <div key={param.name} className="space-y-1">
                  {/* Label row */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {param.name}
                      {param.isKey && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Key
                        </span>
                      )}
                      {showUnits && param.unit && (
                        <span className="text-xs text-slate-400">({param.unit})</span>
                      )}
                    </label>
                    {param.comment && (
                      <div className="group relative">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute right-0 top-6 z-10 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg 
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                          {param.comment}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Control */}
                  {renderControl(param)}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Submit button */}
        {onSubmit && !readOnly && (
          <div className="pt-4 border-t mt-4">
            <button
              type="submit"
              disabled={isLoading || Object.keys(errors).length > 0}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
                flex items-center justify-center gap-2 transition-colors
                disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {submitLabel}
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * Parameter Preview Card
 * Shows a compact read-only view of parameters
 */
interface ParameterPreviewProps {
  parameters: ExtractedParameter[];
  maxVisible?: number;
}

export function ParameterPreview({ parameters, maxVisible = 5 }: ParameterPreviewProps) {
  const visible = parameters.slice(0, maxVisible);
  const hidden = parameters.length - maxVisible;

  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="space-y-2">
        {visible.map(param => (
          <div key={param.name} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{param.name}</span>
            <span className="font-medium text-slate-900">
              {typeof param.value === 'boolean' 
                ? (param.value ? 'Yes' : 'No')
                : param.value}
              {param.unit && <span className="text-slate-400 ml-1">{param.unit}</span>}
            </span>
          </div>
        ))}
        {hidden > 0 && (
          <div className="text-xs text-slate-400 text-center pt-1 border-t">
            +{hidden} more parameters
          </div>
        )}
      </div>
    </div>
  );
}

export default ParameterEditor;
