'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import {
  Plus,
  Users,
  Phone,
  MessageSquare,
  Calendar,
  TrendingUp,
  Filter,
  Search,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

interface Lead {
  id: string;
  name?: string;
  phone: string;
  stage: string;
  source?: string;
  score: number;
  enquiryType?: string;
  budgetRange?: string;
  assignedTo?: string;
  assignedUser?: { firstName: string; lastName: string };
  lastContactedAt?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PipelineStats {
  new: number;
  contacted: number;
  interested: number;
  negotiating: number;
  converted: number;
  lost: number;
}

interface LeadStats {
  totalLeads: number;
  conversionRate: number;
  avgTimeToConvert: number;
  todayFollowUps: number;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  interested: 'bg-green-100 text-green-800 border-green-200',
  negotiating: 'bg-purple-100 text-purple-800 border-purple-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-gray-100 text-gray-800 border-gray-200',
};

const STAGE_ICONS: Record<string, typeof Users> = {
  new: UserPlus,
  contacted: Phone,
  interested: TrendingUp,
  negotiating: MessageSquare,
  converted: CheckCircle,
  lost: XCircle,
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(null);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch leads
        const leadsRes = await apiClient.get('/leads', {
          params: {
            stage: stageFilter !== 'all' ? stageFilter : undefined,
            search: searchQuery || undefined,
          },
        });
        if (leadsRes.data.success) {
          setLeads(leadsRes.data.data || []);
        }

        // Fetch pipeline stats
        const pipelineRes = await apiClient.get('/leads/pipeline');
        if (pipelineRes.data.success) {
          setPipeline(pipelineRes.data.data);
        }

        // Fetch lead stats
        const statsRes = await apiClient.get('/leads/stats');
        if (statsRes.data.success) {
          setStats(statsRes.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stageFilter, searchQuery]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const isOverdue = (followUpDate?: string) => {
    if (!followUpDate) return false;
    return new Date(followUpDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <p className="text-gray-500 mt-1">Track and convert WhatsApp enquiries</p>
        </div>
        <Link href="/leads/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Leads</p>
              <p className="text-2xl font-bold">{stats?.totalLeads || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-bold">{stats?.conversionRate?.toFixed(1) || 0}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Time to Convert</p>
              <p className="text-2xl font-bold">{stats?.avgTimeToConvert || 0} days</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today&apos;s Follow-ups</p>
              <p className="text-2xl font-bold">{stats?.todayFollowUps || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Pipeline View */}
      {pipeline && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Sales Pipeline</h3>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(pipeline).map(([stage, count]) => {
              const StageIcon = STAGE_ICONS[stage] || Users;
              return (
                <div
                  key={stage}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    STAGE_COLORS[stage]
                  } ${stageFilter === stage ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  onClick={() => setStageFilter(stage === stageFilter ? 'all' : stage)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <StageIcon className="h-4 w-4" />
                    <span className="text-xs font-medium capitalize">{stage}</span>
                  </div>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="negotiating">Negotiating</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : leads.length > 0 ? (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`}>
              <Card className="p-4 hover:bg-gray-50 cursor-pointer transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{lead.name || lead.phone}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Phone className="h-3 w-3" />
                        <span>{lead.phone}</span>
                        {lead.source && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{lead.source}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Score */}
                    <div className="text-center">
                      <p className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                        {lead.score}
                      </p>
                      <p className="text-xs text-gray-500">Score</p>
                    </div>

                    {/* Follow-up indicator */}
                    {lead.nextFollowUpDate && (
                      <div className={`flex items-center gap-1 text-sm ${
                        isOverdue(lead.nextFollowUpDate) ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {isOverdue(lead.nextFollowUpDate) ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                        <span>
                          {new Date(lead.nextFollowUpDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Stage badge */}
                    <Badge className={STAGE_COLORS[lead.stage]}>
                      {lead.stage}
                    </Badge>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* Additional info */}
                <div className="flex gap-4 mt-3 ml-14 text-sm text-gray-500">
                  {lead.enquiryType && (
                    <span className="capitalize">{lead.enquiryType.replace(/_/g, ' ')}</span>
                  )}
                  {lead.budgetRange && (
                    <span className="capitalize">{lead.budgetRange.replace(/_/g, ' ')} budget</span>
                  )}
                  {lead.assignedUser && (
                    <span>
                      Assigned: {lead.assignedUser.firstName} {lead.assignedUser.lastName}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No leads found</p>
          <p className="text-sm text-gray-400 mt-1">
            {stageFilter !== 'all'
              ? 'Try changing your filter'
              : 'WhatsApp enquiries will appear here'}
          </p>
        </Card>
      )}
    </div>
  );
}
