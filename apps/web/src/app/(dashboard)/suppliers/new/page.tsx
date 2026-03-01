'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

export default function NewSupplierPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    category: 'wholesaler',
    paymentTerms: '0',
    notes: '',
    contacts: [] as { name: string; phone: string; designation: string; email: string; isPrimary: boolean }[],
  });

  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    designation: '',
    email: '',
    isPrimary: false,
  });

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
      const response = await apiClient.post('/suppliers', {
        businessName: formData.name,
        contactPersonName: formData.contactPerson || null,
        email: formData.email || null,
        phone: formData.phone,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        gstNumber: formData.gstNumber || null,
        supplierType: formData.category,
        defaultCreditDays: parseInt(formData.paymentTerms) || 0,
        notes: formData.notes || null,
        contacts: formData.contacts.map(c => ({
          ...c,
          designation: c.designation || null,
          email: c.email || null,
        })),
      });

      if (response.data.success) {
        router.push('/suppliers/list');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error?.message || 'Failed to create supplier. Please try again.';
      if (err.response?.data?.errors) {
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
        <Link href="/suppliers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Supplier</h1>
          <p className="text-gray-500 mt-1">Register a new supplier in the system</p>
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
                    placeholder="Enter supplier name"
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
                    placeholder="Enter contact person name"
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
                    placeholder="supplier@example.com"
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
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="wholesaler">Wholesaler</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="artisan">Artisan</option>
                    <option value="broker">Broker</option>
                    <option value="other">Other</option>
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
                    placeholder="123456789-0000"
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
                    placeholder="Street address"
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
                    placeholder="City"
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
                    placeholder="State"
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
                    placeholder="00700"
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
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Credit Period (days)</label>
                  <input
                    type="number"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 30"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of days until payment is due (0 for immediate payment)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes about the supplier"
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
                {isLoading ? 'Creating...' : 'Create Supplier'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
