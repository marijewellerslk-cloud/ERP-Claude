'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

const formSchema = z.object({
    expectedTotalWeight: z.string().min(1, 'Expected weight is required'),
    expectedTotalItems: z.string().min(1, 'Expected items count is required'),
    notes: z.string().optional(),
});

interface EditBatchDialogProps {
    batchId: string;
    initialValues: {
        expectedTotalWeight: string;
        expectedTotalItems: number;
        notes?: string;
    };
    onSuccess: () => void;
    trigger?: React.ReactNode;
}

export function EditBatchDialog({
    batchId,
    initialValues,
    onSuccess,
    trigger,
}: EditBatchDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            expectedTotalWeight: initialValues.expectedTotalWeight,
            expectedTotalItems: initialValues.expectedTotalItems.toString(),
            notes: initialValues.notes || '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            const response = await apiClient.put(`/inventory/batches/${batchId}`, {
                expectedTotalWeight: parseFloat(values.expectedTotalWeight),
                expectedTotalItems: parseInt(values.expectedTotalItems),
                notes: values.notes,
            });

            if (response.data.success) {
                setOpen(false);
                onSuccess();
            }
        } catch (error) {
            console.error('Failed to update batch:', error);
            // You might want to show a toast error here
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Details
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Batch Details</DialogTitle>
                    <DialogDescription>
                        Update the expected values for this batch.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="expectedTotalWeight">Expected Total Weight (g)</Label>
                        <Input
                            id="expectedTotalWeight"
                            type="number"
                            step="0.001"
                            {...register('expectedTotalWeight')}
                        />
                        {errors.expectedTotalWeight && (
                            <p className="text-sm text-red-500">{errors.expectedTotalWeight.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expectedTotalItems">Expected Total Items</Label>
                        <Input
                            id="expectedTotalItems"
                            type="number"
                            {...register('expectedTotalItems')}
                        />
                        {errors.expectedTotalItems && (
                            <p className="text-sm text-red-500">{errors.expectedTotalItems.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            {...register('notes')}
                        />
                        {errors.notes && (
                            <p className="text-sm text-red-500">{errors.notes.message}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
