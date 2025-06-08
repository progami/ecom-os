'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Tag, 
  Hash, 
  AlertCircle,
  ChevronRight,
  Filter
} from 'lucide-react';

interface CategorizationRule {
  id: string;
  name: string;
  description?: string;
  matchType: string;
  matchField: string;
  matchValue: string;
  accountCode: string;
  taxType: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success: boolean;
  data: CategorizationRule[];
  count: number;
}

export default function BookkeepingRulesPage() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await fetch('/api/v1/bookkeeping/rules');
        if (!response.ok) {
          throw new Error('Failed to fetch rules');
        }
        const data: ApiResponse = await response.json();
        setRules(data.data);
      } catch (error) {
        console.error('Failed to fetch categorization rules:', error);
        setError('Failed to load categorization rules. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  const getMatchTypeLabel = (matchType: string) => {
    const labels: Record<string, string> = {
      contains: 'Contains',
      equals: 'Equals',
      startsWith: 'Starts with',
      endsWith: 'Ends with'
    };
    return labels[matchType] || matchType;
  };

  const getMatchFieldLabel = (matchField: string) => {
    const labels: Record<string, string> = {
      description: 'Description',
      payee: 'Payee',
      reference: 'Reference'
    };
    return labels[matchField] || matchField;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading categorization rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Categorization Rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          View all active rules for automatic transaction categorization in Xero
        </p>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No categorization rules found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              No active rules are configured for transaction categorization.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Found {rules.length} active {rules.length === 1 ? 'rule' : 'rules'}
          </div>
          
          {rules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {rule.name}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Priority: {rule.priority}
                    </span>
                  </div>
                </div>
                {rule.description && (
                  <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <Filter className="w-4 h-4 mr-1" />
                      Matching Criteria
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center text-sm">
                        <span className="text-gray-600 w-20">Field:</span>
                        <span className="font-medium">{getMatchFieldLabel(rule.matchField)}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className="text-gray-600 w-20">Type:</span>
                        <span className="font-medium">{getMatchTypeLabel(rule.matchType)}</span>
                      </div>
                      <div className="flex items-start text-sm">
                        <span className="text-gray-600 w-20">Value:</span>
                        <span className="font-medium font-mono bg-white px-2 py-1 rounded">
                          {rule.matchValue}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <ChevronRight className="w-4 h-4 mr-1" />
                      Categorization Target
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center text-sm">
                        <Hash className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-gray-600 mr-2">Account:</span>
                        <span className="font-medium font-mono">{rule.accountCode}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Tag className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-gray-600 mr-2">Tax Type:</span>
                        <span className="font-medium">{rule.taxType}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t text-xs text-gray-500">
                  Last updated: {new Date(rule.updatedAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}