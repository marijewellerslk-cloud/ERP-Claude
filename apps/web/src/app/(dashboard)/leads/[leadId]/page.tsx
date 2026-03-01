'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Calendar,
  User,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Edit,
  UserPlus,
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: string;
  source?: string;
  leadScore: number;
  enquiryType?: string;
  interestedProducts?: string[];
  budgetRange?: string;
  assignedTo?: string;
  assignedUser?: { firstName: string; lastName: string };
  nextFollowUpDate?: string;
  lastContactedAt?: string;
  totalInteractions: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  direction: string;
  messageType: string;
  messageContent: string;
  sentAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  interested: 'bg-green-100 text-green-800',
  negotiating: 'bg-purple-100 text-purple-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-800',
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.leadId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    stage: '',
    nextFollowUpDate: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch lead details
        const leadRes = await apiClient.get(`/leads/${leadId}`);
        if (leadRes.data.success) {
          const leadData = leadRes.data.data;
          setLead(leadData);
          setFormData({
            stage: leadData.stage,
            nextFollowUpDate: leadData.nextFollowUpDate
              ? new Date(leadData.nextFollowUpDate).toISOString().split('T')[0]
              : '',
            notes: leadData.notes || '',
          });
        }

        // Fetch conversation history
        try {
          const messagesRes = await apiClient.get(`/whatsapp/messages/lead/${leadId}`);
          if (messagesRes.data.success) {
            setMessages(messagesRes.data.data || []);
          }
        } catch (err) {
          console.log('No messages found');
        }
      } catch (error) {
        console.error('Failed to fetch lead:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leadId]);

  const handleUpdate = async () => {
    try {
      setSaving(true);

      const response = await apiClient.put(`/leads/${leadId}`, {
        stage: formData.stage,
        nextFollowUpDate: formData.nextFollowUpDate || null,
        notes: formData.notes,
      });

      if (response.data.success) {
        setLead(response.data.data);
        setEditMode(false);
        alert('Lead updated successfully!');
      }
    } catch (error: any) {
      console.error('Failed to update lead:', error);
      alert(error.response?.data?.error?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = () => {
    router.push(`/customers/new?leadId=${leadId}&name=${lead?.name}&phone=${lead?.phone}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{lead.name || 'Unnamed Lead'}</h1>
              <Badge className={STAGE_COLORS[lead.stage]}>
                {lead.stage.toUpperCase()}
              </Badge>
            </div>
            <p className="text-gray-500">{lead.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditMode(!editMode)}>
            <Edit className="h-4 w-4 mr-2" />
            {editMode ? 'Cancel' : 'Edit'}
          </Button>
          {lead.stage !== 'converted' && (
            <Button onClick={handleConvert} className="bg-green-600 hover:bg-green-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Convert to Customer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Info Card */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Lead Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-medium">{lead.source || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lead Score</p>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <p className="font-medium">{lead.leadScore}/100</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Enquiry Type</p>
                <p className="font-medium">{lead.enquiryType || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Budget Range</p>
                <p className="font-medium">{lead.budgetRange || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Interactions</p>
                <p className="font-medium">{lead.totalInteractions}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned To</p>
                <p className="font-medium">
                  {lead.assignedUser
                    ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}`
                    : 'Unassigned'}
                </p>
              </div>
            </div>

            {lead.interestedProducts && lead.interestedProducts.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Interested In</p>
                <div className="flex flex-wrap gap-2">
                  {lead.interestedProducts.map((product, idx) => (
                    <Badge key={idx} variant="outline">{product}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Edit Form / Status Card */}
          {editMode ? (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Update Lead</h3>
              <div className="space-y-4">
                <div>
                  <Label>Stage</Label>
                  <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="interested">Interested</SelectItem>
                      <SelectItem value="negotiating">Negotiating</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Next Follow-up Date</Label>
                  <Input
                    type="date"
                    value={formData.nextFollowUpDate}
                    onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Input
                    placeholder="Add notes about this lead..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button onClick={handleUpdate} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </Card>
          ) : (
            lead.notes && (
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-gray-600">{lead.notes}</p>
              </Card>
            )
          )}

          {/* Conversation History */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation History
            </h3>
            {messages.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.direction === 'inbound'
                        ? 'bg-gray-100 ml-8'
                        : 'bg-blue-100 mr-8'
                    }`}
                  >
                    <p className="text-sm">{msg.messageContent}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.sentAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Follow-up Card */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Next Follow-up</h3>
            </div>
            {lead.nextFollowUpDate ? (
              <div>
                <p className="text-lg font-medium">
                  {new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(lead.nextFollowUpDate) < new Date() ? (
                    <span className="text-red-600">Overdue</span>
                  ) : (
                    `In ${Math.ceil((new Date(lead.nextFollowUpDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`
                  )}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Not scheduled</p>
            )}
          </Card>

          {/* Last Contact */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">Last Contact</h3>
            </div>
            {lead.lastContactedAt ? (
              <p className="text-sm">
                {new Date(lead.lastContactedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            ) : (
              <p className="text-gray-500">Never contacted</p>
            )}
          </Card>

          {/* Timeline */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated</span>
                <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
