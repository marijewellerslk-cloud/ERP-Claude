"use client"

import * as React from "react"
import { Check, ChevronsUpDown, ChevronRight, ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Category {
    id: string
    name: string
    parentId?: string
    children?: Category[]
}

interface CategorySelectorProps {
    categories: Category[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export function CategorySelector({
    categories,
    value,
    onChange,
    placeholder = "Select category...",
    disabled = false,
    className,
}: CategorySelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    const { tree, flattenCategories } = React.useMemo(() => {
        // Build the tree
        const categoryMap = new Map<string, Category>()
        // distinct copies for tree building to avoid mutating original props if they are reused
        const nodes: Category[] = categories.map(c => ({ ...c, children: [] }))

        nodes.forEach(node => categoryMap.set(node.id, node))

        const rootNodes: Category[] = []

        nodes.forEach(node => {
            if (node.parentId && categoryMap.has(node.parentId)) {
                categoryMap.get(node.parentId)!.children!.push(node)
            } else {
                rootNodes.push(node)
            }
        })

        // Build flattened list for search
        const flattened: { id: string; name: string; label: string }[] = []
        const processCategory = (cat: Category, parentNames: string[] = []) => {
            const currentLabel = [...parentNames, cat.name].join(" > ")
            flattened.push({
                id: cat.id,
                name: cat.name,
                label: currentLabel,
            })
            if (cat.children) {
                cat.children.forEach(child => processCategory(child, [...parentNames, cat.name]))
            }
        }
        rootNodes.forEach(root => processCategory(root))

        return { tree: rootNodes, flattenCategories: flattened.sort((a, b) => a.label.localeCompare(b.label)) }
    }, [categories])

    const selectedCategory = flattenCategories.find((c) => c.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                    disabled={disabled}
                >
                    {selectedCategory ? selectedCategory.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search category..."
                        onChange={(e) => setQuery(e.target.value)}
                        value={query}
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto p-1">
                    {query.length === 0 ? (
                        // Tree View
                        <div className="space-y-1">
                            {tree.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No categories found.</div>}
                            {tree.map(node => (
                                <CategoryTreeNode
                                    key={node.id}
                                    node={node}
                                    selectedId={value}
                                    onSelect={(id) => {
                                        onChange(id === value ? "" : id)
                                        setOpen(false)
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        // Search Results (Flat List)
                        <div className="space-y-1">
                            {(() => {
                                const filtered = flattenCategories.filter(c =>
                                    c.label.toLowerCase().includes(query.toLowerCase())
                                )
                                if (filtered.length === 0) {
                                    return <div className="py-6 text-center text-sm text-muted-foreground">No category found.</div>
                                }
                                return filtered.map(category => (
                                    <div
                                        key={category.id}
                                        className={cn(
                                            "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                            category.id === value && "bg-accent text-accent-foreground"
                                        )}
                                        onClick={() => {
                                            onChange(category.id === value ? "" : category.id)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === category.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {category.label}
                                    </div>
                                ))
                            })()}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface CategoryTreeNodeProps {
    node: Category
    selectedId?: string
    onSelect: (id: string) => void
    level?: number
}

function CategoryTreeNode({ node, selectedId, onSelect, level = 0 }: CategoryTreeNodeProps) {
    // Auto-expand if a child is selected or if it's top-level
    const hasChildren = node.children && node.children.length > 0
    // Check if any descendant is selected
    const isDescendantSelected = React.useMemo(() => {
        if (!selectedId || !hasChildren) return false;
        const check = (n: Category): boolean => {
            if (n.id === selectedId) return true;
            return n.children ? n.children.some(check) : false;
        }
        return node.children!.some(check);
    }, [node, selectedId, hasChildren]);

    const [expanded, setExpanded] = React.useState(level === 0 || isDescendantSelected)

    React.useEffect(() => {
        if (isDescendantSelected) setExpanded(true);
    }, [isDescendantSelected]);

    return (
        <div>
            <div
                className={cn(
                    "flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent/50 cursor-pointer select-none",
                    selectedId === node.id && "bg-accent text-accent-foreground font-medium"
                )}
                style={{ paddingLeft: `${(level * 12) + 8}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.id);
                }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className="mr-1 p-0.5 hover:bg-accent rounded-sm opacity-60 hover:opacity-100"
                    >
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                ) : (
                    <span className="w-4 mr-1" /> // Spacer
                )}
                <span className="truncate">{node.name}</span>
                {selectedId === node.id && <Check className="ml-auto h-3 w-3 opacity-100" />}
            </div>

            {hasChildren && expanded && (
                <div className="border-l ml-[calc(8px+6px)] border-border/40">
                    {node.children!.map(child => (
                        <CategoryTreeNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
