
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, FolderTree, ChevronRight, ChevronDown } from 'lucide-react';

interface CategoryStatistics {
    itemCount: number;
    totalGrossWeight: number;
    totalNetWeight: number;
    totalStoneWeight: number;
    lastMonthSales: number;
    currentMonthSales: number;
}

export interface Category {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    parent?: Category;
    children?: Category[];
    createdAt: string;
    statistics?: CategoryStatistics;
    requiresLength?: boolean;
    requiresWidth?: boolean;
    requiresHeight?: boolean;
    requiresInternalSize?: boolean;
    requiresRingSize?: boolean;
}

interface CategoryTreeItemProps {
    category: Category;
    level: number;
    isSuperAdmin: boolean;
    onEdit: (category: Category) => void;
    onDelete: (categoryId: string) => void;
}

export function CategoryTreeItem({
    category,
    level,
    isSuperAdmin,
    onEdit,
    onDelete
}: CategoryTreeItemProps) {
    const [isExpanded, setIsExpanded] = useState(level < 1); // Expand top level by default
    const hasChildren = category.children && category.children.length > 0;

    return (
        <div className="mb-2">
            <div className={`p-4 bg-white border-l-4 ${level === 0 ? 'border-blue-600 shadow-sm' :
                    level === 1 ? 'border-green-500 ml-8 bg-gray-50' :
                        'border-gray-400 ml-16 bg-gray-100'
                } rounded-lg hover:shadow-md transition`}>
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center">
                            {/* Expand Toggle */}
                            {hasChildren ? (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="mr-2 p-1 hover:bg-gray-200 rounded-full transition"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                    )}
                                </button>
                            ) : (
                                <div className="w-6 mr-2" /> // Spacer
                            )}

                            <div className={`${level > 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                                {level === 0 && <FolderTree className="h-5 w-5" />}
                                {level > 0 && <div className="h-5 w-5 flex items-center">└─</div>}
                            </div>
                        </div>

                        <div>
                            <h3 className={`font-semibold ${level === 0 ? 'text-gray-900 text-base' : 'text-gray-700 text-sm'}`}>
                                {category.name}
                                {hasChildren && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        {category.children!.length} sub
                                    </span>
                                )}
                            </h3>
                            {category.description && (
                                <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isSuperAdmin && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit(category)}
                                >
                                    <Edit2 className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDelete(category.id)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Statistics Row */}
                {category.statistics && isExpanded && (
                    <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t ${level === 0 ? 'border-gray-200' : 'border-gray-300'
                        }`}>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Items</div>
                            <div className="text-lg font-bold text-blue-600">{category.statistics.itemCount}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Gross Weight</div>
                            <div className="text-sm font-semibold text-gray-900">
                                {category.statistics.totalGrossWeight.toFixed(3)}g
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Net Weight</div>
                            <div className="text-sm font-semibold text-gray-900">
                                {category.statistics.totalNetWeight.toFixed(3)}g
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Last Month</div>
                            <div className="text-sm font-semibold text-gray-700">
                                {category.statistics.lastMonthSales > 0
                                    ? `Rs ${category.statistics.lastMonthSales.toLocaleString('en-LK')}`
                                    : '-'
                                }
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">This Month</div>
                            <div className="text-sm font-semibold text-green-600">
                                {category.statistics.currentMonthSales > 0
                                    ? `Rs ${category.statistics.currentMonthSales.toLocaleString('en-LK')}`
                                    : '-'
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className="mt-2">
                    {category.children!.map((child) => (
                        <CategoryTreeItem
                            key={child.id}
                            category={child}
                            level={level + 1}
                            isSuperAdmin={isSuperAdmin}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
