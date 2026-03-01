'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Loader2, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

// Validation Schema matches API
const recordEntrySchema = z.object({
    date: z.string(),
    description: z.string().min(1, 'Description is required'),
    amount: z.string().superRefine((val, ctx) => {
        const parsed = parseFloat(val);
        if (isNaN(parsed) || parsed <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Amount must be positive',
            });
        }
    }),
    type: z.enum(['receipt', 'payment']),
    categoryId: z.string().min(1, 'Category is required'),
});

type RecordEntryFormValues = z.infer<typeof recordEntrySchema>;

interface PettyCashEntry {
    id: string;
    entry: {
        entryDate: string;
        narration: string;
        referenceNumber?: string;
    };
    debitAmount: string;
    creditAmount: string;
    description: string;
}

interface Account {
    id: string;
    accountName: string;
    accountCode: string;
}

export default function PettyCashPage() {
    const [entries, setEntries] = useState<PettyCashEntry[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<RecordEntryFormValues>({
        resolver: zodResolver(recordEntrySchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            amount: '',
            type: 'payment',
            categoryId: '',
        },
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [bookRes, accountsRes] = await Promise.all([
                apiClient.get('/accounting/petty-cash'),
                apiClient.get('/accounting/accounts'),
            ]);

            if (bookRes.data.success) {
                setEntries(bookRes.data.data.entries);
                setBalance(bookRes.data.data.balance);
            }

            if (accountsRes.data.success) {
                setAccounts(accountsRes.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load petty cash book');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (values: RecordEntryFormValues) => {
        try {
            setSubmitting(true);
            const payload = {
                ...values,
                amount: parseFloat(values.amount),
            };

            const res = await apiClient.post('/accounting/petty-cash', payload);

            if (res.data.success) {
                toast.success('Entry recorded successfully');
                setIsDialogOpen(false);
                form.reset({
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    amount: '',
                    type: 'payment',
                    categoryId: '',
                });
                fetchData(); // Refresh data
            }
        } catch (error) {
            console.error('Failed to record entry', error);
            toast.error('Failed to record entry');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter accounts based on type selection
    const filteredAccounts = accounts.filter((acc) => {
        const type = form.watch('type');
        if (type === 'payment') {
            // For payments, show Expenses, Liabilities, Assets (except Petty Cash)
            return (
                acc.accountCode !== '1102' && // Exclude Petty Cash itself
                (acc.accountCode.startsWith('5') || // Expenses
                    acc.accountCode.startsWith('2') || // Liabilities
                    acc.accountCode.startsWith('1'))   // Assets (e.g. Bank)
            );
        } else {
            // For receipts, show Income, Assets, etc.
            return (
                acc.accountCode !== '1102' &&
                (acc.accountCode.startsWith('4') || // Income
                    acc.accountCode.startsWith('1') || // Assets
                    acc.accountCode.startsWith('2'))   // Liabilities/Equity
            );
        }
        // Simplified filtering logic, can be improved based on Chart of Accounts structure
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Petty Cash Book</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Record Entry
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Record Petty Cash Entry</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="payment">Payment (Money Out)</SelectItem>
                                                    <SelectItem value="receipt">Receipt (Money In)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category / Account</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select account" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="max-h-[200px]">
                                                    {filteredAccounts.map((acc) => (
                                                        <SelectItem key={acc.id} value={acc.id}>
                                                            {acc.accountName} ({acc.accountCode})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter details..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Entry
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                        <div className="h-4 w-4 text-muted-foreground">₹</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cash in Hand
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Debit (In)</TableHead>
                                <TableHead>Credit (Out)</TableHead>
                                {/* <TableHead className="text-right">Balance</TableHead> */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No transactions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((item, index) => {
                                    const debit = parseFloat(item.debitAmount);
                                    const credit = parseFloat(item.creditAmount);
                                    return (
                                        <TableRow key={index}>
                                            <TableCell>{format(new Date(item.entry.entryDate), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.description}</div>
                                                <div className="text-xs text-muted-foreground">{item.entry.narration}</div>
                                            </TableCell>
                                            <TableCell className="text-green-600">
                                                {debit > 0 ? `+₹${debit.toLocaleString('en-IN')}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-red-600">
                                                {credit > 0 ? `-₹${credit.toLocaleString('en-IN')}` : '-'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
