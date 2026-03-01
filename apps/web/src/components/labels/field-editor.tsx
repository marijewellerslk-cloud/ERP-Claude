'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface LabelField {
    id: string;
    type: 'text' | 'barcode' | 'qr' | 'line' | 'rectangle' | 'image';
    field?: string;
    label?: string;
    customText?: string;
    imageUrl?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    textAlign?: string;
    color?: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
}

interface FieldEditorProps {
    fields: LabelField[];
    onChange: (fields: LabelField[]) => void;
    labelWidth: number;
    labelHeight: number;
}

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'barcode', label: 'Barcode' },
    { value: 'image', label: 'Image / Logo' },
    { value: 'line', label: 'Line' },
    { value: 'rectangle', label: 'Rectangle' },
];

const DATA_FIELDS = [
    { value: 'sku', label: 'SKU' },
    { value: 'name', label: 'Product Name' },
    { value: 'grossWeight', label: 'Gross Weight' },
    { value: 'netWeight', label: 'Net Weight' },
    { value: 'stoneWeight', label: 'Stone Weight' },
    { value: 'metalType', label: 'Metal Type' },
    { value: 'purity', label: 'Purity' },
    { value: 'branch', label: 'Branch' },
    { value: 'countryOfOrigin', label: 'Country of Origin' },
    { value: 'gemType', label: 'Gem Type' },
    { value: 'gemWeight', label: 'Gem Weight' },
    { value: 'gemWeight', label: 'Gem Weight' },
    { value: 'costPrice', label: 'Cost Rate' },
    { value: 'costRatePercentage', label: 'Rate % (Value)' },
    { value: 'makingCharges', label: 'Making Charges' },
    { value: 'size', label: 'Size' },
    { value: 'companyName', label: 'Company Name' },
    { value: 'custom', label: 'Custom Text' },
];

export function FieldEditor({ fields, onChange, labelWidth, labelHeight }: FieldEditorProps) {
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    const addField = () => {
        const newField: LabelField = {
            id: crypto.randomUUID(),
            type: 'text',
            field: 'name',
            x: 0,
            y: 0,
            width: Math.min(30, labelWidth),
            height: Math.min(8, labelHeight),
            fontSize: 10,
            color: '#000000',
        };
        onChange([...fields, newField]);
        setActiveFieldId(newField.id);
    };

    const removeField = (id: string) => {
        onChange(fields.filter((f) => f.id !== id));
        if (activeFieldId === id) setActiveFieldId(null);
    };

    const updateField = (id: string, updates: Partial<LabelField>) => {
        onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    };

    const activeField = fields.find((f) => f.id === activeFieldId);

    return (
        <div className="grid grid-cols-12 gap-6">
            {/* Field List */}
            <div className="col-span-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Fields</h3>
                    <Button size="sm" onClick={addField}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                    </Button>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {fields.map((field) => (
                        <div
                            key={field.id}
                            className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${activeFieldId === field.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                            onClick={() => setActiveFieldId(field.id)}
                        >
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                    {field.type === 'text'
                                        ? field.customText || DATA_FIELDS.find((f) => f.value === field.field)?.label || 'Text Field'
                                        : field.type.charAt(0).toUpperCase() + field.type.slice(1)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    X: {field.x}mm, Y: {field.y}mm
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeField(field.id);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {fields.length === 0 && (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                            <p>No fields added yet</p>
                            <Button variant="link" onClick={addField}>
                                Add your first field
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Field Editor */}
            <div className="col-span-8">
                {activeField ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Edit Field</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Type</Label>
                                    <Select
                                        value={activeField.type}
                                        onValueChange={(value: any) => updateField(activeField.id, { type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FIELD_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {activeField.type === 'text' && (
                                    <div>
                                        <Label>Data Source</Label>
                                        <Select
                                            value={activeField.field}
                                            onValueChange={(value) => updateField(activeField.id, { field: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DATA_FIELDS.map((f) => (
                                                    <SelectItem key={f.value} value={f.value}>
                                                        {f.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {activeField.type === 'text' && activeField.field === 'custom' && (
                                <div>
                                    <Label>Custom Text</Label>
                                    <Input
                                        value={activeField.customText || ''}
                                        onChange={(e) => updateField(activeField.id, { customText: e.target.value })}
                                    />
                                </div>
                            )}

                            {activeField.type === 'image' && (
                                <div>
                                    <Label>Image URL (Logo)</Label>
                                    <Input
                                        value={activeField.imageUrl || ''}
                                        onChange={(e) => updateField(activeField.id, { imageUrl: e.target.value })}
                                        placeholder="https://example.com/logo.png"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Enter a direct URL to your logo image.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <Label>X (mm)</Label>
                                    <Input
                                        type="number"
                                        value={activeField.x}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateField(activeField.id, { x: isNaN(val) ? 0 : val });
                                        }}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <Label>Y (mm)</Label>
                                    <Input
                                        type="number"
                                        value={activeField.y}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateField(activeField.id, { y: isNaN(val) ? 0 : val });
                                        }}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <Label>Width (mm)</Label>
                                    <Input
                                        type="number"
                                        value={activeField.width || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateField(activeField.id, { width: isNaN(val) ? undefined : val });
                                        }}
                                        step="0.1"
                                        placeholder="Auto"
                                    />
                                </div>
                                <div>
                                    <Label>Height (mm)</Label>
                                    <Input
                                        type="number"
                                        value={activeField.height || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateField(activeField.id, { height: isNaN(val) ? undefined : val });
                                        }}
                                        step="0.1"
                                        placeholder="Auto"
                                    />
                                </div>
                            </div>

                            {activeField.type === 'text' && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Font Size (pt)</Label>
                                        <Input
                                            type="number"
                                            value={activeField.fontSize || 10}
                                            onChange={(e) =>
                                                updateField(activeField.id, { fontSize: parseFloat(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label>Font Weight</Label>
                                        <Select
                                            value={activeField.fontWeight || 'normal'}
                                            onValueChange={(value) => updateField(activeField.id, { fontWeight: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="normal">Normal</SelectItem>
                                                <SelectItem value="bold">Bold</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Align</Label>
                                        <Select
                                            value={activeField.textAlign || 'left'}
                                            onValueChange={(value) => updateField(activeField.id, { textAlign: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Left</SelectItem>
                                                <SelectItem value="center">Center</SelectItem>
                                                <SelectItem value="right">Right</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed">
                        <p className="text-gray-500">Select a field to edit properties</p>
                    </div>
                )}
            </div>
        </div>
    );
}
