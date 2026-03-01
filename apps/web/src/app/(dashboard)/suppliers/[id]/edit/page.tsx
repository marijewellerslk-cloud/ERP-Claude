'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [formData, setFormData] = useState({
    name: 'Gold Suppliers Ltd',
    contactPerson: 'John Doe',
    email: 'john@goldsuppliers.com',
    phone: '+94 77 123 4567',
    address: '123 Galle Road',
    city: 'Colombo',
    state: 'Western Province',
    pincode: '00700',
    gstNumber: '123456789-0000',
    panNumber: '',
    category: 'Gold',
    paymentTerms: 'Net 30',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    creditLimit: '0',
    notes: 'Reliable gold supplier',
    contacts: [] as { id?: string; name: string; phone: string; designation: string; email: string; isPrimary: boolean }[],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    designation: '',
    email: '',
    isPrimary: false,
  });

  useEffect(() => {
    fetchSupplier();
  }, [supplierId]);

  const fetchSupplier = async () => {
    try {
      const response = await apiClient.get(`/suppliers/${supplierId}`);
      if (response.data.success) {
        const supplier = response.data.data;
        setFormData({
          name: supplier.businessName,
          contactPerson: supplier.contactPersonName || '',
          email: supplier.email || '',
          phone: supplier.phone,
          address: supplier.address || '',
          city: supplier.city || '',
          state: supplier.state || '',
          pincode: supplier.pincode || '',
          gstNumber: supplier.gstNumber || '',
          panNumber: supplier.panNumber || '',
          category: supplier.supplierType || 'wholesaler',
          paymentTerms: supplier.defaultCreditDays?.toString() || '0',
          bankName: supplier.bankName || '',
          accountNumber: supplier.accountNumber || '',
          ifscCode: supplier.ifscCode || '',
          upiId: supplier.upiId || '',
          creditLimit: supplier.creditLimit?.toString() || '0',
          notes: supplier.notes || '',
          contacts: supplier.contacts?.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            designation: c.designation || '',
            email: c.email || '',
            isPrimary: c.isPrimary
          })) || [],
        });
      }
    } catch (error: any) {
      setError(error.response?.data?.error?.message || 'Failed to load supplier details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = () => {
    if (!newContact.name || !newContact.phone) return;

    setFormData({
      ...formData,
      contacts: [...formData.contacts, newContact]
    });

    setNewContact({
      name: '',
      phone: '',
      designation: '',
      email: '',
      isPrimary: false,
    });
  };

  const handleRemoveContact = (index: number) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts.splice(index, 1);
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.patch(`/suppliers/${supplierId}`, {
        businessName: formData.name,
        contactPersonName: formData.contactPerson || null,
        email: formData.email || null,
        phone: formData.phone,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        gstNumber: formData.gstNumber || null,
        panNumber: formData.panNumber || null,
        supplierType: formData.category,
        defaultCreditDays: parseInt(formData.paymentTerms) || 0,
        bankName: formData.bankName || null,
        accountNumber: formData.accountNumber || null,
        ifscCode: formData.ifscCode || null,
        upiId: formData.upiId || null,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        notes: formData.notes || null,
        contacts: formData.contacts.map(c => ({
          ...c,
          designation: c.designation || null,
          email: c.email || null, // Allow clearing email
        })),
      });

      if (response.data.success) {
        router.push('/suppliers/list');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error?.message || 'Failed to update supplier. Please try again.';
      if (err.response?.data?.errors) {
        // Optionally format validation errors, but for now just show the main message
        console.log(err.response.data.errors);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers/list">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Supplier</h1>
          <p className="text-gray-500 mt-1">Update supplier information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    required
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Diamonds">Diamonds</option>
                    <option value="Gemstones">Gemstones</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Tools">Tools</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Address Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Contact Persons */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Additional Contact Persons</h2>

              {/* List of added contacts */}
              {formData.contacts.length > 0 && (
                <div className="mb-4 space-y-2">
                  {formData.contacts.map((contact, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border text-sm">
                      <div>
                        <span className="font-medium">{contact.name}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span>{contact.phone}</span>
                        {contact.designation && <span className="text-gray-500 mx-2">({contact.designation})</span>}
                        {contact.isPrimary && <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Primary</span>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                        onClick={() => handleRemoveContact(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new contact inputs */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 p-3 rounded-md border border-dashed">
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Name</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Name"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                  <input
                    type="text"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Phone"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Designation</label>
                  <input
                    type="text"
                    value={newContact.designation}
                    onChange={(e) => setNewContact({ ...newContact, designation: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Role"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input
                    type="text"
                    value={newContact.email}
                    onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Email"
                  />
                </div>
                <div className="md:col-span-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddContact}
                    disabled={!newContact.name || !newContact.phone}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/suppliers/list">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Supplier'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
