"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import heic2any from "heic2any";
import { toast } from "sonner";

interface ImageUploadProps {
    value?: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
    maxFiles?: number;
}

export function ImageUpload({
    value = [],
    onChange,
    disabled = false,
    maxFiles = 5,
}: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            await processFiles(files);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            await processFiles(files);
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const processFiles = async (files: File[]) => {
        const remainingSlots = maxFiles - value.length;

        if (remainingSlots <= 0) {
            toast.error(`You can only upload up to ${maxFiles} images`);
            return;
        }

        const filesToProcess = files.slice(0, remainingSlots);
        if (files.length > remainingSlots) {
            toast.warning(`Only processing first ${remainingSlots} files due to limit`);
        }

        setIsUploading(true);
        const newUrls: string[] = [];

        try {
            for (const file of filesToProcess) {
                let fileToUpload = file;

                // Basic check for image type
                if (!file.type.startsWith('image/')) {
                    toast.error(`Skipping non-image file: ${file.name}`);
                    continue;
                }

                // Check for HEIC/HEIF
                if (
                    file.type === "image/heic" ||
                    file.type === "image/heif" ||
                    file.name.toLowerCase().endsWith(".heic") ||
                    file.name.toLowerCase().endsWith(".heif")
                ) {
                    try {
                        toast.info(`Converting HEIC image: ${file.name}...`);
                        // @ts-ignore - heic2any types might be tricky with basic import
                        const convertedBlob = await heic2any({
                            blob: file,
                            toType: "image/jpeg",
                            quality: 0.8,
                        });

                        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

                        fileToUpload = new File(
                            [blob],
                            file.name.replace(/\.(heic|heif)$/i, ".jpg"),
                            { type: "image/jpeg" }
                        );
                    } catch (err) {
                        console.error("HEIC conversion failed:", err);
                        toast.error(`Failed to process HEIC image: ${file.name}`);
                        continue;
                    }
                }

                // Upload to server
                const formData = new FormData();
                formData.append("file", fileToUpload);
                formData.append("folder", "inventory");

                try {
                    const response = await apiClient.post("/upload/image", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });

                    if (response.data.success) {
                        newUrls.push(response.data.data.url);
                    }
                } catch (err) {
                    console.error("Upload failed:", err);
                    toast.error(`Failed to upload image: ${file.name}`);
                }
            }

            if (newUrls.length > 0) {
                onChange([...value, ...newUrls]);
                toast.success(`Successfully uploaded ${newUrls.length} image(s)`);
            }
        } catch (error) {
            console.error("Error processing files:", error);
            toast.error("An error occurred while uploading images");
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddUrl = () => {
        if (!urlInput.trim()) return;

        if (value.length >= maxFiles) {
            toast.error(`You can only have up to ${maxFiles} images`);
            return;
        }

        try {
            // Simple validation
            new URL(urlInput);
            onChange([...value, urlInput.trim()]);
            setUrlInput("");
            toast.success("Image URL added");
        } catch {
            toast.error("Please enter a valid URL");
        }
    };

    const removeImage = (indexToRemove: number) => {
        onChange(value.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="space-y-4">
            {/* Image Grid */}
            {value.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {value.map((url, index) => (
                        <div key={index} className="relative group aspect-square rounded-lg border overflow-hidden bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={`Product image ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                disabled={disabled}
                                className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Area */}
            {value.length < maxFiles && (
                <div className="space-y-4">
                    {/* Drag and Drop Zone */}
                    <div
                        onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all duration-200",
                            isDragging
                                ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                                : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/50",
                            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
                            !disabled && "cursor-pointer"
                        )}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp, .heic, .heif"
                            multiple
                            onChange={handleFileSelect}
                            disabled={disabled || isUploading}
                        />

                        {isUploading ? (
                            <div className="flex flex-col items-center py-2 text-blue-600">
                                <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                <p className="font-medium">Processing & Uploading...</p>
                                <p className="text-xs text-muted-foreground mt-1">Converting HEIC images may take a moment</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-2">
                                <div className="p-3 bg-blue-50 rounded-full mb-3 text-blue-600">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <p className="font-medium text-gray-900 mb-1">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 max-w-xs">
                                    Supports JPG, PNG, WEBP, and HEIC (iPhone)
                                    <br />
                                    Max {maxFiles} images
                                </p>
                            </div>
                        )}
                    </div>

                    {/* URL Input */}
                    <div className="flex gap-2">
                        <Input
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="Or paste an image URL..."
                            disabled={disabled || isUploading}
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddUrl();
                                }
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddUrl}
                            disabled={disabled || isUploading || !urlInput.trim()}
                        >
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Add URL
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
