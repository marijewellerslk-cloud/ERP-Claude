
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFieldValue, InventoryItem, SAMPLE_ITEM } from '@/lib/label-utils';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef as useReactRef } from 'react';
import JsBarcode from 'jsbarcode';

// Renders a real barcode SVG for preview
function PreviewBarcode({ value, fontSize }: { value: string; fontSize?: number }) {
    const svgRef = useReactRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'CODE128',
                    width: 1.2,
                    height: 20,
                    displayValue: true,
                    fontSize: fontSize || 8,
                    font: 'monospace',
                    textMargin: 1,
                    margin: 0,
                });
            } catch (e) {
                // Silently handle invalid barcode values in preview
            }
        }
    }, [value, fontSize]);

    if (!value) return null;
    return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />;
}

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

interface LabelTemplate {
    name: string;
    labelWidth: number;
    labelHeight: number;
    showBorder: boolean;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    backgroundColor?: string;
    fields: LabelField[];
    companyName: string;
}

interface LabelPreviewProps {
    template: LabelTemplate;
    sampleItem?: InventoryItem;
    showDieCutGuide?: boolean;
}

export function LabelPreview({ template, sampleItem = SAMPLE_ITEM, showDieCutGuide = false }: LabelPreviewProps) {
    const [scale, setScale] = useState(1);

    const handleZoomIn = () => setScale(Math.min(scale + 0.2, 3));
    const handleZoomOut = () => setScale(Math.max(scale - 0.2, 0.5));
    const handleResetZoom = () => setScale(1);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">Live Preview</CardTitle>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-gray-500 w-12 text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleResetZoom} title="Reset Zoom">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto bg-gray-100 p-8 flex items-center justify-center min-h-[300px]">
                <div
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.2s ease-in-out',
                    }}
                >
                    <div
                        style={{
                            width: `${template.labelWidth}mm`,
                            height: `${template.labelHeight}mm`,
                            position: 'relative',
                            backgroundColor: template.backgroundColor || '#FFFFFF',
                            border: template.showBorder
                                ? `${template.borderWidth || 1}px solid ${template.borderColor || '#000000'}`
                                : '1px dashed #ccc', // Show dashed border if disabled for visualization
                            borderRadius: template.borderRadius ? `${template.borderRadius}px` : '0',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        }}
                    >
                        {showDieCutGuide && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '35mm',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '25.7mm',
                                    height: '21.5mm',
                                    border: '1px dashed #ef4444', // Red dashed line
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red background
                                    pointerEvents: 'none', // Allow clicking through
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <span className="text-[6px] text-red-600 font-medium opacity-70">Print Area</span>
                                <span className="text-[4px] text-red-600 opacity-50">25.7 x 21.5mm</span>
                            </div>
                        )}
                        {template.fields.map((field) => {
                            const fieldValue = field.customText || getFieldValue(sampleItem, field.field, undefined, template.companyName);

                            if (field.type === 'image') {
                                return (
                                    <div
                                        key={field.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}mm`,
                                            top: `${field.y}mm`,
                                            width: field.width ? `${field.width}mm` : 'auto',
                                            height: field.height ? `${field.height}mm` : 'auto',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {field.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={field.imageUrl}
                                                alt="Label Logo"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ) : (
                                            <div className="border border-dashed border-gray-400 w-full h-full flex items-center justify-center text-[8px] text-gray-500 bg-gray-50">
                                                Image
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            if (field.type === 'text') {
                                return (
                                    <div
                                        key={field.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}mm`,
                                            top: `${field.y}mm`,
                                            width: field.width ? `${field.width}mm` : 'auto',
                                            height: field.height ? `${field.height}mm` : 'auto',
                                            fontSize: field.fontSize ? `${field.fontSize}pt` : '10pt',
                                            fontFamily: field.fontFamily || 'Arial',
                                            fontWeight: field.fontWeight || 'normal',
                                            textAlign: (field.textAlign as any) || 'left',
                                            color: field.color || '#000000',
                                            backgroundColor: field.backgroundColor || 'transparent',
                                            border: field.borderWidth
                                                ? `${field.borderWidth}px solid ${field.borderColor || '#000000'}`
                                                : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {field.label && <span>{field.label} </span>}
                                        <span>{fieldValue}</span>
                                    </div>
                                );
                            }

                            if (field.type === 'barcode') {
                                return (
                                    <div
                                        key={field.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}mm`,
                                            top: `${field.y}mm`,
                                            width: field.width ? `${field.width}mm` : '30mm',
                                            height: field.height ? `${field.height}mm` : '10mm',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <PreviewBarcode value={fieldValue} fontSize={field.fontSize} />
                                    </div>
                                );
                            }

                            if (field.type === 'line') {
                                return (
                                    <div
                                        key={field.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}mm`,
                                            top: `${field.y}mm`,
                                            width: field.width ? `${field.width}mm` : '100%',
                                            height: `${field.borderWidth || 1}px`,
                                            backgroundColor: field.borderColor || field.color || '#000000',
                                        }}
                                    />
                                );
                            }

                            if (field.type === 'rectangle') {
                                return (
                                    <div
                                        key={field.id}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}mm`,
                                            top: `${field.y}mm`,
                                            width: field.width ? `${field.width}mm` : '10mm',
                                            height: field.height ? `${field.height}mm` : '10mm',
                                            backgroundColor: field.backgroundColor || 'transparent',
                                            border: field.borderWidth
                                                ? `${field.borderWidth}px solid ${field.borderColor || '#000000'}`
                                                : '1px solid #000000',
                                        }}
                                    />
                                );
                            }

                            return null;
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
