
import React from 'react';

interface PageHeaderProps {
    title: string;
    description?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
    return (
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 ${className || ''}`}>
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
                {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
                {children}
            </div>
        </div>
    );
}
