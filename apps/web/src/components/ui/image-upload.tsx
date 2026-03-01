'use client';

import { useState, useRef } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    onRemove: () => void;
    label?: string;
    folder?: string;
    disabled?: boolean;
    className?: string;
}

export function ImageUpload({
    value,
    onChange,
    onRemove,
    label = 'Image',
    folder = 'misc',
    disabled,
    className,
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset error
        setError(null);

        // Validate type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

            const response = await apiClient.post('/upload/image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                // Construct full URL if needed, but backend returns relative or full depending on config
                // Assuming backend returns relative path for local, or full for S3
                let url = response.data.data.url;

                // If it starts with /api/static, we need to make sure we prepend the API URL if we are on a different domain
                // explicit handling:
                if (url.startsWith('/api/static')) {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
                    // Remove /api/v1 from the end if it exists to get the base
                    const baseUrl = apiUrl.replace('/api/v1', '');
                    url = `${baseUrl}${url}`;
                }

                onChange(url);
            }
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.error || 'Failed to upload image');
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className={`space-y-4 w-full flex flex-col justify-center items-center ${className}`}>
            {label && <Label className="self-start">{label}</Label>}

            {value ? (
                <div className="relative rounded-md overflow-hidden aspect-square w-40 h-40 border border-gray-200 shadow-sm bg-gray-50 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={value}
                        alt="Upload"
                        className="object-cover w-full h-full"
                    />
                    <button
                        onClick={onRemove}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow-sm"
                        type="button"
                        disabled={disabled}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    className={`
                border-2 border-dashed border-gray-300 rounded-md 
                hover:opacity-75 transition 
                flex flex-col items-center justify-center gap-2 
                cursor-pointer 
                w-40 h-40
                bg-gray-50
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${error ? 'border-red-500 bg-red-50' : ''}
            `}
                >
                    {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    ) : (
                        <>
                            <Upload className="h-8 w-8 text-gray-400" />
                            <div className="text-xs text-gray-500 font-medium">Click to upload</div>
                        </>
                    )}
                </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled || isUploading}
            />
        </div>
    );
}
